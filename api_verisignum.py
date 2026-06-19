import os
import json
import subprocess
import requests
import shutil
import uuid
import stripe
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Boolean, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# --- CONFIGURAÇÃO DE LOGGING ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- CONFIGURAÇÃO DA STRIPE ---
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
ENDPOINT_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# --- CONFIGURAÇÃO DA BASE DE DADOS ---
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./verisignum_mvp.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    api_key = Column(String, unique=True, index=True)
    usage_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=False)
    stripe_customer_id = Column(String, nullable=True)

Base.metadata.create_all(bind=engine)

# Auto-Correção para migração de dados no PostgreSQL
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR;"))
        conn.commit()
except:
    pass

app = FastAPI(title="Verisignum API Unified")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def cleanup_files(*paths):
    for path in paths:
        try:
            if os.path.exists(path): os.remove(path)
        except: pass

class ChatRequest(BaseModel):
    message: str

# ==========================================
# ROTAS DE ADMINISTRAÇÃO E PRODUTO
# ==========================================

@app.post("/v1/admin/clients")
def create_client(name: str, db: Session = Depends(get_db)):
    new_key = "vsg_live_" + uuid.uuid4().hex
    new_client = Client(name=name, api_key=new_key, is_active=False)
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return {"message": "Cliente criado!", "client_name": name, "api_key": new_key, "client_id": new_client.id}

@app.post("/v1/shield/sign")
async def sign_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    author: str = Form("Verisignum Admin"),
    api_key: str = Form(...),
    db: Session = Depends(get_db)
):
    if not api_key:
        raise HTTPException(status_code=401, detail="API Key em falta.")
    
    client = db.query(Client).filter(Client.api_key == api_key).first()
    if not client:
        raise HTTPException(status_code=403, detail="API Key inválida.")

    input_path = f"/tmp/{file.filename}"
    output_path = f"/tmp/signed_{file.filename}"
    manifest_path = f"/tmp/manifest.json"
    
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
                    "publisher": [{"@type": "Organization", "name": client.name}] 
                }
            }]
        }

        with open(manifest_path, "w") as f:
            json.dump(manifest_config, f)
            
        cmd = ["c2patool", input_path, "-m", manifest_path, "-o", output_path, "-f"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            raise Exception(f"C2PA falhou: {result.stderr}")
        
        client.usage_count += 1
        db.commit()
            
        background_tasks.add_task(cleanup_files, input_path, output_path, manifest_path)
        return FileResponse(path=output_path, media_type=file.content_type, filename=f"signed_{file.filename}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/lens/verify")
async def verify_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    input_path = f"/tmp/verify_{file.filename}"
    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        cmd = ["c2patool", input_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            try:
                manifest_data = json.loads(result.stdout)
                background_tasks.add_task(cleanup_files, input_path)
                return {"has_c2pa": True, "manifest": manifest_data, "ai_analysis": None}
            except: pass

        background_tasks.add_task(cleanup_files, input_path)
        return {"has_c2pa": False, "manifest": {}, "ai_analysis": {"score": 65, "is_ai": False, "anomalies": ["Nenhum selo C2PA rastreável."]}}
    except Exception as e:
        background_tasks.add_task(cleanup_files, input_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/copilot/chat")
async def copilot_chat(request: ChatRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key: return {"reply": "Chave GEMINI não configurada no Render."}
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        payload = {"contents": [{"parts": [{"text": request.message}]}], "systemInstruction": {"parts": [{"text": "Você é o Verisignum Copilot. Responda em PT-PT."}]}}
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return {"reply": response.json()["candidates"][0]["content"]["parts"][0]["text"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# ROTAS DE FATURAÇÃO E STRIPE
# ==========================================

@app.post("/v1/billing/create-checkout-session")
async def create_checkout_session(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        tenant_id_raw = data.get('tenant_id')
        price_id = data.get('price_id')
        
        if not tenant_id_raw or not price_id:
            return JSONResponse(status_code=400, content={"detail": "tenant_id e price_id são obrigatórios."})

        # PROTEÇÃO CONTRA O ERRO DO POSTGRESQL ("ao5dv")
        try:
            tenant_id = int(tenant_id_raw)
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "O ID do cliente não é um número válido na Base de Dados."})

        cliente = db.query(Client).filter(Client.id == tenant_id).first()
        if not cliente:
            return JSONResponse(status_code=404, content={"detail": f"Cliente ID {tenant_id} não existe."})

        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{'price': price_id, 'quantity': 1}],
            mode='subscription',
	    allow_promotion_codes=True,
            success_url='https://app.verisignum.ai/?payment=success',
            cancel_url='https://app.verisignum.ai/?payment=cancelled',
            metadata={'tenant_id': str(tenant_id), 'client_name': cliente.name}
        )
        return JSONResponse(content={'checkout_url': checkout_session.url}, status_code=200)
        
    except stripe.error.StripeError as e:
        erro_exato = e.user_message or str(e)
        logger.error(f"Erro Stripe: {erro_exato}")
        return JSONResponse(status_code=400, content={"detail": f"Stripe recusou: {erro_exato}"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": f"Erro Interno: {str(e)}"})

@app.post("/v1/billing/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get('Stripe-Signature')

    if not sig_header or not ENDPOINT_SECRET:
        raise HTTPException(status_code=400, detail="Assinatura ausente.")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, ENDPOINT_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload/signature")

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        tenant_id = session.get('metadata', {}).get('tenant_id')
        stripe_customer_id = session.get('customer')
        
        if tenant_id:
            cliente = db.query(Client).filter(Client.id == int(tenant_id)).first()
            if cliente:
                cliente.is_active = True
                cliente.stripe_customer_id = stripe_customer_id
                db.commit()

    elif event['type'] == 'invoice.payment_failed':
        invoice = event['data']['object']
        cliente = db.query(Client).filter(Client.stripe_customer_id == invoice.get('customer')).first()
        if cliente:
            cliente.is_active = False 
            db.commit()

    return JSONResponse(content={"success": True}, status_code=200)