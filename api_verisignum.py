# -*- coding: utf-8 -*-
import os
import json
import datetime
import c2pa
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Verisignum Shield API", version="1.0.2")

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

@app.post("/v1/shield/sign")
async def assinar_midia(
    file: UploadFile = File(...),
    author: str = Form("Autor Desconhecido"),
    organization: str = Form("Verisignum AI")
):
    caminho_entrada = os.path.join(UPLOAD_DIR, file.filename)
    caminho_saida = os.path.join(OUTPUT_DIR, f"verisignum_{file.filename}")

    try:
        with open(caminho_entrada, "wb") as buffer:
            buffer.write(await file.read())

        cert_path = os.getenv("VERISIGNUM_CERT_PATH", "certs/test_cert.pem")
        key_path = os.getenv("VERISIGNUM_KEY_PATH", "certs/test_key.pem")

        # CORREÇÃO: Instanciar a classe Signer corretamente conforme exigido pelo C2PA SDK
        # O c2pa-python exige que o signer seja um objeto da classe c2pa.Signer
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

        # Executa a assinatura utilizando o objeto Signer instanciado
        # Certifique-se de que o caminho dos dados (data_dir) esteja acessível
        c2pa.sign_file(
            caminho_entrada, 
            caminho_saida, 
            json.dumps(manifesto_json), 
            signer
        )

        return FileResponse(
            path=caminho_saida,
            media_type=file.content_type,
            filename=f"verisignum_{file.filename}"
        )

    except Exception as e:
        print(f"[ERRO CRÍTICO BACKEND]: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Erro fatal na assinatura: {str(e)}"
        )
    finally:
        if os.path.exists(caminho_entrada):
            os.remove(caminho_entrada)
