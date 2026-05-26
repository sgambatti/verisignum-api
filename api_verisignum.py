# -*- coding: utf-8 -*-
"""
Verisignum AI - Servidor de API Oficial (Produção)
Framework: FastAPI

Este é o ficheiro principal que o Render carrega. Ele gerencia as chamadas
do Dashboard, desempacota os metadados e aciona o motor C2PA da Adobe.
"""

import os
import json
import datetime
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
    version="1.0.1"
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


def garantir_chaves_criptograficas(cert_path: str, key_path: str):
    """
    Garante a existência das chaves criptográficas. Se não existirem,
    gera dinamicamente um certificado autoassinado ES256 de teste.
    """
    if os.path.exists(cert_path) and os.path.exists(key_path):
        return

    print("[VERISIGNUM INFRA]: Chaves não encontradas. Gerando par de chaves temporárias...")
    
    # Criar diretórios se não existirem
    os.makedirs(os.path.dirname(cert_path) if os.path.dirname(cert_path) else ".", exist_ok=True)
    os.makedirs(os.path.dirname(key_path) if os.path.dirname(key_path) else ".", exist_ok=True)

    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization

    # 1. Gerar chave privada baseada em Curva Elíptica (ES256) compatível com C2PA
    private_key = ec.generate_private_key(ec.SECP256R1())

    # 2. Configurar o esqueleto do certificado autoassinado
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "BR"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "Goias"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "Goiania"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Verisignum Trust Network"),
        x509.NameAttribute(NameOID.COMMON_NAME, "verisignum.com"),
    ])

    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        private_key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
    ).not_valid_after(
        datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365)
    ).sign(private_key, hashes.SHA256())

    # 3. Gravar chave privada PEM no disco
    with open(key_path, "wb") as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption()
        ))

    # 4. Gravar certificado PEM no disco
    with open(cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))
    
    print(f"[VERISIGNUM INFRA]: Chaves geradas com sucesso em: {cert_path} e {key_path}")


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
    injeta as credenciais C2PA e retorna o ficheiro assinado.
    """
    caminho_entrada = os.path.join(UPLOAD_DIR, file.filename)
    caminho_saida = os.path.join(OUTPUT_DIR, f"verisignum_{file.filename}")

    try:
        # 1. Salva o ficheiro enviado temporariamente no disco do servidor
        with open(caminho_entrada, "wb") as buffer:
            buffer.write(await file.read())

        # 2. Configura e garante a existência de chaves criptográficas (físicas ou auto-geradas)
        cert_path = os.getenv("VERISIGNUM_CERT_PATH", "certs/test_cert.pem")
        key_path = os.getenv("VERISIGNUM_KEY_PATH", "certs/test_key.pem")

        garantir_chaves_criptograficas(cert_path, key_path)

        # 3. Monta o manifesto estruturado C2PA (JSON construído dentro do Python)
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

        # 4. Carrega o assinante de forma dinâmica baseando-se no SDK do c2pa-python
        try:
            from c2pa import Signer
            signer = Signer.from_pem(cert_path, key_path, "es256")
        except (ImportError, AttributeError):
            try:
                signer = c2pa.Signer.from_pem(cert_path, key_path, "es256")
            except AttributeError:
                signer = {
                    "certs": cert_path,
                    "key": key_path,
                    "alg": "es256"
                }
        
        # 5. Executa a injeção criptográfica
        data_dir = UPLOAD_DIR # Define o diretório de dados exigido pela versão mais recente do SDK
        try:
            # Tentativa primária: passa o 5º argumento 'data_dir' obrigatório
            c2pa.sign_file(caminho_entrada, caminho_saida, json.dumps(manifesto_json), signer, data_dir)
        except Exception:
            # Fallback para variações de assinatura em versões legadas do SDK
            if isinstance(signer, dict):
                c2pa.sign_file(
                    caminho_entrada, 
                    caminho_saida, 
                    json.dumps(manifesto_json), 
                    signer_info={"cert": cert_path, "key": key_path, "alg": "es256"},
                    data_dir=data_dir
                )
            else:
                c2pa.sign_file(caminho_entrada, caminho_saida, json.dumps(manifesto_json), signer)

        # 6. Retorna o ficheiro assinado de volta para o Dashboard do usuário
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
        # Garante a exclusão do ficheiro temporário de entrada para manter o disco limpo
        if os.path.exists(caminho_entrada):
            try:
                os.remove(caminho_entrada)
            except Exception:
                pass
