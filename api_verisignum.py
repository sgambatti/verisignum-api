import os
import json
import subprocess
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uuid

app = FastAPI(title="Verisignum Shield API - Stable + Lens")

# Configuração CORS essencial para o Frontend comunicar com o Render
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Diretório temporário seguro para processamento de ficheiros
TEMP_DIR = "/tmp/verisignum"
os.makedirs(TEMP_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"status": "online", "motor": "Verisignum API (Estável + Lens)"}

# -------------------------------------------------------------------
# ROTA 1: SHIELD (ASSINATURA C2PA)
# -------------------------------------------------------------------
@app.post("/v1/shield/sign")
async def sign_file(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    input_path = os.path.join(TEMP_DIR, f"{file_id}_{file.filename}")
    output_path = os.path.join(TEMP_DIR, f"signed_{file_id}_{file.filename}")
    manifest_path = os.path.join(TEMP_DIR, f"manifest_{file_id}.json")
    
    with open(input_path, "wb") as buffer:
        buffer.write(await file.read())
    
    manifest = {
        "claim_generator": "Verisignum_Shield",
        "assertions": [
            {
                "label": "stds.schema-org.CreativeWork",
                "data": {"@type": "CreativeWork"}
            }
        ]
    }
    
    with open(manifest_path, "w") as f:
        json.dump(manifest, f)
        
    cmd = ["c2patool", input_path, "-m", manifest_path, "-o", output_path]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        if os.path.exists(input_path): os.remove(input_path)
        if os.path.exists(manifest_path): os.remove(manifest_path)
        raise HTTPException(status_code=500, detail=f"Erro ao assinar ficheiro: {e.stderr}")
        
    if os.path.exists(input_path): os.remove(input_path)
    if os.path.exists(manifest_path): os.remove(manifest_path)
        
    media_type = "image/jpeg"
    ext = file.filename.lower()
    if ext.endswith(".png"): media_type = "image/png"
    elif ext.endswith(".webp"): media_type = "image/webp"
    elif ext.endswith(".mp4"): media_type = "video/mp4"
    elif ext.endswith(".mp3"): media_type = "audio/mpeg"
        
    return FileResponse(output_path, media_type=media_type)

# -------------------------------------------------------------------
# ROTA 2: LENS (LEITURA E VERIFICAÇÃO C2PA)
# -------------------------------------------------------------------
@app.post("/v1/lens/verify")
async def verify_file(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    input_path = os.path.join(TEMP_DIR, f"verify_{file_id}_{file.filename}")
    
    with open(input_path, "wb") as buffer:
        buffer.write(await file.read())
        
    # Quando chamamos o c2patool sem o "-o", ele apenas lê a imagem e devolve o JSON dos metadados
    cmd = ["c2patool", input_path]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Se o returncode for 0 e houver output, significa que encontrou uma assinatura válida
        has_c2pa = result.returncode == 0 and result.stdout.strip() != ""
        
        manifest_data = {}
        if has_c2pa:
            try:
                manifest_data = json.loads(result.stdout)
            except:
                pass
                
        if os.path.exists(input_path): os.remove(input_path)
        
        return {
            "has_c2pa": has_c2pa,
            "manifest": manifest_data,
            "raw_output": result.stdout if has_c2pa else result.stderr
        }
    except Exception as e:
        if os.path.exists(input_path): os.remove(input_path)
        raise HTTPException(status_code=500, detail=f"Erro na verificação forense: {str(e)}")