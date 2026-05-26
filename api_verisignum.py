# -*- coding: utf-8 -*-
"""
Verisignum AI - Servidor de API Oficial (Produção)
Framework: FastAPI

Este é o arquivo principal que o Render carrega. Ele gerencia as chamadas
do Dashboard, desempacota os metadados e aciona o motor C2PA da Adobe.
"""

import os
import json
import c2pa
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Carrega variáveis de ambiente (essencial para chaves de produção)
load_dotenv()

app = FastAPI(
    title="Verisignum Shield API",
    description="API de Proveniência Digital e Assinatura C2PA",
    version="1.0.0"
)

# =====================================================================
# CONFIGURAÇÃO DE SEGURANÇA CORS (Crucial para conectar com o Dashboard)
# =====================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Diretórios temporários de trabalho
UPLOAD_DIR = "temp_uploads"
OUTPUT_DIR = "verisignum_output"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

@app.get("/")
def health_check():
    """Endpoint básico para verificar se o servidor no Render está ativo."""
    return {
        "status": "online",
        "motor": "Verisignum Shield v3.0",
        "c2pa_ready": True
    }

@app.post("/v1/shield/sign")
async def assinar_midia(
    file: UploadFile = File(...),
    author: str = Form("Autor Desconhecido"),
    organization: str = Form("Verisignum AI")
):
    """
    Endpoint de Assinatura: Recebe a imagem do Dashboard,
    injeta as credenciais C2PA e retorna o arquivo assinado.
    """
    caminho_entrada = os.path.join(UPLOAD_DIR, file.filename)
    caminho_saida = os.path.join(OUTPUT_DIR, f"verisignum_{file.filename}")

    try:
        # 1. Salva o arquivo enviado temporariamente no disco do servidor
        with open(caminho_entrada, "wb") as buffer:
            buffer.write(await file.read())

        # 2. Recupera os caminhos das chaves de segurança (secrets do Render)
        cert_path = os.getenv("VERISIGNUM_CERT_PATH", "certs/test_cert.pem")
        key_path = os.getenv("VERISIGNUM_KEY_PATH", "certs/test_key.pem")

        # Validação física de existência das chaves
        if not os.path.exists(cert_path) or not os.path.exists(key_path):
            raise FileNotFoundError(
                f"Chaves criptográficas não localizadas no servidor. "
                f"Esperado em: {cert_path} e {key_path}"
            )

        # 3. Monta o manifesto estruturado C2PA
        manifesto_json = {
            "claim_generator": "Verisignum_Shield/3.0",
            "assertions": [
                {
                    "label": "stds.schema-org.CreativeWork",
                    "data": {
                        "@context": "http://schema.org/",
                        "@type": "CreativeWork",
                        "author": [
                            {
                                "@type": "Person",
                                "name": author
                            }
                        ],
                        "publisher": [
                            {
                                "@type": "Organization",
                                "name": organization
                            }
                        ]
                    }
                }
            ]
        }

        # 4. CORREÇÃO DO ERRO DO SDK:
        # Tenta carregar o assinante de forma dinâmica baseando-se nas diferentes versões 
        # expostas pelo c2pa-python ou bindings nativos de Rust.
        try:
            # Tenta a importação direta caso esteja em submódulo específico
            from c2pa import Signer
            signer = Signer.from_pem(cert_path, key_path, "es256")
        except (ImportError, AttributeError):
            try:
                # Fallback para carregar a partir do módulo raiz
                signer = c2pa.Signer.from_pem(cert_path, key_path, "es256")
            except AttributeError:
                # Caso a versão instalada utilize chaves de dicionário para assinatura direta
                signer = {
                    "certs": cert_path,
                    "key": key_path,
                    "alg": "es256"
                }
        
        # 5. Executa a injeção criptográfica
        if isinstance(signer, dict):
            # Se o SDK exigir a passagem de parâmetros de chave diretamente na chamada
            c2pa.sign_file(
                caminho_entrada, 
                caminho_saida, 
                json.dumps(manifesto_json), 
                signer_info={"cert": cert_path, "key": key_path, "alg": "es256"}
            )
        else:
            c2pa.sign_file(caminho_entrada, caminho_saida, json.dumps(manifesto_json), signer)

        # 6. Retorna o arquivo assinado de volta para o Dashboard do usuário
        return FileResponse(
            path=caminho_saida,
            media_type=file.content_type,
            filename=f"verisignum_{file.filename}"
        )

    except Exception as e:
        print(f"[ERRO CRÍTICO BACKEND]: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Erro interno de assinatura C2PA: {str(e)}"
        )

    finally:
        # Garante a exclusão do arquivo temporário de entrada para manter o disco limpo
        if os.path.exists(caminho_entrada):
            try:
                os.remove(caminho_entrada)
            except Exception:
                pass
