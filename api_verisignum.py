import os
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Boolean, text
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from passlib.context import CryptContext
import jwt

# ==========================================
# 1. CONFIGURAÇÕES GERAIS E SEGURANÇA
# ==========================================
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "uma_chave_super_secreta_para_desenvolvimento_apenas")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # O Token (login) dura 7 dias

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login")

# Configurações do Servidor de E-mail (Titan Email / HostGator)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.titan.email")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587)) # Usando 587 como padrão para nuvem
SMTP_USER = os.getenv("SMTP_USER", "contato@verisignumdigital.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "SuaSenhaDeEmailAqui")

# ==========================================
# 2. BASE DE DADOS
# ==========================================
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
    email = Column(String, unique=True, index=True) 
    hashed_password = Column(String) 
    api_key = Column(String, unique=True, index=True)
    usage_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=False)
    stripe_customer_id = Column(String, nullable=True)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI(title="Verisignum B2B API (Auth + Mail)")

# ==========================================
# CONFIGURAÇÃO DE CORS (O SEGURANÇA QUE LIBERA O FRONT-END)
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite que qualquer site (como o seu na Vercel) acesse a API
    allow_credentials=True,
    allow_methods=["*"],  # Permite POST, GET, OPTIONS, etc.
    allow_headers=["*"],
)

# ==========================================
# 3. MOTOR DE E-MAILS (NOTIFICAÇÕES)
# ==========================================
def send_welcome_email(client_email: str, client_name: str, api_key: str):
    """Envia um e-mail transacional de boas-vindas inteligente (Suporta 465 e 587)."""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Bem-vindo ao Verisignum - O Padrão Ouro Digital"
        msg["From"] = SMTP_USER
        msg["To"] = client_email

        html = f"""
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #f4f4f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; border-top: 4px solid #4F46E5;">
                <h2 style="color: #111827;">Olá, Equipe da {client_name}!</h2>
                <p style="color: #4B5563;">A vossa conta na plataforma <strong>Verisignum AI</strong> foi criada com sucesso.</p>
                <p style="color: #4B5563;">A vossa Chave de Integração (API Key) principal é:</p>
                <div style="background-color: #F3F4F6; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 16px; text-align: center; color: #4F46E5; letter-spacing: 1px;">
                    {api_key}
                </div>
                <p style="color: #4B5563; margin-top: 20px;">Guarde esta chave num local seguro. Ela é o passaporte para assinar digitalmente os seus ativos de média e protegê-los contra Deepfakes.</p>
                <p style="color: #4B5563;">Para concluir a ativação do seu plano e começar a utilizar a API, por favor adicione um método de pagamento no painel.</p>
                <br/>
                <p style="color: #9CA3AF; font-size: 12px;">Com os melhores cumprimentos,<br>Equipa de Suporte Verisignum</p>
            </div>
          </body>
        </html>
        """
        msg.attach(MIMEText(html, "html"))

        # Conexão Inteligente com o Servidor de E-mail
        if SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        else:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls() # Injeta a criptografia TLS necessária para a porta 587
            
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, client_email, msg.as_string())
        server.quit()
        print(f"E-mail enviado com sucesso para {client_email} via porta {SMTP_PORT}")
    except Exception as e:
        print(f"Erro ao enviar e-mail: {e}")

# ==========================================
# 4. ROTAS DE REGISTRO E LOGIN (AUTENTICAÇÃO)
# ==========================================
@app.post("/v1/auth/register", status_code=status.HTTP_201_CREATED)
def register_client(name: str, email: str, password: str, db: Session = Depends(get_db)):
    """Rota para a EdTech se registrar na plataforma."""
    
    # 1. Verificar se o e-mail já existe
    if db.query(Client).filter(Client.email == email).first():
        raise HTTPException(status_code=400, detail="E-mail já registado na plataforma.")

    # 2. Encriptar a senha
    hashed_password = pwd_context.hash(password)
    new_api_key = "vsg_live_" + uuid.uuid4().hex

    # 3. Guardar na Base de Dados
    new_client = Client(name=name, email=email, hashed_password=hashed_password, api_key=new_api_key)
    db.add(new_client)
    db.commit()
    db.refresh(new_client)

    # 4. Disparar E-mail de Boas-Vindas
    # TEMPORARIAMENTE DESATIVADO para evitar o bloqueio (timeout 110) do Render Gratuito
    # send_welcome_email(email, name, new_api_key)

    return {"message": "Conta criada com sucesso!", "email": email}


@app.post("/v1/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Rota onde o Painel React envia e-mail/senha e recebe o JWT Token."""
    
    client = db.query(Client).filter(Client.email == form_data.username).first()
    
    if not client or not pwd_context.verify(form_data.password, client.hashed_password):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")

    expire_time = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_data = {"sub": client.email, "tenant_id": client.id, "exp": expire_time}
    jwt_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

    return {"access_token": jwt_token, "token_type": "bearer"}

# ==========================================
# 5. DEPENDÊNCIA DE SEGURANÇA E FERRAMENTAS
# ==========================================
def get_current_client(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """O 'Guarda-Costas' que protege as outras rotas da API."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token inválido")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sessão expirada ou inválida")
        
    client = db.query(Client).filter(Client.email == email).first()
    if client is None:
        raise HTTPException(status_code=401, detail="Cliente não encontrado")
    return client

@app.get("/v1/dashboard/me")
def get_my_dashboard(current_client: Client = Depends(get_current_client)):
    """Retorna os dados do cliente atual logado."""
    return {
        "id": current_client.id,
        "name": current_client.name,
        "email": current_client.email,
        "is_active": current_client.is_active,
        "api_key": current_client.api_key,
        "usage_count": current_client.usage_count
    }

# Rota temporária de correção de banco de dados (pode ser apagada futuramente)
@app.get("/v1/system/fix-db")
def fix_database(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS email VARCHAR UNIQUE;"))
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS hashed_password VARCHAR;"))
        db.commit()
        return {"status": "Banco de dados atualizado com sucesso!"}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}

# O resto do seu ficheiro como rotas da Stripe, C2PA, etc. devem continuar daqui para baixo