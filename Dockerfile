FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install minimal system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from python-services directory
COPY python-services/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code from python-services directory
COPY python-services/docling_service.py .
COPY python-services/start.sh .

# Make start script executable
RUN chmod +x start.sh

# Create non-root user for security
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser /app
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8080/health')"

# Set environment variables for memory optimization
ENV PORT=8080 WEB_CONCURRENCY=1

# Start the Docling service using the shell script
CMD ["./start.sh"]
