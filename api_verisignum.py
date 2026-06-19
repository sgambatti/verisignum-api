import os
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import create_engine, Column, Integer, String, Boolean
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from passlib.context import CryptContext
import jwt
from sqlalchemy import Column, String, Integer, Boolean, text

# ==========================================
# 1. CONFIGURAÇÕES GERAIS E SEGURANÇA
# ==========================================
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "uma_chave_super_secreta_para_desenvolvimento_apenas")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # O Token (login) dura 7 dias

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login")

# Configurações do Servidor de E-mail (Ex: HostGator SMTP)
SMTP_SERVER = os.getenv("SMTP_SERVER", "mail.verisignumdigital.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USER = os.getenv("SMTP_USER", "suporte@verisignumdigital.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "SuaSenhaDeEmailAqui")

# ==========================================
# 2. BASE DE DADOS (Agora com E-mail e Senha)
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
    email = Column(String, unique=True, index=True) # NOVO: Para Login e Notificações
    hashed_password = Column(String) # NOVO: Senha protegida
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
# 3. MOTOR DE E-MAILS (NOTIFICAÇÕES)
# ==========================================
def send_welcome_email(client_email: str, client_name: str, api_key: str):
    """Envia um e-mail transacional de boas-vindas usando SMTP."""
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

        # Conexão SSL com o servidor de E-mail (Modifique para TLS dependendo do seu host)
        server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, client_email, msg.as_string())
        server.quit()
        print(f"E-mail enviado com sucesso para {client_email}")
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
        raise HTTPException(status_code=400, detail="E-mail já registado.")

    # 2. Encriptar a senha
    hashed_password = pwd_context.hash(password)
    new_api_key = "vsg_live_" + uuid.uuid4().hex

    # 3. Guardar na Base de Dados
    new_client = Client(name=name, email=email, hashed_password=hashed_password, api_key=new_api_key)
    db.add(new_client)
    db.commit()
    db.refresh(new_client)

    # 4. Disparar E-mail de Boas-Vindas em background (neste MVP faremos síncrono para testar)
    send_welcome_email(email, name, new_api_key)

    return {"message": "Conta criada com sucesso!", "email": email}


@app.post("/v1/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Rota onde o Painel React envia e-mail/senha e recebe o JWT Token."""
    
    # 1. Procura o utilizador pelo e-mail
    client = db.query(Client).filter(Client.email == form_data.username).first()
    
    # 2. Valida a senha encriptada
    if not client or not pwd_context.verify(form_data.password, client.hashed_password):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")

    # 3. Gera o "Crachá" (JWT Token)
    expire_time = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_data = {"sub": client.email, "tenant_id": client.id, "exp": expire_time}
    jwt_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)

    return {"access_token": jwt_token, "token_type": "bearer"}

# --- ROTA TEMPORÁRIA PARA ATUALIZAR O BANCO DE DADOS ---
@app.get("/v1/system/fix-db")
def fix_database(db: Session = Depends(get_db)):
    try:
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS email VARCHAR UNIQUE;"))
        db.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS hashed_password VARCHAR;"))
        db.commit()
        return {"status": "Banco de dados atualizado com sucesso! As colunas email e senha foram criadas."}
    except Exception as e:
        db.rollback()
        return {"error": str(e)}

# ==========================================
# 5. DEPENDÊNCIA DE SEGURANÇA (O GUARDA-COSTAS)
# ==========================================
def get_current_client(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Esta função é o 'Guarda-Costas' que protege as outras rotas da API."""
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

# Rota de exemplo protegida (Só entra quem tiver feito login!)
@app.get("/v1/dashboard/me")
def get_my_dashboard(current_client: Client = Depends(get_current_client)):
    """Retorna os dados do cliente atual logado para o Front-end desenhar a tela."""
    return {
        "id": current_client.id,
        "name": current_client.name,
        "email": current_client.email,
        "is_active": current_client.is_active,
        "api_key": current_client.api_key, # Exibimos a API Key no painel dele
        "usage_count": current_client.usage_count
    }

# (O resto do seu ficheiro como rotas da Stripe, C2PA, etc. continuam intactas aqui para baixo!)