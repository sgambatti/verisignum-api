# -*- coding: utf-8 -*-
import os
import json
import requests
import c2pa
import stripe
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Depends
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy import create_engine, Column, Integer, String, Boolean

load_dotenv()

# --- 1. CONFIGURAÇÕES INICIAIS E LOGGING ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Verisignum API (Unified)", version="1.2.0")

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

# --- 2. CONFIGURAÇÕES DA STRIPE ---
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
ENDPOINT_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# --- 3. CONFIGURAÇÃO DA BASE DE DADOS ---
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./verisignum_test.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
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

# --- AUTO-CORREÇÃO DO BANCO DE DADOS (MIGRAÇÃO) ---
from sqlalchemy import text
try:
    with engine.connect() as conn:
        # Tenta adicionar as colunas novas se elas não existirem
        conn.execute(text("ALTER TABLE clients ADD COLUMN is_active BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE clients ADD COLUMN stripe_customer_id VARCHAR;"))
        conn.commit()
        print("Colunas de pagamento adicionadas ao PostgreSQL com sucesso!")
except Exception as e:
    # Se der erro, é porque as colunas já existem, então ignoramos em silêncio.
    pass
# --------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================================
# ROTAS DO VERISIGNUM CORE (SHIELD & COPILOT)
# ==========================================

@app.post("/v1/shield/sign")
async def assinar_midia(
    file: UploadFile = File(...),
    author: str = Form("Autor Desconhecido"),
    organization: str = Form("Verisignum AI")
):
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

class ChatRequest(BaseModel):
    message: str

@app.post("/v1/copilot/chat")
async def copilot_chat(req: ChatRequest):
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="Chave API do Gemini não configurada no servidor.")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    system_prompt = "Você é o Verisignum Compliance Copilot, um assistente técnico especializado em Proveniência Digital."
    
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
# ROTAS DE PAGAMENTO (STRIPE)
# ==========================================

@app.post("/v1/billing/create-checkout-session")
async def create_checkout_session(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        tenant_id = data.get('tenant_id')
        price_id = data.get('price_id')
        
        if not tenant_id or not price_id:
            raise HTTPException(status_code=400, detail="tenant_id e price_id são obrigatórios")

        cliente = db.query(Client).filter(Client.id == tenant_id).first()
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")

        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='subscription',
            success_url='https://app.verisignum.ai/?payment=success',
            cancel_url='https://app.verisignum.ai/?payment=cancelled',
            metadata={
                'tenant_id': str(tenant_id),
                'client_name': cliente.name
            }
        )
        
        logger.info(f"Link de checkout gerado para: {cliente.name}")
        return JSONResponse(content={'checkout_url': checkout_session.url}, status_code=200)
        
    except stripe.error.StripeError as e:
        logger.error(f"Erro Stripe: {str(e)}")
        raise HTTPException(status_code=400, detail="Falha com o provedor de pagamentos")
    except Exception as e:
        logger.error(f"Erro interno: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/billing/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get('Stripe-Signature')

    if not sig_header or not ENDPOINT_SECRET:
        raise HTTPException(status_code=400, detail="Assinatura ausente ou chave não configurada")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, ENDPOINT_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

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
                logger.info(f"SUCESSO: Conta ativada para o tenant_id {tenant_id}.")

    elif event['type'] == 'invoice.payment_failed':
        invoice = event['data']['object']
        stripe_customer_id = invoice.get('customer')
        
        cliente = db.query(Client).filter(Client.stripe_customer_id == stripe_customer_id).first()
        if cliente:
            cliente.is_active = False 
            db.commit()
            logger.warning(f"ALERTA: Pagamento falhou. Conta {cliente.name} bloqueada.")

    return JSONResponse(content={"success": True}, status_code=200)