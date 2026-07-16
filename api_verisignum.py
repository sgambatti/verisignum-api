# ... existing code ...
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return {"message": "Conta criada com sucesso!", "client_id": new_client.id}

@app.post("/v1/admin/register-admin", tags=["Admin (Testes)"], status_code=201)
def register_admin_direct(name: str, email: str, password: str, db: Session = Depends(get_db)):
    """
    Cria ou ATUALIZA uma conta incondicionalmente, mascarando como cliente pagante VIP 
    para que o React nunca redirecione para a tela de Trial.
    """
    client = db.query(Client).filter(Client.email == email).first()
    hashed_password = pwd_context.hash(password)
    
    # Se a conta existir, forçamos o acesso VIP definitivo (sem trial)
    if client:
        client.is_active = True
        client.trial_ends_at = None  # Remove a flag de Trial para o React ler como "Ativo"
        client.stripe_customer_id = "vip_admin_bypass"  # Finge ser cliente pagante
        client.hashed_password = hashed_password 
        db.commit()
        return {"message": "Conta existente foi ATIVADA como VIP! Pode fazer login.", "client_id": client.id}
    
    # Se não existir, cria a conta VIP do zero
    new_api_key = "vsg_live_" + secrets.token_hex(16)
    new_client = Client(
        name=name, email=email, hashed_password=hashed_password, 
        api_key=new_api_key, is_active=True, trial_ends_at=None, stripe_customer_id="vip_admin_bypass"
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return {"message": "Conta VIP criada! Pode fazer login direto no painel.", "client_id": new_client.id}

@app.delete("/v1/admin/reset-database", tags=["Admin (Testes)"])
def reset_database(db: Session = Depends(get_db)):
# ... existing code ...
```

**Como testar agora mesmo e acabar com isto:**
1. Atualize a API no Render com este código.
2. Vá ao Swagger (`/docs`), use a rota `/v1/admin/register-admin` com o seu e-mail e password.
3. Volte ao seu painel React e faça o Login.

O painel vai deixá-lo entrar diretamente na plataforma, sem ecrãs de bloqueio, porque agora, aos olhos do código Front-end, você é um cliente que pagou a subscrição!