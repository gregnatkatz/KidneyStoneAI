use anyhow::Result;
use reqwest::Client;
use serde_json::{json, Value};
use std::env;
use base64::{Engine as _, engine::general_purpose};
use image::{io::Reader as ImageReader, DynamicImage, ImageFormat, GenericImageView};
use std::io::Cursor;

pub struct AzureOpenAIClient {
    client: Client,
    endpoint: String,
    api_key: String,
}

impl AzureOpenAIClient {
    pub fn new() -> Result<Self> {
        let endpoint = env::var("AZURE_OPENAI_ENDPOINT")
            .unwrap_or_else(|_| "https://pharma-agents-jnj-resource.cognitiveservices.azure.com".to_string());
        let api_key = env::var("AZURE_OPENAI_API_KEY")
            .unwrap_or_else(|_| "mock-key".to_string());

        Ok(Self {
            client: Client::new(),
            endpoint,
            api_key,
        })
    }

    pub async fn chat_completion(&self, messages: Vec<Value>, model: &str) -> Result<Value> {
        let url = format!("{}/openai/deployments/{}/chat/completions?api-version=2024-02-15-preview", 
                         self.endpoint, model);

        let request_body = json!({
            "messages": messages,
            "max_tokens": 1000,
            "temperature": 0.7,
            "top_p": 0.95,
            "frequency_penalty": 0,
            "presence_penalty": 0
        });

        let response = self.client
            .post(&url)
            .header("api-key", &self.api_key)
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("Azure OpenAI API error: {}", error_text));
        }

        let response_json: Value = response.json().await?;
        Ok(response_json)
    }

    pub async fn medparse_analysis(&self, patient_data: &str, findings: &str) -> Result<Value> {
        let messages = vec![
            json!({
                "role": "system",
                "content": "You are MedParse, a specialized medical data extraction agent. Extract and structure medical information from patient data and imaging findings. Focus on kidney stone analysis, risk factors, and clinical indicators."
            }),
            json!({
                "role": "user", 
                "content": format!("Analyze this patient data and imaging findings for kidney stone assessment:\n\nPatient Data: {}\n\nFindings: {}", patient_data, findings)
            })
        ];

        self.chat_completion(messages, "gpt-4").await
    }

    pub async fn gpt5_risk_analysis(&self, patient_data: &str, medparse_results: &str) -> Result<Value> {
        let messages = vec![
            json!({
                "role": "system",
                "content": "You are an advanced clinical decision support system specializing in kidney stone risk assessment. Provide comprehensive risk analysis, treatment recommendations, and clinical insights based on patient data and extracted medical information."
            }),
            json!({
                "role": "user",
                "content": format!("Perform comprehensive kidney stone risk analysis:\n\nPatient Data: {}\n\nMedParse Results: {}", patient_data, medparse_results)
            })
        ];

        self.chat_completion(messages, "gpt-4").await
    }

    pub async fn deepseek_pattern_analysis(&self, patient_data: &str, previous_analysis: &str) -> Result<Value> {
        let messages = vec![
            json!({
                "role": "system", 
                "content": "You are an advanced pattern recognition system for medical analysis. Identify complex patterns, correlations, and insights in kidney stone cases that other systems might miss. Focus on temporal patterns, metabolic indicators, and predictive factors."
            }),
            json!({
                "role": "user",
                "content": format!("Identify deep patterns and insights:\n\nPatient Data: {}\n\nPrevious Analysis: {}", patient_data, previous_analysis)
            })
        ];

        self.chat_completion(messages, "gpt-4").await
    }
}

pub struct AzureMLClient {
    client: Client,
    endpoint: String,
    api_key: String,
}

impl AzureMLClient {
    pub fn new() -> Result<Self> {
        let endpoint = env::var("AZURE_ML_MEDPARSE_ENDPOINT")
            .unwrap_or_else(|_| "https://medparse101-muuql.eastus2.inference.ml.azure.com/score".to_string());
        let api_key = env::var("AZURE_ML_MEDPARSE_PRIMARY_KEY")
            .unwrap_or_else(|_| "your-azure-ml-primary-key".to_string());

        Ok(Self {
            client: Client::new(),
            endpoint,
            api_key,
        })
    }

    pub async fn medparse_request(&self, patient_data: &str, findings: &str) -> Result<Value> {
        let request_body = json!({
            "patient_data": patient_data,
            "findings": findings,
            "task": "medical_entity_extraction",
            "format": "structured_json"
        });

        let response = self.client
            .post(&self.endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("Azure ML MedParse API error: {}", error_text));
        }

        let response_json: Value = response.json().await?;
        Ok(response_json)
    }

    pub async fn medparse_image_request(&self, image_paths: &[String], text_prompt: &str) -> Result<Value> {
        let image_path = image_paths.first().ok_or_else(|| anyhow::anyhow!("No image paths provided"))?;
        let base64_image = self.load_and_encode_image(image_path).await?;
        
        let request_body = json!({
            "input_data": {
                "columns": ["image", "text"],
                "index": [0],
                "data": [
                    [base64_image, text_prompt]
                ]
            }
        });

        let response = self.client
            .post(&self.endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("Azure ML MedImageParse API error: {}", error_text));
        }

        let response_json: Value = response.json().await?;
        Ok(response_json)
    }

    async fn load_and_encode_image(&self, image_path: &str) -> Result<String> {
        let full_path = format!("/home/ubuntu/kidney-stone-research/{}", image_path);
        let img = ImageReader::open(&full_path)?
            .decode()?;
        
        let resized_img = self.resize_and_pad_image(img);
        
        let mut buffer = Vec::new();
        let mut cursor = Cursor::new(&mut buffer);
        resized_img.write_to(&mut cursor, ImageFormat::Png)?;
        
        let base64_string = general_purpose::STANDARD.encode(&buffer);
        Ok(base64_string)
    }

    fn resize_and_pad_image(&self, img: DynamicImage) -> DynamicImage {
        use image::{Rgba, RgbaImage};
        
        let (width, height) = img.dimensions();
        let target_size = 1024u32;
        
        let scale = (target_size as f32 / width.max(height) as f32).min(1.0);
        let new_width = (width as f32 * scale) as u32;
        let new_height = (height as f32 * scale) as u32;
        
        let resized = img.resize(new_width, new_height, image::imageops::FilterType::Lanczos3);
        
        let mut canvas = RgbaImage::from_pixel(target_size, target_size, Rgba([0, 0, 0, 255]));
        
        let x_offset = (target_size - new_width) / 2;
        let y_offset = (target_size - new_height) / 2;
        
        image::imageops::overlay(&mut canvas, &resized.to_rgba8(), x_offset.into(), y_offset.into());
        
        DynamicImage::ImageRgba8(canvas)
    }
}
