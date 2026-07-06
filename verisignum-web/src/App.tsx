import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield, Eye, Code, FileCheck, Activity, AlertTriangle, CheckCircle2,
  Terminal, Key, ExternalLink, Sparkles, Send, Loader2, Lock,
  AlertCircle, FileText, LogOut, CreditCard, Check
} from 'lucide-react';

// --- CONSTANTES ---
const API_BASE = "https://verisignum-api.onrender.com/v1";

// --- HELPERS ---
const getAuditStatus = (isAi: boolean, hasVerisignum: boolean) => {
  if (!isAi && hasVerisignum) {
    return { title: "Original + Verisignum", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: <CheckCircle2 size={32} className="text-emerald-400" />, desc: "Origem certificada." };
  } else if (!isAi && !hasVerisignum) {
    return { title: "Original", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: <AlertCircle size={32} className="text-blue-400" />, desc: "Nenhum vestígio de IA." };
  } else if (isAi && hasVerisignum) {
    return { title: "IA + Verisignum", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: <AlertTriangle size={32} className="text-amber-400" />, desc: "IA com autoria declarada." };
  } else {
    return { title: "100% IA", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: <AlertTriangle size={32} className="text-red-400" />, desc: "Deepfake detectado." };
  }
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Modos de Autenticação: login, register, forgot (pedir email), reset (digitar nova senha)
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [clientData, setClientData] = useState<any>(null);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  
  const isAdmin = clientData?.email === 'contato@verisignumdigital.com';

  useEffect(() => {
    // Verifica se há um token de reset na URL (vindo do clique do e-mail)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenNaUrl = urlParams.get('reset_token');
    
    if (tokenNaUrl) {
      setResetToken(tokenNaUrl);
      setAuthMode('reset');
      setIsInitialLoading(false);
      return;
    }

    const token = localStorage.getItem('access_token');
    if (token) {
      setIsAuthenticated(true);
      fetchDashboardData(token);
    } else {
      setIsInitialLoading(false);
    }
  }, []);

  const fetchDashboardData = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/dashboard/me`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setClientData(await res.json());
      else handleLogout();
    } catch (err) {
      console.error(err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === 'register') {
        const url = new URL(`${API_BASE}/auth/register`);
        url.searchParams.append('name', authName);
        url.searchParams.append('email', authEmail);
        url.searchParams.append('password', authPassword);

        const res = await fetch(url.toString(), { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).detail || 'Erro ao criar conta.');
        
        const formData = new URLSearchParams();
        formData.append('username', authEmail);
        formData.append('password', authPassword);
        const loginRes = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData.toString() });
        const loginData = await loginRes.json();
        localStorage.setItem('access_token', loginData.access_token);
        setIsAuthenticated(true);
        fetchDashboardData(loginData.access_token);

      } else if (authMode === 'login') {
        const formData = new URLSearchParams();
        formData.append('username', authEmail);
        formData.append('password', authPassword);
        const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData.toString() });
        if (!res.ok) throw new Error('Credenciais inválidas.');
        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        setIsAuthenticated(true);
        fetchDashboardData(data.access_token);

      } else if (authMode === 'forgot') {
        // PEDIR RESET DE SENHA
        const res = await fetch(`${API_BASE}/auth/reset-password`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: authEmail, frontend_url: window.location.origin })
        });
        if (!res.ok) throw new Error("Erro ao solicitar link.");
        setAuthError((await res.json()).message);
        setTimeout(() => setAuthMode('login'), 4000);

      } else if (authMode === 'reset' && resetToken) {
        // DIGITAR NOVA SENHA (VINDO DO EMAIL)
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
        if (!passwordRegex.test(authPassword)) {
            throw new Error('A senha deve ter no mínimo 8 caracteres, letras, números e caractere especial.');
        }

        const res = await fetch(`${API_BASE}/auth/confirm-reset`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, new_password: authPassword })
        });
        if (!res.ok) throw new Error((await res.json()).detail || "Falha ao redefinir a senha.");
        
        // Sucesso
        setAuthError((await res.json()).message);
        // Limpa a URL e volta pro login
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          setResetToken(null);
          setAuthMode('login');
          setAuthPassword('');
        }, 3000);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setIsAuthenticated(false);
    setClientData(null);
    setActiveTab('dashboard');
  };

  if (isInitialLoading) {
    return <div className="flex h-screen bg-[#0d1117] items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;
  }

  if (!isAuthenticated || authMode === 'reset') {
    return (
      <div className="flex h-screen bg-[#0d1117] items-center justify-center p-4 font-sans py-10">
        <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-2xl p-8 shadow-2xl relative">
          
          <div className="flex flex-col items-center mb-8 relative z-10">
            <div className="w-14 h-14 bg-[#0d1117] border border-[#30363d] rounded-xl flex items-center justify-center mb-4 shadow-lg">
              {authMode === 'reset' ? <Lock className="text-amber-500" size={28} /> : <Shield className="text-indigo-500" size={28} />}
            </div>
            <h1 className="text-xl font-bold text-white tracking-wider">
              {authMode === 'reset' ? 'NOVA SENHA' : 'VERISIGNUM'}
            </h1>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
                <input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm text-white outline-none" required placeholder="Nome da Instituição" />
            )}

            {(authMode !== 'reset') && (
               <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm text-white outline-none" required placeholder="E-mail Corporativo" />
            )}
            
            {(authMode === 'login' || authMode === 'register' || authMode === 'reset') && (
              <div className="space-y-1">
                {authMode === 'login' && (
                  <div className="flex justify-end">
                    <button type="button" onClick={() => {setAuthMode('forgot'); setAuthError(null);}} className="text-xs text-indigo-400 hover:text-indigo-300">Esqueceu a senha?</button>
                  </div>
                )}
                <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm text-white outline-none" required placeholder={authMode === 'reset' ? "Sua nova senha segura" : "••••••••"} />
              </div>
            )}

            {authError && (
              <div className={`p-3 rounded-lg text-xs font-medium border flex items-center gap-2 ${authError.includes('sucesso') || authError.includes('link') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                <AlertCircle size={16} className="flex-shrink-0" /> <span className="leading-tight">{authError}</span>
              </div>
            )}

            <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 text-white font-semibold rounded-lg p-3 text-sm hover:bg-indigo-700 disabled:bg-indigo-600/50 flex items-center justify-center gap-2 mt-4 shadow-lg">
              {authLoading ? <Loader2 className="animate-spin" size={16} /> : (authMode === 'login' ? 'Entrar' : authMode === 'forgot' ? 'Enviar Link Seguro' : authMode === 'reset' ? 'Salvar Nova Senha' : 'Criar Conta')}
            </button>
          </form>

          {authMode !== 'reset' && (
            <div className="mt-6 text-center pt-4 border-t border-[#30363d]">
              <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(null); }} className="text-xs text-indigo-400 hover:text-indigo-300">
                {authMode === 'login' ? 'Novo usuário? Solicite o seu acesso.' : 'Já é parceiro? Faça o seu login.'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0d1117] text-[#c9d1d9] font-sans items-center justify-center">
       <div className="text-center p-8 bg-[#161b22] border border-[#30363d] rounded-xl max-w-md w-full mx-4">
          <Activity className="text-emerald-500 mx-auto mb-4" size={48} />
          <h2 className="text-white font-bold text-xl mb-2">Painel Autenticado!</h2>
          <p className="text-gray-400 text-sm mb-6">Olá, {clientData?.name}. O motor de autenticação e reset de senha foi atualizado com sucesso nesta versão condensada.</p>
          <button onClick={handleLogout} className="w-full bg-[#0d1117] border border-[#30363d] text-white p-3 rounded-lg flex items-center justify-center gap-2 text-sm hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all">
              <LogOut size={16} /> Sair da Aplicação
          </button>
       </div>
    </div>
  );
}