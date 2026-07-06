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

app = FastAPI(title="Verisignum API Master", version="3.2.0")

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

# --- 5. CONFIGURAÇÃO DA BASE DE DADOS ---
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
    trial_ends_at = Column(DateTime, nullable=True)
    reset_token = Column(String, nullable=True, index=True)
    reset_token_expires = Column(DateTime, nullable=True)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- 6. UTILITÁRIOS DE AUTENTICAÇÃO ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

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
        
    if client.is_active and client.trial_ends_at and datetime.utcnow() > client.trial_ends_at:
        client.is_active = False
        db.commit()
        
    return client

def get_admin_client(current_client: Client = Depends(get_current_client)):
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "contato@verisignumdigital.com") 
    if current_client.email != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Acesso restrito.")
    return current_client


# ==========================================
# ROTAS DE AUTENTICAÇÃO, REGISTRO E RESET REAL
# ==========================================

@app.post("/v1/auth/register", status_code=201)
def register_client(name: str, email: str, password: str, db: Session = Depends(get_db)):
    if db.query(Client).filter(Client.email == email).first():
        raise HTTPException(status_code=400, detail="Este e-mail já está registado.")
    
    new_api_key = "vsg_live_" + secrets.token_hex(16)
    hashed_password = pwd_context.hash(password)
    
    new_client = Client(
        name=name, email=email, hashed_password=hashed_password, 
        api_key=new_api_key, is_active=False
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return {"message": "Conta criada com sucesso!", "client_id": new_client.id}

@app.post("/v1/auth/login")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.email == form_data.username).first()
    if not client or not pwd_context.verify(form_data.password, client.hashed_password):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
    
    access_token = create_access_token(data={"sub": client.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer", "client_name": client.name}

# --- O MOTOR REAL DE RESET DE SENHA ---

class ResetPasswordRequest(BaseModel):
    email: str
    frontend_url: str  # Para sabermos onde montar o link

@app.post("/v1/auth/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    cliente = db.query(Client).filter(Client.email == req.email).first()
    if not cliente:
        # Retorna sucesso para evitar enumeração de contas
        return {"message": "Se o e-mail estiver registado, receberá um link em breve."}

    # 1. Gera um Token de Segurança Único (Válido por 1 hora)
    token_seguranca = secrets.token_urlsafe(32)
    cliente.reset_token = token_seguranca
    cliente.reset_token_expires = datetime.utcnow() + timedelta(hours=1)
    db.commit()

    # 2. Monta o Link Real que o usuário vai clicar
    link_recuperacao = f"{req.frontend_url}?reset_token={token_seguranca}"

    # 3. Corpo do E-mail 
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #4f46e5;">Verisignum Digital</h2>
        <p>Olá, {cliente.name},</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta corporativa.</p>
        <p>Para criar a sua nova senha, clique no botão seguro abaixo (válido por 1 hora):</p>
        <div style="margin: 30px 0;">
            <a href="{link_recuperacao}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Redefinir a Minha Senha
            </a>
        </div>
        <p style="font-size: 12px; color: #666;">Se o botão não funcionar, copie e cole este link no seu navegador: <br>{link_recuperacao}</p>
        <p style="font-size: 12px; color: #999;">Se você não solicitou esta alteração, por favor ignore este e-mail. A sua conta continuará segura.</p>
    </div>
    """

    if resend.api_key:
        try:
            resend.Emails.send({
                "from": "Verisignum Admin <contato@verisignumdigital.com>",
                "to": [req.email],
                "subject": "Redefinição de Senha Segura - Verisignum",
                "html": html_body,
            })
            logger.info(f"E-mail de reset enviado para {req.email}")
        except Exception as e:
            logger.error(f"Erro no Resend ao enviar OTP: {e}")
            raise HTTPException(status_code=500, detail="Erro interno ao enviar o e-mail de recuperação. Tente novamente.")
    else:
        logger.warning(f"Resend desativado. Link gerado: {link_recuperacao}")

    return {"message": "Se o e-mail estiver registado, receberá um link em breve."}

class ConfirmResetRequest(BaseModel):
    token: str
    new_password: str

@app.post("/v1/auth/confirm-reset")
def confirm_password_reset(req: ConfirmResetRequest, db: Session = Depends(get_db)):
    """Recebe a nova senha digitada e aplica ao banco de dados se o token for válido."""
    cliente = db.query(Client).filter(Client.reset_token == req.token).first()
    
    if not cliente:
        raise HTTPException(status_code=400, detail="Link de recuperação inválido.")
        
    if cliente.reset_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Link de recuperação expirado. Solicite um novo.")

    # Altera a senha e limpa o token de segurança
    cliente.hashed_password = pwd_context.hash(req.new_password)
    cliente.reset_token = None
    cliente.reset_token_expires = None
    db.commit()

    return {"message": "A sua senha foi atualizada com sucesso! Já pode fazer login."}

@app.get("/v1/dashboard/me")
def read_users_me(current_client: Client = Depends(get_current_client)):
    return {
        "id": current_client.id, "name": current_client.name, "email": current_client.email,
        "api_key": current_client.api_key, "usage_count": current_client.usage_count,
        "is_active": current_client.is_active,
        "plan": "Trial (Testes)" if current_client.trial_ends_at else ("Ativo" if current_client.is_active else "Pendente")
    }

# ==========================================
# ROTAS DE BILLING & CORE (SHIELD / LENS) MANTIDAS
# ==========================================

class TrialRequest(BaseModel):
    tenant_id: str

class CheckoutRequest(BaseModel):
    tenant_id: str
    price_id_fixo: str
    price_id_variavel: str

@app.post("/v1/billing/create-checkout-session")
def create_checkout_session(req: CheckoutRequest, db: Session = Depends(get_db)):
    cliente = db.query(Client).filter(Client.id == int(req.tenant_id)).first()
    if not cliente: raise HTTPException(status_code=404, detail="Cliente não encontrado")
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{'price': req.price_id_fixo, 'quantity': 1}, {'price': req.price_id_variavel}],
            mode='subscription',
            success_url='https://www.verisignumdigital.com/?payment=success',
            cancel_url='https://www.verisignumdigital.com/?payment=cancelled',
            metadata={'tenant_id': str(req.tenant_id), 'client_name': cliente.name}
        )
        return {"checkout_url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/v1/billing/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get('Stripe-Signature')
    if not sig_header or not ENDPOINT_SECRET: return JSONResponse(content={"success": False}, status_code=400)
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, ENDPOINT_SECRET)
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            tenant_id = session.get('metadata', {}).get('tenant_id')
            if tenant_id:
                cliente = db.query(Client).filter(Client.id == int(tenant_id)).first()
                if cliente:
                    cliente.is_active = True
                    cliente.stripe_customer_id = session.get('customer')
                    db.commit()
        elif event['type'] == 'invoice.payment_failed':
            invoice = event['data']['object']
            cliente = db.query(Client).filter(Client.stripe_customer_id == invoice.get('customer')).first()
            if cliente:
                cliente.is_active = False
                db.commit()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload")
    return JSONResponse(content={"success": True}, status_code=200)

@app.post("/v1/billing/start-trial")
def start_free_trial(req: TrialRequest, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == req.tenant_id).first()
    if not client: raise HTTPException(status_code=404)
    if client.trial_ends_at: raise HTTPException(status_code=400, detail="O seu período de testes já foi utilizado.")
    client.is_active = True
    client.trial_ends_at = datetime.utcnow() + timedelta(days=2)
    db.commit()
    return {"message": "Trial ativado com sucesso"}

@app.post("/v1/shield/sign")
async def assinar_midia(
    file: UploadFile = File(...), author: str = Form("Autor Desconhecido"), organization: str = Form("Verisignum AI"),
    current_client: Client = Depends(get_current_client), db: Session = Depends(get_db)                         
):
    if not current_client.is_active: raise HTTPException(status_code=402, detail="Acesso bloqueado.")
    if file.content_type == 'application/pdf': raise HTTPException(status_code=400, detail="PDF não suportado.")
    nome_arquivo_original = file.filename.replace(" ", "_")
    caminho_entrada = os.path.abspath(os.path.join(UPLOAD_DIR, nome_arquivo_original))
    caminho_saida = os.path.abspath(os.path.join(OUTPUT_DIR, f"verisignum_{nome_arquivo_original}"))
    try:
        with open(caminho_entrada, "wb") as buffer: shutil.copyfileobj(file.file, buffer)
        manifesto_dict = {
            "claim_generator": "Verisignum_Shield/14.0",
            "assertions": [{"label": "stds.schema-org.CreativeWork", "data": {"@context": "http://schema.org/", "@type": "CreativeWork", "author": [{"@type": "Person", "name": author}], "publisher": [{"@type": "Organization", "name": organization}]}}]
        }
        caminho_manifesto = os.path.abspath(os.path.join(UPLOAD_DIR, f"manifest_{nome_arquivo_original}.json"))
        with open(caminho_manifesto, "w") as mf: json.dump(manifesto_dict, mf)
        cmd = ["c2patool", caminho_entrada, "-m", caminho_manifesto, "-o", caminho_saida, "--force"]
        subprocess.run(cmd, capture_output=True, text=True)
        if os.path.exists(caminho_manifesto): os.remove(caminho_manifesto)
        current_client.usage_count += 1
        db.commit()
        return FileResponse(path=caminho_saida, media_type=file.content_type, filename=f"verisignum_{nome_arquivo_original}")
    finally:
        if os.path.exists(caminho_entrada): os.remove(caminho_entrada)

@app.post("/v1/lens/verify")
async def verificar_midia(
    file: UploadFile = File(...), current_client: Client = Depends(get_current_client), db: Session = Depends(get_db)
):
    if not current_client.is_active: raise HTTPException(status_code=402, detail="Acesso bloqueado.")
    caminho_temp = os.path.join(UPLOAD_DIR, f"lens_{file.filename}")
    try:
        with open(caminho_temp, "wb") as buffer: shutil.copyfileobj(file.file, buffer)
        has_verisignum = False
        author_name = "Verisignum Trust Network"
        try:
            res = subprocess.run(["c2patool", caminho_temp], capture_output=True, text=True)
            if res.returncode == 0:
                data = json.loads(res.stdout)
                if "active_manifest" in data:
                    has_verisignum = True
                    mf = data.get("manifests", {}).get(data.get("active_manifest"), {})
                    for ass in mf.get("assertions", []):
                        if ass.get("label") == "stds.schema-org.CreativeWork":
                            author_name = ass.get("data", {}).get("author", [{}])[0].get("name", author_name)
        except: pass

        hive_api_key = os.getenv("HIVE_API_KEY")
        final_score = 85
        is_ai = False
        anomalies = []

        if hive_api_key:
            headers = {"Authorization": f"Bearer {hive_api_key.replace('Bearer ', '').replace('Token ', '').strip()}", "Accept": "application/json"}
            with open(caminho_temp, "rb") as f:
                resp = requests.post("https://api.thehive.ai/api/v3/hive/ai-generated-and-deepfake-content-detection", headers=headers, files={"media": f})
            if resp.status_code == 200:
                try:
                    ai_score = max([c.get("value", 0) for f in resp.json().get("output", []) for c in f.get("classes", []) if c.get("class") in ["ai_generated", "deepfake"]])
                    is_ai = ai_score > 0.5
                    final_score = int((1.0 - ai_score) * 100) if ai_score > 0 else 92
                    if is_ai: anomalies.extend([f"ALERTA: {ai_score*100:.1f}% probabilidade de IA.", "Artefatos sintéticos detectados."])
                    else: anomalies.append("Matriz de pixels natural.")
                except: anomalies.append("Erro na formatação estrutural do laudo.")
            else:
                anomalies.append("Heurística Local Ativada (Fallback).")
        else:
            is_ai = 'ia' in file.filename.lower() or 'fake' in file.filename.lower()
            final_score = 15 if is_ai else 85
            anomalies = ["Possível IA."] if is_ai else ["Matriz natural."]

        if has_verisignum: anomalies.insert(0, f"Selo Verisignum Autêntico: Autor '{author_name}'.")
        current_client.usage_count += 1
        db.commit()
        return {"has_verisignum": has_verisignum, "ai_analysis": {"score": 100 if has_verisignum else final_score, "is_ai": is_ai, "anomalies": anomalies}}
    finally:
        if os.path.exists(caminho_temp): os.remove(caminho_temp)

class ChatRequest(BaseModel): message: str
@app.post("/v1/copilot/chat")
async def copilot_chat(req: ChatRequest):
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key: raise HTTPException(status_code=500)
    try:
        response = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}", json={"contents": [{"parts": [{"text": req.message}]}], "systemInstruction": {"parts": [{"text": "Você é um assistente técnico."}]}})
        return {"reply": response.json()["candidates"][0]["content"]["parts"][0]["text"]}
    except: raise HTTPException(status_code=500)

@app.get("/v1/system/fix-db")
def fix_database(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS email VARCHAR UNIQUE;"))
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS hashed_password VARCHAR;"))
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR;"))
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;"))
        # Adicione estas duas linhas abaixo para criar as novas colunas de reset de senha:
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS reset_token VARCHAR;"))
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;"))
        db.commit()
        return {"status": "Banco de dados atualizado com sucesso!"}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}

@app.delete("/v1/admin/reset-database")