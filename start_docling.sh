#!/bin/bash
# Start Local Docling Service for Blii

echo "🚀 Starting Local Docling Service for Blii..."

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

# Verify we're in the virtual environment
echo "🔍 Checking virtual environment..."
which python
which pip

# Install requirements using the virtual environment's pip
echo "📦 Installing requirements..."
pip install -r requirements.txt

# Start the service
echo "🔄 Starting Docling service on port 8080..."
python docling_service.py

echo "✅ Docling service started successfully!"
echo "📍 Service running at: http://localhost:8080"
echo "🩺 Health check: http://localhost:8080/health"
