FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install c2pa CLI from pre-built binary (latest stable release)
# Fazer o download, extrair e listar o que foi extraído para debug
RUN mkdir -p /tmp/c2pa && \
    curl -L https://github.com/contentauth/c2pa-rs/releases/download/c2patool-v0.26.59/c2patool-v0.26.59-x86_64-unknown-linux-gnu.tar.gz \
    -o /tmp/c2pa.tar.gz && \
    tar -tzf /tmp/c2pa.tar.gz && \
    tar xzf /tmp/c2pa.tar.gz -C /tmp/c2pa && \
    ls -la /tmp/c2pa/ && \
    find /tmp/c2pa -type f -executable && \
    cp /tmp/c2pa/c2patool /usr/local/bin/ && \
    chmod +x /usr/local/bin/c2patool && \
    c2patool --version && \
    rm -rf /tmp/c2pa /tmp/c2pa.tar.gz

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
