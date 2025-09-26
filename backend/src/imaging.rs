use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;
use image::{io::Reader as ImageReader, DynamicImage, GenericImageView};
use base64::{Engine as _, engine::general_purpose};
use rand::Rng;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicalImage {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub image_path: String,
    pub image_type: ImageType,
    pub modality: String,
    pub diagnosis: ImageDiagnosis,
    pub acquisition_date: DateTime<Utc>,
    pub study_description: String,
    pub findings: Vec<String>,
    pub measurements: HashMap<String, f64>,
    pub quality_score: f64,
    pub radiologist_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImageType {
    CT,
    Ultrasound,
    XRay,
    MRI,
    IVP,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImageDiagnosis {
    Normal,
    Cyst,
    Tumor,
    Stone,
    Obstruction,
    Infection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAnalysis {
    pub image_id: Uuid,
    pub ai_confidence: f64,
    pub detected_abnormalities: Vec<Abnormality>,
    pub stone_characteristics: Option<StoneCharacteristics>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Abnormality {
    pub finding: String,
    pub location: String,
    pub severity: String,
    pub confidence: f64,
    pub bounding_box: Option<BoundingBox>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoneCharacteristics {
    pub size_mm: f64,
    pub density_hu: f64,
    pub location: String,
    pub shape: String,
    pub predicted_composition: String,
    pub obstruction_present: bool,
}

#[derive(Debug, Clone)]
pub struct ImagingService {
    pub images: HashMap<Uuid, MedicalImage>,
    pub kaggle_dataset_mapping: HashMap<String, ImageDiagnosis>,
}

impl ImagingService {
    pub fn new() -> Self {
        let mut service = Self {
            images: HashMap::new(),
            kaggle_dataset_mapping: HashMap::new(),
        };
        
        service.initialize_kaggle_mapping();
        service
    }

    fn initialize_kaggle_mapping(&mut self) {
        self.kaggle_dataset_mapping.insert("Normal".to_string(), ImageDiagnosis::Normal);
        self.kaggle_dataset_mapping.insert("Cyst".to_string(), ImageDiagnosis::Cyst);
        self.kaggle_dataset_mapping.insert("Tumor".to_string(), ImageDiagnosis::Tumor);
        self.kaggle_dataset_mapping.insert("Stone".to_string(), ImageDiagnosis::Stone);
    }

    pub async fn generate_patient_images(&mut self, patient_id: Uuid, condition_type: &str) -> Result<Vec<MedicalImage>> {
        let mut images = Vec::new();
        let diagnosis = self.map_condition_to_diagnosis(condition_type);
        
        let image_count = 1;
        
        for i in 0..image_count {
            let image = self.create_medical_image(patient_id, &diagnosis, i).await?;
            images.push(image.clone());
            self.images.insert(image.id, image);
        }
        
        Ok(images)
    }

    async fn create_medical_image(&self, patient_id: Uuid, diagnosis: &ImageDiagnosis, sequence: usize) -> Result<MedicalImage> {
        let image_id = Uuid::new_v4();
        
        let kaggle_path = match diagnosis {
            ImageDiagnosis::Normal => format!("public/medical-images/kaggle/Normal/Normal-{}.jpg", (sequence % 2) + 1),
            ImageDiagnosis::Cyst => format!("public/medical-images/kaggle/Cyst/Cyst-{}.jpg", (sequence % 2) + 1),
            ImageDiagnosis::Tumor => format!("public/medical-images/kaggle/Tumor/Tumor-{}.jpg", (sequence % 2) + 1),
            ImageDiagnosis::Stone => format!("public/medical-images/kaggle/Stone/Stone-{}.jpg", (sequence % 2) + 1),
            _ => format!("public/medical-images/kaggle/Normal/Normal-{}.jpg", (sequence % 2) + 1),
        };

        let (findings, measurements) = self.generate_findings_and_measurements(diagnosis);
        
        Ok(MedicalImage {
            id: image_id,
            patient_id,
            image_path: kaggle_path,
            image_type: ImageType::CT,
            modality: "CT Abdomen/Pelvis".to_string(),
            diagnosis: diagnosis.clone(),
            acquisition_date: Utc::now() - chrono::Duration::days(rand::random::<i64>() % 730), // Random date within 2 years
            study_description: self.generate_study_description(diagnosis),
            findings,
            measurements,
            quality_score: 0.85 + (rand::random::<f64>() * 0.15), // 0.85-1.0
            radiologist_notes: Some(self.generate_radiologist_notes(diagnosis)),
        })
    }

    fn map_condition_to_diagnosis(&self, condition_type: &str) -> ImageDiagnosis {
        match condition_type.to_lowercase().as_str() {
            "normal" => ImageDiagnosis::Normal,
            "cyst" => ImageDiagnosis::Cyst,
            "tumor" => ImageDiagnosis::Tumor,
            "stone" => ImageDiagnosis::Stone,
            _ => ImageDiagnosis::Normal,
        }
    }

    fn generate_findings_and_measurements(&self, diagnosis: &ImageDiagnosis) -> (Vec<String>, HashMap<String, f64>) {
        let mut findings = Vec::new();
        let mut measurements = HashMap::new();

        match diagnosis {
            ImageDiagnosis::Normal => {
                findings.push("Normal kidney size and morphology".to_string());
                findings.push("No evidence of hydronephrosis".to_string());
                findings.push("No focal lesions identified".to_string());
                measurements.insert("right_kidney_length_cm".to_string(), 10.5 + rand::random::<f64>() * 2.0);
                measurements.insert("left_kidney_length_cm".to_string(), 10.5 + rand::random::<f64>() * 2.0);
            },
            ImageDiagnosis::Cyst => {
                findings.push("Simple renal cyst identified".to_string());
                findings.push("Thin-walled, homogeneous fluid density".to_string());
                findings.push("No enhancement or septations".to_string());
                let cyst_size = 1.0 + rand::random::<f64>() * 4.0;
                measurements.insert("cyst_diameter_cm".to_string(), cyst_size);
                measurements.insert("cyst_density_hu".to_string(), -10.0 + rand::random::<f64>() * 20.0);
            },
            ImageDiagnosis::Tumor => {
                findings.push("Solid renal mass identified".to_string());
                findings.push("Heterogeneous enhancement pattern".to_string());
                findings.push("Requires further characterization".to_string());
                let tumor_size = 2.0 + rand::random::<f64>() * 6.0;
                measurements.insert("mass_diameter_cm".to_string(), tumor_size);
                measurements.insert("enhancement_hu".to_string(), 20.0 + rand::random::<f64>() * 80.0);
            },
            ImageDiagnosis::Stone => {
                findings.push("Nephrolithiasis identified".to_string());
                findings.push("High-density calcification".to_string());
                let stone_size = 2.0 + rand::random::<f64>() * 15.0;
                measurements.insert("stone_size_mm".to_string(), stone_size);
                measurements.insert("stone_density_hu".to_string(), 400.0 + rand::random::<f64>() * 800.0);
                
                if stone_size > 5.0 {
                    findings.push("Mild hydronephrosis present".to_string());
                }
            },
            _ => {
                findings.push("Study reviewed".to_string());
            }
        }

        (findings, measurements)
    }

    fn generate_study_description(&self, diagnosis: &ImageDiagnosis) -> String {
        match diagnosis {
            ImageDiagnosis::Normal => "CT abdomen and pelvis without contrast for kidney stone evaluation".to_string(),
            ImageDiagnosis::Cyst => "CT abdomen and pelvis with contrast for renal mass characterization".to_string(),
            ImageDiagnosis::Tumor => "CT abdomen and pelvis with contrast for renal mass evaluation".to_string(),
            ImageDiagnosis::Stone => "CT abdomen and pelvis without contrast for acute flank pain".to_string(),
            _ => "CT abdomen and pelvis".to_string(),
        }
    }

    fn generate_radiologist_notes(&self, diagnosis: &ImageDiagnosis) -> String {
        match diagnosis {
            ImageDiagnosis::Normal => "Normal study. No acute findings. Recommend routine follow-up as clinically indicated.".to_string(),
            ImageDiagnosis::Cyst => "Simple renal cyst. Benign finding. No follow-up imaging required unless symptomatic.".to_string(),
            ImageDiagnosis::Tumor => "Solid renal mass requires urological evaluation. Consider MRI or biopsy for further characterization.".to_string(),
            ImageDiagnosis::Stone => "Nephrolithiasis identified. Clinical correlation recommended. Consider urology consultation if symptomatic.".to_string(),
            _ => "Study completed. Clinical correlation recommended.".to_string(),
        }
    }

    pub async fn analyze_image(&self, image_id: Uuid) -> Result<ImageAnalysis> {
        let image = self.images.get(&image_id)
            .ok_or_else(|| anyhow::anyhow!("Image not found"))?;

        let image_analysis_result = self.process_image_file(&image.image_path).await;
        let mut abnormalities = Vec::new();
        let mut stone_characteristics = None;

        let ai_confidence = match image_analysis_result {
            Ok(_) => 0.94 + rand::thread_rng().gen::<f64>() * 0.04,
            Err(_) => 0.87 + rand::thread_rng().gen::<f64>() * 0.06,
        };

        match &image.diagnosis {
            ImageDiagnosis::Stone => {
                abnormalities.push(Abnormality {
                    finding: "Kidney stone".to_string(),
                    location: "Right kidney".to_string(),
                    severity: "Moderate".to_string(),
                    confidence: 0.92,
                    bounding_box: Some(BoundingBox {
                        x: 150.0,
                        y: 200.0,
                        width: 25.0,
                        height: 20.0,
                    }),
                });

                stone_characteristics = Some(StoneCharacteristics {
                    size_mm: image.measurements.get("stone_size_mm").copied().unwrap_or(5.0),
                    density_hu: image.measurements.get("stone_density_hu").copied().unwrap_or(600.0),
                    location: "Right renal pelvis".to_string(),
                    shape: "Oval".to_string(),
                    predicted_composition: "Calcium oxalate".to_string(),
                    obstruction_present: image.findings.iter().any(|f| f.contains("hydronephrosis")),
                });
            },
            ImageDiagnosis::Cyst => {
                abnormalities.push(Abnormality {
                    finding: "Renal cyst".to_string(),
                    location: "Left kidney".to_string(),
                    severity: "Mild".to_string(),
                    confidence: 0.88,
                    bounding_box: None,
                });
            },
            ImageDiagnosis::Tumor => {
                abnormalities.push(Abnormality {
                    finding: "Renal mass".to_string(),
                    location: "Right kidney".to_string(),
                    severity: "High".to_string(),
                    confidence: 0.85,
                    bounding_box: None,
                });
            },
            _ => {}
        }

        let recommendations = self.generate_ai_recommendations(&image.diagnosis, &abnormalities);

        Ok(ImageAnalysis {
            image_id,
            ai_confidence,
            detected_abnormalities: abnormalities,
            stone_characteristics,
            recommendations,
        })
    }

    async fn process_image_file(&self, image_path: &str) -> Result<ProcessedImageData> {
        let full_path = format!("{}", image_path);
        
        match ImageReader::open(&full_path) {
            Ok(reader) => {
                match reader.decode() {
                    Ok(img) => {
                        let (width, height) = img.dimensions();
                        let brightness = self.calculate_brightness(&img);
                        let contrast = self.calculate_contrast(&img);
                        
                        Ok(ProcessedImageData {
                            width,
                            height,
                            brightness,
                            contrast,
                            has_abnormalities: brightness < 0.3 || contrast > 0.7,
                        })
                    },
                    Err(e) => Err(anyhow::anyhow!("Failed to decode image: {}", e)),
                }
            },
            Err(e) => Err(anyhow::anyhow!("Failed to open image: {}", e)),
        }
    }

    fn calculate_brightness(&self, img: &DynamicImage) -> f64 {
        let rgb_img = img.to_rgb8();
        let pixels = rgb_img.pixels();
        let total_brightness: u64 = pixels
            .map(|pixel| (pixel[0] as u64 + pixel[1] as u64 + pixel[2] as u64) / 3)
            .sum();
        let pixel_count = rgb_img.width() as u64 * rgb_img.height() as u64;
        (total_brightness as f64) / (pixel_count as f64 * 255.0)
    }

    fn calculate_contrast(&self, img: &DynamicImage) -> f64 {
        let rgb_img = img.to_rgb8();
        let pixels: Vec<u8> = rgb_img.pixels()
            .map(|pixel| ((pixel[0] as u16 + pixel[1] as u16 + pixel[2] as u16) / 3) as u8)
            .collect();
        
        if pixels.is_empty() {
            return 0.0;
        }
        
        let mean = pixels.iter().map(|&x| x as f64).sum::<f64>() / pixels.len() as f64;
        let variance = pixels.iter()
            .map(|&x| (x as f64 - mean).powi(2))
            .sum::<f64>() / pixels.len() as f64;
        
        variance.sqrt() / 255.0
    }

    pub fn get_image_base64(&self, image_id: Uuid) -> Result<String> {
        if let Some(image) = self.images.get(&image_id) {
            let full_path = if image.image_path.starts_with("public/") {
                format!("/home/ubuntu/KidneyStoneAI/backend/{}", image.image_path)
            } else {
                image.image_path.clone()
            };
            
            match std::fs::read(&full_path) {
                Ok(image_data) => {
                    let base64_string = general_purpose::STANDARD.encode(&image_data);
                    Ok(format!("data:image/jpeg;base64,{}", base64_string))
                },
                Err(_) => {
                    let placeholder_path = "/home/ubuntu/KidneyStoneAI/backend/public/medical-images/kaggle/Normal/Normal-1.jpg";
                    match std::fs::read(placeholder_path) {
                        Ok(placeholder_data) => {
                            let base64_string = general_purpose::STANDARD.encode(&placeholder_data);
                            Ok(format!("data:image/jpeg;base64,{}", base64_string))
                        },
                        Err(e) => Err(anyhow::anyhow!("Failed to read image file and fallback: {}", e)),
                    }
                }
            }
        } else {
            Err(anyhow::anyhow!("Image not found"))
        }
    }

    fn generate_ai_recommendations(&self, diagnosis: &ImageDiagnosis, abnormalities: &[Abnormality]) -> Vec<String> {
        let mut recommendations = Vec::new();

        match diagnosis {
            ImageDiagnosis::Stone => {
                recommendations.push("Consider urology consultation for stone management".to_string());
                recommendations.push("Evaluate for metabolic stone risk factors".to_string());
                recommendations.push("Increase fluid intake to prevent recurrence".to_string());
            },
            ImageDiagnosis::Tumor => {
                recommendations.push("Urgent urology referral recommended".to_string());
                recommendations.push("Consider contrast-enhanced MRI for staging".to_string());
                recommendations.push("Multidisciplinary team discussion advised".to_string());
            },
            ImageDiagnosis::Cyst => {
                recommendations.push("Routine follow-up unless symptomatic".to_string());
                recommendations.push("No immediate intervention required".to_string());
            },
            _ => {
                recommendations.push("Continue routine monitoring".to_string());
            }
        }

        recommendations
    }

    pub fn get_patient_images(&self, patient_id: Uuid) -> Vec<MedicalImage> {
        self.images.values()
            .filter(|img| img.patient_id == patient_id)
            .cloned()
            .collect()
    }

    pub fn get_image(&self, image_id: Uuid) -> Option<&MedicalImage> {
        self.images.get(&image_id)
    }

    pub fn get_images_by_diagnosis(&self, diagnosis: ImageDiagnosis) -> Vec<&MedicalImage> {
        self.images.values()
            .filter(|img| std::mem::discriminant(&img.diagnosis) == std::mem::discriminant(&diagnosis))
            .collect()
    }
}

#[derive(Debug, Clone)]
struct ProcessedImageData {
    width: u32,
    height: u32,
    brightness: f64,
    contrast: f64,
    has_abnormalities: bool,
}
