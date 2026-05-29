import c2pa
import json
from fastapi import FastAPI
app = FastAPI()

# 1. Certifique-se de que o certificado e chave são válidos
# Se não tem um par de chaves, o c2pa-python pode gerar um "fast-track"
def assinar_com_validacao(input_path, output_path, author_name):
    # O C2PA espera um dicionário de configuração de manifesto robusto
    manifest_config = {
        "claim_generator": "Verisignum_Shield_v1",
        "assertions": [
            {
                "label": "stds.schema-org.CreativeWork",
                "data": {
                    "author": [{"name": author_name}],
                    "@context": "https://schema.org",
                    "@type": "CreativeWork"
                }
            }
        ]
    }
    
    # 2. Utilizar o create_signer conforme a versão mais recente do SDK
    # Nota: Certifique-se de que o ficheiro de certificado (.pem) 
    # e a chave (.pem) estão acessíveis no servidor.
    try:
        signer = c2pa.create_signer({
            "alg": "es256",
            "sign_cert": "certs/minha_chave_publica.pem",
            "private_key": "certs/minha_chave_privada.pem"
        })
        
        c2pa.sign_file(
            input_path, 
            output_path, 
            json.dumps(manifest_config), 
            signer
        )
        return True
    except Exception as e:
        print(f"Erro crítico na assinatura C2PA: {e}")
        return False
