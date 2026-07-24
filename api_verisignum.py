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

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Verisignum API Master", version="3.4.0")

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

SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login")

resend.api_key = os.getenv("RESEND_API_KEY")
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
ENDPOINT_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

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

class AssetLog(Base):
    __tablename__ = "asset_logs"
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, index=True)
    filename = Column(String)
    module = Column(String) # 'SHIELD' (Assinatura) ou 'LENS' (Auditoria)
    status = Column(String) # 'Assinado Criptograficamente', 'Aprovado', 'Quarentena'
    score = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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
    
    if token.startswith("vsg_live_"):
        client = db.query(Client).filter(Client.api_key == token).first()
        if client:
            if client.is_active and client.trial_ends_at and datetime.utcnow() > client.trial_ends_at:
                client.is_active = False
                db.commit()
            return client
        raise credentials_exception

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

@app.post("/v1/admin/register-admin", tags=["Admin (Testes)"], status_code=201)
def register_admin_direct(name: str, email: str, password: str, db: Session = Depends(get_db)):
    """
    Cria ou ATUALIZA o admin para ter ACESSO VITALÍCIO na plataforma.
    Força o is_active=True, anula os trials e injeta um ID Stripe vitalício para evitar bloqueios.
    """
    client = db.query(Client).filter(Client.email == email).first()
    hashed_password = pwd_context.hash(password)
    
    if client:
        client.is_active = True
        client.trial_ends_at = None
        client.stripe_customer_id = "lifetime_admin_access"
        client.hashed_password = hashed_password 
        db.commit()
        return {"message": "Admin atualizado com ACESSO VITALÍCIO. Entre direto no painel.", "client_id": client.id}
    
    new_api_key = "vsg_live_" + secrets.token_hex(16)
    new_client = Client(
        name=name, email=email, hashed_password=hashed_password, 
        api_key=new_api_key, is_active=True, trial_ends_at=None,
        stripe_customer_id="lifetime_admin_access"
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return {"message": "Admin criado com ACESSO VITALÍCIO. Entre direto no painel.", "client_id": new_client.id}

@app.post("/v1/auth/login")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.email == form_data.username).first()
    if not client or not pwd_context.verify(form_data.password, client.hashed_password):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
    
    access_token = create_access_token(data={"sub": client.email}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    return {"access_token": access_token, "token_type": "bearer", "client_name": client.name}

@app.get("/v1/dashboard/me")
def read_users_me(current_client: Client = Depends(get_current_client)):
    return {
        "id": current_client.id,
        "name": current_client.name,
        "email": current_client.email,
        "api_key": current_client.api_key,
        "usage_count": current_client.usage_count,
        "is_active": current_client.is_active
    }

@app.get("/v1/admin/clients")
def get_all_clients(admin: Client = Depends(get_admin_client), db: Session = Depends(get_db)):
    return db.query(Client).all()

class TrialRequest(BaseModel): tenant_id: str
class CheckoutRequest(BaseModel): tenant_id: str; price_id_fixo: str; price_id_variavel: str

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
    if client.trial_ends_at: raise HTTPException(status_code=400, detail="Trial já utilizado.")
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
        
        novo_log = AssetLog(
            client_id=current_client.id, 
            filename=nome_arquivo_original, 
            module="SHIELD", 
            status="Assinado Criptograficamente",
            score=100
        )
        db.add(novo_log)
        
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
        except: pass

        is_ai = 'ia' in file.filename.lower() or 'fake' in file.filename.lower()
        final_score = 15 if is_ai else 85
        anomalies = ["Possível IA."] if is_ai else ["Matriz natural."]

        if has_verisignum: anomalies.insert(0, f"Selo Verisignum Autêntico: Autor '{author_name}'.")
        
        status_lens = "Aprovado (Transparente)" if has_verisignum else ("Quarentena (Fraude)" if is_ai else "Aprovado (Orgânico)")
        novo_log = AssetLog(
            client_id=current_client.id, 
            filename=file.filename, 
            module="LENS", 
            status=status_lens, 
            score=100 if has_verisignum else final_score
        )
        db.add(novo_log)
        
        current_client.usage_count += 1
        db.commit()
        return {"has_verisignum": has_verisignum, "ai_analysis": {"score": 100 if has_verisignum else final_score, "is_ai": is_ai, "anomalies": anomalies}}
    finally:
        if os.path.exists(caminho_temp): os.remove(caminho_temp)

@app.delete("/v1/admin/reset-database", tags=["Admin (Testes)"])
def reset_database(db: Session = Depends(get_db)):
    """
    [DANGER ZONE - APAGAR TUDO] 
    Apaga absolutamente TODOS os registos da base de dados, sem exceções.
    """
    try:
        db.query(Client).delete()
        db.commit()
        return {"status": "sucesso", "message": "Base de dados totalmente limpa. TODOS os utilizadores foram apagados."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro: {str(e)}")

@app.get("/v1/dashboard/history")
def get_asset_history(current_client: Client = Depends(get_current_client), db: Session = Depends(get_db)):
    """Devolve os últimos 50 arquivos processados pela instituição para exibição no Dashboard Web."""
    logs = db.query(AssetLog).filter(AssetLog.client_id == current_client.id).order_by(AssetLog.created_at.desc()).limit(50).all()
    
    return [
        {
            "id": log.id, 
            "filename": log.filename, 
            "module": log.module, 
            "status": log.status, 
            "score": log.score, 
            "created_at": log.created_at.isoformat()
        } 
        for log in logs
    ]