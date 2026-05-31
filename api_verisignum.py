import os
import json
import subprocess
import urllib.request
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Verisignum Shield API")

# Configuração CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def cleanup_files(*paths):
    """Limpeza do servidor após o processamento"""
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
        except:
            pass

def get_adobe_test_certs():
    """
    A SOLUÇÃO DEFINITIVA: Em vez de gerar chaves dinamicamente e lidar com
    bugs de formatação do OpenSSL no Docker, nós baixamos os certificados
    oficiais de teste diretamente do repositório dos criadores do c2patool.
    Isto garante 100% de compatibilidade com o parser COSE.
    """
    cert_path = "/tmp/vsg_cert.pem"
    key_path = "/tmp/vsg_key.pem"
    
    cert_url = "https://raw.githubusercontent.com/contentauth/c2patool/main/sample/es256_certs.pem"
    key_url = "https://raw.githubusercontent.com/contentauth/c2patool/main/sample/es256_private.key"
    
    try:
        # Baixa os ficheiros caso eles não existam ou estejam vazios
        if not os.path.exists(cert_path) or os.path.getsize(cert_path) == 0:
            req = urllib.request.Request(cert_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(cert_path, 'wb') as f:
                f.write(response.read())
                
        if not os.path.exists(key_path) or os.path.getsize(key_path) == 0:
            req = urllib.request.Request(key_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response, open(key_path, 'wb') as f:
                f.write(response.read())
    except Exception as e:
        raise Exception(f"Falha ao baixar certificados oficiais da Adobe: {e}")
        
    # Retorna APENAS OS NOMES RELATIVOS para rodarmos tudo confinado na pasta /tmp
    return "vsg_cert.pem", "vsg_key.pem"

@app.get("/")
def read_root():
    return {"status": "online", "message": "API Verisignum (Motor Adobe Test Keys V3) operacional."}

@app.post("/v1/shield/sign")
async def sign_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    author: str = Form("Verisignum Admin"),
    organization: str = Form("Verisignum AI")
):
    # Usamos um nome seguro e limpo para evitar problemas com espaços no terminal Linux
    safe_ext = os.path.splitext(file.filename)[1]
    if not safe_ext: safe_ext = ".png"
    
    input_filename = f"upload_midia{safe_ext}"
    output_filename = f"signed_midia{safe_ext}"
    manifest_filename = "manifest_midia.json"
    
    input_path = f"/tmp/{input_filename}"
    output_path = f"/tmp/{output_filename}"
    manifest_path = f"/tmp/{manifest_filename}"
    
    try:
        # 1. Salvar o arquivo
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # 2. Obter as chaves infalíveis da Adobe
        cert_name, key_name = get_adobe_test_certs()
        
        # 3. O manifesto formatado exatamente como a Adobe exige
        manifest_config = {
            "alg": "es256",
            "claim_generator": "Verisignum_Shield/3.0",
            "private_key": key_name,
            "sign_cert": cert_name,
            "ta_url": "http://timestamp.digicert.com", # Timestamp oficial
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
        
        with open(manifest_path, "w") as f:
            json.dump(manifest_config, f)
            
        # 4. Assinar o ficheiro isolando o terminal na pasta /tmp
        cmd = [
            "c2patool", input_filename, 
            "-m", manifest_filename, 
            "-o", output_filename, 
            "-f"
        ]
        
        print(f"DEBUG INJEÇÃO V3: Comando -> {' '.join(cmd)}")
        result = subprocess.run(cmd, cwd="/tmp", capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"DEBUG STDOUT: {result.stdout}")
            print(f"DEBUG STDERR: {result.stderr}")
            raise Exception(f"Motor C2PA falhou: {result.stderr}")
            
        if not os.path.exists(output_path):
            raise Exception("Erro desconhecido: O c2patool rodou mas não gerou a saída.")
        
        # 5. Agendar limpeza e enviar resposta com o nome original do ficheiro
        background_tasks.add_task(cleanup_files, input_path, output_path, manifest_path)
        
        return FileResponse(
            path=output_path, 
            media_type=file.content_type, 
            filename=f"signed_{file.filename}"
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        background_tasks.add_task(cleanup_files, input_path, manifest_path)
        raise HTTPException(status_code=500, detail=str(e))