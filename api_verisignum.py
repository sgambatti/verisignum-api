from fastapi import FastAPI, UploadFile, File
import subprocess
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
    
    # Assinatura usando c2pa CLI tool
    try:
        manifest_json = json.dumps(manifest_config)
        
        # Call c2patool CLI
        result = subprocess.run([
            "c2patool",
            "sign",
            input_path,
            "-o", output_path,
            "-m", manifest_json
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            return {"message": "Arquivo assinado com sucesso", "filename": output_path}
        else:
            return {"error": f"C2PA signing failed: {result.stderr}"}
    except Exception as e:
        return {"error": str(e)}
