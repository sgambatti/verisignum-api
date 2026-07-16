# ... existing code ...
@app.post("/v1/auth/register", status_code=201)
def register_client(name: str, email: str, password: str, db: Session = Depends(get_db)):
    if db.query(Client).filter(Client.email == email).first():
        raise HTTPException(status_code=400, detail="Este e-mail já está registado.")
    
    new_api_key = "vsg_live_" + secrets.token_hex(16)
    hashed_password = pwd_context.hash(password)
    
    # Deteta se é o Admin a registar-se e dá ativação automática com 10 anos de acesso VIP
    is_admin = (email == ADMIN_EMAIL)
    trial_time = datetime.utcnow() + timedelta(days=3650) if is_admin else None
    
    new_client = Client(
        name=name, email=email, hashed_password=hashed_password, 
        api_key=new_api_key, is_active=is_admin, trial_ends_at=trial_time
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return {"message": "Conta criada com sucesso!", "client_id": new_client.id}

@app.post("/v1/admin/register-admin", tags=["Admin (Testes)"], status_code=201)
def register_admin_direct(name: str, email: str, password: str, db: Session = Depends(get_db)):
    """
    Cria ou ATUALIZA uma conta incondicionalmente, pulando a tela de Trial.
    """
    client = db.query(Client).filter(Client.email == email).first()
    hashed_password = pwd_context.hash(password)
    trial_time = datetime.utcnow() + timedelta(days=3650) # 10 anos de VIP
    
    # Se a conta já existir (porque foi protegida pelo Reset), força a ATIVAÇÃO total!
    if client:
        client.is_active = True
        client.trial_ends_at = trial_time
        client.hashed_password = hashed_password # Atualiza a senha para a que digitar agora
        db.commit()
        return {"message": "Conta existente foi ATIVADA com sucesso! Pode fazer login.", "client_id": client.id}
    
    new_api_key = "vsg_live_" + secrets.token_hex(16)
    new_client = Client(
        name=name, email=email, hashed_password=hashed_password, 
        api_key=new_api_key, is_active=True, trial_ends_at=trial_time
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return {"message": "Conta VIP criada! Pode fazer login direto no painel.", "client_id": new_client.id}

@app.post("/v1/auth/login")
# ... existing code ...
```

**Como testar agora:**
1. Salve e faça o Deploy.
2. Vá ao Swagger > `/v1/admin/register-admin`.
3. Digite o seu email, nome e senha e clique em `Execute`.
4. Ele devolverá a mensagem `"Conta existente foi ATIVADA com sucesso!"`.
5. Vá à plataforma, faça Login e ele irá levá-lo diretamente para dentro do Dashboard sem passar pelo Trial!