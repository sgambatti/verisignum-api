import os
import json
import subprocess
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil

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

def generate_compliant_cert():
    """Gera certificados com as extensões obrigatórias via OpenSSL nativo."""
    cert_path = "/tmp/vsg_cert.pem"
    key_path = "/tmp/vsg_key.pem"
    cnf_path = "/tmp/vsg.cnf"

    if not os.path.exists(cert_path):
        # Criar config para OpenSSL injetar as extensões obrigatórias de integridade
        with open(cnf_path, "w") as f:
            f.write("[req]\ndistinguished_name = dn\n[dn]\n[v3_req]\nbasicConstraints = CA:FALSE\nkeyUsage = digitalSignature\nsubjectKeyIdentifier = hash\nauthorityKeyIdentifier = keyid,issuer")
        
        # Gerar chave e certificado
        subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-keyout", key_path, "-out", cert_path, "-days", "365", "-nodes", "-config", cnf_path, "-extensions", "v3_req", "-subj", "/CN=Verisignum"], check=True)
    
    return cert_path, key_path

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
            shutil.copyfileobj(file.file, buffer)
        
        cert_path, key_path = generate_compliant_cert()
        
        manifest_config = {
            "claim_generator": "Verisignum_Shield/3.0",
            "private_key": key_path,
            "sign_cert": cert_path,
            "assertions": [{
                "label": "stds.schema-org.CreativeWork",
                "data": {
                    "@context": "http://schema.org/",
                    "@type": "CreativeWork",
                    "author": [{"@type": "Person", "name": author}],
                    "publisher": [{"@type": "Organization", "name": organization}]
                }
            }]
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
        raise HTTPException(status_code=500, detail=str(e))
```