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

# Configuração CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def cleanup_files(*paths):
    """Remove ficheiros temporários após o processamento"""
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
        except:
            pass

def get_certs():
    """Gera um certificado self-signed 100% compatível com a exigência COSE/C2PA"""
    cert_path = "/tmp/vsg_cert.pem"
    key_path = "/tmp/vsg_key.pem"
    
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
        public_key = private_key.public_key()
        
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, u"BR"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"Verisignum"),
            x509.NameAttribute(NameOID.COMMON_NAME, u"Verisignum Shield"),
        ])
        
        # O SEGREDO: O C2PA / COSE exige estritamente o SubjectKeyIdentifier
        ski = x509.SubjectKeyIdentifier.from_public_key(public_key)
        aki = x509.AuthorityKeyIdentifier.from_issuer_public_key(public_key)
        
        cert = x509.CertificateBuilder().subject_name(subject).issuer_name(issuer).public_key(
            public_key
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.utcnow() - timedelta(days=1)
        ).not_valid_after(
            datetime.utcnow() + timedelta(days=365)
        ).add_extension(
            ski, critical=False # Exigido para o 'kid' no header COSE
        ).add_extension(
            aki, critical=False
        ).add_extension(
            x509.BasicConstraints(ca=True, path_length=None), critical=True
        ).add_extension(
            x509.KeyUsage(
                digital_signature=True, content_commitment=False, key_encipherment=False,
                data_encipherment=False, key_agreement=False, key_cert_sign=True,
                crl_sign=False, encipher_only=False, decipher_only=False
            ), critical=True
        ).sign(private_key, hashes.SHA256(), default_backend())
        
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
    return {"status": "online", "message": "API Verisignum (Motor Docker CLI) operacional."}

@app.post("/v1/shield/sign")
async def sign_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    author: str = Form("Verisignum Admin"),
    organization: str = Form("Verisignum AI")
):
    # Usaremos nomes relativos e executaremos o processo dentro do /tmp 
    # para evitar os bugs de caminhos absolutos do c2patool em Linux
    input_filename = file.filename
    output_filename = f"signed_{file.filename}"
    manifest_filename = f"manifest_{file.filename}.json"
    
    input_path = f"/tmp/{input_filename}"
    output_path = f"/tmp/{output_filename}"
    manifest_path = f"/tmp/{manifest_filename}"
    
    try:
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
        get_certs()
        
        # O manifesto AGORA define o alg e usa nomes relativos ao diretório /tmp
        manifest_config = {
            "alg": "es256",
            "claim_generator": "Verisignum_Shield/3.0",
            "private_key": "vsg_key.pem",
            "sign_cert": "vsg_cert.pem",
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
            
        # O TRUQUE DE MESTRE: cwd="/tmp" garante que o motor encontre as chaves pelo nome curto
        cmd = ["c2patool", input_filename, "-o", output_filename, "-m", manifest_filename, "-f"]
        result = subprocess.run(cmd, cwd="/tmp", capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"DEBUG STDOUT: {result.stdout}")
            print(f"DEBUG STDERR: {result.stderr}")
            raise Exception(f"Motor C2PA falhou: {result.stderr}")
            
        if not os.path.exists(output_path):
            raise Exception("O comando c2patool foi executado, mas o ficheiro não foi gerado.")
        
        background_tasks.add_task(cleanup_files, input_path, output_path, manifest_path)
        
        return FileResponse(
            path=output_path, 
            media_type=file.content_type, 
            filename=output_filename
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        background_tasks.add_task(cleanup_files, input_path, manifest_path)
        raise HTTPException(status_code=500, detail=str(e))