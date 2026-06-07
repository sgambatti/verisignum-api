import os
import json
import subprocess
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uuid

app = FastAPI(title="Verisignum Shield API - Stable")

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
    return {"status": "online", "motor": "Verisignum API (Versão Estável)"}

@app.post("/v1/shield/sign")
async def sign_file(file: UploadFile = File(...)):
    # Usa UUID para evitar que múltiplos uploads simultâneos reescrevam o mesmo ficheiro
    file_id = str(uuid.uuid4())
    input_path = os.path.join(TEMP_DIR, f"{file_id}_{file.filename}")
    output_path = os.path.join(TEMP_DIR, f"signed_{file_id}_{file.filename}")
    manifest_path = os.path.join(TEMP_DIR, f"manifest_{file_id}.json")
    
    # 1. Guardar o ficheiro recebido da interface web
    with open(input_path, "wb") as buffer:
        buffer.write(await file.read())
    
    # 2. Configuração base do manifesto (Simples e compatível com c2patool)
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
        
    # 3. Executar o c2patool com as configurações padrão (Fallback da Adobe automático)
    cmd = ["c2patool", input_path, "-m", manifest_path, "-o", output_path]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        # Se houver erro, remove os arquivos temporários antes de lançar a exceção
        if os.path.exists(input_path): os.remove(input_path)
        if os.path.exists(manifest_path): os.remove(manifest_path)
        raise HTTPException(status_code=500, detail=f"Erro ao assinar ficheiro no motor C2PA: {e.stderr}")
        
    # Limpeza dos ficheiros originais e do manifesto para libertar espaço
    if os.path.exists(input_path): os.remove(input_path)
    if os.path.exists(manifest_path): os.remove(manifest_path)
        
    # Definir media_type correto para retorno
    media_type = "image/jpeg"
    ext = file.filename.lower()
    if ext.endswith(".png"): media_type = "image/png"
    elif ext.endswith(".webp"): media_type = "image/webp"
    elif ext.endswith(".mp4"): media_type = "video/mp4"
    elif ext.endswith(".mp3"): media_type = "audio/mpeg"
        
    return FileResponse(output_path, media_type=media_type)

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

@app.post("/v1/lens/verify")
async def verify_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    VerisignumLens: Lê a assinatura C2PA de um ficheiro suspeito sem alterá-lo.
    """
    safe_ext = os.path.splitext(file.filename)[1]
    if not safe_ext: safe_ext = ".png"
    
    input_filename = f"verify_midia{safe_ext}"
    input_path = f"/tmp/{input_filename}"
    
    try:
        # 1. Guardar a evidência para análise
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
            
        # 2. Executar o c2patool em modo Leitura (sem o comando -o de saída)
        cmd = ["c2patool", input_filename]
        result = subprocess.run(cmd, cwd="/tmp", capture_output=True, text=True)
        
        has_c2pa = False
        manifest_data = None
        
        # 3. O c2patool retorna 0 e um JSON no stdout se a assinatura existir e for válida
        if result.returncode == 0 and result.stdout.strip().startswith("{"):
            try:
                manifest_data = json.loads(result.stdout)
                has_c2pa = True
            except:
                pass
                
        # 4. Agendar a limpeza da evidência
        background_tasks.add_task(cleanup_files, input_path)
        
        return {
            "has_c2pa": has_c2pa,
            "manifest": manifest_data,
            "raw_output": result.stdout if not has_c2pa else "JSON Parsed",
            "error": result.stderr
        }
        
    except Exception as e:
        background_tasks.add_task(cleanup_files, input_path)
        raise HTTPException(status_code=500, detail=f"Falha na análise: {str(e)}")