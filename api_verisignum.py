# -*- coding: utf-8 -*-
import os
import json
import secrets
import logging
import requests
import c2pa
import stripe
import resend
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy import create_engine, Column, Integer, String, Boolean, text
from passlib.context import CryptContext
from jose import JWTError, jwt
from dotenv import load_dotenv
from pydantic import BaseModel
import io

load_dotenv()

# --- 1. CONFIGURAÇÕES GERAIS E LOGGING ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Verisignum API Master", version="2.0.0")

# Configuração do CORS (Permite que o Front-end na Vercel fale com o Back-end)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Em produção, substitua "*" pelo seu domínio Vercel
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
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 # 24 horas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login")

# --- 3. CONFIGURAÇÕES DE E-MAIL (RESEND API) ---
resend.api_key = os.getenv("RESEND_API_KEY")

# --- 4. CONFIGURAÇÕES DA STRIPE ---
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
ENDPOINT_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# --- 5. CONFIGURAÇÃO DA BASE DE DADOS (POSTGRESQL) ---
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
elif not DATABASE_URL:
     DATABASE_URL = "sqlite:///./verisignum.db" # Fallback para desenvolvimento local

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Modelo de Cliente Unificado
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

# Cria as tabelas se não existirem (não atualiza colunas existentes)
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
    return client

# --- 7. FUNÇÃO DE ENVIO DE E-MAIL (BOAS-VINDAS PROFISSIONAL B2B) ---
def send_welcome_email(client_email, client_name):
    if not resend.api_key:
        print("Aviso: Chave da API do Resend não configurada. E-mail não enviado.")
        return

    html_body = f"""
    <html>
    <body style="font-family: sans-serif; color: #333; line-height: 1.6;">
        <h2>Olá, {client_name}!</h2>
        <p>A sua conta na plataforma <strong>Verisignum AI</strong> foi criada com sucesso.</p>
        <p>A partir de agora, a sua instituição pode blindar fotografias, áudios, vídeos, arquivos e documentos em PDF contra fraudes e deepfakes através do nosso motor de proveniência criptográfica (C2PA).</p>
        <p>Faça login no painel para acessar o <strong>VerisignumShield</strong>, explorar as análises forenses do <strong>VerisignumLens</strong> e consultar a documentação de integração para a sua equipe de TI.</p>
        
        <p style="margin-top: 25px; margin-bottom: 25px;">
            <a href="https://verisignumdigital.com" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Acessar a Plataforma</a>
        </p>
        
        <p>Desejamos-lhe muito sucesso,<br><strong>A Equipe Verisignum</strong></p>
    </body>
    </html>
    """

    # CORREÇÃO: Agora usamos o seu domínio oficial verificado!
    params = {
        "from": "Verisignum AI <contato@verisignumdigital.com>",
        "to": [client_email],
        "subject": "Bem-vindo à Verisignum AI - Infraestrutura de Confiança",
        "html": html_body,
    }

    try:
        r = resend.Emails.send(params)
        print(f"E-mail enviado com sucesso via Resend para {client_email}")
    except Exception as e:
        print(f"Erro ao enviar e-mail via Resend: {e}")


# ==========================================
# ROTAS DE AUTENTICAÇÃO B2B (O "Portão")
# ==========================================

@app.post("/v1/auth/register", status_code=201)
def register_client(name: str, email: str, password: str, db: Session = Depends(get_db)):
    # 1. Verifica se o e-mail já existe
    if db.query(Client).filter(Client.email == email).first():
        raise HTTPException(status_code=400, detail="Este e-mail já está registado.")
    
    # 2. Gera a API Key e encripta a senha
    new_api_key = "vsg_live_" + secrets.token_hex(16)
    hashed_password = pwd_context.hash(password)
    
    # 3. Cria o cliente na base de dados
    new_client = Client(
        name=name, 
        email=email, 
        hashed_password=hashed_password, 
        api_key=new_api_key,
        is_active=False # STATUS INATIVO: A aguardar pagamento na Stripe
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    
    # 4. Envia o e-mail de boas-vindas limpo
    send_welcome_email(email, name)
    
    return {"message": "Conta criada com sucesso!", "client_id": new_client.id}

@app.post("/v1/auth/login")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # O OAuth2PasswordRequestForm usa 'username' para o e-mail
    client = db.query(Client).filter(Client.email == form_data.username).first()
    
    # Verifica se o cliente existe e se a senha está correta
    if not client or not pwd_context.verify(form_data.password, client.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Gera o "Crachá Digital" (Token JWT)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": client.email}, expires_delta=access_token_expires
    )
    # Retorna o token e o nome do cliente para o front-end
    return {"access_token": access_token, "token_type": "bearer", "client_name": client.name}

@app.get("/v1/dashboard/me")
def read_users_me(current_client: Client = Depends(get_current_client)):
    # Rota protegida que retorna os dados do cliente logado
    return {
        "id": current_client.id,
        "name": current_client.name,
        "email": current_client.email,
        "api_key": current_client.api_key,
        "usage_count": current_client.usage_count,
        "is_active": current_client.is_active,
        "plan": "Enterprise" if current_client.is_active else "Trial"
    }

# ==========================================
# ROTAS DO VERISIGNUM CORE (SHIELD & C2PA)
# ==========================================

@app.post("/v1/shield/sign")
async def assinar_midia(
    file: UploadFile = File(...),
    author: str = Form("Autor Desconhecido"),
    organization: str = Form("Verisignum AI"),
    current_client: Client = Depends(get_current_client), # CADEADO ATIVADO
    db: Session = Depends(get_db)                         # Injetamos o banco de dados
):
    # --- PAYWALL: VERIFICAÇÃO DE FREE TRIAL ---
    if not current_client.is_active:
        if current_client.usage_count >= 5:
            raise HTTPException(
                status_code=402, 
                detail="Free Trial esgotado (5/5 usos). Por favor, ative o plano Enterprise na aba Admin para continuar a usar a API."
            )

    if file.filename.lower().endswith('.pdf') or file.content_type == 'application/pdf':
        raise HTTPException(status_code=400, detail="Formato PDF não suportado pelo motor de assinatura C2PA atual.")

    caminho_entrada = os.path.join(UPLOAD_DIR, file.filename)
    caminho_saida = os.path.join(OUTPUT_DIR, f"verisignum_{file.filename}")

    try:
        with open(caminho_entrada, "wb") as buffer:
            buffer.write(await file.read())

        # 1. GERAÇÃO DO CERTIFICADO BLINDADO (O PADRÃO OURO FINAL)
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives import serialization, hashes
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from datetime import datetime, timedelta
        import subprocess
        import json

        cert_path = os.path.abspath(os.path.join(UPLOAD_DIR, "vsg_master_cert_v10.pem"))
        key_path = os.path.abspath(os.path.join(UPLOAD_DIR, "vsg_master_key_v10.pem"))

        # Curva exata que o motor exige (P-256)
        private_key = ec.generate_private_key(ec.SECP256R1())
        with open(key_path, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                # CORREÇÃO 1: Formato TraditionalOpenSSL (SEC1) que o parser em Rust prefere nativamente
                format=serialization.PrivateFormat.TraditionalOpenSSL, 
                encryption_algorithm=serialization.NoEncryption()
            ))

        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"Verisignum Trust Network"),
            x509.NameAttribute(NameOID.COMMON_NAME, u"Verisignum C2PA Signer")
        ])
        
        # CORREÇÃO 2: EXTENSÕES OBRIGATÓRIAS (Impede o "COSE error parsing certificate")
        ski = x509.SubjectKeyIdentifier.from_public_key(private_key.public_key())
        aki = x509.AuthorityKeyIdentifier.from_issuer_public_key(private_key.public_key())

        cert = x509.CertificateBuilder().subject_name(subject).issuer_name(issuer).public_key(
            private_key.public_key()
        ).serial_number(x509.random_serial_number()).not_valid_before(
            datetime.utcnow() - timedelta(days=1) # CORREÇÃO 3: ANTI CLOCK-SKEW
        ).not_valid_after(
            datetime.utcnow() + timedelta(days=3650)
        ).add_extension(
            x509.BasicConstraints(ca=False, path_length=None), critical=True
        ).add_extension(
            x509.KeyUsage(digital_signature=True, content_commitment=False, key_encipherment=False, data_encipherment=False, key_agreement=False, key_cert_sign=False, crl_sign=False, encipher_only=False, decipher_only=False), critical=True
        ).add_extension(
            ski, critical=False # O C2PA usa isto para gerar o 'kid' (Key ID) obrigatório do envelope!
        ).add_extension(
            aki, critical=False
        ).sign(private_key, hashes.SHA256())

        with open(cert_path, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))

        # 2. MANIFESTO PARA O C2PATOOL NATIVO
        manifesto_dict = {
            "claim_generator": "Verisignum_Shield/10.0",
            "alg": "es256",
            "private_key": key_path,
            "sign_cert": cert_path,
            "ta_url": "http://timestamp.digicert.com", # CORREÇÃO 4: Time Authority (Garante validade global temporal)
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
        
        manifest_file = caminho_entrada + ".json"
        with open(manifest_file, "w") as mf:
            json.dump(manifesto_dict, mf)
        
        # 3. Comunicação Direta com o Terminal do Linux
        cmd = [
            "c2patool", caminho_entrada, 
            "-m", manifest_file, 
            "-o", caminho_saida, 
            "--force"
        ]
        
        logger.info("Acionando o c2patool CLI com certificado X.509 completo e SKI...")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Limpeza
        if os.path.exists(manifest_file):
            os.remove(manifest_file)
            
        if result.returncode != 0:
            raise Exception(f"Erro Fatal no motor binário: {result.stderr}")

        # --- SUCESSO: INCREMENTA O USO DO CLIENTE ---
        current_client.usage_count += 1
        db.commit()

        return FileResponse(path=caminho_saida, media_type=file.content_type, filename=f"verisignum_{file.filename}")

    except Exception as e:
        logger.error(f"Erro C2PA: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro no motor de assinatura: {str(e)}")
    finally:
        if os.path.exists(caminho_entrada):
            os.remove(caminho_entrada)

@app.post("/v1/lens/verify")
async def verificar_midia(
    file: UploadFile = File(...),
    current_client: Client = Depends(get_current_client), # CADEADO ATIVADO
    db: Session = Depends(get_db)
):
    # --- PAYWALL: VERIFICAÇÃO DE FREE TRIAL ---
    if not current_client.is_active:
        if current_client.usage_count >= 5:
            raise HTTPException(
                status_code=402, 
                detail="Free Trial esgotado (5/5 usos). Por favor, ative a sua assinatura na aba Admin para continuar."
            )
    
    # Incrementa o uso
    current_client.usage_count += 1
    db.commit()
    
    # Simulação Forense MVP
    filename_lower = file.filename.lower()
    is_ai = 'fake' in filename_lower or 'ia' in filename_lower or 'sintetico' in filename_lower
    score = 15 if is_ai else 85
    
    return {
        "has_c2pa": False,
        "ai_analysis": {
            "score": score,
            "is_ai": is_ai,
            "anomalies": ["Inconsistências e ruído de difusão detetados (Possível Deepfake)."] if is_ai else ["Estrutura de pixels aparentemente natural."]
        }
    }

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
        logger.error(f"Erro Gemini: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro na comunicação com a IA: {str(e)}")

# ==========================================
# ROTAS DE FATURAÇÃO (STRIPE)
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
            success_url='https://verisignumdigital.com/?payment=success', # URL do seu domínio
            cancel_url='https://verisignumdigital.com/?payment=cancelled', # URL do seu domínio
            metadata={
                'tenant_id': str(tenant_id),
                'client_name': cliente.name
            },
             allow_promotion_codes=True,
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

# ==========================================
# ROTAS DE SISTEMA & ADMIN
# ==========================================

@app.post("/v1/admin/clients")
def create_admin_client(name: str, db: Session = Depends(get_db)):
    # Rota simplificada para criar clientes via painel Admin (sem senha)
    import uuid
    new_key = "vsg_live_" + uuid.uuid4().hex
    new_client = Client(name=name, api_key=new_key, is_active=False)
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return {"message": "Cliente criado!", "client_name": name, "api_key": new_key, "client_id": new_client.id}

@app.get("/v1/system/fix-db")
def fix_database(db: Session = Depends(get_db)):
    # Rota de emergência para garantir que todas as colunas existem no banco
    try:
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS email VARCHAR UNIQUE;"))
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS hashed_password VARCHAR;"))
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR;"))
        db.commit()
        return {"status": "Banco de dados atualizado com sucesso! Colunas verificadas."}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}

@app.delete("/v1/admin/reset-database")
def reset_all_clients(db: Session = Depends(get_db)):
    # ATENÇÃO: Esta rota apaga TODOS os utilizadores do banco de dados!
    try:
        db.query(Client).delete()
        db.commit()
        return {"status": "Sucesso! O banco de dados foi completamente zerado."}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}