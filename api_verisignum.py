import os
import json
import subprocess
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

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
    """
    A SOLUÇÃO DEFINITIVA: Abandona o Python para gerar chaves.
    Usa o OpenSSL nativo do Linux (Render) para gerar um certificado 
    matematicamente perfeito e impossível de ser rejeitado pelo c2patool.
    """
    cert_path = "/tmp/vsg_cert.pem"
    key_path = "/tmp/vsg_key.pem"
    
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        # 1. Gera chave privada de Curva Elíptica (P-256) compatível com es256
        subprocess.run(
            "openssl ecparam -name prime256v1 -genkey -noout -out /tmp/vsg_key.pem", 
            shell=True, check=True
        )
        
        # 2. Gera certificado X.509 Padrão do Sistema
        subprocess.run(
            'openssl req -new -x509 -key /tmp/vsg_key.pem -out /tmp/vsg_cert.pem -days 365 -subj "/C=BR/O=Verisignum/CN=Verisignum Shield"', 
            shell=True, check=True
        )
            
    return cert_path, key_path

@app.get("/")
def read_root():
    return {"status": "online", "message": "API Verisignum (Motor Docker CLI com OpenSSL) operacional."}

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
        
        # 2. Gerar chaves usando o Linux (sem erros de Python)
        cert_path, key_path = get_certs()
        
        # 3. O manifesto aponta para as chaves reais
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
            
        # 4. Assina o ficheiro
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