import os
import json
import subprocess
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
    """Remove ficheiros temporários após o processamento"""
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
        except:
            pass

def get_certs():
    """
    Gera as chaves com um arquivo de configuração OpenSSL customizado.
    Isso INJETA as extensões X.509 obrigatórias que o COSE/C2PA exige 
    (subjectKeyIdentifier e digitalSignature), eliminando o erro de parsing.
    """
    cert_path = "/tmp/vsg_cert.pem"
    key_path = "/tmp/vsg_key.pem"
    cnf_path = "/tmp/vsg_openssl.cnf"
    
    if not os.path.exists(cert_path) or not os.path.exists(key_path):
        # 1. Cria o arquivo de configuração rigoroso para o OpenSSL
        cnf_content = """[req]
default_bits = 256
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
C = BR
O = Verisignum
CN = Verisignum Shield

[v3_req]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature
subjectKeyIdentifier = hash
"""
        with open(cnf_path, "w") as f:
            f.write(cnf_content)

        # 2. Gera chave privada
        subprocess.run(
            "openssl ecparam -name prime256v1 -genkey -noout -out /tmp/vsg_key.pem", 
            shell=True, check=True
        )
        
        # 3. Gera certificado X.509 usando a configuração C2PA-compliant
        subprocess.run(
            f"openssl req -new -x509 -key /tmp/vsg_key.pem -out /tmp/vsg_cert.pem -days 365 -config {cnf_path}", 
            shell=True, check=True
        )
            
    # Retornamos apenas os NOMES dos ficheiros porque vamos executar o motor dentro da pasta /tmp
    return "vsg_cert.pem", "vsg_key.pem"

@app.get("/")
def read_root():
    return {"status": "online", "message": "API Verisignum (Motor Docker CLI com OpenSSL V3) operacional."}

@app.post("/v1/shield/sign")
async def sign_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    author: str = Form("Verisignum Admin"),
    organization: str = Form("Verisignum AI")
):
    # Nomes relativos para uso dentro da pasta /tmp
    input_filename = f"upload_{file.filename}"
    output_filename = f"signed_{file.filename}"
    manifest_filename = f"manifest_{file.filename}.json"
    
    input_path = f"/tmp/{input_filename}"
    output_path = f"/tmp/{output_filename}"
    manifest_path = f"/tmp/{manifest_filename}"
    
    try:
        # 1. Salvar o arquivo recebido
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
        # 2. Gerar chaves complacentes com COSE V3
        cert_name, key_name = get_certs()
        
        # 3. O manifesto aponta para as chaves com nomes relativos
        manifest_config = {
            "alg": "es256",
            "claim_generator": "Verisignum_Shield/3.0",
            "private_key": key_name,
            "sign_cert": cert_name,
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
            
        # 4. Executa o motor FORÇANDO o diretório de trabalho para /tmp
        # Isso garante que o motor encontra os arquivos sem bugs de parsing de diretório
        cmd = ["c2patool", input_filename, "-o", output_filename, "-m", manifest_filename, "-f"]
        result = subprocess.run(cmd, cwd="/tmp", capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"DEBUG STDOUT: {result.stdout}")
            print(f"DEBUG STDERR: {result.stderr}")
            raise Exception(f"Motor C2PA falhou: {result.stderr}")
            
        if not os.path.exists(output_path):
            raise Exception("Erro desconhecido: O c2patool rodou mas não gerou a saída.")
        
        # 5. Agendar limpeza e enviar resposta
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