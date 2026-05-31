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
from cryptography.hazmat.backends import default_backend

app = FastAPI(title="Verisignum Shield API")

# Configuração CORS para permitir a comunicação com o front-end
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def cleanup_files(input_path: str, output_path: str):
    """Apaga os ficheiros temporários de média após o envio"""
    try:
        if os.path.exists(input_path): os.remove(input_path)
        if os.path.exists(output_path): os.remove(output_path)
    except:
        pass

def get_or_create_certs():
    """Tenta usar as chaves do render.yaml; se falhar, gera na memória RAM"""
    render_cert = os.getenv("VERISIGNUM_CERT_PATH", "/etc/secrets/cert.pem")
    render_key = os.getenv("VERISIGNUM_KEY_PATH", "/etc/secrets/key.pem")
    
    # Se você configurou os Secret Files no Render, ele usa as suas chaves!
    if os.path.exists(render_cert) and os.path.exists(render_key):
        print("INFO: Utilizando certificados oficiais dos Secret Files do Render.")
        with open(render_cert, "rb") as f:
            cert_pem = f.read()
        with open(render_key, "rb") as f:
            key_pem = f.read()
        
        # Carrega a chave privada para um objeto de criptografia do Python
        private_key = serialization.load_pem_private_key(
            key_pem, password=None, backend=default_backend()
        )
        return cert_pem, private_key

    # Caso contrário, não trava! Gera chaves seguras temporárias na RAM
    print("INFO: Secrets não encontrados. Gerando certificados criptográficos na RAM...")
    private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
    
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
    ).sign(private_key, hashes.SHA256(), default_backend())
    
    cert_pem = cert.public_bytes(serialization.Encoding.PEM)
    return cert_pem, private_key

@app.get("/")
def read_root():
    return {"status": "online", "message": "API Verisignum Nativa Python operacional."}

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
        # 1. Guardar a média localmente
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # 2. Obter os certificados (dos Segredos do Render ou da RAM)
        cert_pem_bytes, private_key = get_or_create_certs()
        
        # 3. A SOLUÇÃO: Criar o "Callback" que o C2PA exige
        # O C2PA pede uma função que execute a assinatura, e não o texto da chave.
        def sign_callback(data: bytes) -> bytes:
            return private_key.sign(data, ec.ECDSA(hashes.SHA256()))
        
        # 4. Inicializar o Signer com os 3 argumentos: Callback, Algoritmo e Certificado
        signer = c2pa.create_signer(sign_callback, "es256", cert_pem_bytes)
        
        # 5. Construir o Manifesto C2PA
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
        
        # 6. Assinar fisicamente a imagem
        manifest_bytes = json.dumps(manifest_config).encode('utf-8')
        c2pa.sign_file(input_path, output_path, manifest_bytes, signer)
        
        # 7. Limpeza agendada do ficheiro original
        background_tasks.add_task(cleanup_files, input_path, output_path)
        
        # 8. Devolver ficheiro assinado com sucesso!
        return FileResponse(
            path=output_path,
            media_type=file.content_type,
            filename=f"signed_{file.filename}"
        )

    except Exception as e:
        import traceback
        traceback.print_exc() # Isso envia o erro completo para os Logs do Render
        raise HTTPException(status_code=500, detail=str(e))