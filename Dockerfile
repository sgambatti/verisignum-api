FROM python:3.11-slim

WORKDIR /app

# Instalar dependências básicas do sistema
RUN apt-get update && apt-get install -y curl tar && rm -rf /var/lib/apt/lists/*

# Buscar e instalar a versão mais recente do c2patool dinamicamente
RUN LATEST_URL=$(curl -sL https://api.github.com/repos/contentauth/c2patool/releases/latest | grep "browser_download_url" | grep "x86_64-unknown-linux" | cut -d '"' -f 4 | head -n 1) \
    && echo "Baixando c2patool de: $LATEST_URL" \
    && curl -fL "$LATEST_URL" -o /tmp/c2patool.tar.gz \
    && tar -xzf /tmp/c2patool.tar.gz -C /tmp \
    && find /tmp -type f -name "c2patool" -exec mv {} /usr/local/bin/ \; \
    && chmod +x /usr/local/bin/c2patool \
    && rm -rf /tmp/c2patool*

# Copiar o arquivo de dependências e instalar
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar o restante do código da API
COPY api_verisignum.py .

# Expor a porta que o Render vai usar
EXPOSE 8000

# Iniciar a API
CMD ["uvicorn", "api_verisignum:app", "--host", "0.0.0.0", "--port", "8000"]
