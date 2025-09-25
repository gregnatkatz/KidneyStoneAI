use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc, Datelike};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Patient {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: DateTime<Utc>,
    pub gender: String,
    pub email: String,
    pub phone: String,
    pub address: Address,
    pub medical_record_number: String,
    pub insurance_provider: String,
    pub emergency_contact: EmergencyContact,
    pub avatar_url: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Address {
    pub street: String,
    pub city: String,
    pub state: String,
    pub zip_code: String,
    pub country: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmergencyContact {
    pub name: String,
    pub relationship: String,
    pub phone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicalTest {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub test_type: String,
    pub test_name: String,
    pub test_date: DateTime<Utc>,
    pub ordered_by: String,
    pub facility: String,
    pub results: TestResults,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResults {
    pub values: std::collections::HashMap<String, TestValue>,
    pub interpretation: String,
    pub reference_ranges: std::collections::HashMap<String, String>,
    pub abnormal_flags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TestValue {
    Numeric(f64),
    Text(String),
    Boolean(bool),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KidneyStoneAnalysis {
    pub patient_id: Uuid,
    pub analysis_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub risk_score: f64,
    pub risk_level: String,
    pub stone_composition_prediction: Vec<StoneComposition>,
    pub recommendations: Vec<String>,
    pub agent_insights: AgentInsights,
    pub follow_up_tests: Vec<String>,
    pub lifestyle_recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoneComposition {
    pub mineral: String,
    pub probability: f64,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInsights {
    pub medparse_findings: Vec<String>,
    pub gpt5_analysis: String,
    pub deepseek_patterns: Vec<PatternMatch>,
    pub coordination_summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternMatch {
    pub pattern_type: String,
    pub confidence: f64,
    pub description: String,
    pub supporting_evidence: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCategory {
    pub name: String,
    pub tests: Vec<String>,
    pub frequency: String,
    pub importance: String,
}

impl Patient {
    pub fn age(&self) -> i32 {
        let now = Utc::now();
        let age = now.year() - self.date_of_birth.year();
        if now.month() < self.date_of_birth.month() ||
           (now.month() == self.date_of_birth.month() && now.day() < self.date_of_birth.day()) {
            age - 1
        } else {
            age
        }
    }
    
    pub fn full_name(&self) -> String {
        format!("{} {}", self.first_name, self.last_name)
    }
}

impl MedicalTest {
    pub fn is_kidney_related(&self) -> bool {
        let kidney_tests = [
            "urinalysis", "urine_culture", "24_hour_urine", "kidney_function",
            "creatinine", "bun", "gfr", "cystatin_c", "ct_scan", "ultrasound",
            "stone_analysis", "calcium", "oxalate", "citrate", "uric_acid"
        ];
        
        kidney_tests.iter().any(|&test| 
            self.test_type.to_lowercase().contains(test) ||
            self.test_name.to_lowercase().contains(test)
        )
    }
    
    pub fn has_abnormal_values(&self) -> bool {
        !self.results.abnormal_flags.is_empty()
    }
}
