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

# Permite que o frontend em React (Vercel) comunique com o servidor Render
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
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        manifest_config = {
            "claim_generator": "Verisignum_Shield/4.0",
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

        # Verificação do Caminho A (Padrão Global Enterprise)
        cert_path = "/etc/secrets/vsg_cert.pem"
        key_path = "/etc/secrets/vsg_key.pem"
        if os.path.exists(cert_path) and os.path.exists(key_path):
            manifest_config["sign_cert"] = cert_path
            manifest_config["private_key"] = key_path
            manifest_config["alg"] = os.getenv("C2PA_ALG", "es256")
        
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

@app.post("/v1/lens/verify")
async def verify_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Motor Dual de Auditoria:
    1. Lê metadados criptográficos C2PA localmente (Gratuito e instantâneo).
    2. Se não encontrar, consome a API da Hive AI para analisar os píxeis (Integração B2B).
    """
    input_path = f"/tmp/verify_{file.filename}"
    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 1. Tenta extrair a assinatura C2PA nativa
        cmd = ["c2patool", input_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            try:
                manifest_data = json.loads(result.stdout)
                background_tasks.add_task(cleanup_files, input_path)
                return {"has_c2pa": True, "manifest": manifest_data, "ai_analysis": None}
            except json.JSONDecodeError:
                pass

        # 2. Se falhar o C2PA, aciona a integração de Forense com a Hive AI
        hive_key = os.getenv("HIVE_API_KEY")
        
        # Fallback inteligente (se a chave da Hive não estiver configurada no Render ainda)
        ai_analysis = {
            "score": 65, 
            "is_ai": False, 
            "anomalies": ["Modo offline: Chave HIVE_API_KEY não configurada no Render.", "Nenhuma assinatura criptográfica C2PA encontrada."]
        }

        if hive_key:
            headers = {"Authorization": f"token {hive_key}"}
            with open(input_path, "rb") as img_file:
                # Chamada real à rede neural da Hive para deteção de Deepfakes
                hive_response = requests.post(
                    "https://api.thehive.ai/api/v2/task/sync", 
                    headers=headers, 
                    files={"media": img_file},
                    data={"classes": "ai_generated"}
                )
                
            if hive_response.status_code == 200:
                try:
                    res_json = hive_response.json()
                    # Extrai o score probabilístico da resposta complexa da Hive
                    ai_score = res_json.get("status", [{}])[0].get("response", {}).get("output", [{}])[0].get("classes", [{}])[0].get("score", 0.0)
                    
                    is_ai = ai_score > 0.5
                    ai_analysis = {
                        "score": int((1 - ai_score) * 100), # Transforma em % Humano
                        "is_ai": is_ai,
                        "anomalies": [
                            "ALERTA: Alta probabilidade de síntese por IA generativa." if is_ai else "A estrutura de píxeis não apresenta anomalias evidentes de síntese.",
                            f"Nível de confiança detetado pelo motor: {ai_score:.2f}"
                        ]
                    }
                except Exception as e:
                    ai_analysis["anomalies"].append(f"Erro ao processar dados da Hive: {str(e)}")

        background_tasks.add_task(cleanup_files, input_path)
        return {"has_c2pa": False, "manifest": {}, "ai_analysis": ai_analysis}
            
    except Exception as e:
        background_tasks.add_task(cleanup_files, input_path)
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