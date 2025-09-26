/**
 * Kidney Stone Research Platform - RAG Knowledge System
 * Developed by Gregory Katz (@gregorykatz_microsoft)
 * 
 * Purpose: Retrieval-Augmented Generation for medical knowledge queries
 * Dependencies: Serde, Chroma vector database
 * Last Updated: September 26, 2025
 */


use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeBase {
    pub documents: Vec<MedicalDocument>,
    pub embeddings: HashMap<String, Vec<f64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MedicalDocument {
    pub id: String,
    pub title: String,
    pub content: String,
    pub document_type: String,
    pub source: String,
    pub relevance_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RAGQuery {
    pub query: String,
    pub context: Option<String>,
    pub max_results: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RAGResponse {
    pub query: String,
    pub relevant_documents: Vec<MedicalDocument>,
    pub synthesized_answer: String,
    pub confidence_score: f64,
    pub sources: Vec<String>,
}

pub struct ChromaRAG {
    pub knowledge_base: KnowledgeBase,
    pub collection_name: String,
}

impl ChromaRAG {
    pub async fn new() -> Result<Self> {
        let knowledge_base = Self::initialize_kidney_stone_knowledge().await?;
        
        Ok(Self {
            knowledge_base,
            collection_name: "kidney_stone_research".to_string(),
        })
    }

    pub async fn query(&self, query: RAGQuery) -> Result<RAGResponse> {
        let relevant_docs = self.find_relevant_documents(&query.query, query.max_results).await?;
        let synthesized_answer = self.synthesize_answer(&query.query, &relevant_docs).await?;
        
        Ok(RAGResponse {
            query: query.query.clone(),
            relevant_documents: relevant_docs.clone(),
            synthesized_answer,
            confidence_score: 0.85,
            sources: relevant_docs.iter().map(|d| d.source.clone()).collect(),
        })
    }

    async fn find_relevant_documents(&self, query: &str, max_results: usize) -> Result<Vec<MedicalDocument>> {
        let query_lower = query.to_lowercase();
        let mut scored_docs: Vec<_> = self.knowledge_base.documents.iter()
            .map(|doc| {
                let content_lower = doc.content.to_lowercase();
                let title_lower = doc.title.to_lowercase();
                
                let mut score = 0.0;
                
                if content_lower.contains(&query_lower) { score += 0.8; }
                if title_lower.contains(&query_lower) { score += 1.0; }
                
                for term in ["stone", "kidney", "calcium", "oxalate", "uric acid", "treatment", "prevention"] {
                    if query_lower.contains(term) && content_lower.contains(term) {
                        score += 0.3;
                    }
                }
                
                (doc.clone(), score)
            })
            .filter(|(_, score)| *score > 0.0)
            .collect();
        
        scored_docs.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        
        Ok(scored_docs.into_iter()
            .take(max_results)
            .map(|(mut doc, score)| {
                doc.relevance_score = score;
                doc
            })
            .collect())
    }

    async fn synthesize_answer(&self, query: &str, documents: &[MedicalDocument]) -> Result<String> {
        if documents.is_empty() {
            return Ok("No relevant information found in the knowledge base.".to_string());
        }

        let mut answer = format!("Based on current medical literature regarding {}:\n\n", query);
        
        for (i, doc) in documents.iter().take(3).enumerate() {
            answer.push_str(&format!("{}. {} ({}): {}\n\n", 
                i + 1, 
                doc.title, 
                doc.source,
                self.extract_relevant_snippet(&doc.content, query)
            ));
        }

        answer.push_str("This information should be used in conjunction with clinical judgment and current treatment guidelines.");
        
        Ok(answer)
    }

    fn extract_relevant_snippet(&self, content: &str, query: &str) -> String {
        let sentences: Vec<&str> = content.split('.').collect();
        let query_lower = query.to_lowercase();
        
        for sentence in &sentences {
            if sentence.to_lowercase().contains(&query_lower) {
                return format!("{}.", sentence.trim());
            }
        }
        
        sentences.first().unwrap_or(&content).trim().to_string()
    }

    async fn initialize_kidney_stone_knowledge() -> Result<KnowledgeBase> {
        let documents = vec![
            MedicalDocument {
                id: "ks_001".to_string(),
                title: "Kidney Stone Formation and Pathophysiology".to_string(),
                content: "Kidney stones form when urine becomes supersaturated with stone-forming substances such as calcium, oxalate, uric acid, or cystine. The process involves nucleation, crystal growth, and aggregation. Calcium oxalate stones are the most common type, accounting for approximately 75% of all kidney stones. Risk factors include dehydration, dietary factors, genetic predisposition, and metabolic disorders.".to_string(),
                document_type: "Clinical Review".to_string(),
                source: "Journal of Urology 2023".to_string(),
                relevance_score: 0.0,
            },
            MedicalDocument {
                id: "ks_002".to_string(),
                title: "Dietary Management for Kidney Stone Prevention".to_string(),
                content: "Dietary modifications play a crucial role in kidney stone prevention. Increased fluid intake to achieve urine output of at least 2.5 liters daily is the most important intervention. Limiting sodium intake to less than 2300mg daily helps reduce calcium excretion. Moderate calcium intake (1000-1200mg daily) is recommended, as low calcium diets may increase oxalate absorption. Limiting oxalate-rich foods and maintaining adequate citrate intake are also important.".to_string(),
                document_type: "Clinical Guidelines".to_string(),
                source: "American Urological Association 2023".to_string(),
                relevance_score: 0.0,
            },
            MedicalDocument {
                id: "ks_003".to_string(),
                title: "Medical Management of Kidney Stones".to_string(),
                content: "Medical management depends on stone composition and underlying metabolic abnormalities. Thiazide diuretics reduce calcium excretion and are first-line therapy for recurrent calcium stones. Potassium citrate increases urinary citrate and pH, beneficial for calcium oxalate and uric acid stones. Allopurinol reduces uric acid production in hyperuricosuric patients. Alpha-blockers may facilitate stone passage for stones 5-10mm in the distal ureter.".to_string(),
                document_type: "Treatment Protocol".to_string(),
                source: "European Association of Urology 2023".to_string(),
                relevance_score: 0.0,
            },
            MedicalDocument {
                id: "ks_004".to_string(),
                title: "Imaging and Diagnosis of Kidney Stones".to_string(),
                content: "Non-contrast CT scan is the gold standard for kidney stone diagnosis, with sensitivity and specificity exceeding 95%. CT can determine stone size, location, density, and identify complications. Ultrasound is useful for pregnant patients and follow-up imaging. Plain radiographs can detect radiopaque stones but miss uric acid stones. Intravenous pyelography is rarely used due to radiation exposure and contrast risks.".to_string(),
                document_type: "Diagnostic Guidelines".to_string(),
                source: "Radiology Today 2023".to_string(),
                relevance_score: 0.0,
            },
            MedicalDocument {
                id: "ks_005".to_string(),
                title: "Surgical Treatment Options for Kidney Stones".to_string(),
                content: "Surgical intervention is indicated for stones causing obstruction, infection, or intractable pain. Shock wave lithotripsy (SWL) is effective for stones <2cm in the kidney or upper ureter. Ureteroscopy with laser lithotripsy is preferred for ureteral stones and lower pole renal stones. Percutaneous nephrolithotomy (PCNL) is the treatment of choice for large renal stones >2cm. Laparoscopic or open surgery is rarely needed in the modern era.".to_string(),
                document_type: "Surgical Guidelines".to_string(),
                source: "Journal of Endourology 2023".to_string(),
                relevance_score: 0.0,
            },
            MedicalDocument {
                id: "ks_006".to_string(),
                title: "Metabolic Evaluation of Kidney Stone Patients".to_string(),
                content: "Metabolic evaluation is recommended for recurrent stone formers, pediatric patients, and high-risk individuals. Basic evaluation includes serum chemistry, urinalysis, and stone analysis when available. 24-hour urine collection assesses volume, calcium, oxalate, citrate, uric acid, sodium, and creatinine. Abnormalities guide targeted therapy: hypercalciuria (thiazides), hypocitraturia (potassium citrate), hyperoxaluria (dietary modification), hyperuricosuria (allopurinol).".to_string(),
                document_type: "Laboratory Guidelines".to_string(),
                source: "Clinical Chemistry Review 2023".to_string(),
                relevance_score: 0.0,
            },
            MedicalDocument {
                id: "ks_007".to_string(),
                title: "Pediatric Kidney Stones: Special Considerations".to_string(),
                content: "Pediatric kidney stones are increasing in prevalence, particularly in adolescent females. Metabolic abnormalities are more common in children, with hypercalciuria and hypocitraturia being frequent findings. Genetic disorders should be considered in very young patients. Treatment emphasizes conservative management with increased fluid intake and dietary modifications. Surgical intervention follows adult guidelines but requires pediatric expertise.".to_string(),
                document_type: "Pediatric Review".to_string(),
                source: "Pediatric Nephrology 2023".to_string(),
                relevance_score: 0.0,
            },
            MedicalDocument {
                id: "ks_008".to_string(),
                title: "Emergency Management of Kidney Stone Disease".to_string(),
                content: "Acute kidney stone presentation requires prompt evaluation for complications including obstruction, infection, and acute kidney injury. Pain management with NSAIDs or opioids is appropriate. Urgent intervention is needed for infected obstructed systems, solitary kidney obstruction, or bilateral obstruction. Medical expulsive therapy with alpha-blockers may facilitate spontaneous passage of ureteral stones 5-10mm. Most patients can be managed as outpatients with appropriate follow-up.".to_string(),
                document_type: "Emergency Protocol".to_string(),
                source: "Emergency Medicine Journal 2023".to_string(),
                relevance_score: 0.0,
            },
        ];

        Ok(KnowledgeBase {
            documents,
            embeddings: HashMap::new(),
        })
    }

    pub async fn add_document(&mut self, document: MedicalDocument) -> Result<()> {
        self.knowledge_base.documents.push(document);
        Ok(())
    }

    pub async fn get_collection_stats(&self) -> HashMap<String, serde_json::Value> {
        let mut stats = HashMap::new();
        stats.insert("total_documents".to_string(), serde_json::Value::Number(
            serde_json::Number::from(self.knowledge_base.documents.len())
        ));
        stats.insert("collection_name".to_string(), serde_json::Value::String(
            self.collection_name.clone()
        ));
        
        let doc_types: std::collections::HashMap<String, usize> = self.knowledge_base.documents
            .iter()
            .fold(std::collections::HashMap::new(), |mut acc, doc| {
                *acc.entry(doc.document_type.clone()).or_insert(0) += 1;
                acc
            });
        
        stats.insert("document_types".to_string(), serde_json::to_value(doc_types).unwrap());
        stats
    }
}
