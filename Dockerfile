FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install c2pa CLI from pre-built binary
RUN curl -L https://github.com/contentauthenticity/c2pa-rs/releases/download/c2pa-0.32.0/c2pa-linux-x86_64.tar.gz | tar xz -C /usr/local/bin/

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY api_verisignum.py .
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "api_verisignum:app", "--host", "0.0.0.0", "--port", "8000"]
