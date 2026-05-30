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

# Configuração CORS (Garante que o Front-end consiga comunicar)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def cleanup_files(input_path: str, output_path: str):
    """Apaga os ficheiros temporários APÓS o cliente descarregar o arquivo para não encher o servidor"""
    try:
        if os.path.exists(input_path): os.remove(input_path)
        if os.path.exists(output_path): os.remove(output_path)
    except:
        pass

def get_or_create_certs():
    """Gera certificados PKI Criptográficos válidos dinamicamente"""
    cert_path = "/tmp/vsg_cert.pem"
    key_path = "/tmp/vsg_key.pem"
    
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        print("A gerar novos certificados criptográficos em tempo real...")
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
        
        with open(key_path, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ))
            
        with open(cert_path, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
            
    return cert_path, key_path

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
        # 1. Guardar o ficheiro carregado temporariamente
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # 2. Obter ou gerar certificados
        cert_path, key_path = get_or_create_certs()
        
        # 3. Inicializar o Motor C2PA nativo (sem depender de executáveis)
        signer = c2pa.Signer.from_pem(cert_path, key_path, "es256")
        
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
        
        # 5. Assinar o arquivo
        c2pa.sign_file(input_path, output_path, json.dumps(manifest_config), signer)
        
        # 6. Agendar a limpeza do servidor para libertar espaço após o envio
        background_tasks.add_task(cleanup_files, input_path, output_path)
        
        # 7. Devolver o ficheiro real assinado ao utilizador
        return FileResponse(
            path=output_path,
            media_type=file.content_type,
            filename=f"signed_{file.filename}"
        )

    except Exception as e:
        print(f"Erro Interno Capturado: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))