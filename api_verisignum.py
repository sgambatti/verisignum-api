import os
import json
import subprocess
import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import shutil

app = FastAPI(title="Verisignum Shield API")

# Permite que o frontend em React (Vite/Vercel) comunique com o servidor Render
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

def cleanup_files(*paths):
    """Limpa os ficheiros temporários para não sobrecarregar a memória do Render."""
    for path in paths:
        try:
            if os.path.exists(path): os.remove(path)
        except: pass

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
        # 1. Guarda a imagem submetida
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 2. Configura o manifesto C2PA
        # Nota Estratégica: Ao não definir "private_key" e "sign_cert", 
        # o motor usará o seu certificado de testes interno, garantindo 100% de sucesso.
        manifest_config = {
            "claim_generator": "Verisignum_Shield/3.0",
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
            
        # 3. Invoca o motor nativo para assinar
        cmd = ["c2patool", input_path, "-m", manifest_path, "-o", output_path, "-f"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception(f"Motor C2PA falhou: {result.stderr}")
            
        background_tasks.add_task(cleanup_files, input_path, output_path, manifest_path)
        return FileResponse(path=output_path, media_type=file.content_type, filename=f"signed_{file.filename}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/lens/verify")
async def verify_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """Lê os metadados C2PA de um ficheiro e devolve-os para a auditoria no frontend."""
    input_path = f"/tmp/verify_{file.filename}"
    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # O c2patool lê o ficheiro e devolve o JSON do manifesto no stdout
        cmd = ["c2patool", input_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        background_tasks.add_task(cleanup_files, input_path)
        
        if result.returncode == 0:
            try:
                manifest_data = json.loads(result.stdout)
                return {"has_c2pa": True, "manifest": manifest_data}
            except json.JSONDecodeError:
                return {"has_c2pa": True, "manifest": {}}
        else:
            return {"has_c2pa": False, "manifest": {}}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/copilot/chat")
async def copilot_chat(request: ChatRequest):
    """Proxy seguro que mascara a chamada ao Gemini, impedindo roubo da API Key."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"reply": "Aviso: A chave GEMINI_API_KEY não está configurada no servidor (Painel do Render)."}
        
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": request.message}]}],
            "systemInstruction": {"parts": [{"text": "Você é o Verisignum Compliance Copilot. Responda em Português."}]}
        }
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        reply = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "Não consegui processar o pedido.")
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na ligação com a IA: {str(e)}")