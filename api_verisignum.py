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

    # Radar de Busca: Lista de todos os locais onde o Render/Windows pode guardar as chaves
    locais_de_busca = [
        ("", ""),                                                 # Raiz padrão
        ("/etc/secrets/", "/etc/secrets/"),                       # Pasta secreta do Render (Linux)
        ("/opt/render/project/src/", "/opt/render/project/src/"), # Caminho absoluto do Render
        ("certs/", "certs/")                                      # Pasta de teste local no seu PC
    ]

    for cert_dir, key_dir in locais_de_busca:
        cert_file = os.path.join(cert_dir, "verisignum_cert.pem")
        key_file = os.path.join(key_dir, "verisignum_key.pem")
        
        if os.path.exists(cert_file) and os.path.exists(key_file):
            print(f"DEBUG: Chaves REAIS encontradas na pasta: '{cert_dir or 'raiz'}'")
            shutil.copy(cert_file, cert_path_tmp)
            shutil.copy(key_file, key_path_tmp)
            return "vsg_cert.pem", "vsg_key.pem"
    
    # FALLBACK: Chaves de Teste da Adobe
    print("DEBUG: Chaves não encontradas no radar. Ativando Fallback da Adobe.")
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
    """Endpoint de Diagnóstico - Mostra exatamente onde procurou e o que achou"""
    locais = ["", "/etc/secrets/", "/opt/render/project/src/", "certs/"]
    diagnostico = {}
    chaves_encontradas = False
    
    for local in locais:
        cert_ok = os.path.exists(os.path.join(local, "verisignum_cert.pem"))
        key_ok = os.path.exists(os.path.join(local, "verisignum_key.pem"))
        diagnostico[local or "raiz_do_projeto"] = {"cert": cert_ok, "key": key_ok}
        if cert_ok and key_ok:
            chaves_encontradas = True
            
    estado = "SUCESSO (Chaves Verisignum Injetadas e Ativas!)" if chaves_encontradas else "FALLBACK ATIVO (Usando chaves da Adobe Test)"
        
    return {
        "status": "online", 
        "motor": "V5.2 - Deep Scan Mode",
        "estado_das_chaves": estado,
        "raio_x_pastas": diagnostico
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
        
        # Verifica se estamos a usar as chaves reais baseadas no Radar
        locais = ["", "/etc/secrets/", "/opt/render/project/src/", "certs/"]
        usando_chaves_reais = any(os.path.exists(os.path.join(loc, "verisignum_key.pem")) for loc in locais)
        
        # Chaves autoassinadas usam RS256, Chaves da Adobe usam ES256
        manifest_config = {
            "alg": "rs256" if usando_chaves_reais else "es256", 
            "claim_generator": "Verisignum_Shield/5.2",
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