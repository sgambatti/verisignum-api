FROM python:3.11-slim

WORKDIR /app

# Install system dependencies and c2patool
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Download c2patool - versão mais recente (v0.27.x)
# Usar wget como alternativa se curl falhar
RUN curl -fL https://github.com/contentauth/c2pa-rs/releases/download/c2patool-v0.27.0/c2patool-v0.27.0-x86_64-unknown-linux-gnu.tar.gz \
    -o /tmp/c2patool.tar.gz && \
    cd /tmp && \
    tar -xzf c2patool.tar.gz && \
    ls -la /tmp/c2patool* && \
    mv /tmp/c2patool /usr/local/bin/ && \
    chmod +x /usr/local/bin/c2patool && \
    /usr/local/bin/c2patool --version && \
    rm -f /tmp/c2patool.tar.gz

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
