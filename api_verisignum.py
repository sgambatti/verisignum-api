from fastapi import FastAPI, UploadFile, File
import c2pa
import json
import os

app = FastAPI()

@app.get("/")
def read_root():
    return {"status": "online", "message": "API Verisignum pronta para assinar."}

@app.post("/v1/shield/sign")
async def sign_file(file: UploadFile = File(...)):
    input_path = f"temp_{file.filename}"
    output_path = f"signed_{file.filename}"
    
    with open(input_path, "wb") as buffer:
        buffer.write(await file.read())
    
    # Configuração do Manifesto C2PA
    manifest_config = {
        "claim_generator": "Verisignum_Shield_v1",
        "assertions": [
            {
                "label": "stds.schema-org.CreativeWork",
                "data": {
                    "@context": "https://schema.org",
                    "@type": "CreativeWork",
                    "author": [{"name": "Verisignum"}]
                }
            }
        ]
    }
    
    # Assinatura (Simulada para ambiente de teste sem certificados .pem)
    try:
        # Nota: Em produção, você precisará configurar os certificados reais aqui.
        # Por enquanto, usamos a lógica de assinatura básica do c2pa.
        c2pa.sign_file(input_path, output_path, json.dumps(manifest_config))
        return {"message": "Arquivo assinado com sucesso", "filename": output_path}
    except Exception as e:
        return {"error": str(e)}
