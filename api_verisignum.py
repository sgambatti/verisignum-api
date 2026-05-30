from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import json
import os
import shutil
import urllib.request
import tarfile
import stat

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_c2patool():
    """Faz o download e extração dinâmica do c2patool caso não exista no sistema (ex: Render nativo)"""
    bin_path = "/tmp/c2patool"
    if os.path.exists(bin_path):
        return bin_path
        
    system_path = shutil.which("c2patool")
    if system_path:
        return system_path
        
    print("A descarregar o c2patool dinamicamente no Render...")
    url = "https://github.com/contentauth/c2patool/releases/download/v0.31.0/c2patool-v0.31.0-x86_64-unknown-linux-gnu.tar.gz"
    tar_path = "/tmp/c2patool.tar.gz"
    
    try:
        urllib.request.urlretrieve(url, tar_path)
        with tarfile.open(tar_path, "r:gz") as tar:
            for member in tar.getmembers():
                # Encontrar o binário independentemente da estrutura de pastas do zip
                if member.name.endswith("c2patool") and not member.isdir():
                    member.name = "c2patool" 
                    tar.extract(member, path="/tmp")
                    break
                    
        if os.path.exists(bin_path):
            st = os.stat(bin_path)
            os.chmod(bin_path, st.st_mode | stat.S_IEXEC)
            
        return bin_path
    except Exception as e:
        print(f"Falha ao instalar o c2patool: {str(e)}")
        return None

@app.get("/")
def read_root():
    return {"status": "online", "message": "API Verisignum operacional."}

@app.post("/v1/shield/sign")
async def sign_file(file: UploadFile = File(...)):
    # Caminhos temporários seguros no Render (/tmp)
    input_path = os.path.join("/tmp", file.filename)
    output_path = os.path.join("/tmp", f"signed_{file.filename}")
    manifest_path = "/tmp/manifest.json"
    
    # Garante que o c2patool está instalado
    c2pa_bin = get_c2patool()
    if not c2pa_bin or not os.path.exists(c2pa_bin):
        raise HTTPException(status_code=500, detail="c2patool não encontrado. Verifique a instalação.")

    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        manifest_config = {
            "claim_generator": "Verisignum_Shield_v1",
            "assertions": [{
                "label": "stds.schema-org.CreativeWork",
                "data": {
                    "@context": "https://schema.org",
                    "@type": "CreativeWork",
                    "author": [{"name": "Verisignum"}]
                }
            }]
        }
        
        with open(manifest_path, "w") as f:
            json.dump(manifest_config, f)
            
        cmd = [c2pa_bin, input_path, "-o", output_path, "-m", manifest_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Erro CLI: {result.stderr}")
            
        return {"message": "Ficheiro assinado com sucesso", "filename": f"signed_{file.filename}"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(input_path): os.remove(input_path)
        if os.path.exists(manifest_path): os.remove(manifest_path)
