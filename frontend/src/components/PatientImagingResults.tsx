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

export const PatientImagingResults: React.FC<PatientImagingResultsProps> = ({
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
      {/* REM: Patient Selection Panel */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="h-5 w-5" />
            Patient Selection
          </CardTitle>
          <CardDescription className="text-gray-400">
            Select a patient to view comprehensive imaging results and analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((patient) => {
              const styling = getRiskStyling(patient.riskLevel);
              const isSelected = selectedPatient?.id === patient.id;
              
              return (
                <Card 
                  key={patient.id}
                  className={`cursor-pointer transition-all duration-200 ${
                    isSelected 
                      ? `${styling.bg} ${styling.border} border-2` 
                      : 'bg-gray-800 border-gray-600 hover:bg-gray-750'
                  }`}
                  onClick={() => handlePatientSelect(patient)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-white">{patient.name}</h3>
                      <Badge className={`${styling.bg} ${styling.color} border-0`}>
                        {patient.riskLevel}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        {patient.age}y, {patient.gender}
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-3 w-3" />
                        {patient.riskScore.stones}% stone risk
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {patient.imaging.length} studies
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* REM: Selected Patient Analysis Display */}
      {selectedPatient && (
        <div className="space-y-6">
          {/* REM: Medical Image Display Grid */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Medical Imaging Studies - {selectedPatient.name}
              </CardTitle>
              <CardDescription className="text-gray-400">
                CT scans and imaging analysis with findings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedPatient.imaging.map((study) => (
                  <Card key={study.id} className="bg-gray-800 border-gray-600">
                    <CardContent className="p-4">
                      <div className="aspect-square bg-gray-700 rounded mb-3 overflow-hidden">
                        {!imageLoadErrors.has(study.id) ? (
                          <img
                            src={study.imagePath}
                            alt={`${study.type} scan`}
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(study.id)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <div className="text-center">
                              <Activity className="h-8 w-8 mx-auto mb-2" />
                              <p className="text-sm">CT Scan</p>
                              <p className="text-xs">Image Loading...</p>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-white">{study.type}</span>
                          <Badge 
                            className={
                              study.status === 'normal' ? 'bg-green-900/20 text-green-400' :
                              study.status === 'mild' ? 'bg-yellow-900/20 text-yellow-400' :
                              'bg-red-900/20 text-red-400'
                            }
                          >
                            {study.status}
                          </Badge>
                        </div>
                        
                        <p className="text-xs text-gray-400">
                          {new Date(study.date).toLocaleDateString()}
                        </p>
                        
                        <div className="space-y-1">
                          {study.findings.slice(0, 2).map((finding, idx) => (
                            <p key={idx} className="text-xs text-gray-300">
                              • {finding}
                            </p>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* REM: Patient-Friendly Explanations and Recommendations */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Info className="h-5 w-5" />
                Your Results Explained
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="findings" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-gray-800">
                  <TabsTrigger value="findings" className="text-gray-300">What We Found</TabsTrigger>
                  <TabsTrigger value="meaning" className="text-gray-300">Why This Matters</TabsTrigger>
                  <TabsTrigger value="symptoms" className="text-gray-300">Possible Symptoms</TabsTrigger>
                  <TabsTrigger value="recommendations" className="text-gray-300">Recommendations</TabsTrigger>
                </TabsList>

                <TabsContent value="findings" className="mt-4">
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <p className="text-gray-300">
                      {getPatientExplanations(selectedPatient).whatWeFound}
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="meaning" className="mt-4">
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <p className="text-gray-300">
                      {getPatientExplanations(selectedPatient).whyThisMatters}
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="symptoms" className="mt-4">
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <ul className="space-y-2">
                      {getPatientExplanations(selectedPatient).possibleSymptoms.map((symptom, idx) => (
                        <li key={idx} className="text-gray-300 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-blue-400" />
                          {symptom}
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>

                <TabsContent value="recommendations" className="mt-4">
                  <div className="space-y-4">
                    {/* REM: Immediate Actions */}
                    <Card className="bg-red-900/10 border-red-500/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-red-400 flex items-center gap-2 text-lg">
                          <AlertTriangle className="h-5 w-5" />
                          Immediate Actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {getRecommendations(selectedPatient).immediate.map((action, idx) => (
                            <li key={idx} className="text-gray-300 flex items-center gap-2">
                              <Zap className="h-4 w-4 text-red-400" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* REM: Lifestyle Changes */}
                    <Card className="bg-green-900/10 border-green-500/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-green-400 flex items-center gap-2 text-lg">
                          <Heart className="h-5 w-5" />
                          Lifestyle Changes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {getRecommendations(selectedPatient).lifestyle.map((change, idx) => (
                            <li key={idx} className="text-gray-300 flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-400" />
                              {change}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* REM: Medical Treatment */}
                    <Card className="bg-purple-900/10 border-purple-500/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-purple-400 flex items-center gap-2 text-lg">
                          <Shield className="h-5 w-5" />
                          Medical Treatment Options
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {getRecommendations(selectedPatient).medical.map((treatment, idx) => (
                            <li key={idx} className="text-gray-300 flex items-center gap-2">
                              <Activity className="h-4 w-4 text-purple-400" />
                              {treatment}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* REM: Emergency Guidelines */}
                    <Card className="bg-orange-900/10 border-orange-500/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-orange-400 flex items-center gap-2 text-lg">
                          <Clock className="h-5 w-5" />
                          When to Seek Emergency Care
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {getRecommendations(selectedPatient).emergency.map((emergency, idx) => (
                            <li key={idx} className="text-gray-300 flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-orange-400" />
                              {emergency}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
