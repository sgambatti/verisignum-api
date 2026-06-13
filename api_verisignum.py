# -*- coding: utf-8 -*-
import os
import json
import requests
import c2pa
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Verisignum API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "temp_uploads"
OUTPUT_DIR = "verisignum_output"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. Rota do Shield (Assinatura C2PA)
@app.post("/v1/shield/sign")
async def assinar_midia(
    file: UploadFile = File(...),
    author: str = Form("Autor Desconhecido"),
    organization: str = Form("Verisignum AI")
):
    # Dupla verificação no backend: bloquear PDFs no servidor
    if file.filename.lower().endswith('.pdf') or file.content_type == 'application/pdf':
        raise HTTPException(status_code=400, detail="Formato PDF não suportado pelo motor de assinatura C2PA.")

    caminho_entrada = os.path.join(UPLOAD_DIR, file.filename)
    caminho_saida = os.path.join(OUTPUT_DIR, f"verisignum_{file.filename}")

    try:
        with open(caminho_entrada, "wb") as buffer:
            buffer.write(await file.read())

        cert_path = os.getenv("VERISIGNUM_CERT_PATH", "certs/test_cert.pem")
        key_path = os.getenv("VERISIGNUM_KEY_PATH", "certs/test_key.pem")

        signer = c2pa.Signer.from_pem(cert_path, key_path, "es256")

        manifesto_json = {
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

        c2pa.sign_file(caminho_entrada, caminho_saida, json.dumps(manifesto_json), signer)

        return FileResponse(path=caminho_saida, media_type=file.content_type, filename=f"verisignum_{file.filename}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(caminho_entrada):
            os.remove(caminho_entrada)

# 2. Modelo de Dados para o Chatbot
class ChatRequest(BaseModel):
    message: str

# 3. Proxy Seguro para a API do Gemini
@app.post("/v1/copilot/chat")
async def copilot_chat(req: ChatRequest):
    # A chave agora fica segura no servidor Render
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="Chave API do Gemini não configurada no servidor.")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    system_prompt = "Você é o Verisignum Compliance Copilot, um assistente técnico e de negócios especializado em Proveniência Digital (C2PA) e proteção contra deepfakes. Responda em Português de forma objetiva."
    
    payload = {
        "contents": [{"parts": [{"text": req.message}]}],
        "systemInstruction": {"parts": [{"text": system_prompt}]}
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        reply_text = data["candidates"][0]["content"]["parts"][0]["text"]
        return {"reply": reply_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na comunicação com a IA: {str(e)}")