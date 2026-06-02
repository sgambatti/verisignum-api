import os
import json
import subprocess
import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization, hashes
from cryptography import x509
from cryptography.x509.oid import NameOID

app = FastAPI(title="Verisignum Shield API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def cleanup_files(*paths):
    for path in paths:
        try:
            if os.path.exists(path): os.remove(path)
        except: pass

def get_certs():
    cert_path = "/tmp/vsg_cert.pem"
    key_path = "/tmp/vsg_key.pem"
    
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = issuer = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, u"Verisignum Shield Node")])
        
        cert = x509.CertificateBuilder().subject_name(subject).issuer_name(issuer).public_key(
            private_key.public_key()
        ).serial_number(x509.random_serial_number()).not_valid_before(
            datetime.datetime.utcnow() - datetime.timedelta(days=1)
        ).not_valid_after(
            datetime.datetime.utcnow() + datetime.timedelta(days=365)
        ).add_extension(
            x509.SubjectKeyIdentifier.from_public_key(private_key.public_key()), critical=False
        ).add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(private_key.public_key()), critical=False
        ).add_extension(
            x509.KeyUsage(
                digital_signature=True, content_commitment=False, key_encipherment=False,
                data_encipherment=False, key_agreement=False, key_cert_sign=False,
                crl_sign=False, encipher_only=False, decipher_only=False
            ), critical=True
        ).add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True).sign(private_key, hashes.SHA256())
        
        with open(key_path, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM, format=serialization.PrivateFormat.PKCS8, encryption_algorithm=serialization.NoEncryption()
            ))
        with open(cert_path, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
            
    return cert_path, key_path

@app.get("/")
def read_root():
    return {"status": "online", "message": "API Verisignum (Motor Docker CLI - RSA/ps256) operacional."}

# ==========================================
# NOVO ENDPOINT: VERIFICADOR FORENSE (LENS)
# ==========================================
@app.post("/v1/lens/verify")
async def verify_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Lê uma imagem e verifica se possui assinatura C2PA real embutida."""
    input_path = f"/tmp/verify_{file.filename}"
    
    try:
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
            
        # Executa a ferramenta C2PA no modo "Leitura" (sem a flag -o ou -m)
        cmd = ["c2patool", input_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        background_tasks.add_task(cleanup_files, input_path)
        
        if result.returncode == 0 and result.stdout.strip() != "{}":
            # Conseguiu ler um manifesto JSON válido de dentro da imagem!
            manifest_data = json.loads(result.stdout)
            return {
                "status": "verified", 
                "has_c2pa": True, 
                "manifest": manifest_data
            }
        else:
            # Não tem assinatura ou a assinatura foi quebrada
            return {
                "status": "unverified", 
                "has_c2pa": False, 
                "error": "Nenhuma assinatura C2PA autêntica encontrada no arquivo."
            }

    except Exception as e:
        background_tasks.add_task(cleanup_files, input_path)
        raise HTTPException(status_code=500, detail=str(e))

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
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
        cert_path, key_path = get_certs()
        
        manifest_config = {
            "alg": "ps256",
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
            
        cmd = ["c2patool", input_path, "-m", manifest_path, "-o", output_path, "-f"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception(f"Motor C2PA falhou: {result.stderr}")
            
        background_tasks.add_task(cleanup_files, input_path, output_path, manifest_path)
        
        return FileResponse(path=output_path, media_type=file.content_type, filename=f"signed_{file.filename}")

    except Exception as e:
        background_tasks.add_task(cleanup_files, input_path, manifest_path)
        raise HTTPException(status_code=500, detail=str(e))