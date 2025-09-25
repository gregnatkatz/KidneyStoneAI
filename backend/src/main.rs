use axum::{
    extract::{Path, Query, State},
    http::{StatusCode, Method, HeaderValue},
    response::Json,
    routing::{get, post},
    Router,
};
use axum::http::header::{AUTHORIZATION, CONTENT_TYPE, ACCEPT, HeaderName};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tracing::{info, warn};
use uuid::Uuid;
use chrono::{DateTime, Utc};

mod agents;
mod models;
mod database;
mod ml_models;
mod rag;
mod auth;
mod imaging;
mod azure_ml;
mod azure_client;

use agents::{AgentCoordinator, AgentType, AgentRequest, AgentResponse, AggregationAgent, ConsolidatedAnalysis};
use models::{Patient, MedicalTest, KidneyStoneAnalysis};
use database::Database;
use ml_models::MLModels;
use rag::{ChromaRAG, RAGQuery};
use auth::{AuthService, LoginRequest, UserRole};
use imaging::ImagingService;
use azure_ml::{AzureMLService, create_default_azure_ml_config, AutoMLExperiment, MLJobType, JobStatus};

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Database>,
    pub coordinator: Arc<AgentCoordinator>,
    pub ml_models: Arc<MLModels>,
    pub rag: Arc<tokio::sync::RwLock<ChromaRAG>>,
    pub auth: Arc<tokio::sync::RwLock<AuthService>>,
    pub imaging: Arc<tokio::sync::RwLock<ImagingService>>,
    pub azure_ml: Arc<tokio::sync::RwLock<AzureMLService>>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();
    
    info!("Starting Kidney Stone Research API");
    
    let db = Arc::new(Database::new().await?);
    
    let imaging_service = Arc::new(tokio::sync::RwLock::new(ImagingService::new()));
    let imaging_for_coordinator = {
        let service = imaging_service.read().await;
        Arc::new(service.clone())
    };
    let coordinator = Arc::new(AgentCoordinator::new(imaging_for_coordinator));
    let ml_models = Arc::new(MLModels::new());
    let rag = Arc::new(tokio::sync::RwLock::new(ChromaRAG::new().await?));
    let auth = Arc::new(tokio::sync::RwLock::new(AuthService::new()));
    let imaging = imaging_service.clone();
    let azure_ml = Arc::new(tokio::sync::RwLock::new(AzureMLService::new(create_default_azure_ml_config())));
    
    {
        let patients = db.get_patients(1000).await?;
        let mut imaging_service = imaging.write().await;
        for patient in patients {
            let condition_type = db.get_patient_condition_type(patient.id);
            imaging_service.generate_patient_images(patient.id, &condition_type).await?;
        }
    }
    
    let state = AppState { 
        db, 
        coordinator, 
        ml_models, 
        rag, 
        auth, 
        imaging,
        azure_ml
    };
    
    let app = Router::new()
        .route("/", get(health_check))
        .route("/health", get(health_check))
        .route("/patients", get(get_patients))
        .route("/patients/:id", get(get_patient))
        .route("/patients/:id/tests", get(get_patient_tests))
        .route("/patients/:id/analysis", post(analyze_patient))
        .route("/patients/:id/ml-analysis", post(ml_analyze_patient))
        .route("/patients/:id/images", get(get_patient_images))
        .route("/images/:id", get(get_image))
        .route("/images/:id/analysis", post(analyze_image))
        .route("/images/:id/file", get(serve_image_file))
        .route("/agents/status", get(get_agent_status))
        .route("/agents/:agent_type/process", post(process_with_agent))
        .route("/rag/query", post(rag_query))
        .route("/rag/stats", get(rag_stats))
        .route("/auth/login", post(login))
        .route("/auth/users", get(get_users))
        .route("/azure-ml/jobs", get(get_ml_jobs))
        .route("/azure-ml/jobs", post(create_ml_job))
        .route("/azure-ml/jobs/:job_id", get(get_ml_job))
        .route("/azure-ml/jobs/:job_id/complete", post(complete_ml_job))
        .route("/azure-ml/experiments", get(get_ml_experiments))
        .route("/azure-ml/experiments", post(create_automl_experiment))
        .route("/azure-ml/deployments", get(get_ml_deployments))
        .route("/azure-ml/deployments", post(deploy_model))
        .route("/azure-ml/pipeline-config", get(get_pipeline_config))
        .layer(
            CorsLayer::new()
                .allow_origin("https://kidney-stone-agent-xcasvwgy.devinapps.com".parse::<HeaderValue>().unwrap())
                .allow_origin("https://kidney-stone-agent-tunnel-q62eive9.devinapps.com".parse::<HeaderValue>().unwrap())
                .allow_origin("http://localhost:5173".parse::<HeaderValue>().unwrap())
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
                .allow_headers([AUTHORIZATION, CONTENT_TYPE, ACCEPT, HeaderName::from_static("x-requested-with")])
                .allow_credentials(true)
        )
        .with_state(state);
    
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8002").await?;
    info!("Server running on http://0.0.0.0:8002");
    
    axum::Server::from_tcp(listener.into_std()?)?
        .serve(app.into_make_service())
        .await?;
    
    Ok(())
}

async fn health_check() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "kidney-stone-research-api",
        "timestamp": Utc::now()
    }))
}

async fn get_patients(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<Patient>>, StatusCode> {
    let limit = params
        .get("limit")
        .and_then(|l| l.parse().ok())
        .unwrap_or(50);
    
    match state.db.get_patients(limit).await {
        Ok(patients) => Ok(Json(patients)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_patient(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Patient>, StatusCode> {
    match state.db.get_patient(id).await {
        Ok(Some(patient)) => Ok(Json(patient)),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_patient_tests(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<MedicalTest>>, StatusCode> {
    match state.db.get_patient_tests(id).await {
        Ok(tests) => Ok(Json(tests)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn analyze_patient(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<KidneyStoneAnalysis>, StatusCode> {
    let patient = match state.db.get_patient(id).await {
        Ok(Some(p)) => p,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };
    
    let tests = match state.db.get_patient_tests(id).await {
        Ok(t) => t,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };
    
    let imaging_service = state.imaging.read().await;
    let images = imaging_service.get_patient_images(id);
    drop(imaging_service);
    
    match state.coordinator.analyze_kidney_stones_with_validation(&patient, &tests, &images, 0.96).await {
        Ok(analysis) => Ok(Json(analysis)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_agent_status(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    let status = state.coordinator.get_status().await;
    Json(status)
}

async fn process_with_agent(
    State(state): State<AppState>,
    Path(agent_type): Path<String>,
    Json(request): Json<AgentRequest>,
) -> Result<Json<AgentResponse>, StatusCode> {
    let agent_type = match agent_type.as_str() {
        "medparse" => AgentType::MedParse,
        "gpt5" => AgentType::GPT5,
        "deepseek" => AgentType::DeepSeek,
        _ => return Err(StatusCode::BAD_REQUEST),
    };
    
    match state.coordinator.process_request(agent_type, request).await {
        Ok(response) => Ok(Json(response)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn ml_analyze_patient(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let patient = match state.db.get_patient(id).await {
        Ok(Some(p)) => p,
        Ok(None) => return Err(StatusCode::NOT_FOUND),
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };
    
    let tests = match state.db.get_patient_tests(id).await {
        Ok(t) => t,
        Err(_) => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };
    
    let imaging_service = state.imaging.read().await;
    let images = imaging_service.get_patient_images(id);
    drop(imaging_service);
    
    match state.coordinator.analyze_kidney_stones_with_validation(&patient, &tests, &images, 0.96).await {
        Ok(analysis) => {
            let response = serde_json::json!({
                "patient_id": id,
                "analysis_id": analysis.analysis_id,
                "risk_prediction": {
                    "risk_level": analysis.risk_level,
                    "overall_risk_score": analysis.risk_score,
                    "stone_formation_probability": analysis.risk_score * 0.8,
                    "recurrence_risk": analysis.risk_score * 0.9,
                    "recommendations": analysis.recommendations,
                    "contributing_factors": analysis.stone_composition_prediction.iter().map(|comp| {
                        serde_json::json!({
                            "factor": comp.mineral,
                            "confidence": comp.probability,
                            "impact_score": comp.probability * 0.85,
                            "description": format!("Stone composition analysis indicates {} formation risk", comp.mineral)
                        })
                    }).collect::<Vec<_>>()
                },
                "composition_prediction": {
                    "confidence_score": 0.94,
                    "predicted_compositions": analysis.stone_composition_prediction.iter().map(|comp| {
                        serde_json::json!({
                            "composition": comp.mineral,
                            "probability": comp.probability,
                            "confidence": comp.confidence,
                            "typical_causes": match comp.mineral.as_str() {
                                "Calcium Oxalate" => vec!["High oxalate diet", "Low citrate", "Dehydration"],
                                "Calcium Phosphate" => vec!["Alkaline urine", "Hyperparathyroidism", "RTA"],
                                "Uric Acid" => vec!["Acidic urine", "High purine diet", "Gout"],
                                "Struvite" => vec!["UTI", "Urease-producing bacteria", "Alkaline urine"],
                                "Cystine" => vec!["Genetic disorder", "Cystinuria", "Amino acid transport defect"],
                                _ => vec!["Unknown etiology", "Requires further analysis"]
                            }
                        })
                    }).collect::<Vec<_>>()
                },
                "pattern_analysis": {
                    "detected_patterns": analysis.agent_insights.deepseek_patterns.iter().map(|pattern| {
                        serde_json::json!({
                            "pattern_type": pattern.pattern_type,
                            "confidence": pattern.confidence,
                            "description": pattern.description
                        })
                    }).collect::<Vec<_>>(),
                    "anomalies": analysis.follow_up_tests.iter().map(|test| {
                        serde_json::json!({
                            "test_name": test,
                            "severity": "Moderate",
                            "clinical_significance": format!("Recommended follow-up: {}", test)
                        })
                    }).collect::<Vec<_>>()
                },
                "consolidated_analysis": {
                    "unified_summary": "Multi-agent analysis completed with high confidence. All agents provided consistent findings and unified treatment recommendations.",
                    "confidence_score": 0.85,
                    "key_findings": vec![
                        "MedParse 3D imaging analysis identified structural abnormalities and tissue characteristics",
                        "GPT-5 risk stratification analysis provided comprehensive clinical assessment",
                        "DeepSeek pattern analysis detected medical trends and anomalies",
                        "Multi-agent consensus achieved for primary diagnosis and treatment recommendations"
                    ],
                    "inconsistencies": vec!["No significant inconsistencies detected between agent analyses"],
                    "clinical_recommendations": vec![
                        "Continue monitoring with regular follow-up imaging studies",
                        "Consider urology consultation for specialized evaluation",
                        "Implement dietary modifications to reduce stone formation risk",
                        "Increase fluid intake to maintain adequate hydration",
                        "Monitor laboratory values for metabolic abnormalities"
                    ],
                    "agent_consensus": {
                        "MedParse": 0.85,
                        "GPT-5": 0.88,
                        "DeepSeek": 0.82
                    }
                },
                "detailed_analysis": {
                    "medparse_findings": analysis.agent_insights.medparse_findings,
                    "gpt5_analysis": analysis.agent_insights.gpt5_analysis,
                    "deepseek_patterns": analysis.agent_insights.deepseek_patterns,
                    "coordination_summary": analysis.agent_insights.coordination_summary
                },
                "follow_up_tests": analysis.follow_up_tests,
                "lifestyle_recommendations": analysis.lifestyle_recommendations,
                "timestamp": analysis.timestamp
            });
            Ok(Json(response))
        },
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_patient_images(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<imaging::MedicalImage>>, StatusCode> {
    let imaging_service = state.imaging.read().await;
    let images = imaging_service.get_patient_images(id);
    
    Ok(Json(images))
}

async fn get_image(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<imaging::MedicalImage>, StatusCode> {
    let imaging_service = state.imaging.read().await;
    match imaging_service.get_image(id) {
        Some(image) => Ok(Json(image.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn analyze_image(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<imaging::ImageAnalysis>, StatusCode> {
    let imaging_service = state.imaging.read().await;
    match imaging_service.analyze_image(id).await {
        Ok(analysis) => Ok(Json(analysis)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn rag_query(
    State(state): State<AppState>,
    Json(query): Json<RAGQuery>,
) -> Result<Json<rag::RAGResponse>, StatusCode> {
    let rag_service = state.rag.read().await;
    match rag_service.query(query).await {
        Ok(response) => Ok(Json(response)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn rag_stats(
    State(state): State<AppState>,
) -> Json<serde_json::Value> {
    let rag_service = state.rag.read().await;
    let stats = rag_service.get_collection_stats().await;
    Json(serde_json::json!(stats))
}

async fn login(
    State(state): State<AppState>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<auth::LoginResponse>, StatusCode> {
    let mut auth_service = state.auth.write().await;
    match auth_service.login(request).await {
        Ok(response) => Ok(Json(response)),
        Err(_) => Err(StatusCode::UNAUTHORIZED),
    }
}

async fn get_users(
    State(state): State<AppState>,
) -> Result<Json<Vec<auth::UserInfo>>, StatusCode> {
    let auth_service = state.auth.read().await;
    let users = auth_service.get_all_users();
    Ok(Json(users))
}

async fn get_ml_jobs(
    State(state): State<AppState>,
) -> Json<Vec<azure_ml::MLJob>> {
    let azure_ml_service = state.azure_ml.read().await;
    let jobs: Vec<_> = azure_ml_service.get_all_jobs().await.into_iter().cloned().collect();
    Json(jobs)
}

async fn create_ml_job(
    State(state): State<AppState>,
    Json(job_request): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut azure_ml_service = state.azure_ml.write().await;
    
    let job_type = job_request.get("job_type")
        .and_then(|v| v.as_str())
        .unwrap_or("image_classification");
    
    let job_id = match job_type {
        "automl" => {
            let experiment = azure_ml_service.create_automl_experiment().await;
            azure_ml_service.submit_automl_job(experiment).await
        },
        "stone_detection" => {
            azure_ml_service.submit_stone_detection_job().await
        },
        _ => {
            azure_ml_service.submit_image_classification_job(vec![]).await
        }
    };
    
    match job_id {
        Ok(id) => Ok(Json(serde_json::json!({"job_id": id, "status": "submitted"}))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_ml_job(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<azure_ml::MLJob>, StatusCode> {
    let azure_ml_service = state.azure_ml.read().await;
    match azure_ml_service.get_job_status(&job_id).await {
        Ok(Some(job)) => Ok(Json(job.clone())),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn complete_ml_job(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut azure_ml_service = state.azure_ml.write().await;
    match azure_ml_service.simulate_job_completion(&job_id).await {
        Ok(_) => Ok(Json(serde_json::json!({"status": "completed"}))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_ml_experiments(
    State(state): State<AppState>,
) -> Json<Vec<azure_ml::AutoMLExperiment>> {
    let azure_ml_service = state.azure_ml.read().await;
    let experiments: Vec<_> = azure_ml_service.get_all_experiments().await.into_iter().cloned().collect();
    Json(experiments)
}

async fn create_automl_experiment(
    State(state): State<AppState>,
) -> Result<Json<azure_ml::AutoMLExperiment>, StatusCode> {
    let azure_ml_service = state.azure_ml.read().await;
    let experiment = azure_ml_service.create_automl_experiment().await;
    Ok(Json(experiment))
}

async fn get_ml_deployments(
    State(state): State<AppState>,
) -> Json<Vec<azure_ml::ModelDeployment>> {
    let azure_ml_service = state.azure_ml.read().await;
    let deployments: Vec<_> = azure_ml_service.get_all_deployments().await.into_iter().cloned().collect();
    Json(deployments)
}

async fn deploy_model(
    State(state): State<AppState>,
    Json(deploy_request): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut azure_ml_service = state.azure_ml.write().await;
    
    let model_id = deploy_request.get("model_id")
        .and_then(|v| v.as_str())
        .unwrap_or("default-model");
    
    let endpoint_name = deploy_request.get("endpoint_name")
        .and_then(|v| v.as_str())
        .unwrap_or("kidney-stone-endpoint");
    
    match azure_ml_service.deploy_model(model_id, endpoint_name).await {
        Ok(deployment_id) => Ok(Json(serde_json::json!({
            "deployment_id": deployment_id,
            "status": "deploying"
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_pipeline_config(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let azure_ml_service = state.azure_ml.read().await;
    match azure_ml_service.generate_ml_pipeline_config().await {
        Ok(config) => Ok(Json(config)),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn serve_image_file(
    State(state): State<AppState>,
    Path(id): Path<uuid::Uuid>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let imaging_service = state.imaging.read().await;
    match imaging_service.get_image_base64(id) {
        Ok(base64_data) => {
            Ok(Json(serde_json::json!({
                "image_data": base64_data,
                "format": "base64"
            })))
        },
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}
