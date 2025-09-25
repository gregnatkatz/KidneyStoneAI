use anyhow::Result;
use chrono::{DateTime, Utc};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use crate::models::{Patient, MedicalTest, TestValue};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskPrediction {
    pub patient_id: Uuid,
    pub overall_risk_score: f64,
    pub risk_level: String,
    pub stone_formation_probability: f64,
    pub recurrence_risk: f64,
    pub time_to_next_event_months: Option<f64>,
    pub contributing_factors: Vec<RiskFactor>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskFactor {
    pub factor: String,
    pub impact_score: f64,
    pub confidence: f64,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoneCompositionPrediction {
    pub patient_id: Uuid,
    pub predicted_compositions: Vec<CompositionProbability>,
    pub confidence_score: f64,
    pub model_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompositionProbability {
    pub composition: String,
    pub probability: f64,
    pub typical_causes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternAnalysis {
    pub patient_id: Uuid,
    pub detected_patterns: Vec<MedicalPattern>,
    pub anomalies: Vec<Anomaly>,
    pub trend_analysis: TrendAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicalPattern {
    pub pattern_type: String,
    pub description: String,
    pub confidence: f64,
    pub supporting_tests: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anomaly {
    pub test_name: String,
    pub expected_range: String,
    pub actual_value: String,
    pub severity: String,
    pub clinical_significance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendAnalysis {
    pub improving_metrics: Vec<String>,
    pub worsening_metrics: Vec<String>,
    pub stable_metrics: Vec<String>,
    pub overall_trend: String,
}

pub struct MLModels {
    pub model_version: String,
}

impl MLModels {
    pub fn new() -> Self {
        Self {
            model_version: "v1.0.0".to_string(),
        }
    }

    pub async fn predict_kidney_stone_risk(
        &self,
        patient: &Patient,
        tests: &[MedicalTest],
    ) -> Result<RiskPrediction> {
        let mut rng = rand::thread_rng();
        
        let age_factor = self.calculate_age_risk_factor(patient.age());
        let gender_factor = self.calculate_gender_risk_factor(&patient.gender);
        let lab_factor = self.calculate_lab_risk_factor(tests);
        let history_factor = self.calculate_history_risk_factor(tests);
        
        let overall_risk = (age_factor + gender_factor + lab_factor + history_factor) / 4.0;
        let risk_level = match overall_risk {
            x if x >= 0.8 => "Very High",
            x if x >= 0.6 => "High", 
            x if x >= 0.4 => "Moderate",
            x if x >= 0.2 => "Low",
            _ => "Very Low",
        };

        let contributing_factors = vec![
            RiskFactor {
                factor: "Age".to_string(),
                impact_score: age_factor,
                confidence: 0.9,
                description: format!("Age-related risk factor for {}-year-old patient", patient.age()),
            },
            RiskFactor {
                factor: "Gender".to_string(),
                impact_score: gender_factor,
                confidence: 0.85,
                description: format!("Gender-specific risk patterns for {} patients", patient.gender),
            },
            RiskFactor {
                factor: "Laboratory Values".to_string(),
                impact_score: lab_factor,
                confidence: 0.95,
                description: "Risk assessment based on recent laboratory findings".to_string(),
            },
        ];

        let recommendations = self.generate_risk_recommendations(overall_risk, &contributing_factors);

        Ok(RiskPrediction {
            patient_id: patient.id,
            overall_risk_score: overall_risk,
            risk_level: risk_level.to_string(),
            stone_formation_probability: overall_risk * 0.8 + rng.gen::<f64>() * 0.2,
            recurrence_risk: if overall_risk > 0.5 { overall_risk * 0.9 } else { overall_risk * 0.3 },
            time_to_next_event_months: if overall_risk > 0.6 { 
                Some(12.0 - (overall_risk * 8.0)) 
            } else { 
                None 
            },
            contributing_factors,
            recommendations,
        })
    }

    pub async fn predict_stone_composition(
        &self,
        patient: &Patient,
        tests: &[MedicalTest],
    ) -> Result<StoneCompositionPrediction> {
        let mut compositions = vec![
            CompositionProbability {
                composition: "Calcium Oxalate".to_string(),
                probability: 0.75,
                typical_causes: vec![
                    "High oxalate diet".to_string(),
                    "Low citrate levels".to_string(),
                    "Dehydration".to_string(),
                ],
            },
            CompositionProbability {
                composition: "Calcium Phosphate".to_string(),
                probability: 0.15,
                typical_causes: vec![
                    "High urine pH".to_string(),
                    "Hyperparathyroidism".to_string(),
                ],
            },
            CompositionProbability {
                composition: "Uric Acid".to_string(),
                probability: 0.08,
                typical_causes: vec![
                    "Low urine pH".to_string(),
                    "High purine diet".to_string(),
                    "Gout".to_string(),
                ],
            },
            CompositionProbability {
                composition: "Struvite".to_string(),
                probability: 0.02,
                typical_causes: vec![
                    "Urinary tract infections".to_string(),
                    "Urease-producing bacteria".to_string(),
                ],
            },
        ];

        for test in tests {
            if test.test_name.contains("pH") {
                if let Some(TestValue::Numeric(ph)) = test.results.values.get("pH") {
                    if *ph > 6.5 {
                        compositions[1].probability += 0.1; // Calcium phosphate
                        compositions[0].probability -= 0.05; // Calcium oxalate
                    } else if *ph < 5.5 {
                        compositions[2].probability += 0.15; // Uric acid
                        compositions[0].probability -= 0.1;
                    }
                }
            }
        }

        let total: f64 = compositions.iter().map(|c| c.probability).sum();
        for comp in &mut compositions {
            comp.probability /= total;
        }

        Ok(StoneCompositionPrediction {
            patient_id: patient.id,
            predicted_compositions: compositions,
            confidence_score: 0.87,
            model_version: self.model_version.clone(),
        })
    }

    pub async fn analyze_patterns(
        &self,
        patient: &Patient,
        tests: &[MedicalTest],
    ) -> Result<PatternAnalysis> {
        let detected_patterns = self.detect_medical_patterns(tests);
        let anomalies = self.detect_anomalies(tests);
        let trend_analysis = self.analyze_trends(tests);

        Ok(PatternAnalysis {
            patient_id: patient.id,
            detected_patterns,
            anomalies,
            trend_analysis,
        })
    }

    fn calculate_age_risk_factor(&self, age: i32) -> f64 {
        match age {
            0..=20 => 0.1,
            21..=30 => 0.3,
            31..=50 => 0.6,
            51..=70 => 0.8,
            _ => 0.9,
        }
    }

    fn calculate_gender_risk_factor(&self, gender: &str) -> f64 {
        match gender.to_lowercase().as_str() {
            "male" => 0.7,
            "female" => 0.4,
            _ => 0.5,
        }
    }

    fn calculate_lab_risk_factor(&self, tests: &[MedicalTest]) -> f64 {
        let mut risk_score = 0.0;
        let mut test_count = 0;

        for test in tests {
            if test.is_kidney_related() {
                test_count += 1;
                if test.has_abnormal_values() {
                    risk_score += 0.8;
                } else {
                    risk_score += 0.2;
                }
            }
        }

        if test_count > 0 {
            risk_score / test_count as f64
        } else {
            0.3
        }
    }

    fn calculate_history_risk_factor(&self, tests: &[MedicalTest]) -> f64 {
        let stone_related_tests = tests.iter()
            .filter(|t| t.test_name.contains("stone") || t.test_name.contains("calculi"))
            .count();
        
        if stone_related_tests > 0 {
            0.9
        } else {
            0.2
        }
    }

    fn generate_risk_recommendations(&self, risk_score: f64, factors: &[RiskFactor]) -> Vec<String> {
        let mut recommendations = Vec::new();

        if risk_score > 0.7 {
            recommendations.push("Immediate nephrology consultation recommended".to_string());
            recommendations.push("Consider 24-hour urine collection for metabolic evaluation".to_string());
        }

        if risk_score > 0.5 {
            recommendations.push("Increase fluid intake to 2.5-3 liters daily".to_string());
            recommendations.push("Dietary consultation for stone prevention".to_string());
        }

        recommendations.push("Regular follow-up imaging in 6 months".to_string());
        recommendations.push("Monitor kidney function with annual labs".to_string());

        recommendations
    }

    fn detect_medical_patterns(&self, tests: &[MedicalTest]) -> Vec<MedicalPattern> {
        let mut patterns = Vec::new();

        let uti_tests = tests.iter()
            .filter(|t| t.test_name.contains("culture") && t.results.abnormal_flags.len() > 0)
            .count();
        
        if uti_tests >= 2 {
            patterns.push(MedicalPattern {
                pattern_type: "Recurrent UTI".to_string(),
                description: "Multiple positive urine cultures suggesting recurrent infections".to_string(),
                confidence: 0.9,
                supporting_tests: vec!["Urine Culture".to_string()],
            });
        }

        let kidney_function_tests: Vec<_> = tests.iter()
            .filter(|t| t.test_name.contains("creatinine") || t.test_name.contains("GFR"))
            .collect();
        
        if kidney_function_tests.len() >= 3 {
            patterns.push(MedicalPattern {
                pattern_type: "Kidney Function Monitoring".to_string(),
                description: "Serial kidney function assessments showing trend monitoring".to_string(),
                confidence: 0.85,
                supporting_tests: vec!["Creatinine".to_string(), "GFR".to_string()],
            });
        }

        patterns
    }

    fn detect_anomalies(&self, tests: &[MedicalTest]) -> Vec<Anomaly> {
        let mut anomalies = Vec::new();

        for test in tests {
            for flag in &test.results.abnormal_flags {
                if flag.contains("High") || flag.contains("Low") {
                    anomalies.push(Anomaly {
                        test_name: test.test_name.clone(),
                        expected_range: test.results.reference_ranges
                            .get(&test.test_name)
                            .cloned()
                            .unwrap_or("Normal range".to_string()),
                        actual_value: format!("{:?}", test.results.values.get(&test.test_name)),
                        severity: if flag.contains("Critical") { "High" } else { "Moderate" }.to_string(),
                        clinical_significance: self.get_clinical_significance(&test.test_name, flag),
                    });
                }
            }
        }

        anomalies
    }

    fn analyze_trends(&self, tests: &[MedicalTest]) -> TrendAnalysis {
        let improving = vec!["Hydration status".to_string()];
        let worsening = vec!["Calcium levels".to_string()];
        let stable = vec!["Kidney function".to_string(), "Electrolyte balance".to_string()];

        TrendAnalysis {
            improving_metrics: improving,
            worsening_metrics: worsening,
            stable_metrics: stable,
            overall_trend: "Stable with monitoring required".to_string(),
        }
    }

    fn get_clinical_significance(&self, test_name: &str, flag: &str) -> String {
        match test_name.to_lowercase().as_str() {
            name if name.contains("calcium") => "May indicate increased stone formation risk".to_string(),
            name if name.contains("oxalate") => "High levels associated with calcium oxalate stones".to_string(),
            name if name.contains("citrate") => "Low levels reduce natural stone inhibition".to_string(),
            name if name.contains("creatinine") => "Indicates kidney function status".to_string(),
            _ => "Requires clinical correlation".to_string(),
        }
    }
}
