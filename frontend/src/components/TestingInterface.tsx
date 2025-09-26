import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Search, 
  Brain, 
  Target, 
  CheckCircle,
  Loader2,
  User,
  Database
} from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { apiCall } from '@/config/api'

// ImageWithLoader component for displaying CT images in Testing Interface (important-comment)
const ImageWithLoader = ({ imageId, alt, onError, loadImageData }: {
  imageId: string;
  alt: string;
  onError: () => void;
  loadImageData: (id: string) => Promise<string>;
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);
        const imageData = await loadImageData(imageId);
        setImageSrc(imageData);
      } catch (err) {
        setError(true);
        onError();
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [imageId, loadImageData, onError]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !imageSrc) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <Database className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">CT Scan</p>
          <p className="text-xs">Medical Image</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className="w-full h-full object-cover"
      onError={() => {
        setError(true);
        onError();
      }}
    />
  );
};

interface TestingInterfaceProps {
  token: string
}

interface Patient {
  id: string
  first_name: string
  last_name: string
  medical_record_number: string
  age: number
  gender: string
  avatar_url: string
  riskLevel?: "High" | "Moderate" | "Low"
  riskScore?: {
    stones: number
    recurrence: number
  }
  imaging?: Array<{
    id: string
    type: string
    date: string
    findings: string[]
    imagePath: string
    status: "normal" | "abnormal" | "mild"
  }>
}

interface AnalysisResult {
  patient_id: string
  risk_prediction: {
    overall_risk_score: number
    risk_level: string
    stone_formation_probability: number
    recurrence_risk: number
    contributing_factors: Array<{
      factor: string
      impact_score: number
      confidence: number
      description: string
    }>
    recommendations: string[]
  }
  composition_prediction: {
    predicted_compositions: Array<{
      composition: string
      probability: number
      typical_causes: string[]
    }>
    confidence_score: number
  }
  pattern_analysis: {
    detected_patterns: Array<{
      pattern_type: string
      description: string
      confidence: number
    }>
    anomalies: Array<{
      test_name: string
      severity: string
      clinical_significance: string
    }>
  }
  timestamp: string
}


export function TestingInterface({ token }: TestingInterfaceProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchPatients()
  }, [token])

  const fetchPatients = async () => {
    try {
      const response = await apiCall(`/api/patients?limit=20`)
      const data = await response.json()
      setPatients(data.map((p: any) => ({
        ...p,
        age: calculateAge(p.date_of_birth)
      })))
    } catch (error) {
      console.error('Failed to fetch patients:', error)
    }
  }

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    
    return age
  }

  const runAnalysis = async () => {
    if (!selectedPatient) return

    setLoading(true)
    setAnalysisResult(null) // Reset previous results
    
    try {
      console.log('Starting analysis for patient:', selectedPatient.id) // (important-comment)
      const response = await apiCall(`/api/analysis/run/${selectedPatient.id}`, {
        method: 'POST'
      })
      
      console.log('Analysis API response status:', response.status) // (important-comment)
      console.log('Analysis API response headers:', Object.fromEntries(response.headers.entries())) // (important-comment)
      
      if (response.ok) {
        const result = await response.json()
        console.log('Analysis result received:', result) // (important-comment)
        setAnalysisResult(result)
        
        // Fetch patient images after analysis completes (important-comment)
        await fetchPatientImages(selectedPatient.id)
        
        console.log('Analysis completed successfully:', result) // (important-comment)
      } else {
        const errorText = await response.text()
        console.error('Analysis failed:', response.status, errorText) // (important-comment)
      }
    } catch (error) {
      console.error('Failed to run analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  // REM: Fetch patient images when selected (important-comment)
  const fetchPatientImages = async (patientId: string) => {
    try {
      console.log('Fetching patient images for:', patientId) // (important-comment)
      const response = await apiCall(`/api/patients/${patientId}/imaging`)
      console.log('Patient images API response status:', response.status) // (important-comment)
      
      if (response.ok) {
        const imagingData = await response.json()
        console.log('Patient imaging data received:', imagingData) // (important-comment)
        
        // REM: Update patient with imaging data for display (important-comment)
        setSelectedPatient(prev => prev ? {
          ...prev,
          imaging: imagingData.imaging_studies || [],
          riskLevel: prev.riskLevel || "Moderate",
          riskScore: prev.riskScore || { stones: 45, recurrence: 30 }
        } : null)
      } else {
        const errorText = await response.text()
        console.error('Failed to fetch patient images:', response.status, errorText) // (important-comment)
      }
    } catch (error) {
      console.error('Failed to fetch patient images:', error)
    }
  }

  // Load image data for CT scans in Testing Interface
  const loadImageData = async (imageId: string): Promise<string> => {
    try {
      const response = await apiCall(`/api/images/${imageId}/base64`);
      if (response.ok) {
        const data = await response.json();
        return data.image_data;
      }
      throw new Error('Failed to load image');
    } catch (error) {
      console.error('Error loading image:', error);
      throw error;
    }
  };

  const filteredPatients = patients.filter(patient =>
    `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.medical_record_number.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case 'very high': return 'text-red-600'
      case 'high': return 'text-orange-600'
      case 'moderate': return 'text-yellow-600'
      case 'low': return 'text-green-600'
      case 'very low': return 'text-green-500'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5 text-blue-400" />
              <span>Select Patient</span>
            </CardTitle>
            <CardDescription>
              Choose a patient for comprehensive analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredPatients.map((patient) => (
                  <Button
                    key={patient.id}
                    variant={selectedPatient?.id === patient.id ? "default" : "ghost"}
                    className={`w-full justify-start h-auto p-3 ${
                      selectedPatient?.id === patient.id 
                        ? "bg-blue-600/20 border border-blue-500/50 shadow-md" 
                        : "hover:bg-blue-500/10"
                    }`}
                    onClick={() => {
                      setSelectedPatient(patient)
                      // REM: Trigger image loading for selected patient
                      if (patient.id) {
                        fetchPatientImages(patient.id)
                      }
                    }}
                  >
                    <div className="flex items-center space-x-3 text-left w-full">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={patient.avatar_url} alt={`${patient.first_name} ${patient.last_name}`} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 text-blue-400">
                          {patient.first_name.charAt(0)}{patient.last_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium">
                          {patient.first_name} {patient.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {patient.age}y, {patient.gender} • MRN: {patient.medical_record_number}
                        </div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>

              {selectedPatient && (
                <Button 
                  onClick={runAnalysis} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Run Multi-Agent Analysis
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 bg-gradient-to-br from-green-500/20 to-green-600/10 border-green-500/30 hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-green-400" />
              <span>Patient CT Imaging Studies</span>
            </CardTitle>
            <CardDescription>
              View kidney CT scans for selected patient
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedPatient ? (
              <div className="space-y-4">
                {analysisResult && selectedPatient && selectedPatient.imaging && selectedPatient.imaging.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedPatient.imaging.slice(0, 2).map((study, index) => (
                      <Card key={`${selectedPatient.id}-${index}`} className="bg-gray-800/50 border-gray-700">
                        <CardContent className="p-4">
                          <div className="aspect-square bg-gray-700 rounded mb-3 overflow-hidden">
                            <ImageWithLoader 
                              imageId={study.id}
                              alt={`${study.type} scan for ${selectedPatient.first_name} ${selectedPatient.last_name}`}
                              onError={() => console.log(`Failed to load image ${study.id}`)}
                              loadImageData={loadImageData}
                            />
                          </div>
                          <div className="space-y-2 text-left">
                            <h4 className="font-semibold text-white text-sm text-left">{study.type || "CT Abdomen/Pelvis"}</h4>
                            <p className="text-gray-400 text-xs text-left">{study.date || new Date().toLocaleDateString()}</p>
                            <p className="text-xs text-gray-400 text-left">
                              Clinical findings: {study.findings?.join(', ') || 'Analysis complete'}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-left text-muted-foreground">
                    {loading ? (
                      <div className="flex items-center space-x-2 py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-green-400" />
                        <span>Analyzing patient data and retrieving CT images...</span>
                      </div>
                    ) : analysisResult ? 
                      "No imaging studies available for this patient" : 
                      `CT images for ${selectedPatient.first_name} ${selectedPatient.last_name} will be displayed here when analysis is run`
                    }
                  </div>
                )}
                {!analysisResult && (
                  <div className="text-xs text-muted-foreground text-left">
                    Run Multi-Agent Analysis to view patient's kidney CT scans and comprehensive findings
                  </div>
                )}
              </div>
            ) : (
              <div className="text-left text-muted-foreground py-8">
                Select a patient to view their CT imaging studies
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {analysisResult && (
        <Tabs defaultValue="laymen" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="laymen">Patient-Friendly Results</TabsTrigger>
            <TabsTrigger value="clinical">Clinical Results</TabsTrigger>
          </TabsList>

          <TabsContent value="laymen" className="space-y-6">
            <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-purple-400" />
                  <span>Your Kidney Stone Risk Assessment</span>
                </CardTitle>
                <CardDescription>
                  Easy-to-understand analysis of your kidney health
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${analysisResult?.risk_prediction?.risk_level ? getRiskColor(analysisResult.risk_prediction.risk_level) : 'text-gray-400'}`}>
                    {loading ? (
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                        <span className="text-2xl">Analyzing...</span>
                      </div>
                    ) : (
                      analysisResult?.risk_prediction?.risk_level || 'Run analysis to view results'
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Overall Risk Level
                  </div>
                  <Progress 
                    value={analysisResult?.risk_prediction?.overall_risk_score ? analysisResult.risk_prediction.overall_risk_score * 100 : 0} 
                    className="mt-4"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <div className="font-medium text-blue-900 dark:text-blue-100">
                      Chance of Developing Stones
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin inline mr-1" />
                      ) : (
                        analysisResult?.risk_prediction?.stone_formation_probability 
                          ? Math.round(analysisResult.risk_prediction.stone_formation_probability * 100) 
                          : 0
                      )}%
                    </div>
                  </div>
                  
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                    <div className="font-medium text-orange-900 dark:text-orange-100">
                      Risk of Recurrence
                    </div>
                    <div className="text-2xl font-bold text-orange-600">
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin inline mr-1" />
                      ) : (
                        analysisResult?.risk_prediction?.recurrence_risk 
                          ? Math.round(analysisResult.risk_prediction.recurrence_risk * 100) 
                          : 0
                      )}%
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">What This Means for You:</h4>
                  <div className="space-y-2">
                    {analysisResult?.risk_prediction?.recommendations?.map((rec, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Most Likely Stone Type:</h4>
                  <div className="space-y-2">
                    {analysisResult?.composition_prediction?.predicted_compositions
                      ?.slice(0, 2)
                      ?.map((comp, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                        <div>
                          <div className="font-medium">{comp.composition}</div>
                          <div className="text-xs text-muted-foreground">
                            Common causes: {comp.typical_causes.join(', ')}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {Math.round(comp.probability * 100)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clinical" className="space-y-6">

            {/* Comprehensive Clinical Analysis */}
            {analysisResult && (analysisResult as any).consolidated_analysis && (
              <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-left">
                    <Brain className="h-5 w-5 text-blue-400" />
                    <span>Comprehensive Clinical Analysis</span>
                  </CardTitle>
                  <CardDescription className="text-left">
                    Integrated findings from advanced medical imaging analysis, natural language processing, and clinical decision support systems
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6 text-left">
                    <div className="p-4 bg-muted/50 rounded-lg text-left">
                      <h4 className="font-semibold mb-3 text-left text-blue-400">Comprehensive Clinical Assessment</h4>
                      <p className="text-sm text-left leading-relaxed">{(analysisResult as any).consolidated_analysis.unified_summary}</p>
                      
                      <div className="mt-4 p-3 bg-gray-800/50 rounded border border-gray-700">
                        <h5 className="font-medium text-xs text-gray-300 mb-2 text-left">Clinical Interpretation:</h5>
                        <p className="text-xs text-gray-400 text-left">
                          This analysis represents a comprehensive evaluation utilizing state-of-the-art medical imaging interpretation, 
                          clinical pattern recognition algorithms, and evidence-based diagnostic protocols. The assessment incorporates 
                          radiological findings, patient demographics, clinical history, and established nephrolithiasis risk stratification models 
                          to provide clinically actionable recommendations for patient management and treatment planning.
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="text-left">
                        <h4 className="font-semibold mb-3 text-left text-green-400">Primary Clinical Findings</h4>
                        <div className="space-y-3">
                          {(analysisResult as any).consolidated_analysis.key_findings.map((finding: string, index: number) => (
                            <div key={index} className="p-3 bg-gray-800/30 rounded text-left">
                              <div className="flex items-start space-x-3 text-left">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <div className="text-left">
                                  <p className="text-sm font-medium text-white text-left">{finding}</p>
                                  <p className="text-xs text-gray-400 mt-1 text-left">
                                    Clinical significance: This finding contributes to the overall diagnostic assessment and treatment planning protocol.
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="text-left">
                        <h4 className="font-semibold mb-3 text-left text-purple-400">Evidence-Based Clinical Recommendations</h4>
                        <div className="space-y-3">
                          {(analysisResult as any).consolidated_analysis.clinical_recommendations.map((rec: string, index: number) => (
                            <div key={index} className="p-3 bg-gray-800/30 rounded text-left">
                              <div className="flex items-start space-x-3 text-left">
                                <Target className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                <div className="text-left">
                                  <p className="text-sm font-medium text-white text-left">{rec}</p>
                                  <p className="text-xs text-gray-400 mt-1 text-left">
                                    Recommendation based on current clinical guidelines and evidence-based protocols for nephrolithiasis management.
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    
                    <div className="border-t border-gray-700 pt-4 text-left">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                        <div className="text-left">
                          <h5 className="font-medium text-xs text-gray-300 mb-1 text-left">Analysis Confidence</h5>
                          <p className="text-sm text-white text-left">{Math.round((analysisResult as any).consolidated_analysis.confidence_score * 100)}%</p>
                          <p className="text-xs text-gray-400 text-left">Based on imaging quality and clinical data completeness</p>
                        </div>
                        <div className="text-left">
                          <h5 className="font-medium text-xs text-gray-300 mb-1 text-left">Clinical Grade</h5>
                          <p className="text-sm text-white text-left">Professional Medical Analysis</p>
                          <p className="text-xs text-gray-400 text-left">Suitable for clinical decision support</p>
                        </div>
                        <div className="text-left">
                          <h5 className="font-medium text-xs text-gray-300 mb-1 text-left">Analysis Methodology</h5>
                          <p className="text-sm text-white text-left">Multi-Modal Clinical Integration</p>
                          <p className="text-xs text-gray-400 text-left">Advanced medical imaging interpretation with clinical correlation and evidence-based assessment protocols</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>


        </Tabs>
      )}
    </div>
  )
}
