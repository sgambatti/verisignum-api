import os
import json
import c2pa
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from dotenv import load_dotenv

# Carrega variáveis de ambiente (onde guardaremos o caminho das chaves)
load_dotenv()

app = FastAPI(title="Verisignum API Oficial")

@app.post("/v1/shield/sign")
async def assinar_midia(
    file: UploadFile = File(...),
    author: str = Form(...),
    organization: str = Form(...)
):
    # Definimos caminhos temporários
    temp_input = f"temp_{file.filename}"
    output_path = f"signed_{file.filename}"

    try:
        # Salva arquivo recebido
        with open(temp_input, "wb") as buffer:
            buffer.write(await file.read())

        # Configuração segura das chaves via Variáveis de Ambiente
        # Você definirá essas variáveis no seu servidor de nuvem
        cert_path = os.getenv("VERISIGNUM_CERT_PATH", "certs/test_cert.pem")
        key_path = os.getenv("VERISIGNUM_KEY_PATH", "certs/test_key.pem")

        # Estrutura do Manifesto (A montagem que discutimos)
        manifesto = {
            "claim_generator": "Verisignum_Shield/1.0",
            "assertions": [{
                "label": "stds.schema-org.CreativeWork",
                "data": {
                    "@context": "http://schema.org/",
                    "@type": "CreativeWork",
                    "author": [{"@type": "Person", "name": author}],
                    "publisher": [{"@type": "Organization", "name": organization}]
                }
            }]
        }

        # Assinatura Real via SDK
        signer = c2pa.Signer.from_pem(cert_path, key_path, "es256")
        c2pa.sign_file(temp_input, output_path, json.dumps(manifesto), signer)

        return FileResponse(output_path, filename=f"verisignum_{file.filename}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro crítico na assinatura: {str(e)}")
    
    finally:
        # Limpeza de arquivos temporários para manter o servidor limpo
        if os.path.exists(temp_input): os.remove(temp_input)
