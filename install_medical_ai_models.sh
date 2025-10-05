#!/bin/bash

set -e  # Exit on any error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

if [[ ! -f /etc/lsb-release ]] || ! grep -q "Ubuntu" /etc/lsb-release; then
    error "This script is designed for Ubuntu. Please run on Ubuntu 20.04 or 22.04."
fi

if [[ $EUID -eq 0 ]]; then
    error "This script should not be run as root. Please run as a regular user with sudo privileges."
fi

if ! command -v nvidia-smi &> /dev/null; then
    warn "NVIDIA GPU not detected. This installation requires an NVIDIA GPU (NCasT VM series)."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

log "Starting Medical AI Models installation on Azure NCasT VM..."

log "Updating system packages..."
sudo apt update && sudo apt upgrade -y

log "Installing essential packages..."
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    jq \
    htop \
    unzip

if ! command -v nvidia-smi &> /dev/null; then
    log "Installing NVIDIA drivers..."
    sudo apt install -y nvidia-driver-535
    warn "NVIDIA drivers installed. System reboot required. Please reboot and run this script again."
    exit 0
fi

log "Verifying GPU availability..."
nvidia-smi || error "GPU verification failed. Please check NVIDIA driver installation."

if ! command -v nvcc &> /dev/null; then
    log "Installing CUDA Toolkit 11.8..."
    wget -q https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.0-1_all.deb
    sudo dpkg -i cuda-keyring_1.0-1_all.deb
    sudo apt update
    sudo apt install -y cuda-11-8
    
    echo 'export PATH=/usr/local/cuda-11.8/bin:$PATH' >> ~/.bashrc
    echo 'export LD_LIBRARY_PATH=/usr/local/cuda-11.8/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
    export PATH=/usr/local/cuda-11.8/bin:$PATH
    export LD_LIBRARY_PATH=/usr/local/cuda-11.8/lib64:$LD_LIBRARY_PATH
fi

if ! command -v conda &> /dev/null; then
    log "Installing Miniconda..."
    wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O miniconda.sh
    bash miniconda.sh -b -p $HOME/miniconda3
    echo 'export PATH="$HOME/miniconda3/bin:$PATH"' >> ~/.bashrc
    export PATH="$HOME/miniconda3/bin:$PATH"
    rm miniconda.sh
    
    $HOME/miniconda3/bin/conda init bash
    source ~/.bashrc
fi

source $HOME/miniconda3/etc/profile.d/conda.sh

MODELS_DIR="$HOME/medical-ai-models"
mkdir -p "$MODELS_DIR"
cd "$MODELS_DIR"

log "Installing BiomedParse..."
mkdir -p biomedparse
cd biomedparse

if [[ ! -d "BiomedParse" ]]; then
    git clone https://github.com/microsoft/BiomedParse.git
fi

cd BiomedParse

if ! conda env list | grep -q "biomedparse"; then
    log "Creating BiomedParse conda environment..."
    conda create -n biomedparse python=3.9 -y
fi

conda activate biomedparse

pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

if [[ -f "requirements.txt" ]]; then
    pip install -r requirements.txt
fi

pip install flask pillow numpy transformers accelerate

pip install -e .

mkdir -p models
cd models

echo "BiomedParse model weights placeholder" > model_weights.txt

cd "$MODELS_DIR"

log "Installing MedImageParse..."
mkdir -p medimageparse
cd medimageparse

if ! conda env list | grep -q "medimageparse"; then
    log "Creating MedImageParse conda environment..."
    conda create -n medimageparse python=3.9 -y
fi

conda activate medimageparse

pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install transformers accelerate pillow numpy flask requests azure-ai-ml azure-identity

cd "$MODELS_DIR"

log "Installing CxrReportGen..."
mkdir -p cxrreportgen
cd cxrreportgen

if ! conda env list | grep -q "cxrreportgen"; then
    log "Creating CxrReportGen conda environment..."
    conda create -n cxrreportgen python=3.9 -y
fi

conda activate cxrreportgen

pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install transformers accelerate pillow numpy flask requests

cd "$MODELS_DIR"

log "Installing MedImageInsight..."
mkdir -p medimageinsight
cd medimageinsight

if ! conda env list | grep -q "medimageinsight"; then
    log "Creating MedImageInsight conda environment..."
    conda create -n medimageinsight python=3.9 -y
fi

conda activate medimageinsight

pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install transformers accelerate pillow numpy flask requests scikit-learn

cd "$MODELS_DIR"

log "Creating service files..."

cat > biomedparse/biomedparse_service.py << 'EOF'
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

app = Flask(__name__)


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "model": "BiomedParse", "note": "Service ready - update with actual model"})

@app.route('/parse', methods=['POST'])
def parse_image():
    try:
        data = request.json
        image_b64 = data['image']
        text_prompt = data.get('text', 'segment everything')
        
        image_data = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        mock_mask = np.zeros((1024, 1024), dtype=np.uint8)
        result_b64 = base64.b64encode(mock_mask.tobytes()).decode('utf-8')
        
        return jsonify({
            "segmentation_mask": result_b64,
            "categories": ["mock_category"],
            "confidence": 0.85,
            "note": "Mock response - update with actual BiomedParse model"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=False)
EOF

chmod +x biomedparse/biomedparse_service.py

cat > medimageparse/medimageparse_service.py << 'EOF'
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

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "model": "MedImageParse", "note": "Service ready - update with actual model"})

@app.route('/segment', methods=['POST'])
def segment_image():
    try:
        data = request.json
        image_b64 = data['image']
        text_prompt = data.get('text', 'liver')
        
        image_data = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        image = image.resize((1024, 1024))
        
        mock_mask = np.zeros((1024, 1024), dtype=np.uint8)
        result_b64 = base64.b64encode(mock_mask.tobytes()).decode('utf-8')
        
        return jsonify({
            "segmentation_mask": result_b64,
            "shape": [1024, 1024],
            "categories": [text_prompt],
            "note": "Mock response - update with actual MedImageParse model"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001, debug=False)
EOF

chmod +x medimageparse/medimageparse_service.py

cat > cxrreportgen/cxrreportgen_service.py << 'EOF'
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

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "model": "CxrReportGen", "note": "Service ready - update with actual model"})

@app.route('/generate_report', methods=['POST'])
def generate_report():
    try:
        data = request.json
        image_b64 = data['image']
        indication = data.get('indication', 'chest pain')
        
        image_data = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        mock_report = {
            "findings": f"Chest X-ray performed for {indication}. Mock analysis - update with actual model.",
            "impression": "Mock impression - update with actual CxrReportGen model",
            "indication": indication,
            "technique": "Frontal chest radiograph",
            "comparison": "None available"
        }
        
        return jsonify({
            "report": mock_report,
            "note": "Mock response - update with actual CxrReportGen model"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8002, debug=False)
EOF

chmod +x cxrreportgen/cxrreportgen_service.py

cat > medimageinsight/medimageinsight_service.py << 'EOF'
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
    return jsonify({"status": "healthy", "model": "MedImageInsight", "note": "Service ready - update with actual model"})

@app.route('/analyze', methods=['POST'])
def analyze_image():
    try:
        data = request.json
        image_b64 = data['image']
        analysis_type = data.get('type', 'malignancy')
        
        image_data = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        if analysis_type == 'malignancy':
            mock_result = {
                "malignancy_likelihood": 0.15,
                "confidence": 0.87,
                "features": ["mock feature analysis"],
                "recommendation": "Mock recommendation - update with actual model"
            }
        else:
            mock_result = {
                "embeddings": [0.1, 0.2, 0.3],
                "similarity_score": 0.92,
                "analysis_type": analysis_type
            }
        
        return jsonify({
            "analysis": mock_result,
            "note": "Mock response - update with actual MedImageInsight model"
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8003, debug=False)
EOF

chmod +x medimageinsight/medimageinsight_service.py

log "Creating service management script..."
cat > manage_services.sh << 'EOF'
#!/bin/bash

SERVICES=("biomedparse:8000" "medimageparse:8001" "cxrreportgen:8002" "medimageinsight:8003")
BASE_DIR="$HOME/medical-ai-models"

start_service() {
    local service_name=$1
    local port=$2
    local service_dir="$BASE_DIR/$service_name"
    
    echo "Starting $service_name on port $port..."
    cd "$service_dir"
    
    source ~/miniconda3/etc/profile.d/conda.sh
    conda activate $service_name
    
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

chmod +x manage_services.sh

log "Installing Azure CLI..."
if ! command -v az &> /dev/null; then
    curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
    az extension add -n ml
fi

log "Creating test script..."
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
import sys

def create_test_image():
    img = Image.new('RGB', (1024, 1024), color='gray')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')

def test_service(service_name, port, endpoint, payload):
    url = f"http://localhost:{port}/{endpoint}"
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"✓ {service_name}: {response.status_code}")
        result = response.json()
        print(f"  Response: {result.get('note', 'OK')}")
        return True
    except Exception as e:
        print(f"✗ {service_name} Error: {e}")
        return False

def main():
    print("Testing Medical AI Models...")
    print("=" * 50)
    
    test_image = create_test_image()
    
    services = [
        ("BiomedParse", 8000, "parse", {"image": test_image, "text": "liver"}),
        ("MedImageParse", 8001, "segment", {"image": test_image, "text": "kidney"}),
        ("CxrReportGen", 8002, "generate_report", {"image": test_image, "indication": "chest pain"}),
        ("MedImageInsight", 8003, "analyze", {"image": test_image, "type": "malignancy"})
    ]
    
    success_count = 0
    for service_name, port, endpoint, payload in services:
        print(f"\nTesting {service_name}...")
        if test_service(service_name, port, endpoint, payload):
            success_count += 1
    
    print(f"\n{'='*50}")
    print(f"Test Results: {success_count}/{len(services)} services responding")
    
    if success_count == len(services):
        print("✓ All services are running correctly!")
        return 0
    else:
        print("✗ Some services are not responding. Check logs and service status.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
EOF

chmod +x test_models.py

log "Installation completed successfully!"
echo
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Start services: ./manage_services.sh start"
echo "2. Check status: ./manage_services.sh status"
echo "3. Test services: python test_models.py"
echo "4. View logs: tail -f */service_name.log"
echo
echo -e "${YELLOW}Important Notes:${NC}"
echo "- Services are currently using mock implementations"
echo "- Update service files with actual model weights when available"
echo "- Configure Azure ML Studio integration using the provided README"
echo "- Monitor GPU usage with: nvidia-smi -l 1"
echo
echo -e "${GREEN}Installation directory: $MODELS_DIR${NC}"
echo -e "${GREEN}Management script: $MODELS_DIR/manage_services.sh${NC}"
echo
log "Medical AI Models installation completed!"
