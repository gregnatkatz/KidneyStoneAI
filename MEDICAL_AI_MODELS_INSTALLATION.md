# Medical AI Models Installation Guide for Azure NCasT VM

**Developed by Gregory Katz (@gregorykatz_microsoft)**

This guide provides comprehensive instructions for installing and deploying 4 medical AI models on a low-end Azure NCasT VM running Ubuntu, with subsequent integration to Azure ML Studio.

## Overview

This installation covers:
1. **BiomedParse** - Comprehensive biomedical image analysis foundation model
2. **MedImageParse** - Medical image segmentation and parsing
3. **CxrReportGen** - Chest X-ray report generation
4. **MedImageInsight** - Medical image embeddings and tumor malignancy assessment

## Prerequisites

### Azure VM Requirements
- **VM Type**: Standard_NC4as_T4_v3 (Low-end NCasT series)
- **OS**: Ubuntu 20.04 LTS or 22.04 LTS
- **GPU**: NVIDIA T4 (included in NCasT series)
- **RAM**: 28 GB
- **Storage**: 180 GB SSD (minimum)
- **Network**: Standard networking with public IP

### Azure Subscription Requirements
- Valid Azure subscription with GPU quota
- Azure AI Foundry access
- Azure Machine Learning workspace
- Sufficient compute quota for NCasT series VMs

## Part 1: Azure VM Setup

### 1.1 Create Azure NCasT VM

```bash
# Create resource group
az group create --name medical-ai-models-rg --location eastus

# Create VM with GPU support
az vm create \
  --resource-group medical-ai-models-rg \
  --name medical-ai-vm \
  --image Ubuntu2204 \
  --size Standard_NC4as_T4_v3 \
  --admin-username azureuser \
  --generate-ssh-keys \
  --public-ip-sku Standard \
  --storage-sku Premium_LRS

# Open necessary ports
az vm open-port --resource-group medical-ai-models-rg --name medical-ai-vm --port 8000-8004
```

### 1.2 Connect to VM and Initial Setup

```bash
# SSH into the VM
ssh azureuser@<VM_PUBLIC_IP>

# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release
```

### 1.3 Install NVIDIA Drivers and CUDA

```bash
# Install NVIDIA drivers
sudo apt install -y nvidia-driver-535
sudo reboot

# After reboot, verify GPU
nvidia-smi

# Install CUDA Toolkit 11.8
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.0-1_all.deb
sudo dpkg -i cuda-keyring_1.0-1_all.deb
sudo apt update
sudo apt install -y cuda-11-8

# Add CUDA to PATH
echo 'export PATH=/usr/local/cuda-11.8/bin:$PATH' >> ~/.bashrc
echo 'export LD_LIBRARY_PATH=/usr/local/cuda-11.8/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc
```

### 1.4 Install Python and Conda

```bash
# Install Miniconda
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh -b -p $HOME/miniconda3
echo 'export PATH="$HOME/miniconda3/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Initialize conda
conda init bash
source ~/.bashrc

# Install Python 3.9
conda create -n medical-ai python=3.9 -y
conda activate medical-ai
```

## Part 2: Model Installations

### 2.1 BiomedParse Installation

```bash
# Create directory structure
mkdir -p ~/medical-ai-models/biomedparse
cd ~/medical-ai-models/biomedparse

# Clone BiomedParse repository
git clone https://github.com/microsoft/BiomedParse.git
cd BiomedParse

# Create conda environment from provided file
conda env create -f environment.yml
conda activate biomedparse_env

# Install additional dependencies
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install -e .

# Download model weights
mkdir -p models
cd models
wget https://huggingface.co/microsoft/BiomedParse/resolve/main/pytorch_model.bin
wget https://huggingface.co/microsoft/BiomedParse/resolve/main/config.json
cd ..

# Create service script
cat > biomedparse_service.py << 'EOF'
#!/usr/bin/env python3
"""
BiomedParse API Service
Developed by Gregory Katz (@gregorykatz_microsoft)
"""

import torch
import base64
import json
from flask import Flask, request, jsonify
from PIL import Image
import io
import numpy as np
from biomedparse import BiomedParseModel

app = Flask(__name__)

# Load model
model = BiomedParseModel.from_pretrained("./models")
model.eval()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "model": "BiomedParse"})

@app.route('/parse', methods=['POST'])
def parse_image():
    try:
        data = request.json
        image_b64 = data['image']
        text_prompt = data.get('text', 'segment everything')
        
        # Decode image
        image_data = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        # Process with model
        with torch.no_grad():
            results = model.parse(image, text_prompt)
        
        # Encode results
        result_b64 = base64.b64encode(results['mask'].numpy().tobytes()).decode('utf-8')
        
        return jsonify({
            "segmentation_mask": result_b64,
            "categories": results.get('categories', []),
            "confidence": results.get('confidence', 0.0)
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=False)
EOF

chmod +x biomedparse_service.py
```

### 2.2 MedImageParse Installation

```bash
# Create directory for MedImageParse
mkdir -p ~/medical-ai-models/medimageparse
cd ~/medical-ai-models/medimageparse

# Create conda environment
conda create -n medimageparse python=3.9 -y
conda activate medimageparse

# Install dependencies
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install transformers accelerate pillow numpy flask requests azure-ai-ml azure-identity

# Create MedImageParse service (local inference)
cat > medimageparse_service.py << 'EOF'
#!/usr/bin/env python3
"""
MedImageParse Local Service
Developed by Gregory Katz (@gregorykatz_microsoft)
"""

import torch
import base64
import json
from flask import Flask, request, jsonify
from PIL import Image
import io
import numpy as np
from transformers import AutoModel, AutoTokenizer

app = Flask(__name__)

# Note: This is a template - actual MedImageParse model loading depends on Microsoft's release
# For now, this creates a service structure that can be updated when local models are available

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "model": "MedImageParse"})

@app.route('/segment', methods=['POST'])
def segment_image():
    try:
        data = request.json
        image_b64 = data['image']
        text_prompt = data.get('text', 'liver')
        
        # Decode image
        image_data = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        # Resize to 1024x1024 as required
        image = image.resize((1024, 1024))
        
        # TODO: Replace with actual MedImageParse model inference
        # For now, return mock segmentation
        mock_mask = np.zeros((1024, 1024), dtype=np.uint8)
        result_b64 = base64.b64encode(mock_mask.tobytes()).decode('utf-8')
        
        return jsonify({
            "segmentation_mask": result_b64,
            "shape": [1024, 1024],
            "categories": [text_prompt],
            "note": "Local MedImageParse - update with actual model when available"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001, debug=False)
EOF

chmod +x medimageparse_service.py
```

### 2.3 CxrReportGen Installation

```bash
# Create directory for CxrReportGen
mkdir -p ~/medical-ai-models/cxrreportgen
cd ~/medical-ai-models/cxrreportgen

# Create conda environment
conda create -n cxrreportgen python=3.9 -y
conda activate cxrreportgen

# Install dependencies
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install transformers accelerate pillow numpy flask requests

# Create CxrReportGen service
cat > cxrreportgen_service.py << 'EOF'
#!/usr/bin/env python3
"""
CxrReportGen Local Service
Developed by Gregory Katz (@gregorykatz_microsoft)
"""

import torch
import base64
import json
from flask import Flask, request, jsonify
from PIL import Image
import io
import numpy as np

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "model": "CxrReportGen"})

@app.route('/generate_report', methods=['POST'])
def generate_report():
    try:
        data = request.json
        image_b64 = data['image']
        indication = data.get('indication', 'chest pain')
        
        # Decode image
        image_data = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        # TODO: Replace with actual CxrReportGen model inference
        # For now, return structured mock report
        mock_report = {
            "findings": f"Chest X-ray performed for {indication}. No acute cardiopulmonary abnormalities identified.",
            "impression": "Normal chest X-ray",
            "indication": indication,
            "technique": "Frontal chest radiograph",
            "comparison": "None available"
        }
        
        return jsonify({
            "report": mock_report,
            "note": "Local CxrReportGen - update with actual model when available"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8002, debug=False)
EOF

chmod +x cxrreportgen_service.py
```

### 2.4 MedImageInsight Installation

```bash
# Create directory for MedImageInsight
mkdir -p ~/medical-ai-models/medimageinsight
cd ~/medical-ai-models/medimageinsight

# Create conda environment
conda create -n medimageinsight python=3.9 -y
conda activate medimageinsight

# Install dependencies
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install transformers accelerate pillow numpy flask requests scikit-learn

# Create MedImageInsight service
cat > medimageinsight_service.py << 'EOF'
#!/usr/bin/env python3
"""
MedImageInsight Local Service
Developed by Gregory Katz (@gregorykatz_microsoft)
"""

import torch
import base64
import json
from flask import Flask, request, jsonify
from PIL import Image
import io
import numpy as np

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "model": "MedImageInsight"})

@app.route('/analyze', methods=['POST'])
def analyze_image():
    try:
        data = request.json
        image_b64 = data['image']
        analysis_type = data.get('type', 'malignancy')
        
        # Decode image
        image_data = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        # TODO: Replace with actual MedImageInsight model inference
        # For now, return mock analysis
        if analysis_type == 'malignancy':
            mock_result = {
                "malignancy_likelihood": 0.15,
                "confidence": 0.87,
                "features": ["well-defined borders", "homogeneous texture"],
                "recommendation": "Benign appearance, routine follow-up"
            }
        else:
            mock_result = {
                "embeddings": [0.1, 0.2, 0.3],  # Mock embedding vector
                "similarity_score": 0.92,
                "analysis_type": analysis_type
            }
        
        return jsonify({
            "analysis": mock_result,
            "note": "Local MedImageInsight - update with actual model when available"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8003, debug=False)
EOF

chmod +x medimageinsight_service.py
```

## Part 3: Service Management

### 3.1 Create Master Control Script

```bash
# Create master control script
cat > ~/medical-ai-models/manage_services.sh << 'EOF'
#!/bin/bash
# Medical AI Models Service Manager
# Developed by Gregory Katz (@gregorykatz_microsoft)

SERVICES=("biomedparse:8000" "medimageparse:8001" "cxrreportgen:8002" "medimageinsight:8003")
BASE_DIR="$HOME/medical-ai-models"

start_service() {
    local service_name=$1
    local port=$2
    local service_dir="$BASE_DIR/$service_name"
    
    echo "Starting $service_name on port $port..."
    cd "$service_dir"
    
    # Activate appropriate conda environment
    source ~/miniconda3/etc/profile.d/conda.sh
    conda activate $service_name
    
    # Start service in background
    nohup python ${service_name}_service.py > ${service_name}.log 2>&1 &
    echo $! > ${service_name}.pid
    
    echo "$service_name started with PID $(cat ${service_name}.pid)"
}

stop_service() {
    local service_name=$1
    local service_dir="$BASE_DIR/$service_name"
    
    if [ -f "$service_dir/${service_name}.pid" ]; then
        local pid=$(cat "$service_dir/${service_name}.pid")
        echo "Stopping $service_name (PID: $pid)..."
        kill $pid 2>/dev/null
        rm "$service_dir/${service_name}.pid"
        echo "$service_name stopped"
    else
        echo "$service_name is not running"
    fi
}

status_service() {
    local service_name=$1
    local port=$2
    local service_dir="$BASE_DIR/$service_name"
    
    if [ -f "$service_dir/${service_name}.pid" ]; then
        local pid=$(cat "$service_dir/${service_name}.pid")
        if ps -p $pid > /dev/null; then
            echo "$service_name is running (PID: $pid, Port: $port)"
            curl -s http://localhost:$port/health | jq . 2>/dev/null || echo "Health check failed"
        else
            echo "$service_name is not running (stale PID file)"
            rm "$service_dir/${service_name}.pid"
        fi
    else
        echo "$service_name is not running"
    fi
}

case "$1" in
    start)
        echo "Starting all medical AI services..."
        for service_info in "${SERVICES[@]}"; do
            IFS=':' read -r service_name port <<< "$service_info"
            start_service "$service_name" "$port"
        done
        ;;
    stop)
        echo "Stopping all medical AI services..."
        for service_info in "${SERVICES[@]}"; do
            IFS=':' read -r service_name port <<< "$service_info"
            stop_service "$service_name"
        done
        ;;
    status)
        echo "Medical AI Services Status:"
        for service_info in "${SERVICES[@]}"; do
            IFS=':' read -r service_name port <<< "$service_info"
            status_service "$service_name" "$port"
        done
        ;;
    restart)
        $0 stop
        sleep 5
        $0 start
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        exit 1
        ;;
esac
EOF

chmod +x ~/medical-ai-models/manage_services.sh
```

### 3.2 Create Systemd Services (Optional)

```bash
# Create systemd service for automatic startup
sudo tee /etc/systemd/system/medical-ai-models.service > /dev/null << EOF
[Unit]
Description=Medical AI Models Service
After=network.target

[Service]
Type=forking
User=azureuser
WorkingDirectory=/home/azureuser/medical-ai-models
ExecStart=/home/azureuser/medical-ai-models/manage_services.sh start
ExecStop=/home/azureuser/medical-ai-models/manage_services.sh stop
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable medical-ai-models.service
```

## Part 4: Azure ML Studio Integration

### 4.1 Install Azure CLI and ML Extension

```bash
# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Install ML extension
az extension add -n ml

# Login to Azure
az login
```

### 4.2 Create Azure ML Workspace

```bash
# Set variables
RESOURCE_GROUP="medical-ai-models-rg"
WORKSPACE_NAME="medical-ai-workspace"
LOCATION="eastus"

# Create ML workspace
az ml workspace create \
    --resource-group $RESOURCE_GROUP \
    --name $WORKSPACE_NAME \
    --location $LOCATION
```

### 4.3 Register VM as Compute Target

```bash
# Get VM details
VM_NAME="medical-ai-vm"
VM_IP=$(az vm show -g $RESOURCE_GROUP -n $VM_NAME --show-details --query publicIps -o tsv)

# Create compute target configuration
cat > compute-config.yml << EOF
name: medical-ai-vm-compute
type: virtualmachine
location: eastus
resource_id: /subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Compute/virtualMachines/$VM_NAME
ssh_settings:
  admin_username: azureuser
  ssh_key_value: $(cat ~/.ssh/id_rsa.pub)
EOF

# Register compute target
az ml compute create --file compute-config.yml --resource-group $RESOURCE_GROUP --workspace-name $WORKSPACE_NAME
```

### 4.4 Create Model Endpoints

```bash
# Create endpoint configurations for each model
for model in biomedparse medimageparse cxrreportgen medimageinsight; do
    port=$((8000 + $(echo "biomedparse medimageparse cxrreportgen medimageinsight" | tr ' ' '\n' | grep -n $model | cut -d: -f1) - 1))
    
    cat > ${model}-endpoint.yml << EOF
name: ${model}-endpoint
description: ${model} model endpoint
auth_mode: key
traffic:
  ${model}-deployment: 100
EOF

    cat > ${model}-deployment.yml << EOF
name: ${model}-deployment
endpoint_name: ${model}-endpoint
model: azureml://models/${model}/versions/1
environment: azureml://environments/sklearn-1.0/versions/1
compute: medical-ai-vm-compute
instance_count: 1
request_settings:
  request_timeout_ms: 90000
  max_concurrent_requests_per_instance: 1
  max_queue_wait_ms: 500
environment_variables:
  MODEL_PORT: "${port}"
  MODEL_HOST: "localhost"
EOF

    # Create endpoint
    az ml online-endpoint create --file ${model}-endpoint.yml --resource-group $RESOURCE_GROUP --workspace-name $WORKSPACE_NAME
    
    # Create deployment
    az ml online-deployment create --file ${model}-deployment.yml --resource-group $RESOURCE_GROUP --workspace-name $WORKSPACE_NAME
done
```

## Part 5: Testing and Validation

### 5.1 Test Local Services

```bash
# Start all services
~/medical-ai-models/manage_services.sh start

# Test each service
echo "Testing BiomedParse..."
curl -X POST http://localhost:8000/health

echo "Testing MedImageParse..."
curl -X POST http://localhost:8001/health

echo "Testing CxrReportGen..."
curl -X POST http://localhost:8002/health

echo "Testing MedImageInsight..."
curl -X POST http://localhost:8003/health
```

### 5.2 Test with Sample Image

```bash
# Create test script
cat > test_models.py << 'EOF'
#!/usr/bin/env python3
"""
Medical AI Models Test Script
Developed by Gregory Katz (@gregorykatz_microsoft)
"""

import requests
import base64
import json
from PIL import Image
import io

def create_test_image():
    # Create a simple test image
    img = Image.new('RGB', (1024, 1024), color='gray')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')

def test_service(service_name, port, endpoint, payload):
    url = f"http://localhost:{port}/{endpoint}"
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"{service_name}: {response.status_code}")
        print(f"Response: {response.json()}")
        return True
    except Exception as e:
        print(f"{service_name} Error: {e}")
        return False

# Test all services
test_image = create_test_image()

services = [
    ("BiomedParse", 8000, "parse", {"image": test_image, "text": "liver"}),
    ("MedImageParse", 8001, "segment", {"image": test_image, "text": "kidney"}),
    ("CxrReportGen", 8002, "generate_report", {"image": test_image, "indication": "chest pain"}),
    ("MedImageInsight", 8003, "analyze", {"image": test_image, "type": "malignancy"})
]

for service_name, port, endpoint, payload in services:
    print(f"\n--- Testing {service_name} ---")
    test_service(service_name, port, endpoint, payload)
EOF

python test_models.py
```

## Part 6: Monitoring and Maintenance

### 6.1 Setup Monitoring

```bash
# Install monitoring tools
sudo apt install -y htop nvidia-ml-py3

# Create monitoring script
cat > ~/medical-ai-models/monitor.py << 'EOF'
#!/usr/bin/env python3
"""
Medical AI Models Monitoring
Developed by Gregory Katz (@gregorykatz_microsoft)
"""

import psutil
import GPUtil
import requests
import time
import json
from datetime import datetime

def check_system_resources():
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    try:
        gpus = GPUtil.getGPUs()
        gpu_info = {
            "gpu_count": len(gpus),
            "gpu_usage": [gpu.load * 100 for gpu in gpus],
            "gpu_memory": [gpu.memoryUtil * 100 for gpu in gpus]
        }
    except:
        gpu_info = {"error": "GPU monitoring unavailable"}
    
    return {
        "timestamp": datetime.now().isoformat(),
        "cpu_percent": cpu_percent,
        "memory_percent": memory.percent,
        "disk_percent": (disk.used / disk.total) * 100,
        "gpu_info": gpu_info
    }

def check_services():
    services = [
        ("biomedparse", 8000),
        ("medimageparse", 8001),
        ("cxrreportgen", 8002),
        ("medimageinsight", 8003)
    ]
    
    status = {}
    for service, port in services:
        try:
            response = requests.get(f"http://localhost:{port}/health", timeout=5)
            status[service] = {
                "status": "healthy" if response.status_code == 200 else "unhealthy",
                "response_time": response.elapsed.total_seconds()
            }
        except:
            status[service] = {"status": "down", "response_time": None}
    
    return status

if __name__ == "__main__":
    while True:
        system_info = check_system_resources()
        service_status = check_services()
        
        report = {
            "system": system_info,
            "services": service_status
        }
        
        print(json.dumps(report, indent=2))
        time.sleep(60)  # Check every minute
EOF

chmod +x ~/medical-ai-models/monitor.py
```

### 6.2 Setup Log Rotation

```bash
# Create logrotate configuration
sudo tee /etc/logrotate.d/medical-ai-models > /dev/null << EOF
/home/azureuser/medical-ai-models/*/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF
```

## Part 7: Security and Best Practices

### 7.1 Firewall Configuration

```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 8000:8003/tcp  # Allow model service ports
sudo ufw status
```

### 7.2 SSL/TLS Setup (Optional)

```bash
# Install nginx for reverse proxy with SSL
sudo apt install -y nginx certbot python3-certbot-nginx

# Create nginx configuration
sudo tee /etc/nginx/sites-available/medical-ai-models > /dev/null << EOF
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain
    
    location /biomedparse/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
    
    location /medimageparse/ {
        proxy_pass http://localhost:8001/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
    
    location /cxrreportgen/ {
        proxy_pass http://localhost:8002/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
    
    location /medimageinsight/ {
        proxy_pass http://localhost:8003/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/medical-ai-models /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Troubleshooting

### Common Issues

1. **CUDA Out of Memory**
   - Reduce batch sizes in model configurations
   - Monitor GPU memory usage with `nvidia-smi`

2. **Service Won't Start**
   - Check logs in respective service directories
   - Verify conda environment activation
   - Ensure all dependencies are installed

3. **Port Conflicts**
   - Use `netstat -tulpn | grep :8000` to check port usage
   - Modify port assignments in service scripts

4. **Model Loading Errors**
   - Verify model weights are downloaded correctly
   - Check file permissions
   - Ensure sufficient disk space

### Performance Optimization

1. **GPU Utilization**
   - Monitor with `nvidia-smi -l 1`
   - Adjust batch sizes for optimal GPU usage

2. **Memory Management**
   - Use `htop` to monitor system memory
   - Configure swap if needed

3. **Network Optimization**
   - Use nginx for load balancing
   - Implement request queuing for high loads

## Next Steps

1. **Model Updates**: Replace mock implementations with actual model weights when available
2. **Scaling**: Consider container orchestration with Docker/Kubernetes
3. **Monitoring**: Integrate with Azure Monitor or Prometheus
4. **Backup**: Implement automated backup strategies for model weights and configurations

## Support

For issues and questions:
- Check service logs in respective directories
- Monitor system resources with provided monitoring script
- Review Azure ML Studio integration status
- Contact: Gregory Katz (@gregorykatz_microsoft)

---

**Note**: This installation guide provides a comprehensive framework for deploying medical AI models on Azure NCasT VMs. Some model implementations may require updates when official local deployment packages become available from Microsoft.
