import os
import json
import subprocess
import requests
import shutil
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends, Security
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# ==========================================
# 1. CONFIGURAÇÃO DA BASE DE DADOS
# ==========================================
# Usa o PostgreSQL do Render se existir, caso contrário cria um SQLite local para testes
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./verisignum_mvp.db")

# Ajuste necessário para o SQLAlchemy funcionar com o Postgres do Render
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Modelo da Tabela de Clientes no Banco de Dados
class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    api_key = Column(String, unique=True, index=True)
    usage_count = Column(Integer, default=0) # O contador de faturamento!

# Cria as tabelas automaticamente quando o servidor arranca
Base.metadata.create_all(bind=engine)

# ==========================================
# 2. CONFIGURAÇÃO DA API E MIDDLEWARES
# ==========================================
app = FastAPI(title="Verisignum Shield API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# MUDANÇA 1: Mudamos o nome do cabeçalho que a API procura
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Injeção de Dependência da Base de Dados
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# MUDANÇA 2: Ajustamos a lógica para ler a chave diretamente
def verify_api_key(api_key: str = Security(api_key_header), db: Session = Depends(get_db)):
    if not api_key:
        raise HTTPException(status_code=401, detail="Acesso Negado: API Key não fornecida no cabeçalho 'X-API-Key'.")
    
    # Como não usamos mais a palavra "Bearer", lemos a chave limpa
    client = db.query(Client).filter(Client.api_key == api_key).first()
    if not client:
        raise HTTPException(status_code=403, detail="Acesso Negado: API Key inválida ou revogada.")
    return client

class ChatRequest(BaseModel):
    message: str

def cleanup_files(*paths):
    for path in paths:
        try:
            if os.path.exists(path): os.remove(path)
        except: pass

# ==========================================
# 3. ROTAS DE ADMINISTRAÇÃO E PRODUTO
# ==========================================

# Rota interna (escondida) apenas para você criar novos clientes e gerar chaves
@app.post("/v1/admin/clients")
def create_client(name: str, db: Session = Depends(get_db)):
    # Gera uma chave no formato do nosso UI: vsg_live_7a3bc...
    new_key = "vsg_live_" + uuid.uuid4().hex
    new_client = Client(name=name, api_key=new_key)
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return {"message": "Cliente criado com sucesso!", "client_name": name, "api_key": new_key}

# A Rota de Assinatura agora é PROTEGIDA e conta o consumo
@app.post("/v1/shield/sign")
async def sign_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    author: str = Form("Verisignum Admin"),
    organization: str = Form("Verisignum AI"),
    client: Client = Depends(verify_api_key), # Exige Chave de API Válida!
    db: Session = Depends(get_db)
):
    input_path = f"/tmp/{file.filename}"
    output_path = f"/tmp/signed_{file.filename}"
    manifest_path = f"/tmp/manifest_{file.filename}.json"
    
    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # A organização do manifesto passa a ser o nome do Cliente no Banco de Dados!
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
            raise Exception(f"Motor C2PA falhou: {result.stderr}")
        
        # METERING: Incrementa o consumo do cliente na base de dados!
        client.usage_count += 1
        db.commit()
            
        background_tasks.add_task(cleanup_files, input_path, output_path, manifest_path)
        return FileResponse(path=output_path, media_type=file.content_type, filename=f"signed_{file.filename}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/lens/verify")
async def verify_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    # Mantemos o Lens aberto (sem API Key) para que funcione como "Isca" (Lead Magnet) no seu site
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
            except json.JSONDecodeError:
                pass

        hive_key = os.getenv("HIVE_API_KEY")
        ai_analysis = {"score": 65, "is_ai": False, "anomalies": ["Chave HIVE_API_KEY não configurada.", "Sem C2PA."]}

        if hive_key:
            headers = {"Authorization": f"token {hive_key}"}
            with open(input_path, "rb") as img_file:
                hive_response = requests.post("https://api.thehive.ai/api/v2/task/sync", headers=headers, files={"media": img_file}, data={"classes": "ai_generated"})
                
            if hive_response.status_code == 200:
                try:
                    res_json = hive_response.json()
                    ai_score = res_json.get("status", [{}])[0].get("response", {}).get("output", [{}])[0].get("classes", [{}])[0].get("score", 0.0)
                    is_ai = ai_score > 0.5
                    ai_analysis = {
                        "score": int((1 - ai_score) * 100),
                        "is_ai": is_ai,
                        "anomalies": ["Probabilidade de síntese por IA generativa." if is_ai else "Estrutura de píxeis natural.", f"Confiança: {ai_score:.2f}"]
                    }
                except Exception as e:
                    ai_analysis["anomalies"].append(f"Erro na Hive: {str(e)}")

        background_tasks.add_task(cleanup_files, input_path)
        return {"has_c2pa": False, "manifest": {}, "ai_analysis": ai_analysis}
    except Exception as e:
        background_tasks.add_task(cleanup_files, input_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/copilot/chat")
async def copilot_chat(request: ChatRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key: return {"reply": "Chave GEMINI não configurada."}
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        payload = {"contents": [{"parts": [{"text": request.message}]}], "systemInstruction": {"parts": [{"text": "Você é o Verisignum Copilot. Responda em PT-PT."}]}}
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return {"reply": response.json()["candidates"][0]["content"]["parts"][0]["text"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na IA: {str(e)}")