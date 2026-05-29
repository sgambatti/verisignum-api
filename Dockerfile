FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for py3exiv2
RUN apt-get update && apt-get install -y \
    libexiv2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY . .

# Expose port (adjust if needed)
EXPOSE 8000

# Run the application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
