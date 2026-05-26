# API de Integração com Verisignum
# Responsável pela comunicação com o endpoint da API
import requests
import json

class VerisignumAPI:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    def fetch_data(self, endpoint):
        """Busca dados do endpoint fornecido."""
        try:
            response = requests.get(f"{self.base_url}/{endpoint}", headers=self.headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            # Tratamento de erro centralizado
            print(f"Erro na requisição para {endpoint}: {e}")
            return {"error": str(e)}

    def post_data(self, endpoint, payload):
        """Envia dados para o endpoint fornecido."""
        try:
            response = requests.post(
                f"{self.base_url}/{endpoint}", 
                headers=self.headers, 
                json=payload,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Erro no envio para {endpoint}: {e}")
            return {"error": str(e)}
