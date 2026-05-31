import os
import json
import subprocess
from datetime import datetime, timedelta
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.x509.oid import NameOID
from cryptography import x509
from cryptography.hazmat.backends import default_backend

app = FastAPI(title="Verisignum Shield API")

# Configuração CORS para permitir a comunicação com o front-end
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def cleanup_files(*paths):
    """Apaga os ficheiros temporários para não sobrecarregar o servidor"""
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
        except:
            pass

def get_or_create_certs():
    """Gera certificados compatíveis com o padrão COSE da Adobe"""
    cert_path = "/tmp/vsg_cert.pem"
    key_path = "/tmp/vsg_key.pem"
    
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
        
        # Nome do sujeito (obrigatório para o parser COSE)
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, u"BR"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"Verisignum"),
            x509.NameAttribute(NameOID.COMMON_NAME, u"Verisignum Shield"),
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
            datetime.utcnow() - timedelta(minutes=1) # Margem de erro de clock
        ).not_valid_after(
            datetime.utcnow() + timedelta(days=365)
        ).add_extension(
            x509.BasicConstraints(ca=False, path_length=None), critical=True,
        ).sign(private_key, hashes.SHA256(), default_backend())
        
        # Escrever chave privada (Traditional OpenSSL)
        with open(key_path, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ))
            
        # Escrever certificado (PEM puro)
        with open(cert_path, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
            
    return cert_path, key_path

@app.get("/")
def read_root():
    return {"status": "online", "message": "API Verisignum (Motor Docker CLI) operacional."}

@app.post("/v1/shield/sign")
async def sign_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    author: str = Form("Verisignum Admin"),
    organization: str = Form("Verisignum AI")
):
    input_path = os.path.join("/tmp", file.filename)
    output_path = os.path.join("/tmp", f"signed_{file.filename}")
    manifest_path = os.path.join("/tmp", f"manifest_{file.filename}.json")
    
    try:
        # 1. Guardar a média localmente
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # 2. Obter os certificados
        cert_path, key_path = get_or_create_certs()
        
        # 3. Construir o Manifesto exato que o Motor C2PA da Adobe exige
        manifest_config = {
            "claim_generator": "Verisignum_Shield/3.0",
            "private_key": key_path,
            "sign_cert": cert_path,
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
        
        with open(manifest_path, "w") as f:
            json.dump(manifest_config, f)
            
        # 4. A MÁGICA: Executa o motor oficial CLI em vez da biblioteca Python instável
        cmd = ["c2patool", input_path, "-o", output_path, "-m", manifest_path, "-f"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception(f"Erro no Motor C2PA: {result.stderr}")
        
        # 5. Agendar limpeza e devolver ficheiro
        background_tasks.add_task(cleanup_files, input_path, output_path, manifest_path)
        
        return FileResponse(
            path=output_path,
            media_type=file.content_type,
            filename=f"signed_{file.filename}"
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        background_tasks.add_task(cleanup_files, input_path, manifest_path)
        raise HTTPException(status_code=500, detail=str(e))