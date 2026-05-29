FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for py3exiv2 and pykcs11
RUN apt-get update && apt-get install -y \
    build-essential \
    libexiv2-dev \
    libboost-python-dev \
    libpcsclite-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

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
