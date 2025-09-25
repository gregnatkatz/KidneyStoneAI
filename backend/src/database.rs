use anyhow::Result;
use chrono::{DateTime, Utc, Duration, TimeZone, Datelike};
use fake::{Fake, Faker};
use fake::faker::name::en::*;
use fake::faker::internet::en::*;
use fake::faker::phone_number::en::*;
use rand::Rng;
use serde_json::json;
use std::collections::HashMap;
use uuid::Uuid;

use crate::models::{Patient, MedicalTest, Address, EmergencyContact, TestResults, TestValue};

pub struct Database {
    patients: Vec<Patient>,
    tests: Vec<MedicalTest>,
}

impl Database {
    pub async fn new() -> Result<Self> {
        let mut db = Self {
            patients: Vec::new(),
            tests: Vec::new(),
        };
        
        db.generate_synthetic_data().await?;
        
        Ok(db)
    }
    
    pub async fn generate_synthetic_data(&mut self) -> Result<()> {
        println!("Generating 1000 synthetic patients with 2-year medical history...");
        
        let mut rng = rand::thread_rng();
        
        for i in 0..1000 {
            let patient_id = Uuid::new_v4();
            let patient = self.generate_patient(patient_id, &mut rng);
            
            let tests = self.generate_patient_tests(patient_id, &mut rng);
            
            self.patients.push(patient);
            self.tests.extend(tests);
            
            if i % 200 == 0 {
                println!("Generated {} patients...", i);
            }
        }
        
        println!("Synthetic data generation completed!");
        println!("Total patients: {}", self.patients.len());
        println!("Total medical tests: {}", self.tests.len());
        
        Ok(())
    }
    
    pub fn get_patient_condition_type(&self, patient_id: Uuid) -> String {
        let hash = patient_id.as_u128() % 4;
        match hash {
            0 => "normal".to_string(),
            1 => "cyst".to_string(),
            2 => "tumor".to_string(),
            _ => "stone".to_string(),
        }
    }

    pub async fn get_patients(&self, limit: usize) -> Result<Vec<Patient>> {
        Ok(self.patients.iter().take(limit).cloned().collect())
    }
    
    pub async fn get_patient(&self, id: Uuid) -> Result<Option<Patient>> {
        Ok(self.patients.iter().find(|p| p.id == id).cloned())
    }
    
    pub async fn get_patient_tests(&self, patient_id: Uuid) -> Result<Vec<MedicalTest>> {
        Ok(self.tests.iter()
            .filter(|t| t.patient_id == patient_id)
            .cloned()
            .collect())
    }
    
    fn generate_patient(&self, id: Uuid, rng: &mut impl Rng) -> Patient {
        let gender = if rng.gen_range(0..100) < 55 { "Male" } else if rng.gen_range(0..100) < 90 { "Female" } else { "Other" };
        
        let age = match rng.gen_range(0..100) {
            0..=10 => rng.gen_range(18..30),   
            11..=25 => rng.gen_range(30..40),  
            26..=60 => rng.gen_range(40..50),  
            61..=85 => rng.gen_range(50..60),  
            _ => rng.gen_range(60..81),         
        };
        
        let birth_year = Utc::now().year() - age;
        let birth_month = rng.gen_range(1..13);
        let birth_day = rng.gen_range(1..29);
        let date_of_birth = Utc.with_ymd_and_hms(birth_year, birth_month, birth_day, 0, 0, 0).unwrap();
        
        let first_name: String = FirstName().fake();
        let last_name: String = LastName().fake();
        
        let avatar_url = self.generate_avatar_url(&gender, age, rng);
        
        let email: String = SafeEmail().fake();
        let phone: String = PhoneNumber().fake();
        
        let states = ["CA", "TX", "FL", "NY", "PA", "IL", "OH", "GA", "NC", "MI"];
        let cities = ["Los Angeles", "Houston", "Miami", "New York", "Philadelphia", "Chicago", "Columbus", "Atlanta", "Charlotte", "Detroit"];
        let state = states[rng.gen_range(0..states.len())];
        let city = cities[rng.gen_range(0..cities.len())];
        
        let insurance_providers = ["Blue Cross Blue Shield", "Aetna", "Cigna", "UnitedHealth", "Humana", "Kaiser Permanente", "Anthem", "Molina Healthcare"];
        
        Patient {
            id,
            first_name: first_name.clone(),
            last_name: last_name.clone(),
            date_of_birth,
            gender: gender.to_string(),
            email,
            phone,
            address: Address {
                street: format!("{} {} St", rng.gen_range(100..9999), ["Main", "Oak", "Pine", "Elm", "Cedar"][rng.gen_range(0..5)]),
                city: city.to_string(),
                state: state.to_string(),
                zip_code: format!("{:05}", rng.gen_range(10000..99999)),
                country: "USA".to_string(),
            },
            medical_record_number: format!("MRN{:08}", rng.gen_range(10000000..99999999)),
            insurance_provider: insurance_providers[rng.gen_range(0..insurance_providers.len())].to_string(),
            emergency_contact: EmergencyContact {
                name: format!("{} {}", FirstName().fake::<String>(), LastName().fake::<String>()),
                relationship: ["Spouse", "Parent", "Sibling", "Child", "Friend"][rng.gen_range(0..5)].to_string(),
                phone: PhoneNumber().fake(),
            },
            avatar_url,
            created_at: Utc::now() - Duration::days(rng.gen_range(30..730)),
            updated_at: Utc::now() - Duration::days(rng.gen_range(1..30)),
        }
    }
    
    fn generate_avatar_url(&self, gender: &str, age: i32, rng: &mut impl Rng) -> String {
        let age_group = if age < 30 { "young" } else if age < 50 { "middle" } else { "senior" };
        let gender_code = match gender {
            "Male" => "male",
            "Female" => "female",
            _ => "neutral"
        };
        let variant = rng.gen_range(1..=5);
        
        format!("https://api.dicebear.com/7.x/avataaars/svg?seed={}-{}-{}&backgroundColor=transparent", 
                gender_code, age_group, variant)
    }
    
    fn generate_patient_tests(&self, patient_id: Uuid, rng: &mut impl Rng) -> Vec<MedicalTest> {
        let mut tests = Vec::new();
        let start_date = Utc::now() - Duration::days(730); // 2 years ago
        let patient_condition = self.get_patient_condition_type(patient_id);
        
        let test_configs = vec![
            ("Laboratory", "Complete Blood Count", 90, true),
            ("Laboratory", "Basic Metabolic Panel", 90, true),
            ("Laboratory", "Lipid Panel", 180, false),
            ("Laboratory", "Urinalysis", 120, true),
            ("Laboratory", "24-Hour Urine Collection", 365, true),
            ("Imaging", "CT Scan (Non-contrast)", 365, true),
            ("Imaging", "Kidney Ultrasound", 180, true),
            ("Laboratory", "Kidney Function Panel", 90, true),
            ("Laboratory", "Calcium Level", 120, true),
            ("Laboratory", "Uric Acid Level", 120, true),
            ("Laboratory", "Parathyroid Hormone (PTH)", 180, false),
            ("Laboratory", "Vitamin D Level", 180, false),
            ("Imaging", "X-ray KUB", 365, true),
            ("Laboratory", "Stone Analysis", 730, true),
            ("Laboratory", "Cystatin C", 180, false),
        ];
        
        let facilities = ["City General Hospital", "Regional Medical Center", "University Hospital", "Community Health Center", "Specialty Clinic"];
        let doctors = ["Dr. Smith", "Dr. Johnson", "Dr. Williams", "Dr. Brown", "Dr. Davis", "Dr. Miller"];
        
        for (test_type, test_name, frequency_days, is_kidney_related) in test_configs {
            let mut current_date = start_date;
            
            while current_date <= Utc::now() {
                if rng.gen_bool(0.8) { // 80% chance of having the test
                    let test = MedicalTest {
                        id: Uuid::new_v4(),
                        patient_id,
                        test_type: test_type.to_string(),
                        test_name: test_name.to_string(),
                        test_date: current_date + Duration::days(rng.gen_range(-7..8)), // ±7 days variation
                        ordered_by: doctors[rng.gen_range(0..doctors.len())].to_string(),
                        facility: facilities[rng.gen_range(0..facilities.len())].to_string(),
                        results: self.generate_test_results(test_name, is_kidney_related, &patient_condition, rng),
                        status: "Completed".to_string(),
                        notes: if rng.gen_bool(0.3) { 
                            Some("Patient reported no symptoms".to_string()) 
                        } else { 
                            None 
                        },
                        created_at: current_date,
                    };
                    tests.push(test);
                }
                
                current_date = current_date + Duration::days(frequency_days + rng.gen_range(-14..15));
            }
        }
        
        tests
    }
    
    fn generate_test_results(&self, test_name: &str, is_kidney_related: bool, patient_condition: &str, rng: &mut impl Rng) -> TestResults {
        let mut values = HashMap::new();
        let mut reference_ranges = HashMap::new();
        let mut abnormal_flags = Vec::new();
        
        match test_name {
            "Complete Blood Count" => {
                let wbc = rng.gen_range(4.0..11.0);
                let rbc = rng.gen_range(4.2..5.4);
                let hemoglobin = rng.gen_range(12.0..16.0);
                let hematocrit = rng.gen_range(36.0..46.0);
                
                values.insert("WBC".to_string(), TestValue::Numeric(wbc));
                values.insert("RBC".to_string(), TestValue::Numeric(rbc));
                values.insert("Hemoglobin".to_string(), TestValue::Numeric(hemoglobin));
                values.insert("Hematocrit".to_string(), TestValue::Numeric(hematocrit));
                
                reference_ranges.insert("WBC".to_string(), "4.0-11.0 K/uL".to_string());
                reference_ranges.insert("RBC".to_string(), "4.2-5.4 M/uL".to_string());
                reference_ranges.insert("Hemoglobin".to_string(), "12.0-16.0 g/dL".to_string());
                reference_ranges.insert("Hematocrit".to_string(), "36.0-46.0%".to_string());
            },
            "Basic Metabolic Panel" => {
                let glucose = rng.gen_range(70.0..140.0);
                let mut bun = rng.gen_range(7.0..25.0);
                let mut creatinine = rng.gen_range(0.6..1.3);
                let sodium = rng.gen_range(135.0..145.0);
                let potassium = rng.gen_range(3.5..5.0);
                let chloride = rng.gen_range(98.0..107.0);
                let co2 = rng.gen_range(22.0..28.0);
                
                if patient_condition == "stone" && rng.gen_bool(0.4) {
                    creatinine = rng.gen_range(1.2..1.8);
                    bun = rng.gen_range(20.0..35.0);
                }
                
                values.insert("Glucose".to_string(), TestValue::Numeric(glucose));
                values.insert("BUN".to_string(), TestValue::Numeric(bun));
                values.insert("Creatinine".to_string(), TestValue::Numeric(creatinine));
                values.insert("Sodium".to_string(), TestValue::Numeric(sodium));
                values.insert("Potassium".to_string(), TestValue::Numeric(potassium));
                values.insert("Chloride".to_string(), TestValue::Numeric(chloride));
                values.insert("CO2".to_string(), TestValue::Numeric(co2));
                
                reference_ranges.insert("Glucose".to_string(), "70-140 mg/dL".to_string());
                reference_ranges.insert("BUN".to_string(), "7-25 mg/dL".to_string());
                reference_ranges.insert("Creatinine".to_string(), "0.6-1.3 mg/dL".to_string());
                
                if creatinine > 1.2 {
                    abnormal_flags.push("Elevated creatinine".to_string());
                }
                if bun > 20.0 {
                    abnormal_flags.push("Elevated BUN".to_string());
                }
            },
            "Urinalysis" => {
                let specific_gravity = rng.gen_range(1.003..1.030);
                let ph = rng.gen_range(4.6..8.0);
                let mut protein = "Negative";
                let glucose = if rng.gen_bool(0.05) { "Positive" } else { "Negative" };
                let ketones = if rng.gen_bool(0.02) { "Trace" } else { "Negative" };
                let mut blood = "Negative";
                let nitrites = if rng.gen_bool(0.08) { "Positive" } else { "Negative" };
                let leukocyte_esterase = if rng.gen_bool(0.12) { "Positive" } else { "Negative" };
                
                if patient_condition == "stone" {
                    if rng.gen_bool(0.7) { blood = "Trace"; }
                    if rng.gen_bool(0.3) { protein = "Trace"; }
                } else {
                    if rng.gen_bool(0.05) { protein = "Trace"; }
                    if rng.gen_bool(0.05) { blood = "Trace"; }
                }
                
                values.insert("Specific_Gravity".to_string(), TestValue::Numeric(specific_gravity));
                values.insert("pH".to_string(), TestValue::Numeric(ph));
                values.insert("Protein".to_string(), TestValue::Text(protein.to_string()));
                values.insert("Glucose".to_string(), TestValue::Text(glucose.to_string()));
                values.insert("Ketones".to_string(), TestValue::Text(ketones.to_string()));
                values.insert("Blood".to_string(), TestValue::Text(blood.to_string()));
                values.insert("Nitrites".to_string(), TestValue::Text(nitrites.to_string()));
                values.insert("Leukocyte_Esterase".to_string(), TestValue::Text(leukocyte_esterase.to_string()));
                
                if protein == "Trace" { abnormal_flags.push("Proteinuria".to_string()); }
                if blood == "Trace" { abnormal_flags.push("Hematuria".to_string()); }
                if nitrites == "Positive" { abnormal_flags.push("Possible UTI".to_string()); }
            },
            "24-Hour Urine Collection" => {
                let volume = rng.gen_range(800.0..3000.0);
                let mut calcium = rng.gen_range(50.0..300.0);
                let mut oxalate = rng.gen_range(10.0..40.0);
                let mut citrate = rng.gen_range(300.0..900.0);
                let mut uric_acid = rng.gen_range(250.0..800.0);
                let sodium = rng.gen_range(40.0..220.0);
                let creatinine = rng.gen_range(800.0..2500.0);
                
                if patient_condition == "stone" {
                    if rng.gen_bool(0.6) { calcium = rng.gen_range(300.0..500.0); }
                    if rng.gen_bool(0.5) { oxalate = rng.gen_range(40.0..80.0); }
                    if rng.gen_bool(0.4) { citrate = rng.gen_range(100.0..300.0); }
                    if rng.gen_bool(0.3) { uric_acid = rng.gen_range(800.0..1200.0); }
                }
                
                values.insert("Volume".to_string(), TestValue::Numeric(volume));
                values.insert("Calcium".to_string(), TestValue::Numeric(calcium));
                values.insert("Oxalate".to_string(), TestValue::Numeric(oxalate));
                values.insert("Citrate".to_string(), TestValue::Numeric(citrate));
                values.insert("Uric_Acid".to_string(), TestValue::Numeric(uric_acid));
                values.insert("Sodium".to_string(), TestValue::Numeric(sodium));
                values.insert("Creatinine".to_string(), TestValue::Numeric(creatinine));
                
                reference_ranges.insert("Calcium".to_string(), "50-300 mg/24hr".to_string());
                reference_ranges.insert("Oxalate".to_string(), "10-40 mg/24hr".to_string());
                reference_ranges.insert("Citrate".to_string(), "300-900 mg/24hr".to_string());
                
                if calcium > 300.0 { abnormal_flags.push("Hypercalciuria".to_string()); }
                if oxalate > 40.0 { abnormal_flags.push("Hyperoxaluria".to_string()); }
                if citrate < 300.0 { abnormal_flags.push("Hypocitraturia".to_string()); }
                if uric_acid > 800.0 { abnormal_flags.push("Hyperuricosuria".to_string()); }
            },
            "Calcium Level" => {
                let mut calcium = rng.gen_range(8.5..10.2);
                
                if patient_condition == "stone" && rng.gen_bool(0.3) {
                    calcium = rng.gen_range(10.2..11.0);
                }
                
                values.insert("Calcium".to_string(), TestValue::Numeric(calcium));
                reference_ranges.insert("Calcium".to_string(), "8.5-10.5 mg/dL".to_string());
                
                if calcium > 10.2 { abnormal_flags.push("Hypercalcemia".to_string()); }
                if calcium < 8.8 { abnormal_flags.push("Hypocalcemia".to_string()); }
            },
            "Uric Acid Level" => {
                let mut uric_acid = rng.gen_range(2.5..7.0);
                
                if patient_condition == "stone" && rng.gen_bool(0.4) {
                    uric_acid = rng.gen_range(7.0..9.5);
                }
                
                values.insert("Uric_Acid".to_string(), TestValue::Numeric(uric_acid));
                reference_ranges.insert("Uric_Acid".to_string(), "2.5-7.0 mg/dL".to_string());
                
                if uric_acid > 7.0 { abnormal_flags.push("Hyperuricemia".to_string()); }
            },
            "CT Scan (Non-contrast)" => {
                let findings = match patient_condition {
                    "stone" => {
                        if rng.gen_bool(0.8) {
                            "Nephrolithiasis identified in right kidney, measuring 4mm"
                        } else if rng.gen_bool(0.6) {
                            "Small kidney stone identified in left kidney with mild hydronephrosis"
                        } else {
                            "Multiple small kidney stones noted bilaterally"
                        }
                    },
                    "cyst" => {
                        if rng.gen_bool(0.7) {
                            "Simple renal cyst identified in left kidney"
                        } else {
                            "Multiple simple renal cysts noted"
                        }
                    },
                    "tumor" => {
                        if rng.gen_bool(0.8) {
                            "Solid renal mass identified requiring further evaluation"
                        } else {
                            "Heterogeneous renal lesion noted"
                        }
                    },
                    _ => {
                        if rng.gen_bool(0.9) {
                            "No acute abnormalities"
                        } else {
                            "Normal kidney size and morphology"
                        }
                    }
                };
                
                values.insert("Findings".to_string(), TestValue::Text(findings.to_string()));
                
                if findings.contains("stone") || findings.contains("Nephrolithiasis") { 
                    abnormal_flags.push("Kidney stone present".to_string()); 
                }
                if findings.contains("hydronephrosis") { 
                    abnormal_flags.push("Hydronephrosis".to_string()); 
                }
                if findings.contains("cyst") { 
                    abnormal_flags.push("Renal cyst identified".to_string()); 
                }
                if findings.contains("mass") || findings.contains("lesion") { 
                    abnormal_flags.push("Renal mass requires evaluation".to_string()); 
                }
            },
            "Kidney Ultrasound" => {
                let findings = match patient_condition {
                    "stone" => {
                        if rng.gen_bool(0.7) {
                            "Echogenic focus suggestive of kidney stone"
                        } else {
                            "Acoustic shadowing consistent with nephrolithiasis"
                        }
                    },
                    "cyst" => {
                        "Anechoic lesion consistent with simple renal cyst"
                    },
                    "tumor" => {
                        "Heterogeneous echogenicity concerning for renal mass"
                    },
                    _ => {
                        if rng.gen_bool(0.9) {
                            "Normal kidney size and echogenicity"
                        } else {
                            "No focal lesions identified"
                        }
                    }
                };
                
                values.insert("Findings".to_string(), TestValue::Text(findings.to_string()));
                
                if findings.contains("stone") || findings.contains("nephrolithiasis") { 
                    abnormal_flags.push("Possible kidney stone".to_string()); 
                }
                if findings.contains("cyst") { 
                    abnormal_flags.push("Renal cyst identified".to_string()); 
                }
                if findings.contains("mass") { 
                    abnormal_flags.push("Renal mass identified".to_string()); 
                }
            },
            "Stone Analysis" => {
                if patient_condition == "stone" {
                    let compositions = ["Calcium oxalate monohydrate", "Calcium oxalate dihydrate", "Calcium phosphate", "Uric acid", "Struvite", "Cystine"];
                    let composition = compositions[rng.gen_range(0..compositions.len())];
                    values.insert("Composition".to_string(), TestValue::Text(composition.to_string()));
                    values.insert("Size".to_string(), TestValue::Text(format!("{}mm", rng.gen_range(2..15))));
                    abnormal_flags.push(format!("{} stone identified", composition));
                } else {
                    values.insert("Result".to_string(), TestValue::Text("No stone available for analysis".to_string()));
                }
            },
            _ => {
                values.insert("Result".to_string(), TestValue::Text("Normal".to_string()));
            }
        }
        
        let interpretation = if abnormal_flags.is_empty() {
            "Results within normal limits".to_string()
        } else {
            format!("Abnormal findings: {}", abnormal_flags.join(", "))
        };
        
        TestResults {
            values,
            interpretation,
            reference_ranges,
            abnormal_flags,
        }
    }
}
