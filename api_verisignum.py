import os
import json
import subprocess
import urllib.request
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil

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

def get_certificates():
    """
    Motor Inteligente de Certificados:
    1. Tenta usar as chaves secretas injetadas na raiz pelo Render.
    2. Tenta usar as chaves locais na pasta certs/ (para dev local).
    3. Se não existirem, faz fallback seguro para as chaves de teste da Adobe.
    """
    cert_path_tmp = "/tmp/vsg_cert.pem"
    key_path_tmp = "/tmp/vsg_key.pem"

    # 1. Procura na raiz (Ficheiros Secretos do Render)
    if os.path.exists("verisignum_cert.pem") and os.path.exists("verisignum_key.pem"):
        print("DEBUG: Utilizando chaves reais injetadas pelo Render.")
        shutil.copy("verisignum_cert.pem", cert_path_tmp)
        shutil.copy("verisignum_key.pem", key_path_tmp)
        return "vsg_cert.pem", "vsg_key.pem"

    # 2. Procura na pasta local (Para testes no seu computador)
    if os.path.exists("certs/verisignum_cert.pem") and os.path.exists("certs/verisignum_key.pem"):
        print("DEBUG: Utilizando chaves locais da Verisignum da pasta 'certs/'.")
        shutil.copy("certs/verisignum_cert.pem", cert_path_tmp)
        shutil.copy("certs/verisignum_key.pem", key_path_tmp)
        return "vsg_cert.pem", "vsg_key.pem"
    
    # 3. FALLBACK: Baixa os certificados de teste da Adobe
    print("DEBUG: Chaves locais não encontradas. Baixando chaves de teste da Adobe.")
    cert_url = "https://raw.githubusercontent.com/contentauth/c2patool/main/sample/es256_certs.pem"
    key_url = "https://raw.githubusercontent.com/contentauth/c2patool/main/sample/es256_private.key"
    
    try:
        if not os.path.exists(cert_path_tmp) or os.path.getsize(cert_path_tmp) == 0:
            req = urllib.request.Request(cert_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(cert_path_tmp, 'wb') as f:
                f.write(response.read())
                
        if not os.path.exists(key_path_tmp) or os.path.getsize(key_path_tmp) == 0:
            req = urllib.request.Request(key_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(key_path_tmp, 'wb') as f:
                f.write(response.read())
    except Exception as e:
        raise Exception(f"Falha ao gerir certificados de assinatura: {e}")
        
    return "vsg_cert.pem", "vsg_key.pem"

@app.get("/")
def read_root():
    return {"status": "online", "message": "API Verisignum (Motor de Certificados V5) operacional."}

@app.post("/v1/shield/sign")
async def sign_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    author: str = Form("Verisignum Admin"),
    organization: str = Form("Verisignum AI")
):
    safe_ext = os.path.splitext(file.filename)[1]
    if not safe_ext: safe_ext = ".png"
    
    input_filename = f"upload_midia{safe_ext}"
    output_filename = f"signed_midia{safe_ext}"
    manifest_filename = "manifest_midia.json"
    
    input_path = f"/tmp/{input_filename}"
    output_path = f"/tmp/{output_filename}"
    manifest_path = f"/tmp/{manifest_filename}"
    
    try:
        # 1. Salvar o arquivo
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # 2. Obter as chaves corretas
        cert_name, key_name = get_certificates()
        
        # 3. Manifesto Dinâmico
        manifest_config = {
            "alg": "es256" if "Adobe" in cert_name else "rs256", 
            "claim_generator": "Verisignum_Shield/5.0",
            "private_key": key_name,
            "sign_cert": cert_name,
            "ta_url": "http://timestamp.digicert.com",
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
        
        # Define algoritmo RS256 se estiver a usar as chaves reais da Verisignum
        usando_chaves_reais = os.path.exists("verisignum_key.pem") or os.path.exists("certs/verisignum_key.pem")
        manifest_config["alg"] = "rs256" if usando_chaves_reais else "es256"

        with open(manifest_path, "w") as f:
            json.dump(manifest_config, f)
            
        # 4. Injetar a Criptografia
        cmd = [
            "c2patool", input_filename, 
            "-m", manifest_filename, 
            "-o", output_filename, 
            "-f"
        ]
        
        result = subprocess.run(cmd, cwd="/tmp", capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception(f"Erro no Motor C2PA: {result.stderr}")
            
        if not os.path.exists(output_path):
            raise Exception("Erro desconhecido: C2PA falhou em gerar a saída.")
        
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