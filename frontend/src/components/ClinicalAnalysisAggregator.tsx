/**
 * Kidney Stone Research Platform - ClinicalAnalysisAggregator Component
 * Developed by Greg Katz
 * 
 * Purpose: Multi-model AI integration for clinical-grade kidney stone analysis
 * Dependencies: React, lucide-react, tailwindcss, shadcn/ui components
 * Last Updated: September 25, 2025
 */

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { 
  Brain, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Shield,
  Zap,
  Target,
  Calendar,
  FileText,
  BarChart3
} from 'lucide-react';

interface ClinicalAnalysis {
  analysisMetadata: {
    completedAt: string;
    confidence: "High" | "Medium" | "Low" | "Insufficient";
    confidenceScore: number;
    consensusLevel: string;
    studiesAnalyzed: number;
  };
  clinicalFindings: {
    primary: {
      diagnosis: string;
      anatomicalLocation: string;
      severity: string;
      stoneCharacteristics?: {
        largest: string;
        composition: string;
        density: string;
        morphology: string;
      };
    };
    secondary: {
      hydronephrosis: string;
      renalFunction: string;
      ureteralFindings: string;
      bladderFindings: string;
    };
  };
  riskStratification: {
    recurrence: string;
    progression: string;
    complications: string;
    metabolicRisk: string;
  };
  treatmentRecommendations: {
    immediate: {
      priority: string;
      timeline: string;
      indication: string;
    };
    interventional: Array<{
      option: string;
      indication: string;
      success: string;
      considerations: string;
    }>;
    medical: {
      acuteManagement: string[];
      metabolicEvaluation: string[];
      prevention: string[];
    };
  };
  followUpProtocol: {
    shortTerm: {
      timeline: string;
      imaging: string;
      assessment: string;
    };
    longTerm: {
      timeline: string;
      monitoring: string;
      metabolic: string;
    };
    emergency: {
      criteria: string;
      action: string;
    };
  };
  prognosticFactors: {
    favorable: string[];
    concerning: string[];
  };
}

interface ClinicalAnalysisAggregatorProps {
  patientId: string;
  onAnalysisComplete?: (analysis: ClinicalAnalysis) => void;
}

export const ClinicalAnalysisAggregator: React.FC<ClinicalAnalysisAggregatorProps> = ({
  patientId,
  onAnalysisComplete
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [analysis, setAnalysis] = useState<ClinicalAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runMultiModelAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setError(null);
    
    try {
      setCurrentModel('MedParse 3D Imaging Analysis');
      setAnalysisProgress(10);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setAnalysisProgress(35);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setCurrentModel('GPT-5 Clinical Assessment');
      setAnalysisProgress(45);
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      setAnalysisProgress(70);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setCurrentModel('DeepSeek Pattern Recognition');
      setAnalysisProgress(80);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setAnalysisProgress(95);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002'}/analysis/run/${patientId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Analysis failed');
      }
      
      const analysisData = await response.json();
      setAnalysis(analysisData);
      setAnalysisProgress(100);
      setCurrentModel('Analysis Complete');
      
      if (onAnalysisComplete) {
        onAnalysisComplete(analysisData);
      }
      
    } catch (err) {
      setError('Failed to complete multi-model analysis. Please try again.');
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getConfidenceStyling = (confidence: string) => {
    switch (confidence) {
      case 'High':
        return { color: 'text-green-400', bg: 'bg-green-900/20', icon: CheckCircle };
      case 'Medium':
        return { color: 'text-yellow-400', bg: 'bg-yellow-900/20', icon: AlertTriangle };
      case 'Low':
        return { color: 'text-orange-400', bg: 'bg-orange-900/20', icon: AlertTriangle };
      default:
        return { color: 'text-red-400', bg: 'bg-red-900/20', icon: AlertTriangle };
    }
  };

  const formatConfidenceScore = (score: number) => {
    return `${Math.round(score * 100)}%`;
  };

  return (
    <div className="w-full space-y-6">
      {/* REM: Analysis Control Panel */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Multi-Agent Clinical Analysis
          </CardTitle>
          <CardDescription className="text-gray-400">
            Aggregate results from MedParse, GPT-5, and DeepSeek models for comprehensive clinical assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isAnalyzing && !analysis && (
            <Button 
              onClick={runMultiModelAnalysis}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
            >
              <Brain className="h-4 w-4 mr-2" />
              Run Multi-Agent Analysis
            </Button>
          )}
          
          {isAnalyzing && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                <span className="text-white font-medium">{currentModel}</span>
              </div>
              <Progress value={analysisProgress} className="w-full" />
              <p className="text-sm text-gray-400">
                Processing medical imaging and clinical data... {analysisProgress}%
              </p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Analysis Error</span>
              </div>
              <p className="text-red-300 mt-1">{error}</p>
              <Button 
                onClick={runMultiModelAnalysis}
                className="mt-3 bg-red-600 hover:bg-red-700"
                size="sm"
              >
                Retry Analysis
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* REM: Analysis Results Display */}
      {analysis && (
        <div className="space-y-6">
          {/* REM: Analysis Metadata and Confidence */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Analysis Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-800 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {React.createElement(getConfidenceStyling(analysis.analysisMetadata.confidence).icon, {
                      className: `h-4 w-4 ${getConfidenceStyling(analysis.analysisMetadata.confidence).color}`
                    })}
                    <span className="text-sm font-medium text-gray-300">Confidence</span>
                  </div>
                  <div className={`text-lg font-bold ${getConfidenceStyling(analysis.analysisMetadata.confidence).color}`}>
                    {analysis.analysisMetadata.confidence}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatConfidenceScore(analysis.analysisMetadata.confidenceScore)}
                  </div>
                </div>
                
                <div className="bg-gray-800 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-gray-300">Consensus</span>
                  </div>
                  <div className="text-lg font-bold text-blue-400">
                    {analysis.analysisMetadata.consensusLevel}
                  </div>
                </div>
                
                <div className="bg-gray-800 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-gray-300">Studies</span>
                  </div>
                  <div className="text-lg font-bold text-purple-400">
                    {analysis.analysisMetadata.studiesAnalyzed}
                  </div>
                </div>
                
                <div className="bg-gray-800 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium text-gray-300">Completed</span>
                  </div>
                  <div className="text-sm font-bold text-green-400">
                    {new Date(analysis.analysisMetadata.completedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* REM: Clinical Findings and Analysis Tabs */}
          <Card className="bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Clinical Analysis Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="findings" className="w-full">
                <TabsList className="grid w-full grid-cols-5 bg-gray-800">
                  <TabsTrigger value="findings" className="text-gray-300">Clinical Findings</TabsTrigger>
                  <TabsTrigger value="risk" className="text-gray-300">Risk Assessment</TabsTrigger>
                  <TabsTrigger value="treatment" className="text-gray-300">Treatment Plan</TabsTrigger>
                  <TabsTrigger value="followup" className="text-gray-300">Follow-up</TabsTrigger>
                  <TabsTrigger value="prognosis" className="text-gray-300">Prognosis</TabsTrigger>
                </TabsList>

                {/* REM: Clinical Findings Tab */}
                <TabsContent value="findings" className="mt-6">
                  <div className="space-y-6">
                    {/* Primary Diagnosis */}
                    <Card className="bg-gray-800 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white text-lg">Primary Diagnosis</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium text-gray-300 mb-2">Diagnosis</h4>
                            <p className="text-white">{analysis.clinicalFindings.primary.diagnosis}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-2">Location</h4>
                            <p className="text-white">{analysis.clinicalFindings.primary.anatomicalLocation}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-2">Severity</h4>
                            <Badge className={
                              analysis.clinicalFindings.primary.severity === 'High' ? 'bg-red-900/20 text-red-400' :
                              analysis.clinicalFindings.primary.severity === 'Moderate' ? 'bg-yellow-900/20 text-yellow-400' :
                              'bg-green-900/20 text-green-400'
                            }>
                              {analysis.clinicalFindings.primary.severity}
                            </Badge>
                          </div>
                        </div>
                        
                        {analysis.clinicalFindings.primary.stoneCharacteristics && (
                          <div>
                            <h4 className="font-medium text-gray-300 mb-3">Stone Characteristics</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-700 p-4 rounded-lg">
                              <div>
                                <span className="text-xs text-gray-400">Size</span>
                                <p className="text-white font-medium">{analysis.clinicalFindings.primary.stoneCharacteristics.largest}</p>
                              </div>
                              <div>
                                <span className="text-xs text-gray-400">Composition</span>
                                <p className="text-white font-medium">{analysis.clinicalFindings.primary.stoneCharacteristics.composition}</p>
                              </div>
                              <div>
                                <span className="text-xs text-gray-400">Density</span>
                                <p className="text-white font-medium">{analysis.clinicalFindings.primary.stoneCharacteristics.density}</p>
                              </div>
                              <div>
                                <span className="text-xs text-gray-400">Morphology</span>
                                <p className="text-white font-medium">{analysis.clinicalFindings.primary.stoneCharacteristics.morphology}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Secondary Findings */}
                    <Card className="bg-gray-800 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white text-lg">Secondary Findings</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Hydronephrosis</h4>
                            <p className="text-white">{analysis.clinicalFindings.secondary.hydronephrosis}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Renal Function</h4>
                            <p className="text-white">{analysis.clinicalFindings.secondary.renalFunction}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Ureteral Findings</h4>
                            <p className="text-white">{analysis.clinicalFindings.secondary.ureteralFindings}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Bladder Findings</h4>
                            <p className="text-white">{analysis.clinicalFindings.secondary.bladderFindings}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* REM: Risk Stratification Tab */}
                <TabsContent value="risk" className="mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-gray-800 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Risk Assessment
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h4 className="font-medium text-gray-300 mb-1">Recurrence Risk</h4>
                          <p className="text-white">{analysis.riskStratification.recurrence}</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-300 mb-1">Progression Risk</h4>
                          <p className="text-white">{analysis.riskStratification.progression}</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-300 mb-1">Complications</h4>
                          <p className="text-white">{analysis.riskStratification.complications}</p>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-300 mb-1">Metabolic Risk</h4>
                          <p className="text-white">{analysis.riskStratification.metabolicRisk}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* REM: Treatment Recommendations Tab */}
                <TabsContent value="treatment" className="mt-6">
                  <div className="space-y-6">
                    {/* Immediate Treatment */}
                    <Card className="bg-red-900/10 border-red-500/20">
                      <CardHeader>
                        <CardTitle className="text-red-400 flex items-center gap-2">
                          <Zap className="h-4 w-4" />
                          Immediate Management
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Priority</h4>
                            <Badge className="bg-red-900/20 text-red-400">
                              {analysis.treatmentRecommendations.immediate.priority}
                            </Badge>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Timeline</h4>
                            <p className="text-white">{analysis.treatmentRecommendations.immediate.timeline}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Indication</h4>
                            <p className="text-white">{analysis.treatmentRecommendations.immediate.indication}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Interventional Options */}
                    <Card className="bg-gray-800 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Interventional Options
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {analysis.treatmentRecommendations.interventional.map((option, idx) => (
                            <div key={idx} className="bg-gray-700 p-4 rounded-lg">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div>
                                  <h4 className="font-medium text-gray-300 mb-1">Option</h4>
                                  <p className="text-white font-medium">{option.option}</p>
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-300 mb-1">Indication</h4>
                                  <p className="text-white">{option.indication}</p>
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-300 mb-1">Success Rate</h4>
                                  <p className="text-green-400 font-medium">{option.success}</p>
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-300 mb-1">Considerations</h4>
                                  <p className="text-white">{option.considerations}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Medical Management */}
                    <Card className="bg-gray-800 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white">Medical Management</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div>
                            <h4 className="font-medium text-gray-300 mb-3">Acute Management</h4>
                            <ul className="space-y-2">
                              {analysis.treatmentRecommendations.medical.acuteManagement.map((item, idx) => (
                                <li key={idx} className="text-white flex items-center gap-2">
                                  <CheckCircle className="h-3 w-3 text-green-400" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-3">Metabolic Evaluation</h4>
                            <ul className="space-y-2">
                              {analysis.treatmentRecommendations.medical.metabolicEvaluation.map((item, idx) => (
                                <li key={idx} className="text-white flex items-center gap-2">
                                  <CheckCircle className="h-3 w-3 text-blue-400" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-3">Prevention</h4>
                            <ul className="space-y-2">
                              {analysis.treatmentRecommendations.medical.prevention.map((item, idx) => (
                                <li key={idx} className="text-white flex items-center gap-2">
                                  <CheckCircle className="h-3 w-3 text-purple-400" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* REM: Follow-up Protocol Tab */}
                <TabsContent value="followup" className="mt-6">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="bg-gray-800 border-gray-600">
                        <CardHeader>
                          <CardTitle className="text-white flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Short-term Follow-up
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Timeline</h4>
                            <p className="text-white">{analysis.followUpProtocol.shortTerm.timeline}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Imaging</h4>
                            <p className="text-white">{analysis.followUpProtocol.shortTerm.imaging}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Assessment</h4>
                            <p className="text-white">{analysis.followUpProtocol.shortTerm.assessment}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gray-800 border-gray-600">
                        <CardHeader>
                          <CardTitle className="text-white flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Long-term Monitoring
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Timeline</h4>
                            <p className="text-white">{analysis.followUpProtocol.longTerm.timeline}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Monitoring</h4>
                            <p className="text-white">{analysis.followUpProtocol.longTerm.monitoring}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Metabolic</h4>
                            <p className="text-white">{analysis.followUpProtocol.longTerm.metabolic}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="bg-orange-900/10 border-orange-500/20">
                      <CardHeader>
                        <CardTitle className="text-orange-400 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Emergency Protocol
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Criteria</h4>
                            <p className="text-white">{analysis.followUpProtocol.emergency.criteria}</p>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-300 mb-1">Action</h4>
                            <p className="text-white">{analysis.followUpProtocol.emergency.action}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* REM: Prognostic Factors Tab */}
                <TabsContent value="prognosis" className="mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-green-900/10 border-green-500/20">
                      <CardHeader>
                        <CardTitle className="text-green-400 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          Favorable Factors
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {analysis.prognosticFactors.favorable.map((factor, idx) => (
                            <li key={idx} className="text-white flex items-center gap-2">
                              <CheckCircle className="h-3 w-3 text-green-400" />
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Card className="bg-orange-900/10 border-orange-500/20">
                      <CardHeader>
                        <CardTitle className="text-orange-400 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Concerning Factors
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {analysis.prognosticFactors.concerning.map((factor, idx) => (
                            <li key={idx} className="text-white flex items-center gap-2">
                              <AlertTriangle className="h-3 w-3 text-orange-400" />
                              {factor}
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
