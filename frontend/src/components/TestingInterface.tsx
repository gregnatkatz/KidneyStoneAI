import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PatientImagingResults } from './PatientImagingResults'
import { ClinicalAnalysisAggregator } from './ClinicalAnalysisAggregator'
import { 
  Search, 
  Brain, 
  Zap, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Loader2,
  User,
  Activity,
  Database
} from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { apiConfig, apiCall } from '@/config/api'

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

interface RAGResponse {
  query: string
  synthesized_answer: string
  confidence_score: number
  sources: string[]
}

export function TestingInterface({ token }: TestingInterfaceProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [ragQuery, setRagQuery] = useState('')
  const [ragResponse, setRagResponse] = useState<RAGResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [ragLoading, setRagLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchPatients()
  }, [token])

  const fetchPatients = async () => {
    try {
      const response = await apiCall(`${apiConfig.endpoints.patients}?limit=20`)
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
    try {
      const response = await apiCall(`${apiConfig.endpoints.patients}/${selectedPatient.id}/ml-analysis`, {
        method: 'POST'
      })
      const result = await response.json()
      setAnalysisResult(result)
      
      // REM: Fetch patient images when analysis is run
      await fetchPatientImages(selectedPatient.id)
    } catch (error) {
      console.error('Failed to run analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  // REM: Fetch patient images when selected
  const fetchPatientImages = async (patientId: string) => {
    try {
      const response = await apiCall(`${apiConfig.endpoints.patients}/${patientId}/imaging`)
      if (response.ok) {
        const imagingData = await response.json()
        // REM: Update patient with imaging data for display
        setSelectedPatient(prev => prev ? {
          ...prev,
          imaging: imagingData.imaging_studies || [],
          riskLevel: prev.riskLevel || "Moderate",
          riskScore: prev.riskScore || { stones: 45, recurrence: 30 }
        } : null)
      }
    } catch (error) {
      console.error('Failed to fetch patient images:', error)
    }
  }

  const queryRAG = async () => {
    if (!ragQuery.trim()) return

    setRagLoading(true)
    try {
      const response = await apiCall(`${apiConfig.endpoints.rag}/query`, {
        method: 'POST',
        body: JSON.stringify({
          query: ragQuery,
          max_results: 3
        })
      })
      const result = await response.json()
      setRagResponse(result)
    } catch (error) {
      console.error('Failed to query RAG:', error)
    } finally {
      setRagLoading(false)
    }
  }

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
                    className="w-full justify-start h-auto p-3"
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
                <div className="text-center text-muted-foreground">
                  CT images for {selectedPatient.first_name} {selectedPatient.last_name} will be displayed here when analysis is run
                </div>
                <div className="text-xs text-muted-foreground text-center">
                  Run Multi-Agent Analysis to view patient's kidney CT scans and comprehensive findings
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Select a patient to view their CT imaging studies
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {analysisResult && (
        <Tabs defaultValue="laymen" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="laymen">Patient-Friendly Results</TabsTrigger>
            <TabsTrigger value="clinical">Clinical Results</TabsTrigger>
            <TabsTrigger value="patient-results">Patient Imaging</TabsTrigger>
            <TabsTrigger value="clinical-analysis">Multi-Agent Analysis</TabsTrigger>
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
                  <div className={`text-4xl font-bold ${getRiskColor(analysisResult.risk_prediction.risk_level)}`}>
                    {analysisResult.risk_prediction.risk_level}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Overall Risk Level
                  </div>
                  <Progress 
                    value={analysisResult.risk_prediction.overall_risk_score * 100} 
                    className="mt-4"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <div className="font-medium text-blue-900 dark:text-blue-100">
                      Chance of Developing Stones
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round(analysisResult.risk_prediction.stone_formation_probability * 100)}%
                    </div>
                  </div>
                  
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                    <div className="font-medium text-orange-900 dark:text-orange-100">
                      Risk of Recurrence
                    </div>
                    <div className="text-2xl font-bold text-orange-600">
                      {Math.round(analysisResult.risk_prediction.recurrence_risk * 100)}%
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">What This Means for You:</h4>
                  <div className="space-y-2">
                    {analysisResult.risk_prediction.recommendations.map((rec, index) => (
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
                    {analysisResult.composition_prediction.predicted_compositions
                      .slice(0, 2)
                      .map((comp, index) => (
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

            {/* Consolidated Clinical Analysis */}
            {analysisResult.consolidated_analysis && (
              <Card className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Brain className="h-5 w-5 text-blue-400" />
                    <span>Consolidated Multi-Agent Clinical Analysis</span>
                  </CardTitle>
                  <CardDescription>
                    Aggregated findings from MedParse 3D, GPT-5, and DeepSeek agents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-medium mb-2">Unified Clinical Summary</h4>
                      <p className="text-sm">{analysisResult.consolidated_analysis.unified_summary}</p>
                    </div>
                    
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="font-medium mb-2">Key Findings</h4>
                        <ul className="space-y-1">
                          {analysisResult.consolidated_analysis.key_findings.map((finding, index) => (
                            <li key={index} className="text-sm flex items-start space-x-2">
                              <CheckCircle className="h-3 w-3 text-green-500 mt-1 flex-shrink-0" />
                              <span>{finding}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Clinical Recommendations</h4>
                        <ul className="space-y-1">
                          {analysisResult.consolidated_analysis.clinical_recommendations.map((rec, index) => (
                            <li key={index} className="text-sm flex items-start space-x-2">
                              <Target className="h-3 w-3 text-blue-500 mt-1 flex-shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {analysisResult.consolidated_analysis.inconsistencies.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Analysis Inconsistencies</h4>
                        <ul className="space-y-1">
                          {analysisResult.consolidated_analysis.inconsistencies.map((inconsistency, index) => (
                            <li key={index} className="text-sm flex items-start space-x-2">
                              <AlertTriangle className="h-3 w-3 text-yellow-500 mt-1 flex-shrink-0" />
                              <span>{inconsistency}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Analysis Confidence: {Math.round(analysisResult.consolidated_analysis.confidence_score * 100)}%</span>
                      <span>Agents: MedParse 3D • GPT-5 • DeepSeek</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="patient-results" className="mt-6">
            {selectedPatient ? (
              <PatientImagingResults
                patients={[selectedPatient]}
                onPatientSelect={(patientId) => {
                  const patient = patients.find(p => p.id === patientId)
                  if (patient) {
                    setSelectedPatient(patient)
                    fetchPatientImages(patientId)
                  }
                }}
                selectedPatientId={selectedPatient.id}
              />
            ) : (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-8 text-center">
                <div className="text-blue-400 mb-4">
                  <User className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Select a Patient</h3>
                <p className="text-gray-400">
                  Choose a patient from the list above to view comprehensive imaging results and analysis
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="clinical-analysis" className="mt-6">
            {selectedPatient ? (
              <ClinicalAnalysisAggregator
                patientId={selectedPatient.id}
                onAnalysisComplete={(analysis) => {
                  console.log('Analysis completed:', analysis)
                }}
              />
            ) : (
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-8 text-center">
                <div className="text-purple-400 mb-4">
                  <Brain className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Select a Patient for Analysis</h3>
                <p className="text-gray-400">
                  Choose a patient from the list above to run multi-model AI clinical analysis
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
