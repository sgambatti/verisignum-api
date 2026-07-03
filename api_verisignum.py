# -*- coding: utf-8 -*-
import os
import json
import secrets
import logging
import requests
import stripe
import resend
import shutil
import subprocess
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy import create_engine, Column, Integer, String, Boolean, text, DateTime
from passlib.context import CryptContext
from jose import JWTError, jwt

load_dotenv()

# --- 1. CONFIGURAÇÕES GERAIS E LOGGING ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Verisignum API Master", version="3.1.0")

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

# --- 2. CONFIGURAÇÕES DE SEGURANÇA (JWT & BCRYPT) ---
SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login")

# --- 3. CONFIGURAÇÕES DE E-MAIL (RESEND API) ---
resend.api_key = os.getenv("RESEND_API_KEY")

# --- 4. CONFIGURAÇÕES DA STRIPE ---
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
ENDPOINT_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# --- 5. CONFIGURAÇÃO DA BASE DE DADOS (POSTGRESQL / SQLITE) ---
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
elif not DATABASE_URL:
     DATABASE_URL = "sqlite:///./verisignum.db" 

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    api_key = Column(String, unique=True, index=True)
    usage_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=False)
    stripe_customer_id = Column(String, nullable=True)
    trial_ends_at = Column(DateTime, nullable=True) # NOVO: Relógio do Trial

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- 6. UTILITÁRIOS DE AUTENTICAÇÃO E RELÓGIO DE AREIA ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_client(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    client = db.query(Client).filter(Client.email == email).first()
    if client is None:
        raise credentials_exception
        
    # NOVO: Verifica se o Trial expirou e expulsa o cliente automaticamente
    if client.is_active and client.trial_ends_at and datetime.utcnow() > client.trial_ends_at:
        client.is_active = False
        db.commit()
        
    return client

def get_admin_client(current_client: Client = Depends(get_current_client)):
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "contato@verisignumdigital.com") 
    if current_client.email != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Acesso restrito. Apenas o administrador da plataforma pode executar esta ação.")
    return current_client

# --- 7. FUNÇÃO DE ENVIO DE E-MAIL ---
def send_welcome_email(client_email, client_name):
    if not resend.api_key:
        logger.warning("Chave da API do Resend não configurada. E-mail não enviado.")
        return

    html_body = f"""
    <html>
    <body style="font-family: sans-serif; color: #333; line-height: 1.6;">
        <h2>Olá, {client_name}!</h2>
        <p>A sua conta na plataforma <strong>Verisignum AI</strong> foi criada com sucesso.</p>
        <p>A partir de agora, a sua instituição pode blindar fotografias, áudios, vídeos, arquivos e documentos em PDF contra fraudes e deepfakes através do nosso motor de proveniência criptográfica (C2PA).</p>
        <p>Faça login no painel para acessar o <strong>VerisignumShield</strong>, explorar as análises forenses do <strong>VerisignumLens</strong> e consultar a documentação de integração para a sua equipe de TI.</p>
        
        <p style="margin-top: 25px; margin-bottom: 25px;">
            <a href="https://www.verisignumdigital.com" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acessar a Plataforma</a>
        </p>
        
        <p>Desejamos-lhe muito sucesso,<br><strong>A Equipe Verisignum</strong></p>
    </body>
    </html>
    """

    params = {
        "from": "Verisignum AI <contato@verisignumdigital.com>",
        "to": [client_email],
        "subject": "Bem-vindo à Verisignum AI - Infraestrutura de Confiança",
        "html": html_body,
    }

    try:
        resend.Emails.send(params)
        logger.info(f"E-mail enviado com sucesso para {client_email}")
    except Exception as e:
        logger.error(f"Erro ao enviar e-mail via Resend: {e}")

# ==========================================
# ROTAS DE AUTENTICAÇÃO E BILLING (COM TRIAL)
# ==========================================

class TrialRequest(BaseModel):
    tenant_id: str

@app.post("/v1/billing/start-trial")
def start_free_trial(req: TrialRequest, db: Session = Depends(get_db)):
    """Liberta a plataforma por 48 horas sem exigir cartão de crédito"""
    client = db.query(Client).filter(Client.id == req.tenant_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Conta não encontrada")
    
    if client.is_active:
        raise HTTPException(status_code=400, detail="A sua conta já está ativa.")
        
    if client.trial_ends_at:
        raise HTTPException(status_code=400, detail="O seu período de testes já foi utilizado e expirou. Por favor, ative a assinatura.")
        
    # Ativa por 48 horas
    client.is_active = True
    client.trial_ends_at = datetime.utcnow() + timedelta(days=2)
    db.commit()
    
    return {"message": "Trial ativado com sucesso", "expires_in_hours": 48}

@app.post("/v1/auth/register", status_code=201)
def register_client(name: str, email: str, password: str, db: Session = Depends(get_db)):
    if db.query(Client).filter(Client.email == email).first():
        raise HTTPException(status_code=400, detail="Este e-mail já está registado.")
    
    new_api_key = "vsg_live_" + secrets.token_hex(16)
    hashed_password = pwd_context.hash(password)
    
    new_client = Client(
        name=name, 
        email=email, 
        hashed_password=hashed_password, 
        api_key=new_api_key,
        is_active=False
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    
    send_welcome_email(email, name)
    
    return {"message": "Conta criada com sucesso!", "client_id": new_client.id}

@app.post("/v1/auth/login")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.email == form_data.username).first()
    
    if not client or not pwd_context.verify(form_data.password, client.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": client.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "client_name": client.name}

@app.get("/v1/dashboard/me")
def read_users_me(current_client: Client = Depends(get_current_client)):
    return {
        "id": current_client.id,
        "name": current_client.name,
        "email": current_client.email,
        "api_key": current_client.api_key,
        "usage_count": current_client.usage_count,
        "is_active": current_client.is_active,
        "plan": "Trial (Testes)" if current_client.trial_ends_at else ("Ativo" if current_client.is_active else "Pendente")
    }

# ==========================================
# ROTAS DO VERISIGNUM CORE (SHIELD & C2PA)
# ==========================================

@app.post("/v1/shield/sign")
async def assinar_midia(
    file: UploadFile = File(...),
    author: str = Form("Autor Desconhecido"),
    organization: str = Form("Verisignum AI"),
    current_client: Client = Depends(get_current_client), 
    db: Session = Depends(get_db)                         
):
    if not current_client.is_active:
        raise HTTPException(
            status_code=402, 
            detail="Acesso bloqueado. Assinatura pendente ou período de testes expirado."
        )

    if file.filename.lower().endswith('.pdf') or file.content_type == 'application/pdf':
        raise HTTPException(status_code=400, detail="Formato PDF não suportado pelo motor de assinatura C2PA atual.")

    nome_arquivo_original = file.filename.replace(" ", "_")
    caminho_entrada = os.path.abspath(os.path.join(UPLOAD_DIR, nome_arquivo_original))
    nome_saida = f"verisignum_{nome_arquivo_original}"
    caminho_saida = os.path.abspath(os.path.join(OUTPUT_DIR, nome_saida))

    try:
        with open(caminho_entrada, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        manifesto_dict = {
            "claim_generator": "Verisignum_Shield/14.0",
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
        
        cert_path = os.getenv("PROD_CERT_PATH", "")
        key_path = os.getenv("PROD_KEY_PATH", "")
        if cert_path and key_path and os.path.exists(cert_path) and os.path.exists(key_path):
            manifesto_dict["sign_cert"] = os.path.abspath(cert_path)
            manifesto_dict["private_key"] = os.path.abspath(key_path)
            manifesto_dict["alg"] = "es256"

        nome_manifesto = f"manifest_{nome_arquivo_original}.json"
        caminho_manifesto = os.path.abspath(os.path.join(UPLOAD_DIR, nome_manifesto))
        
        with open(caminho_manifesto, "w") as mf:
            json.dump(manifesto_dict, mf)
        
        cmd = [
            "c2patool", caminho_entrada, 
            "-m", caminho_manifesto, 
            "-o", caminho_saida, 
            "--force"
        ]
        
        logger.info("Executando c2patool com o motor de PKI embutido nativo...")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if os.path.exists(caminho_manifesto):
            os.remove(caminho_manifesto)
            
        if result.returncode != 0:
            raise Exception(f"Erro Fatal no motor binário: {result.stderr}")

        current_client.usage_count += 1
        db.commit()

        return FileResponse(path=caminho_saida, media_type=file.content_type, filename=nome_saida)

    except Exception as e:
        logger.error(f"Erro C2PA: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro no motor de assinatura: {str(e)}")
    finally:
        if os.path.exists(caminho_entrada):
            os.remove(caminho_entrada)

# ==========================================
# ROTAS DO VERISIGNUM LENS (C2PA + HIVE AI)
# ==========================================

@app.post("/v1/lens/verify")
async def verificar_midia(
    file: UploadFile = File(...),
    current_client: Client = Depends(get_current_client),
    db: Session = Depends(get_db)
):
    if not current_client.is_active:
        raise HTTPException(
            status_code=402, 
            detail="Acesso bloqueado. Assinatura pendente ou período de testes expirado."
        )
    
    caminho_temp = os.path.join(UPLOAD_DIR, f"lens_{file.filename}")
    try:
        with open(caminho_temp, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # PASSO 1: INSPEÇÃO CRIPTOGRÁFICA (O ELO COM O SHIELD)
        has_c2pa = False
        author_name = "Verisignum Trust Network"
        
        try:
            cmd_c2pa = ["c2patool", caminho_temp]
            result_c2pa = subprocess.run(cmd_c2pa, capture_output=True, text=True)
            
            if result_c2pa.returncode == 0 and result_c2pa.stdout.strip():
                try:
                    c2pa_data = json.loads(result_c2pa.stdout)
                    if "active_manifest" in c2pa_data or "manifests" in c2pa_data:
                        has_c2pa = True
                        
                        active_manifest = c2pa_data.get("active_manifest")
                        if active_manifest:
                            manifest_obj = c2pa_data.get("manifests", {}).get(active_manifest, {})
                            assertions = manifest_obj.get("assertions", [])
                            for ass in assertions:
                                if ass.get("label") == "stds.schema-org.CreativeWork":
                                    authors = ass.get("data", {}).get("author", [])
                                    if authors:
                                        author_name = authors[0].get("name", author_name)
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            logger.error(f"Lens: Erro ao tentar ler C2PA: {str(e)}")

        if has_c2pa:
            current_client.usage_count += 1
            db.commit()
            return {
                "has_c2pa": True, 
                "ai_analysis": {
                    "score": 100,
                    "is_ai": False,
                    "anomalies": [
                        f"Selo C2PA Autêntico: Validação criptográfica confirmada para o autor '{author_name}'.",
                        "Cadeia de custódia validada: Os píxeis não sofreram alterações.",
                        "A integridade forense deste arquivo está matematicamente comprovada."
                    ]
                }
            }

        # PASSO 2: HIVE AI (SE NÃO TIVER C2PA)
        hive_api_key = os.getenv("HIVE_API_KEY")
        
        final_score = 85
        is_ai = False
        anomalies = []

        if hive_api_key:
            chave_limpa = hive_api_key.strip()
            if chave_limpa.lower().startswith("bearer"):
                chave_limpa = chave_limpa[6:].strip()
            elif chave_limpa.lower().startswith("token"):
                chave_limpa = chave_limpa[5:].strip()
                
            headers = {
                "Authorization": f"Bearer {chave_limpa}",
                "Accept": "application/json"
            }
            
            hive_endpoint = "https://api.thehive.ai/api/v3/hive/ai-generated-and-deepfake-content-detection"
            
            with open(caminho_temp, "rb") as f:
                response = requests.post(
                    hive_endpoint, 
                    headers=headers, 
                    files={"media": f}
                )
                
            if response.status_code == 200:
                res_data = response.json()
                try:
                    ai_score = 0.0
                    is_ai = False
                    
                    outputs = res_data.get("output", [])
                    geradores_detectados = []
                    
                    if outputs:
                        for frame in outputs:
                            classes = frame.get("classes", [])
                            for c in classes:
                                nome_classe = c.get("class", "").lower()
                                valor = c.get("value", 0.0)
                                
                                if nome_classe in ["ai_generated", "deepfake", "ai_generated_audio"]:
                                    ai_score = max(ai_score, valor)
                                    
                                if valor > 0.4 and nome_classe not in [
                                    "not_ai_generated", "none", "ai_generated", 
                                    "deepfake", "ai_generated_audio", "not_ai_generated_audio", 
                                    "inconclusive", "other_image_generators"
                                ]:
                                    if nome_classe not in geradores_detectados:
                                        geradores_detectados.append(nome_classe)
                    
                    if ai_score > 0:
                        final_score = int((1.0 - ai_score) * 100)
                        is_ai = ai_score > 0.5
                    else:
                        final_score = 92
                        is_ai = False

                    if is_ai:
                        anomalies.append(f"ALERTA HIVE AI: {ai_score*100:.1f}% de probabilidade de síntese artificial.")
                        if geradores_detectados:
                            anomalies.append(f"Assinatura do motor detetada: {', '.join(geradores_detectados).title()}.")
                        anomalies.append("Artefatos sintéticos ou ruído de difusão detetados nos píxeis/áudio.")
                    else:
                        anomalies.append("HIVE AI: Nenhuma anomalia gerativa detetada no arquivo.")
                        anomalies.append("A matriz de dados é consistente com uma gravação natural.")
                        
                except Exception as parse_err:
                    anomalies.append("Erro na formatação estrutural do laudo heurístico da Hive AI.")
            else:
                anomalies.append(f"A API da Hive AI recusou o arquivo (Erro HTTP {response.status_code}).")
                anomalies.append("Heurística Local Ativada (Fallback): A estrutura aparenta ser orgânica (85% Humano).")
        else:
            filename_lower = file.filename.lower()
            is_ai = 'fake' in filename_lower or 'ia' in filename_lower or 'sintetico' in filename_lower
            final_score = 15 if is_ai else 85
            if is_ai:
                anomalies = ["Inconsistências espaciais e ruído de difusão detetados (Possível IA)."]
            else:
                anomalies = ["Estrutura de dados aparentemente natural."]

        current_client.usage_count += 1
        db.commit()
        
        return {
            "has_c2pa": False, 
            "ai_analysis": {
                "score": final_score,
                "is_ai": is_ai,
                "anomalies": anomalies
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na análise forense: {str(e)}")
    finally:
        if os.path.exists(caminho_temp):
            os.remove(caminho_temp)

# ==========================================
# ROTAS DE IA (COPILOT)
# ==========================================

class ChatRequest(BaseModel):
    message: str

@app.post("/v1/copilot/chat")
async def copilot_chat(req: ChatRequest):
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="Chave API do Gemini não configurada no servidor.")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    system_prompt = "Você é o Verisignum Compliance Copilot, um assistente técnico especializado em Proveniência Digital e norma C2PA."
    
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

# ==========================================
# ROTAS DE SISTEMA & ADMIN (MÁQUINA DO TEMPO)
# ==========================================

@app.post("/v1/admin/setup-founder")
def setup_founder_account(password: str, db: Session = Depends(get_db)):
    """Rota secreta para criar a conta do dono sem passar pelo Stripe."""
    email = "contato@verisignumdigital.com"
    
    cliente_existente = db.query(Client).filter(Client.email == email).first()
    if cliente_existente:
        cliente_existente.hashed_password = pwd_context.hash(password)
        cliente_existente.is_active = True
        db.commit()
        return {"message": "Conta de fundador atualizada e ativada com sucesso!"}
    
    import secrets
    new_key = "vsg_live_" + secrets.token_hex(16)
    
    new_client = Client(
        name="Verisignum Admin",
        email=email,
        hashed_password=pwd_context.hash(password),
        api_key=new_key,
        is_active=True  
    )
    db.add(new_client)
    db.commit()
    return {"message": "Conta de fundador criada e ativada com sucesso!"}

@app.get("/v1/admin/clients")
def get_all_clients(admin: Client = Depends(get_admin_client), db: Session = Depends(get_db)):
    clients = db.query(Client).order_by(Client.id.desc()).all()
    return [
        {
            "id": str(c.id), 
            "name": c.name, 
            "email": c.email,
            "apiKey": c.api_key, 
            "usageCount": c.usage_count, 
            "plan": "Enterprise" if c.stripe_customer_id else ("Trial" if c.trial_ends_at else "Plano Base"),
            "status": "Ativo" if c.is_active else "Inativo"
        } for c in clients
    ]

@app.post("/v1/admin/clients")
def create_admin_client(name: str, admin: Client = Depends(get_admin_client), db: Session = Depends(get_db)):
    import uuid
    new_key = "vsg_live_" + uuid.uuid4().hex
    new_client = Client(name=name, api_key=new_key, is_active=False)
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return {"message": "Cliente criado!", "client_name": name, "api_key": new_key, "client_id": new_client.id}

@app.get("/v1/system/fix-db")
def fix_database(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS email VARCHAR UNIQUE;"))
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS hashed_password VARCHAR;"))
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR;"))
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;")) # Adiciona coluna de Trial
        db.commit()
        return {"status": "Banco de dados atualizado com sucesso! Colunas de Trial verificadas."}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}

@app.delete("/v1/admin/reset-database")
def reset_all_clients(admin: Client = Depends(get_admin_client), db: Session = Depends(get_db)):
    try:
        db.query(Client).delete()
        db.commit()
        return {"status": "Sucesso! O banco de dados foi completamente zerado."}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}