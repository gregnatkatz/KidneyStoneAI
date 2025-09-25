# Azure ML Studio Configuration Guide

## Overview

This guide provides detailed step-by-step instructions for configuring Azure ML Studio integration with the Kidney Stone Research Platform. The system currently uses mock endpoints and needs real Azure ML Studio credentials to enable full functionality.

## Prerequisites

- Azure subscription with ML Studio access
- Resource group created for the kidney stone research project
- Azure ML workspace provisioned
- API keys and authentication configured

## Configuration Steps

### 1. Azure ML Workspace Setup

#### Step 1.1: Create Azure ML Workspace
```bash
# Using Azure CLI
az ml workspace create \
  --name kidney-stone-research-ws \
  --resource-group kidney-stone-rg \
  --subscription your-subscription-id \
  --location eastus
```

#### Step 1.2: Get Workspace Details
```bash
# Get workspace information
az ml workspace show \
  --name kidney-stone-research-ws \
  --resource-group kidney-stone-rg \
  --subscription your-subscription-id
```

### 2. Update Configuration File

The Azure ML configuration is located in `/backend/src/azure_ml.rs`. Update the `create_default_azure_ml_config()` function:

```rust
pub fn create_default_azure_ml_config() -> AzureMLConfig {
    AzureMLConfig {
        workspace_name: "kidney-stone-research-ws".to_string(),           // ✅ Update with your workspace name
        resource_group: "kidney-stone-rg".to_string(),                    // ✅ Update with your resource group
        subscription_id: "your-subscription-id".to_string(),              // ❌ REPLACE with real subscription ID
        endpoint_url: "https://kidney-stone-research-ws.azureml.net".to_string(), // ✅ Update with your workspace URL
        api_key: None,                                                     // ❌ REPLACE with real API key
    }
}
```

### 3. Environment Variables Setup

Create a `.env` file in the backend directory:

```env
# Azure ML Studio Configuration
AZURE_ML_SUBSCRIPTION_ID=your-actual-subscription-id
AZURE_ML_RESOURCE_GROUP=kidney-stone-rg
AZURE_ML_WORKSPACE_NAME=kidney-stone-research-ws
AZURE_ML_ENDPOINT_URL=https://kidney-stone-research-ws.azureml.net
AZURE_ML_API_KEY=your-actual-api-key
AZURE_ML_TENANT_ID=your-tenant-id
AZURE_ML_CLIENT_ID=your-client-id
AZURE_ML_CLIENT_SECRET=your-client-secret
```

### 4. Authentication Setup

#### Option A: Service Principal Authentication
```bash
# Create service principal
az ad sp create-for-rbac \
  --name kidney-stone-ml-sp \
  --role contributor \
  --scopes /subscriptions/your-subscription-id/resourceGroups/kidney-stone-rg
```

#### Option B: Managed Identity (Recommended for Production)
```bash
# Enable managed identity for your compute resources
az vm identity assign \
  --name your-vm-name \
  --resource-group kidney-stone-rg
```

### 5. Compute Targets Configuration

#### Step 5.1: Create CPU Cluster
```bash
az ml compute create \
  --name cpu-cluster \
  --type amlcompute \
  --min-instances 0 \
  --max-instances 4 \
  --size Standard_DS3_v2 \
  --workspace-name kidney-stone-research-ws \
  --resource-group kidney-stone-rg
```

#### Step 5.2: Create GPU Cluster
```bash
az ml compute create \
  --name gpu-cluster \
  --type amlcompute \
  --min-instances 0 \
  --max-instances 2 \
  --size Standard_NC6s_v3 \
  --workspace-name kidney-stone-research-ws \
  --resource-group kidney-stone-rg
```

### 6. Dataset Registration

#### Step 6.1: Upload Kidney Stone Images
```bash
# Create datastore for kidney stone images
az ml datastore create \
  --name kidney-images \
  --type azureblob \
  --account-name your-storage-account \
  --container-name kidney-stone-images \
  --workspace-name kidney-stone-research-ws \
  --resource-group kidney-stone-rg
```

#### Step 6.2: Register Datasets
```bash
# Register complete image dataset
az ml dataset register \
  --name kidney-stone-complete \
  --datastore kidney-images \
  --path complete-images/ \
  --workspace-name kidney-stone-research-ws \
  --resource-group kidney-stone-rg

# Register incomplete image dataset for ML testing
az ml dataset register \
  --name kidney-stone-incomplete \
  --datastore kidney-images \
  --path incomplete-images/ \
  --workspace-name kidney-stone-research-ws \
  --resource-group kidney-stone-rg
```

### 7. Pipeline Configuration

The system includes a comprehensive 5-step ML pipeline:

1. **Data Preparation**: `prepare_kidney_data.py`
2. **Feature Engineering**: `feature_engineering.py`
3. **Model Training**: AutoML classification
4. **Model Evaluation**: `evaluate_model.py`
5. **Model Deployment**: Automated endpoint deployment

#### Step 7.1: Upload Pipeline Scripts
```bash
# Upload pipeline scripts to Azure ML
az ml job create \
  --file pipeline-config.yml \
  --workspace-name kidney-stone-research-ws \
  --resource-group kidney-stone-rg
```

### 8. Model Endpoints Configuration

#### Step 8.1: Deploy Image Classification Model
```bash
az ml online-endpoint create \
  --name kidney-classification-endpoint \
  --workspace-name kidney-stone-research-ws \
  --resource-group kidney-stone-rg
```

#### Step 8.2: Deploy Stone Detection Model
```bash
az ml online-endpoint create \
  --name stone-detection-endpoint \
  --workspace-name kidney-stone-research-ws \
  --resource-group kidney-stone-rg
```

### 9. Testing Configuration

#### Step 9.1: Test Connection
```rust
// Add to your Rust code for testing
#[tokio::test]
async fn test_azure_ml_connection() {
    let config = create_azure_ml_config_from_env();
    let mut service = AzureMLService::new(config);
    
    // Test dataset creation
    let dataset_name = service.create_kidney_stone_dataset().await.unwrap();
    assert!(!dataset_name.is_empty());
    
    // Test job submission
    let experiment = service.create_automl_experiment().await;
    let job_id = service.submit_automl_job(experiment).await.unwrap();
    assert!(!job_id.is_empty());
}
```

#### Step 9.2: Validate Pipeline
```bash
# Run pipeline validation
az ml pipeline validate \
  --file kidney-stone-pipeline.yml \
  --workspace-name kidney-stone-research-ws \
  --resource-group kidney-stone-rg
```

### 10. Monitoring and Logging

#### Step 10.1: Enable Application Insights
```bash
az ml workspace update \
  --name kidney-stone-research-ws \
  --resource-group kidney-stone-rg \
  --application-insights your-app-insights-resource
```

#### Step 10.2: Configure Logging
```rust
// Update logging configuration in main.rs
use tracing::{info, warn, error};

// Log Azure ML operations
info!("Azure ML job submitted: {}", job_id);
warn!("Azure ML job failed: {}", error_message);
error!("Azure ML connection failed: {}", connection_error);
```

## ML Job Types Supported

### 1. Image Classification
- **Model**: ResNet50
- **Purpose**: Classify kidney conditions (Normal, Cyst, Tumor, Stone)
- **Training**: 100 epochs, batch size 16
- **Expected Accuracy**: >92%

### 2. Stone Detection
- **Model**: YOLOv8
- **Purpose**: Detect and localize kidney stones in CT images
- **Training**: 150 epochs, batch size 8
- **Expected Accuracy**: >88%

### 3. Risk Prediction
- **Model**: AutoML Classification
- **Purpose**: Predict patient risk levels (Low, Moderate, High)
- **Features**: Age, gender, lab values, medical history
- **Expected Accuracy**: >86%

### 4. Composition Analysis
- **Model**: Custom CNN
- **Purpose**: Analyze stone composition and characteristics
- **Training**: Transfer learning from medical imaging models

### 5. AutoML Experiments
- **Task**: Classification and regression
- **Max Trials**: 50
- **Timeout**: 120 minutes
- **Primary Metric**: Accuracy

## Incomplete Image Handling

The system supports 6 types of incomplete images for ML testing:

1. **Partial Scan**: Incomplete CT coverage
2. **Motion Artifact**: Patient movement during scan
3. **Low Contrast**: Poor image quality
4. **Incomplete Coverage**: Missing anatomical regions
5. **Noise Corrupted**: Electronic noise interference
6. **Partial Reconstruction**: Incomplete image reconstruction

Each type includes 50 synthetic images for comprehensive ML training and testing.

## Troubleshooting

### Common Issues

#### Issue 1: Authentication Failed
```bash
# Solution: Refresh Azure CLI login
az login --tenant your-tenant-id
az account set --subscription your-subscription-id
```

#### Issue 2: Compute Target Not Found
```bash
# Solution: Verify compute target exists
az ml compute list \
  --workspace-name kidney-stone-research-ws \
  --resource-group kidney-stone-rg
```

#### Issue 3: Dataset Registration Failed
```bash
# Solution: Check datastore permissions
az ml datastore show \
  --name kidney-images \
  --workspace-name kidney-stone-research-ws \
  --resource-group kidney-stone-rg
```

### Performance Optimization

1. **Use GPU clusters** for image classification and detection tasks
2. **Enable early stopping** to prevent overfitting
3. **Configure auto-scaling** for compute targets
4. **Use parallel processing** for batch inference
5. **Implement model caching** for faster predictions

## Security Best Practices

1. **Use managed identities** instead of service principals when possible
2. **Store secrets in Azure Key Vault**
3. **Enable network isolation** for ML workspaces
4. **Implement RBAC** for resource access
5. **Enable audit logging** for all ML operations

## Cost Optimization

1. **Use low-priority VMs** for training jobs
2. **Configure auto-shutdown** for compute instances
3. **Monitor resource usage** with Azure Cost Management
4. **Use spot instances** for non-critical workloads
5. **Implement resource tagging** for cost tracking

## Next Steps

After completing this configuration:

1. Test all ML job types with real data
2. Validate model performance metrics
3. Set up automated retraining pipelines
4. Configure production deployment
5. Implement monitoring and alerting

## Support

For additional support:
- Azure ML Documentation: https://docs.microsoft.com/azure/machine-learning/
- Azure CLI Reference: https://docs.microsoft.com/cli/azure/ml
- GitHub Issues: Create issues in the project repository
