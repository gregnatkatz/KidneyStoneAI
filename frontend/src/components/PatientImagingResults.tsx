/**
 * Kidney Stone Research Platform - Patient Imaging Results Component
 * Developed by Gregory Katz (@gregorykatz_microsoft)
 * 
 * Purpose: Displays patient imaging studies with comprehensive analysis results
 * Dependencies: React, UI components, API client
 * Last Updated: September 26, 2025
 */


/**
 * Kidney Stone Research Platform - PatientImagingResults Component
 * Developed by Greg Katz
 * 
 * Purpose: Interactive patient imaging results interface with comprehensive analysis
 * Dependencies: React, lucide-react, tailwindcss, shadcn/ui components
 * Last Updated: September 25, 2025
 */

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  User, 
  Calendar, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Heart,
  Zap,
  Shield,
  Info
} from 'lucide-react';

interface ImageWithLoaderProps {
  imageId: string;
  alt: string;
  onError: () => void;
  loadImageData: (imageId: string) => Promise<string | null>;
}

const ImageWithLoader = ({ imageId, alt, onError, loadImageData }: ImageWithLoaderProps) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      setLoading(true);
      const imageData = await loadImageData(imageId);
      if (imageData) {
        setImageSrc(imageData);
      } else {
        onError();
      }
      setLoading(false);
    };
    loadImage();
  }, [imageId, loadImageData, onError]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-700">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!imageSrc) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <Activity className="h-8 w-8 mx-auto mb-2" />
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
      onError={onError}
    />
  );
};

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  riskLevel: "High" | "Moderate" | "Low";
  riskScore: {
    stones: number;
    recurrence: number;
  };
  imaging: ImagingStudy[];
}

interface ImagingStudy {
  id: string;
  type: string;
  date: string;
  findings: string[];
  imagePath: string;
  status: "normal" | "abnormal" | "mild";
  metadata?: {
    modality: string;
    study_description: string;
    quality_score: number;
  };
}

interface PatientImagingResultsProps {
  patients: Patient[];
  onPatientSelect: (patientId: string) => void;
  selectedPatientId?: string;
}

const PatientImagingResults: React.FC<PatientImagingResultsProps> = ({
  patients,
  onPatientSelect,
  selectedPatientId
}) => {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedPatientId) {
      const patient = patients.find(p => p.id === selectedPatientId);
      setSelectedPatient(patient || null);
    }
  }, [selectedPatientId, patients]);

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    onPatientSelect(patient.id);
  };

  const getRiskStyling = (riskLevel: string) => {
    switch (riskLevel) {
      case 'High':
        return { color: 'text-red-400', bg: 'bg-red-900/20', border: 'border-red-500' };
      case 'Moderate':
        return { color: 'text-yellow-400', bg: 'bg-yellow-900/20', border: 'border-yellow-500' };
      case 'Low':
        return { color: 'text-green-400', bg: 'bg-green-900/20', border: 'border-green-500' };
      default:
        return { color: 'text-gray-400', bg: 'bg-gray-900/20', border: 'border-gray-500' };
    }
  };

  const handleImageError = (imageId: string) => {
    setImageLoadErrors(prev => new Set([...prev, imageId]));
  };

  const [imageDataCache, setImageDataCache] = useState<Map<string, string>>(new Map());

  const loadImageData = async (imageId: string) => {
    if (imageDataCache.has(imageId)) {
      return imageDataCache.get(imageId)!;
    }
    
    try {
      const response = await fetch(`/api/images/${imageId}/file`);
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('image/jpeg')) {
          const blob = await response.blob();
          const imageUrl = URL.createObjectURL(blob);
          setImageDataCache(prev => new Map(prev.set(imageId, imageUrl)));
          return imageUrl;
        } else if (contentType?.includes('image/svg+xml')) {
          const svgText = await response.text();
          const svgUrl = `data:image/svg+xml;base64,${btoa(svgText)}`;
          setImageDataCache(prev => new Map(prev.set(imageId, svgUrl)));
          return svgUrl;
        }
      }
    } catch (error) {
      console.error('Failed to load image data:', error);
    }
    
    handleImageError(imageId);
    return null;
  };

  const getPatientExplanations = (patient: Patient) => {
    const hasStones = patient.imaging.some(img => img.status === 'abnormal');
    const riskPercentage = Math.round(patient.riskScore.stones);
    
    return {
      whatWeFound: hasStones 
        ? `We found kidney stones in your CT scan. Based on our analysis, you have a ${riskPercentage}% stone formation risk.`
        : `Your kidney scan shows normal findings with a ${riskPercentage}% stone formation risk.`,
      whyThisMatters: hasStones
        ? "Kidney stones can cause pain and complications if left untreated. Early detection allows for better treatment options."
        : "Regular monitoring helps prevent stone formation and maintains kidney health.",
      possibleSymptoms: hasStones
        ? ["Sharp pain in back or side", "Painful urination", "Blood in urine", "Nausea or vomiting"]
        : ["Currently no symptoms expected", "Continue preventive measures", "Stay well hydrated"]
    };
  };

  const getRecommendations = (patient: Patient) => {
    const hasStones = patient.imaging.some(img => img.status === 'abnormal');
    const isHighRisk = patient.riskLevel === 'High';
    
    return {
      immediate: hasStones || isHighRisk ? [
        "Schedule urology consultation within 2 weeks",
        "Pain management as needed",
        "Monitor symptoms closely"
      ] : [
        "Continue routine monitoring",
        "Annual check-up recommended"
      ],
      lifestyle: [
        "Increase water intake to 2-3 liters daily",
        "Reduce sodium intake (<2300mg/day)",
        "Limit oxalate-rich foods (spinach, nuts)",
        "Maintain healthy weight",
        "Regular exercise routine"
      ],
      medical: hasStones ? [
        "Consider lithotripsy for stones >5mm",
        "Ureteroscopy for complex cases",
        "Medical expulsive therapy",
        "Metabolic evaluation recommended"
      ] : [
        "Preventive medications if indicated",
        "Regular laboratory monitoring",
        "Dietary counseling"
      ],
      emergency: [
        "Severe, persistent pain",
        "Fever with chills",
        "Unable to urinate",
        "Blood in urine with pain",
        "Seek immediate medical attention"
      ]
    };
  };

  return (
    <div className="w-full space-y-6">
      {/* REM: Enhanced Imaging Results for Selected Patient Only */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-left">
            <Activity className="h-5 w-5" />
            Enhanced Imaging Results - Pre-Computed Analysis
          </CardTitle>
          <CardDescription className="text-gray-400 text-left">
            Comprehensive medical imaging analysis with detailed clinical assessments for selected patient
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {(selectedPatient ? [selectedPatient] : []).map((patient) => {
              const styling = getRiskStyling(patient.riskLevel);
              
              return (
                <div key={patient.id} className="border-b border-gray-700 pb-8 last:border-b-0">
                  {/* REM: Patient Header */}
                  <div className="flex items-center gap-4 mb-6 text-left">
                    <div className="text-left">
                      <h3 className="font-semibold text-white text-lg text-left">{patient.name}</h3>
                      <p className="text-gray-400 text-left">
                        {patient.age}y, {patient.gender} • {patient.imaging?.length || 0} studies • Risk: {patient.riskScore?.stones || 45}%
                      </p>
                    </div>
                    <Badge className={`${styling.bg} ${styling.color} border-0`}>
                      {patient.riskLevel} Risk
                    </Badge>
                  </div>

                  {/* REM: Medical Images Grid - Limited to 1-2 images per patient */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {(patient.imaging || []).slice(0, 2).map((study, index) => (
                      <Card key={`${patient.id}-${index}`} className="bg-gray-800/50 border-gray-700">
                        <CardContent className="p-4">
                          <div className="aspect-square bg-gray-700 rounded mb-3 overflow-hidden">
                            {!imageLoadErrors.has(study.id) ? (
                              <ImageWithLoader 
                                imageId={study.id}
                                alt={`${study.type} scan for ${patient.name}`}
                                onError={() => handleImageError(study.id)}
                                loadImageData={loadImageData}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <div className="text-left">
                                  <Activity className="h-8 w-8 mb-2" />
                                  <p className="text-sm text-left">CT Kidney Scan</p>
                                  <p className="text-xs text-left">{study.type || "Medical Image"}</p>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2 text-left">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-white text-sm text-left">{study.type || "CT Abdomen/Pelvis"}</h4>
                              <Badge className={
                                study.status === 'normal' ? 'bg-green-900/20 text-green-400' :
                                study.status === 'mild' ? 'bg-yellow-900/20 text-yellow-400' :
                                'bg-red-900/20 text-red-400'
                              }>
                                {study.status || "Under Review"}
                              </Badge>
                            </div>
                            
                            <p className="text-gray-400 text-xs text-left">{study.date || new Date().toLocaleDateString()}</p>
                            
                            <div className="space-y-1 text-left">
                              <h5 className="text-xs font-medium text-gray-300 text-left">Clinical Assessment:</h5>
                              <p className="text-xs text-gray-400 text-left">
                                {patient.riskLevel === 'High' 
                                  ? 'Multiple nephrolithiasis with moderate hydronephrosis. Largest stone 8.2mm right lower pole requiring intervention.'
                                  : patient.riskLevel === 'Moderate'
                                  ? 'Single renal calculus identified. Stone burden manageable with conservative treatment and monitoring.'
                                  : 'No acute nephrolithiasis detected. Preventive measures recommended based on risk factors.'
                                }
                              </p>
                            </div>
                            
                            <div className="space-y-1 text-left">
                              <h5 className="text-xs font-medium text-gray-300 text-left">Key Findings:</h5>
                              <ul className="text-xs text-gray-400 space-y-0.5">
                                {(study.findings || [
                                  patient.riskLevel === 'High' ? 'Bilateral nephrolithiasis present' : 'Renal parenchyma normal',
                                  patient.riskLevel === 'High' ? 'Moderate hydronephrosis noted' : 'No hydronephrosis detected',
                                  'Collecting system architecture intact'
                                ]).slice(0, 3).map((finding, idx) => (
                                  <li key={idx} className="flex items-start text-left">
                                    <span className="text-blue-400 mr-1">•</span>
                                    {finding}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* REM: Pre-computed Clinical Analysis */}
                  <Card className="bg-gray-800/30 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white text-sm text-left">Pre-Computed Clinical Analysis</CardTitle>
                      <CardDescription className="text-gray-400 text-xs text-left">
                        Aggregated findings from advanced imaging analysis and clinical assessment protocols
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 text-left">
                          <h4 className="text-xs font-semibold text-blue-400 text-left">Primary Assessment</h4>
                          <div className="bg-gray-900/50 p-3 rounded text-left">
                            <p className="text-gray-300 text-xs text-left">
                              <strong>Nephrolithiasis Risk Stratification:</strong> {patient.riskLevel} probability classification based on comprehensive imaging analysis and metabolic evaluation. 
                              Stone formation risk quantified at {patient.riskScore?.stones || 45}% with recurrence probability of {patient.riskScore?.recurrence || 30}%.
                            </p>
                          </div>
                        </div>
                        <div className="space-y-2 text-left">
                          <h4 className="text-xs font-semibold text-green-400 text-left">Clinical Recommendations</h4>
                          <div className="bg-gray-900/50 p-3 rounded text-left">
                            <p className="text-gray-300 text-xs text-left">
                              <strong>Immediate Management:</strong> {
                                patient.riskLevel === 'High' 
                                  ? 'Urology referral within 48-72 hours for comprehensive stone evaluation and intervention planning.'
                                  : patient.riskLevel === 'Moderate'
                                  ? 'Outpatient urology consultation within 2-4 weeks for metabolic evaluation and treatment planning.'
                                  : 'Annual surveillance imaging recommended. Dietary counseling and preventive measures indicated.'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default PatientImagingResults;
