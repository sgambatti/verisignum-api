from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import subprocess
import json
import os

app = FastAPI()

# Configuração de CORS: Permite que o seu frontend fale com a API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Em produção, substitua pelos URLs do seu frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "message": "API Verisignum pronta para assinar."}

@app.post("/v1/shield/sign")
async def sign_file(file: UploadFile = File(...)):
    input_path = f"temp_{file.filename}"
    output_path = f"signed_{file.filename}"
    
    try:
        # Salvar o ficheiro temporariamente
        with open(input_path, "wb") as buffer:
            buffer.write(await file.read())
        
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
        
        # Guardar manifesto num ficheiro temporário para o c2patool
        manifest_json_path = "manifest.json"
        with open(manifest_json_path, "w") as f:
            json.dump(manifest_config, f)
        
        # Executar c2patool
        result = subprocess.run([
            "c2patool",
            input_path,
            "-o", output_path,
            "-m", manifest_json_path
        ], capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"Erro no c2patool: {result.stderr}")
            raise HTTPException(status_code=500, detail=f"Erro c2patool: {result.stderr}")
        
        # Retornar o arquivo assinado
        return FileResponse(output_path, filename=output_path, media_type="application/octet-stream")

    except FileNotFoundError as e:
        print(f"Arquivo não encontrado: {str(e)}")
        raise HTTPException(status_code=500, detail="c2patool não encontrado. Verifique a instalação.")
    except Exception as e:
        print(f"Erro interno: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Limpeza
        if os.path.exists(input_path): 
            os.remove(input_path)
        if os.path.exists("manifest.json"): 
            os.remove("manifest.json")
