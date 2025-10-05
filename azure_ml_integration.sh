#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

RESOURCE_GROUP="medical-ai-models-rg"
WORKSPACE_NAME="medical-ai-workspace"
LOCATION="eastus"
VM_NAME="medical-ai-vm"

log "Starting Azure ML Studio integration..."

if ! command -v az &> /dev/null; then
    error "Azure CLI is not installed. Please install it first."
fi

if ! az extension list | grep -q "ml"; then
    log "Installing Azure ML extension..."
    az extension add -n ml
fi

if ! az account show &> /dev/null; then
    log "Please login to Azure..."
    az login
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
log "Using subscription: $SUBSCRIPTION_ID"

log "Creating/verifying resource group: $RESOURCE_GROUP"
az group create --name $RESOURCE_GROUP --location $LOCATION --output table

log "Creating Azure ML workspace: $WORKSPACE_NAME"
if ! az ml workspace show --resource-group $RESOURCE_GROUP --name $WORKSPACE_NAME &> /dev/null; then
    az ml workspace create \
        --resource-group $RESOURCE_GROUP \
        --name $WORKSPACE_NAME \
        --location $LOCATION \
        --output table
    log "Azure ML workspace created successfully"
else
    log "Azure ML workspace already exists"
fi

log "Getting VM details..."
if az vm show -g $RESOURCE_GROUP -n $VM_NAME &> /dev/null; then
    VM_IP=$(az vm show -g $RESOURCE_GROUP -n $VM_NAME --show-details --query publicIps -o tsv)
    VM_RESOURCE_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Compute/virtualMachines/$VM_NAME"
    log "VM found: $VM_NAME (IP: $VM_IP)"
else
    warn "VM $VM_NAME not found in resource group $RESOURCE_GROUP"
    read -p "Enter your VM name: " VM_NAME
    VM_IP=$(az vm show -g $RESOURCE_GROUP -n $VM_NAME --show-details --query publicIps -o tsv)
    VM_RESOURCE_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Compute/virtualMachines/$VM_NAME"
fi

log "Creating compute target configuration..."
cat > compute-config.yml << EOF
\$schema: https://azuremlschemas.azureedge.net/latest/compute.schema.json
name: medical-ai-vm-compute
type: virtualmachine
location: $LOCATION
resource_id: $VM_RESOURCE_ID
ssh_settings:
  admin_username: azureuser
  ssh_key_value: $(cat ~/.ssh/id_rsa.pub 2>/dev/null || echo "SSH_KEY_PLACEHOLDER")
EOF

log "Registering compute target..."
if ! az ml compute show --name medical-ai-vm-compute --resource-group $RESOURCE_GROUP --workspace-name $WORKSPACE_NAME &> /dev/null; then
    az ml compute create --file compute-config.yml --resource-group $RESOURCE_GROUP --workspace-name $WORKSPACE_NAME
    log "Compute target registered successfully"
else
    log "Compute target already exists"
fi

log "Creating custom environment..."
cat > medical-ai-environment.yml << EOF
\$schema: https://azuremlschemas.azureedge.net/latest/environment.schema.json
name: medical-ai-env
version: 1
image: mcr.microsoft.com/azureml/openmpi4.1.0-cuda11.8-cudnn8-ubuntu20.04:latest
conda_file: |
  name: medical-ai
  channels:
    - conda-forge
    - pytorch
  dependencies:
    - python=3.9
    - pytorch
    - torchvision
    - torchaudio
    - pytorch-cuda=11.8
    - pip
    - pip:
      - flask
      - pillow
      - numpy
      - transformers
      - accelerate
      - requests
      - azure-ai-ml
      - azure-identity
EOF

az ml environment create --file medical-ai-environment.yml --resource-group $RESOURCE_GROUP --workspace-name $WORKSPACE_NAME || log "Environment already exists or creation skipped"

log "Creating model endpoint configurations..."

MODELS=("biomedparse" "medimageparse" "cxrreportgen" "medimageinsight")
PORTS=(8000 8001 8002 8003)

for i in "${!MODELS[@]}"; do
    model=${MODELS[$i]}
    port=${PORTS[$i]}
    
    log "Creating configuration for $model..."
    
    cat > ${model}-endpoint.yml << EOF
\$schema: https://azuremlschemas.azureedge.net/latest/managedOnlineEndpoint.schema.json
name: ${model}-endpoint
description: ${model} model endpoint on VM
auth_mode: key
traffic:
  ${model}-deployment: 100
EOF

    cat > ${model}-deployment.yml << EOF
\$schema: https://azuremlschemas.azureedge.net/latest/managedOnlineDeployment.schema.json
name: ${model}-deployment
endpoint_name: ${model}-endpoint
environment: azureml:medical-ai-env:1
compute: medical-ai-vm-compute
instance_count: 1
request_settings:
  request_timeout_ms: 90000
  max_concurrent_requests_per_instance: 1
  max_queue_wait_ms: 500
environment_variables:
  MODEL_PORT: "${port}"
  MODEL_HOST: "localhost"
  MODEL_NAME: "${model}"
code_configuration:
  code: ./
  scoring_script: ${model}_score.py
EOF

    cat > ${model}_score.py << EOF
#!/usr/bin/env python3
"""
Azure ML Scoring Script for ${model}
Developed by Gregory Katz (@gregorykatz_microsoft)
"""

import json
import requests
import os
from typing import List

def init():
    """Initialize the model"""
    global model_port, model_host
    model_port = os.environ.get('MODEL_PORT', '${port}')
    model_host = os.environ.get('MODEL_HOST', 'localhost')
    print(f"Initialized ${model} proxy to {model_host}:{model_port}")

def run(raw_data: str) -> List[str]:
    """Run inference"""
    try:
        data = json.loads(raw_data)
        
        if "${model}" == "biomedparse":
            endpoint = "parse"
        elif "${model}" == "medimageparse":
            endpoint = "segment"
        elif "${model}" == "cxrreportgen":
            endpoint = "generate_report"
        elif "${model}" == "medimageinsight":
            endpoint = "analyze"
        else:
            endpoint = "health"
        
        url = f"http://{model_host}:{model_port}/{endpoint}"
        response = requests.post(url, json=data, timeout=60)
        
        if response.status_code == 200:
            return [json.dumps(response.json())]
        else:
            return [json.dumps({"error": f"Service returned {response.status_code}"})]
    
    except Exception as e:
        return [json.dumps({"error": str(e)})]
EOF

done

log "Creating deployment script..."
cat > deploy_endpoints.sh << 'EOF'
#!/bin/bash

RESOURCE_GROUP="medical-ai-models-rg"
WORKSPACE_NAME="medical-ai-workspace"
MODELS=("biomedparse" "medimageparse" "cxrreportgen" "medimageinsight")

echo "Deploying model endpoints to Azure ML Studio..."

for model in "${MODELS[@]}"; do
    echo "Deploying $model..."
    
    if ! az ml online-endpoint show --name ${model}-endpoint --resource-group $RESOURCE_GROUP --workspace-name $WORKSPACE_NAME &> /dev/null; then
        echo "Creating endpoint for $model..."
        az ml online-endpoint create --file ${model}-endpoint.yml --resource-group $RESOURCE_GROUP --workspace-name $WORKSPACE_NAME
    else
        echo "Endpoint for $model already exists"
    fi
    
    if ! az ml online-deployment show --name ${model}-deployment --endpoint-name ${model}-endpoint --resource-group $RESOURCE_GROUP --workspace-name $WORKSPACE_NAME &> /dev/null; then
        echo "Creating deployment for $model..."
        az ml online-deployment create --file ${model}-deployment.yml --resource-group $RESOURCE_GROUP --workspace-name $WORKSPACE_NAME
    else
        echo "Deployment for $model already exists"
    fi
    
    echo "Getting endpoint details for $model..."
    az ml online-endpoint show --name ${model}-endpoint --resource-group $RESOURCE_GROUP --workspace-name $WORKSPACE_NAME --query "scoring_uri" -o tsv
done

echo "All endpoints deployed successfully!"
echo "You can now access your models through Azure ML Studio endpoints."
EOF

chmod +x deploy_endpoints.sh

log "Creating Azure ML monitoring script..."
cat > monitor_ml_endpoints.py << 'EOF'
#!/usr/bin/env python3
"""
Azure ML Endpoints Monitoring Script
Developed by Gregory Katz (@gregorykatz_microsoft)
"""

import json
import time
import subprocess
from datetime import datetime

def get_endpoint_status(endpoint_name, resource_group, workspace_name):
    """Get endpoint status using Azure CLI"""
    try:
        cmd = [
            "az", "ml", "online-endpoint", "show",
            "--name", endpoint_name,
            "--resource-group", resource_group,
            "--workspace-name", workspace_name,
            "--query", "provisioning_state",
            "-o", "tsv"
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.stdout.strip() if result.returncode == 0 else "Unknown"
    except Exception as e:
        return f"Error: {e}"

def get_endpoint_logs(endpoint_name, deployment_name, resource_group, workspace_name):
    """Get endpoint logs"""
    try:
        cmd = [
            "az", "ml", "online-deployment", "get-logs",
            "--name", deployment_name,
            "--endpoint-name", endpoint_name,
            "--resource-group", resource_group,
            "--workspace-name", workspace_name,
            "--lines", "10"
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.stdout if result.returncode == 0 else "No logs available"
    except Exception as e:
        return f"Error getting logs: {e}"

def main():
    resource_group = "medical-ai-models-rg"
    workspace_name = "medical-ai-workspace"
    models = ["biomedparse", "medimageparse", "cxrreportgen", "medimageinsight"]
    
    print("Azure ML Endpoints Monitoring")
    print("=" * 50)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print()
    
    for model in models:
        endpoint_name = f"{model}-endpoint"
        deployment_name = f"{model}-deployment"
        
        print(f"Checking {model}...")
        status = get_endpoint_status(endpoint_name, resource_group, workspace_name)
        print(f"  Status: {status}")
        
        if status.lower() in ["succeeded", "running"]:
            print("  ✓ Endpoint is healthy")
        else:
            print("  ✗ Endpoint may have issues")
            logs = get_endpoint_logs(endpoint_name, deployment_name, resource_group, workspace_name)
            print(f"  Recent logs: {logs[:200]}...")
        
        print()

if __name__ == "__main__":
    main()
EOF

chmod +x monitor_ml_endpoints.py

log "Creating Azure ML endpoint test script..."
cat > test_ml_endpoints.py << 'EOF'
#!/usr/bin/env python3
"""
Test Azure ML Endpoints
Developed by Gregory Katz (@gregorykatz_microsoft)
"""

import json
import requests
import base64
import subprocess
from PIL import Image
import io

def get_endpoint_uri(endpoint_name, resource_group, workspace_name):
    """Get endpoint URI using Azure CLI"""
    try:
        cmd = [
            "az", "ml", "online-endpoint", "show",
            "--name", endpoint_name,
            "--resource-group", resource_group,
            "--workspace-name", workspace_name,
            "--query", "scoring_uri",
            "-o", "tsv"
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.stdout.strip() if result.returncode == 0 else None
    except Exception as e:
        print(f"Error getting endpoint URI: {e}")
        return None

def get_endpoint_key(endpoint_name, resource_group, workspace_name):
    """Get endpoint key using Azure CLI"""
    try:
        cmd = [
            "az", "ml", "online-endpoint", "get-credentials",
            "--name", endpoint_name,
            "--resource-group", resource_group,
            "--workspace-name", workspace_name,
            "--query", "primaryKey",
            "-o", "tsv"
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.stdout.strip() if result.returncode == 0 else None
    except Exception as e:
        print(f"Error getting endpoint key: {e}")
        return None

def create_test_image():
    """Create a test image"""
    img = Image.new('RGB', (1024, 1024), color='gray')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')

def test_endpoint(endpoint_name, payload, resource_group, workspace_name):
    """Test an Azure ML endpoint"""
    uri = get_endpoint_uri(endpoint_name, resource_group, workspace_name)
    key = get_endpoint_key(endpoint_name, resource_group, workspace_name)
    
    if not uri or not key:
        print(f"✗ Could not get URI or key for {endpoint_name}")
        return False
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {key}'
    }
    
    try:
        response = requests.post(uri, json=payload, headers=headers, timeout=60)
        if response.status_code == 200:
            print(f"✓ {endpoint_name}: Success")
            result = response.json()
            print(f"  Response: {json.dumps(result, indent=2)[:200]}...")
            return True
        else:
            print(f"✗ {endpoint_name}: HTTP {response.status_code}")
            print(f"  Error: {response.text[:200]}...")
            return False
    except Exception as e:
        print(f"✗ {endpoint_name}: {e}")
        return False

def main():
    resource_group = "medical-ai-models-rg"
    workspace_name = "medical-ai-workspace"
    
    print("Testing Azure ML Endpoints")
    print("=" * 50)
    
    test_image = create_test_image()
    
    tests = [
        ("biomedparse-endpoint", {"image": test_image, "text": "liver"}),
        ("medimageparse-endpoint", {"image": test_image, "text": "kidney"}),
        ("cxrreportgen-endpoint", {"image": test_image, "indication": "chest pain"}),
        ("medimageinsight-endpoint", {"image": test_image, "type": "malignancy"})
    ]
    
    success_count = 0
    for endpoint_name, payload in tests:
        print(f"\nTesting {endpoint_name}...")
        if test_endpoint(endpoint_name, payload, resource_group, workspace_name):
            success_count += 1
    
    print(f"\n{'='*50}")
    print(f"Test Results: {success_count}/{len(tests)} endpoints responding")

if __name__ == "__main__":
    main()
EOF

chmod +x test_ml_endpoints.py

rm -f compute-config.yml medical-ai-environment.yml
rm -f *-endpoint.yml *-deployment.yml *_score.py

log "Azure ML Studio integration setup completed!"
echo
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Deploy endpoints: ./deploy_endpoints.sh"
echo "2. Monitor endpoints: python monitor_ml_endpoints.py"
echo "3. Test endpoints: python test_ml_endpoints.py"
echo
echo -e "${YELLOW}Important Notes:${NC}"
echo "- Ensure your local services are running before deploying endpoints"
echo "- Endpoints will proxy requests to your VM services"
echo "- Monitor costs as Azure ML endpoints incur charges"
echo "- Update scoring scripts with actual model implementations"
echo
echo -e "${GREEN}Azure ML Workspace: $WORKSPACE_NAME${NC}"
echo -e "${GREEN}Resource Group: $RESOURCE_GROUP${NC}"
echo
log "Azure ML Studio integration completed!"
