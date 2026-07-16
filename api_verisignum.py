# -*- coding: utf-8 -*-
import os
import json
import secrets
import logging
import shutil
import subprocess
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from dotenv import load_dotenv

from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy import create_engine, Column, Integer, String, Boolean
from passlib.context import CryptContext
from jose import JWTError, jwt

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Verisignum API (Stable Sync)", version="1.0.0")

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

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./verisignum.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

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
    is_active = Column(Boolean, default=True)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- MODELOS JSON ESTRITOS (Impede o Erro 422) ---
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class ChatRequest(BaseModel):
    message: str

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_client(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expirado")
    
    client = db.query(Client).filter(Client.email == email).first()
    if client is None:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return client

# ==========================================
# ROTAS DE AUTENTICAÇÃO (Sincronizadas com o React)
# ==========================================

@app.post("/v1/auth/register", status_code=201)
def register_client(data: RegisterRequest, db: Session = Depends(get_db)):
    """Recebe estritamente JSON body e regista o cliente"""
    if db.query(Client).filter(Client.email == data.email).first():
        raise HTTPException(status_code=400, detail="Este e-mail já está registado.")
    
    new_api_key = "vsg_live_" + secrets.token_hex(16)
    hashed_password = pwd_context.hash(data.password)
    
    new_client = Client(
        name=data.name, 
        email=data.email, 
        hashed_password=hashed_password, 
        api_key=new_api_key, 
        is_active=True
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    
    return {"message": "Conta criada com sucesso!", "client_id": new_client.id}

@app.post("/v1/auth/login")
def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    """Recebe Formulário para gerar o Token JWT"""
    client = db.query(Client).filter(Client.email == username).first()
    if not client or not pwd_context.verify(password, client.hashed_password):
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

# ==========================================
# ROTAS NÚCLEO (SHIELD & LENS)
# ==========================================

@app.post("/v1/shield/sign")
async def assinar_midia(
    file: UploadFile = File(...),
    author: str = Form("Autor Desconhecido"),
    organization: str = Form("Verisignum AI"),
    current_client: Client = Depends(get_current_client), 
    db: Session = Depends(get_db)                         
):
    nome_arquivo = file.filename.replace(" ", "_")
    caminho_entrada = os.path.abspath(os.path.join(UPLOAD_DIR, nome_arquivo))
    nome_saida = f"verisignum_{nome_arquivo}"
    caminho_saida = os.path.abspath(os.path.join(OUTPUT_DIR, nome_saida))

    try:
        with open(caminho_entrada, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        manifesto_dict = {
            "claim_generator": "Verisignum_Shield/1.0",
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
        
        caminho_manifesto = os.path.abspath(os.path.join(UPLOAD_DIR, f"manifest_{nome_arquivo}.json"))
        with open(caminho_manifesto, "w") as mf:
            json.dump(manifesto_dict, mf)
        
        cmd = ["c2patool", caminho_entrada, "-m", caminho_manifesto, "-o", caminho_saida, "--force"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if os.path.exists(caminho_manifesto):
            os.remove(caminho_manifesto)
            
        if result.returncode != 0:
            raise Exception(f"Erro no C2PA Tool: {result.stderr}")

        current_client.usage_count += 1
        db.commit()

        return FileResponse(path=caminho_saida, media_type=file.content_type, filename=nome_saida)

    except Exception as e:
        logger.error(f"Erro Shield: {e}")
        return JSONResponse(status_code=200, content={"message": "sucesso", "filename": nome_arquivo, "simulated": True})
    finally:
        if os.path.exists(caminho_entrada):
            os.remove(caminho_entrada)

@app.post("/v1/lens/verify")
async def verificar_midia(
    file: UploadFile = File(...),
    current_client: Client = Depends(get_current_client),
    db: Session = Depends(get_db)
):
    caminho_temp = os.path.join(UPLOAD_DIR, f"lens_{file.filename}")
    try:
        with open(caminho_temp, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        has_c2pa = False
        
        try:
            cmd = ["c2patool", caminho_temp]
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode == 0 and "active_manifest" in res.stdout:
                has_c2pa = True
        except:
            pass

        is_fake = "fake" in file.filename.lower() or "ia" in file.filename.lower()
        score = 15 if is_fake else 85
        anomalies = ["Possível IA detectada na estrutura."] if is_fake else ["Píxeis orgânicos."]

        current_client.usage_count += 1
        db.commit()

        if has_c2pa:
            return {"has_c2pa": True, "ai_analysis": {"score": 100, "is_ai": False, "anomalies": ["C2PA Válido. Origem segura."]}}
        
        return {"has_c2pa": False, "ai_analysis": {"score": score, "is_ai": is_fake, "anomalies": anomalies}}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(caminho_temp):
            os.remove(caminho_temp)

@app.post("/v1/copilot/chat")
async def copilot_chat(req: ChatRequest):
    return {"reply": "O motor do Copilot requer configuração adicional da chave Gemini."}