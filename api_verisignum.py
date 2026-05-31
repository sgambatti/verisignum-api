import os
import json
import subprocess
import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization, hashes
from cryptography import x509
from cryptography.x509.oid import NameOID

app = FastAPI(title="Verisignum Shield API")

# Configuração CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def cleanup_files(*paths):
    """Limpeza do servidor após o processamento"""
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
        except:
            pass

def get_certs():
    """
    Geração cirúrgica da Âncora de Confiança C2PA.
    Aplica Formato PKCS#8, SubjectKeyIdentifier e DigitalSignature KeyUsage.
    Isso satisfaz 100% das exigências do parser COSE em Rust.
    """
    cert_path = "/tmp/vsg_cert.pem"
    key_path = "/tmp/vsg_key.pem"
    
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        # 1. Chave Curva Elíptica (P-256) exigida pelo es256
        private_key = ec.generate_private_key(ec.SECP256R1())
        
        # 2. Definição do Sujeito
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, u"Verisignum Shield Node"),
        ])
        
        # 3. Construção rigorosa do Certificado X.509 v3
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.datetime.utcnow() - datetime.timedelta(days=1)
        ).not_valid_after(
            datetime.datetime.utcnow() + datetime.timedelta(days=365)
        ).add_extension(
            x509.SubjectKeyIdentifier.from_public_key(private_key.public_key()),
            critical=False
        ).add_extension(
            x509.KeyUsage(
                digital_signature=True, content_commitment=False, key_encipherment=False,
                data_encipherment=False, key_agreement=False, key_cert_sign=False,
                crl_sign=False, encipher_only=False, decipher_only=False
            ),
            critical=True
        ).sign(private_key, hashes.SHA256())
        
        # O PULO DO GATO: Exportar a chave privada estritamente em PKCS8
        with open(key_path, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8, # <- Esta é a solução do erro COSE
                encryption_algorithm=serialization.NoEncryption()
            ))
            
        with open(cert_path, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
            
    return cert_path, key_path

@app.get("/")
def read_root():
    return {"status": "online", "message": "API Verisignum (Motor Docker CLI - PKCS8) operacional."}

@app.post("/v1/shield/sign")
async def sign_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    author: str = Form("Verisignum Admin"),
    organization: str = Form("Verisignum AI")
):
    input_path = f"/tmp/{file.filename}"
    output_path = f"/tmp/signed_{file.filename}"
    manifest_path = f"/tmp/manifest_{file.filename}.json"
    
    try:
        # 1. Salvar o arquivo
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # 2. Gerar chaves invioláveis
        cert_path, key_path = get_certs()
        
        # 3. O manifesto usa caminhos absolutos
        manifest_config = {
            "alg": "es256",
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
            
        # 4. Assina o ficheiro (sem cwd="tmp", usando os caminhos absolutos)
        cmd = ["c2patool", input_path, "-o", output_path, "-m", manifest_path, "-f"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"DEBUG STDOUT: {result.stdout}")
            print(f"DEBUG STDERR: {result.stderr}")
            raise Exception(f"Motor C2PA falhou: {result.stderr}")
            
        if not os.path.exists(output_path):
            raise Exception("Erro desconhecido: O c2patool rodou mas não gerou a saída.")
        
        # 5. Agendar limpeza e enviar resposta
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