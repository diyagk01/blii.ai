#!/bin/bash
# Start Local Docling Service

echo "🚀 Starting Local Docling Service..."

# Navigate to python-services directory
cd python-services

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install requirements if needed
echo "📦 Checking requirements..."
pip install -r requirements.txt

# Start the service
echo "🔄 Starting Docling service on port 8080..."
python3 docling_service.py

echo "✅ Docling service started successfully!"
echo "📍 Service running at: http://localhost:8080"
echo "🩺 Health check: http://localhost:8080/health"
