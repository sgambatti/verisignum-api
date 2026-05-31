import os
import json
from datetime import datetime, timedelta
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import c2pa
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.x509.oid import NameOID
from cryptography import x509

app = FastAPI(title="Verisignum Shield API")

# Configuração CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def cleanup_files(input_path: str, output_path: str):
    """Apaga os ficheiros temporários de mídia"""
    try:
        if os.path.exists(input_path): os.remove(input_path)
        if os.path.exists(output_path): os.remove(output_path)
    except:
        pass

def get_certs_in_memory():
    """Gera certificados PKI válidos diretamente na Memória (RAM)"""
    private_key = ec.generate_private_key(ec.SECP256R1())
    
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"Verisignum Trust Network"),
        x509.NameAttribute(NameOID.COMMON_NAME, u"Verisignum Shield Node"),
    ])
    
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        private_key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.utcnow()
    ).not_valid_after(
        datetime.utcnow() + timedelta(days=365)
    ).sign(private_key, hashes.SHA256())
    
    # Extrai as chaves em formato texto seguro
    key_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode('utf-8')
        
    return cert_pem, key_pem

@app.get("/")
def read_root():
    return {"status": "online", "message": "API Verisignum 100% Nativa Python operacional."}

@app.post("/v1/shield/sign")
async def sign_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    author: str = Form("Verisignum Admin"),
    organization: str = Form("Verisignum AI")
):
    input_path = os.path.join("/tmp", file.filename)
    output_path = os.path.join("/tmp", f"signed_{file.filename}")
    
    try:
        # 1. Guardar a mídia localmente (obrigatório para manipulação)
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # 2. Obter os certificados da memória
        cert_pem, key_pem = get_certs_in_memory()
        
        # 3. Configurar o Signer usando a nova API do c2pa-python
        sign_config = {
            "alg": "es256",
            "sign_cert": cert_pem,
            "private_key": key_pem
        }
        
        # Cria a instância do signer convertendo o config para bytes JSON
        signer = c2pa.create_signer(json.dumps(sign_config).encode('utf-8'))
        
        # 4. Construir o Manifesto C2PA
        manifest_config = {
            "claim_generator": "Verisignum_Shield/3.0",
            "assertions": [
                {
                    "label": "stds.schema-org.CreativeWork",
                    "data": {
                        "@context": "http://schema.org/",
                        "@type": "CreativeWork",
                        "author": [{"@type": "Person", "name": author}],
                        "publisher": [{"@type": "Organization", "name": organization}]
                    }
                }
            ]
        }
        
        # O c2pa-python exige que o manifesto seja passado como bytes
        manifest_bytes = json.dumps(manifest_config).encode('utf-8')
        
        # 5. Assinar fisicamente a imagem/vídeo
        c2pa.sign_file(input_path, output_path, manifest_bytes, signer)
        
        # 6. Limpeza agendada do ficheiro original
        background_tasks.add_task(cleanup_files, input_path, output_path)
        
        # 7. Devolver ficheiro assinado com sucesso!
        return FileResponse(
            path=output_path,
            media_type=file.content_type,
            filename=f"signed_{file.filename}"
        )

    except Exception as e:
        print(f"Erro Interno Capturado: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))