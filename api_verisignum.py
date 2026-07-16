# ... existing code ...
@app.post("/v1/auth/register", status_code=201)
def register_client(name: str, email: str, password: str, db: Session = Depends(get_db)):
    if db.query(Client).filter(Client.email == email).first():
        raise HTTPException(status_code=400, detail="Este e-mail já está registado.")
    
    new_api_key = "vsg_live_" + secrets.token_hex(16)
    hashed_password = pwd_context.hash(password)
    
    # Deteta se é o Admin a registar-se para lhe dar passe VIP automático
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "contato@verisignumdigital.com")
    is_admin = (email == ADMIN_EMAIL)
    
    new_client = Client(
        name=name, email=email, hashed_password=hashed_password, 
        api_key=new_api_key, is_active=is_admin
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return {"message": "Conta criada com sucesso!", "client_id": new_client.id}

@app.post("/v1/admin/register-admin", tags=["Admin (Testes)"], status_code=201)
def register_admin_direct(name: str, email: str, password: str, db: Session = Depends(get_db)):
    """
    [ROTA VIP/ADMIN] Cria um utilizador com acesso imediato.
    A conta é criada já ativada (is_active=True), pulando a tela de Trial.
    """
    if db.query(Client).filter(Client.email == email).first():
        raise HTTPException(status_code=400, detail="Este e-mail já está registado.")
    
    new_api_key = "vsg_live_" + secrets.token_hex(16)
    hashed_password = pwd_context.hash(password)
    
    # O segredo está aqui: is_active=True incondicionalmente
    new_client = Client(
        name=name, email=email, hashed_password=hashed_password, 
        api_key=new_api_key, is_active=True
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return {"message": "Conta VIP criada! Pode fazer login direto no painel.", "client_id": new_client.id}

@app.post("/v1/auth/login")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
# ... existing code ...
```

### Como testar agora:
1. Abra o seu **Swagger** (`/docs`).
2. Desça até à secção **Admin (Testes)** (a mesma onde está o botão intocável de Reset).
3. Use a nova rota **`POST /v1/admin/register-admin`**.
4. Crie o seu usuário.
5. Vá ao **Painel React**, faça o login e verá que o sistema o leva **diretamente para dentro do Dashboard**, saltando completamente a barreira de pagamento!