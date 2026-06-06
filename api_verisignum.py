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
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
        except:
            pass

def get_certificates():
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
        print("DEBUG: Utilizando chaves locais.")
        shutil.copy("certs/verisignum_cert.pem", cert_path_tmp)
        shutil.copy("certs/verisignum_key.pem", key_path_tmp)
        return "vsg_cert.pem", "vsg_key.pem"
    
    # 3. FALLBACK: Chaves de Teste da Adobe
    print("DEBUG: Chaves não encontradas. Ativando Fallback da Adobe.")
    cert_url = "https://raw.githubusercontent.com/contentauth/c2patool/main/sample/es256_certs.pem"
    key_url = "https://raw.githubusercontent.com/contentauth/c2patool/main/sample/es256_private.key"
    
    try:
        req = urllib.request.Request(cert_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(cert_path_tmp, 'wb') as f:
            f.write(response.read())
            
        req = urllib.request.Request(key_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(key_path_tmp, 'wb') as f:
            f.write(response.read())
    except Exception as e:
        raise Exception(f"Falha ao gerir certificados: {e}")
        
    return "vsg_cert.pem", "vsg_key.pem"

@app.get("/")
def read_root():
    """Endpoint de Diagnóstico para validar se o Render injetou as chaves corretamente"""
    cert_root = os.path.exists("verisignum_cert.pem")
    key_root = os.path.exists("verisignum_key.pem")
    
    estado = "FALLBACK ATIVO (Usando chaves da Adobe Test)"
    if cert_root and key_root:
        estado = "SUCESSO (Chaves Verisignum Injetadas pelo Render!)"
        
    return {
        "status": "online", 
        "motor": "V5.1 - Diagnosis Mode",
        "estado_das_chaves": estado,
        "diagnostico_ficheiros": {
            "verisignum_cert.pem_encontrado": cert_root,
            "verisignum_key.pem_encontrado": key_root
        }
    }

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
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
        cert_name, key_name = get_certificates()
        
        # O OpenSSL cria chaves RSA padrão. O C2PA exige rs256 ou ps256 para elas.
        usando_chaves_reais = os.path.exists("verisignum_key.pem") or os.path.exists("certs/verisignum_key.pem")
        
        manifest_config = {
            "alg": "rs256" if usando_chaves_reais else "es256", 
            "claim_generator": "Verisignum_Shield/5.1",
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

        with open(manifest_path, "w") as f:
            json.dump(manifest_config, f)
            
        cmd = ["c2patool", input_filename, "-m", manifest_filename, "-o", output_filename, "-f"]
        result = subprocess.run(cmd, cwd="/tmp", capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception(f"Erro no Motor C2PA: {result.stderr}")
            
        background_tasks.add_task(cleanup_files, input_path, output_path, manifest_path)
        
        return FileResponse(path=output_path, media_type=file.content_type, filename=f"signed_{file.filename}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        background_tasks.add_task(cleanup_files, input_path, manifest_path)
        raise HTTPException(status_code=500, detail=str(e))