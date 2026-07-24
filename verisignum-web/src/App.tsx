import React, { useState, useEffect } from 'react';
import {
  Eye, Code, FileCheck, Activity, AlertTriangle, CheckCircle2, 
  Terminal, Key, ExternalLink, Sparkles, Loader2, Lock, 
  FileText, LogOut, CreditCard, Menu, X, Copy, Monitor, Download, Search,
  Shield, Users, UploadCloud
} from 'lucide-react';

interface CopyStatus {
  [key: string]: boolean | string | null;
  error: string | null;
}

interface HistoryLog {
  id: number;
  filename: string;
  module: string;
  status: string;
  score: number | null;
  created_at: string;
}

interface ClientTenant {
  id: number;
  name: string;
  email: string;
  api_key: string;
  usage_count: number;
  is_active: boolean;
}

const RENDER_DASHBOARD_ME_URL = "https://verisignum-api.onrender.com/v1/dashboard/me";
const RENDER_HISTORY_URL = "https://verisignum-api.onrender.com/v1/dashboard/history";
const RENDER_ADMIN_CLIENTS = "https://verisignum-api.onrender.com/v1/admin/clients";
const RENDER_SHIELD_URL = "https://verisignum-api.onrender.com/v1/shield/sign";
const RENDER_LENS_URL = "https://verisignum-api.onrender.com/v1/lens/verify";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [clientData, setClientData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState({ type: '', text: '' });
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [adminClients, setAdminClients] = useState<ClientTenant[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  const [shieldFile, setShieldFile] = useState<File | null>(null);
  const [shieldAuthor, setShieldAuthor] = useState('');
  const [shieldOrg, setShieldOrg] = useState('');
  const [isShielding, setIsShielding] = useState(false);
  const [shieldSuccess, setShieldSuccess] = useState(false);
  const [shieldPreview, setShieldPreview] = useState<string | null>(null);

  const [lensFile, setLensFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const [lensPreview, setLensPreview] = useState<string | null>(null);

  const [copyStatus, setCopyStatus] = useState<CopyStatus>({ error: null });
  
  // Defina o email do administrador do sistema aqui
  const ADMIN_EMAIL = 'contato@verisignumdigital.com';
  const isAdmin = clientData?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!shieldFile) {
      setShieldPreview(null);
      return;
    }
    if (shieldFile.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(shieldFile);
      setShieldPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setShieldPreview(null);
    }
  }, [shieldFile]);

  useEffect(() => {
    if (!lensFile) {
      setLensPreview(null);
      return;
    }
    if (lensFile.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(lensFile);
      setLensPreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setLensPreview(null);
    }
  }, [lensFile]);

  const fetchHistory = async (token: string) => {
    setHistoryLoading(true);
    try {
      const response = await fetch(RENDER_HISTORY_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error("Falha ao buscar o histórico forense", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchAdminClients = async (token: string) => {
    setAdminLoading(true);
    try {
      const response = await fetch(RENDER_ADMIN_CLIENTS, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAdminClients(data);
      }
    } catch (error) {
      console.error("Falha ao buscar clientes admin", error);
    } finally {
      setAdminLoading(false);
    }
  };

  const fetchDashboardData = async (token: string) => {
    try {
      const response = await fetch(RENDER_DASHBOARD_ME_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setClientData(data);
        setIsAuthenticated(true);
        fetchHistory(token);
        if (data.email === ADMIN_EMAIL) {
          fetchAdminClients(token);
        }
      } else {
        localStorage.removeItem('access_token');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Erro de conexão", error);
    } finally {
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchDashboardData(token);
    } else {
      setIsInitialLoad(false);
    }
  }, []);

  const safeCopyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, [key]: false })), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setIsAuthenticated(false);
    setClientData(null);
  };

  const handleShieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shieldFile) return;
    setIsShielding(true);
    setShieldSuccess(false);

    const formData = new FormData();
    formData.append('file', shieldFile);
    formData.append('author', shieldAuthor || clientData?.name || 'Autor Desconhecido');
    formData.append('organization', shieldOrg || 'Verisignum AI');

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(RENDER_SHIELD_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `verisignum_${shieldFile.name}`;
        a.click();
        setShieldSuccess(true);
        if(token) fetchHistory(token);
      } else {
        alert("Falha ao assinar o arquivo. Verifique se tem créditos ou se a API está online.");
      }
    } catch(err) {
      console.error("Erro no Shield", err);
    } finally {
      setIsShielding(false);
    }
  };

  const handleLensScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lensFile) return;
    setIsScanning(true);
    setScanResult(null);
    setScanStep('A transferir arquivo para o laboratório forense...');

    const formData = new FormData();
    formData.append('file', lensFile);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(RENDER_LENS_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setScanStep('A decodificar C2PA e processar heurísticas...');
        setTimeout(() => {
          setScanResult(data);
          if(token) fetchHistory(token);
          setIsScanning(false);
        }, 1500);
      } else {
        alert("Falha na auditoria. Verifique a conexão com o servidor.");
        setIsScanning(false);
      }
    } catch(err) {
      console.error("Erro no Lens", err);
      setIsScanning(false);
    }
  };

  const downloadManual = () => {
    const text = `# POP-06: Guia de Instalação do Agente Verisignum\n\nConsulte o documento oficial pop_instalacao_agente_windows.md entregue no repositório para o passo a passo completo da instalação local do Agente.`;
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pop_instalacao_agente_windows.md';
    a.click();
  };

  const downloadFakeExecutable = (os: string) => {
    const text = `Este é o executável mock do Agente para ${os}. A aplicação real foi compilada via PyInstaller.`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = os === 'windows' ? 'Verisignum_Agent_Windows.exe' : 'Verisignum_Agent_Mac.app';
    a.click();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage({ type: '', text: '' });
    try {
      const formData = new URLSearchParams();
      formData.append('username', authEmail);
      formData.append('password', authPassword);

      const res = await fetch("https://verisignum-api.onrender.com/v1/auth/login", {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        fetchDashboardData(data.access_token);
      } else {
        const err = await res.json();
        setAuthMessage({ type: 'error', text: err.detail || 'E-mail ou senha incorretos.' });
      }
    } catch (err) {
      setAuthMessage({ type: 'error', text: 'Erro de conexão com o servidor.' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage({ type: '', text: '' });
    try {
      const res = await fetch(`https://verisignum-api.onrender.com/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword })
      });

      if (res.ok) {
        setAuthMode('login');
        setAuthMessage({ type: 'success', text: 'Conta criada com sucesso! Faça login abaixo.' });
        setAuthPassword('');
      } else {
        const err = await res.json();
        setAuthMessage({ type: 'error', text: err.detail || 'Erro ao criar conta.' });
      }
    } catch (err) {
      setAuthMessage({ type: 'error', text: 'Erro de conexão com o servidor.' });
    } finally {
      setAuthLoading(false);
    }
  };

  if (isInitialLoad) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
         <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <div className="bg-[#161b22] border border-[#30363d] p-8 rounded-2xl w-full max-w-md shadow-2xl">
          <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 flex items-center justify-center mx-auto mb-6">
            <Shield size={32} className="text-indigo-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            {authMode === 'login' ? 'Acesso ao Portal' : 'Criar Nova Conta'}
          </h2>
          <p className="text-gray-400 text-sm mb-6 text-center">
            {authMode === 'login' 
              ? 'Inicie sessão para aceder à plataforma forense.' 
              : 'Registe-se para proteger os seus ativos digitais.'}
          </p>

          {authMessage.text && (
            <div className={`mb-4 p-3 rounded-lg text-sm font-semibold flex items-center gap-2 ${authMessage.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              {authMessage.type === 'error' ? <AlertTriangle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" />}
              {authMessage.text}
            </div>
          )}

          <form onSubmit={authMode === 'login' ? handleLoginSubmit : handleRegisterSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1">Nome Completo</label>
                <input 
                  type="text" 
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full bg-[#0d1117] text-white border border-[#30363d] rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none transition-colors" 
                  placeholder="Ex: Universidade XYZ"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">E-mail Corporativo</label>
              <input 
                type="email" 
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-[#0d1117] text-white border border-[#30363d] rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none transition-colors" 
                placeholder="nome@empresa.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">Palavra-passe</label>
              <input 
                type="password" 
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-[#0d1117] text-white border border-[#30363d] rounded-lg px-4 py-2.5 focus:border-indigo-500 outline-none transition-colors" 
                placeholder="••••••••"
              />
            </div>

            <button 
              disabled={authLoading}
              type="submit" 
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {authLoading ? <Loader2 className="animate-spin" size={18} /> : (authMode === 'login' ? <Lock size={18} /> : <Shield size={18} />)}
              {authLoading ? 'A processar...' : (authMode === 'login' ? 'Entrar no Sistema' : 'Registar Conta Gratuita')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setAuthMessage({ type: '', text: '' });
                setAuthPassword('');
              }}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
            >
              {authMode === 'login' ? 'Não tem conta? Registe-se agora' : 'Já possui conta? Iniciar Sessão'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] font-sans text-gray-200 flex flex-col md:flex-row overflow-hidden">
      
      {/* HEADER MOBILE */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#161b22] border-b border-[#30363d] z-20">
        <div className="flex items-center gap-2">
           <Shield size={24} className="text-indigo-500" />
           <span className="font-bold text-white text-lg">VERISIGNUM</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-400 hover:text-white">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* SIDEBAR */}
      <aside className={`fixed md:relative top-0 left-0 h-full w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col transition-transform duration-300 z-10 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 hidden md:flex items-center gap-3">
          <Shield size={28} className="text-indigo-500" />
          <span className="font-bold text-white text-xl tracking-wider">VERISIGNUM</span>
        </div>
        
        <div className="px-4 py-2 mt-4 md:mt-0 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-2 mb-2">Workspace</p>
          <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
              {clientData?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{clientData?.name || 'Carregando...'}</p>
              <p className="text-xs text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-2 mt-4 mb-2">Painel de Controlo</p>
          <button onClick={() => {setActiveTab('dashboard'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500 shadow-sm' : 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200'}`}><Activity size={18} /> Atividade & Logs</button>
          
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-2 mt-6 mb-2">Módulos Forenses</p>
          <button onClick={() => {setActiveTab('shield'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'shield' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500 shadow-sm' : 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200'}`}><FileCheck size={18} /> VerisignumShield</button>
          <button onClick={() => {setActiveTab('lens'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'lens' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500 shadow-sm' : 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200'}`}><Eye size={18} /> VerisignumLens</button>
          
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-2 mt-6 mb-2">Integração B2B</p>
          <button onClick={() => {setActiveTab('api'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'api' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500 shadow-sm' : 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200'}`}><Code size={18} /> API & Agentes (MCP)</button>

          {isAdmin && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-2 mt-6 mb-2">Administração</p>
              <button onClick={() => {setActiveTab('admin'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'admin' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500 shadow-sm' : 'text-gray-400 hover:bg-[#21262d] hover:text-gray-200'}`}><Users size={18} /> Gestão de Clientes</button>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[#30363d]">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={18} /> Encerrar Sessão
          </button>
        </div>
      </aside>

      {/* OVERLAY MOBILE */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-0 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 h-screen overflow-y-auto p-4 md:p-8 bg-[#0d1117] relative">
        <div className="max-w-6xl mx-auto">

          {}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-white">Análise da Operação Verisignum</h2>
                <button onClick={() => fetchHistory(localStorage.getItem('access_token') || '')} className="flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-2 rounded-lg transition-all border border-indigo-500/20 shadow-sm">
                  <Activity size={14} /> Sincronizar Logs
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full blur-2xl pointer-events-none"></div>
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider relative z-10">Total de Verificações</span>
                  <div className="text-3xl font-extrabold text-white relative z-10">{history.length > 0 ? history.length : (clientData?.usage_count || 0)}</div>
                </div>
                <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full blur-2xl pointer-events-none"></div>
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider relative z-10">Ativos Criptografados</span>
                  <div className="text-3xl font-extrabold text-emerald-400 relative z-10">{history.filter(h => h.module === 'SHIELD').length}</div>
                </div>
                <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full blur-2xl pointer-events-none"></div>
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider relative z-10">Deepfakes Identificados</span>
                  <div className="text-3xl font-extrabold text-amber-500 relative z-10">{history.filter(h => h.status.includes('Quarentena') || h.status.includes('Fraude')).length}</div>
                </div>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg mt-8">
                <div className="p-4 md:p-6 border-b border-[#30363d] bg-[#0d1117] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="text-indigo-400" size={18} /> Histórico de Processamento
                  </h3>
                  
                  <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <Search size={14} className="text-gray-500" />
                      </div>
                      <input 
                        type="text" 
                        placeholder="Buscar por nome..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#161b22] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:border-indigo-500 outline-none transition-colors"
                      />
                    </div>
                    <select 
                      value={moduleFilter} 
                      onChange={(e) => setModuleFilter(e.target.value)}
                      className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="ALL">Todos os Módulos</option>
                      <option value="SHIELD">🛡️ Shield (C2PA)</option>
                      <option value="LENS">👁️ Lens (Forense)</option>
                    </select>
                    <select 
                      value={statusFilter} 
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="ALL">Qualquer Veredicto</option>
                      <option value="Aprovado">✅ Aprovados Seguros</option>
                      <option value="Quarentena">🚨 Quarentena (Deepfake)</option>
                      <option value="Assinado">🔐 Assinados Criptograficamente</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-400 min-w-[700px]">
                    <thead className="bg-[#0d1117]/50 border-b border-[#30363d] text-[10px] uppercase font-bold tracking-wider">
                      <tr>
                        <th className="p-4 w-40">Data e Hora</th>
                        <th className="p-4">Arquivo Base</th>
                        <th className="p-4 w-32">Motor</th>
                        <th className="p-4 w-56">Score & Veredicto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#30363d]">
                      {historyLoading ? (
                        <tr><td colSpan={4} className="p-12 text-center text-gray-500"><Loader2 className="animate-spin mx-auto mb-3 text-indigo-500" size={24} /> Sincronizando Registos Forenses...</td></tr>
                      ) : history.length === 0 ? (
                        <tr><td colSpan={4} className="p-12 text-center text-gray-500">Nenhum ativo processado por esta conta. A operação está limpa.</td></tr>
                      ) : history.filter(log => {
                        const matchSearch = log.filename.toLowerCase().includes(searchQuery.toLowerCase());
                        const matchMod = moduleFilter === 'ALL' || log.module === moduleFilter;
                        const matchStatus = statusFilter === 'ALL' || log.status.includes(statusFilter);
                        return matchSearch && matchMod && matchStatus;
                      }).length === 0 ? (
                        <tr><td colSpan={4} className="p-12 text-center text-gray-500">Nenhum registro encontrado.</td></tr>
                      ) : (
                        history.filter(log => {
                          const matchSearch = log.filename.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchMod = moduleFilter === 'ALL' || log.module === moduleFilter;
                          const matchStatus = statusFilter === 'ALL' || log.status.includes(statusFilter);
                          return matchSearch && matchMod && matchStatus;
                        }).map(log => (
                          <tr key={log.id} className="hover:bg-[#21262d] transition-colors">
                            <td className="p-4 text-xs font-mono text-gray-500">
                              {new Date(log.created_at).toLocaleString('pt-PT', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                            </td>
                            <td className="p-4 font-medium text-white truncate max-w-[200px]" title={log.filename}>
                              <div className="flex items-center gap-2">
                                <FileText size={14} className="text-gray-500 shrink-0"/>
                                <span className="truncate">{log.filename}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${log.module === 'SHIELD' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                {log.module === 'SHIELD' ? '🛡️ Shield' : '👁️ Lens'}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {log.status.includes('Quarentena') || log.status.includes('Fraude') ? (
                                  <AlertTriangle size={14} className="text-red-400 shrink-0" />
                                ) : log.status.includes('Aprovado') ? (
                                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                ) : (
                                  <Lock size={14} className="text-blue-400 shrink-0" />
                                )}
                                <span className={`text-xs font-semibold ${log.status.includes('Quarentena') || log.status.includes('Fraude') ? 'text-red-400' : log.status.includes('Aprovado') ? 'text-emerald-400' : 'text-blue-400'}`}>
                                  {log.status} {log.score !== null && log.score !== 100 && log.module === 'LENS' ? `(${log.score}% Humano)` : ''}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {}
          {activeTab === 'shield' && (
            <div className="space-y-6 animate-in fade-in duration-300">
               <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <FileCheck className="text-indigo-500" /> VerisignumShield
                </h2>
                <p className="text-sm text-gray-400 mt-1">Ferramenta visual de assinatura rápida. Injeta a malha C2PA e faz o download automático.</p>
              </div>
              
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-lg max-w-2xl">
                <form onSubmit={handleShieldSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Selecione o Arquivo (Mídia)</label>
                    <div className="relative border-2 border-dashed border-[#30363d] hover:border-indigo-500 bg-[#0d1117] rounded-xl p-8 text-center transition-colors">
                      <input 
                        type="file" 
                        onChange={(e) => setShieldFile(e.target.files?.[0] || null)} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                        required 
                      />
                      
                      {shieldPreview ? (
                        <div className="flex flex-col items-center pointer-events-none">
                          <img src={shieldPreview} alt="Preview" className="max-h-40 rounded-lg shadow-md mb-3 object-contain border border-[#30363d]" />
                          <p className="text-sm text-indigo-400 font-bold">{shieldFile?.name}</p>
                          <p className="text-xs text-gray-500">{(shieldFile?.size ? (shieldFile.size / (1024 * 1024)).toFixed(2) : 0)} MB</p>
                        </div>
                      ) : shieldFile ? (
                        <div className="flex flex-col items-center pointer-events-none">
                          <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-3">
                            <FileText className="text-indigo-500" size={32} />
                          </div>
                          <p className="text-sm text-indigo-400 font-bold">{shieldFile.name}</p>
                          <p className="text-xs text-gray-500">{(shieldFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                      ) : (
                        <div className="pointer-events-none">
                          <UploadCloud className="mx-auto text-indigo-500 mb-3" size={32} />
                          <p className="text-sm text-gray-300 font-medium">Clique ou arraste o arquivo aqui</p>
                          <p className="text-xs text-gray-500 mt-1">JPEG, PNG, MP4, MP3, PDF</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Autor / Signatário</label>
                      <input 
                        type="text" 
                        value={shieldAuthor} 
                        onChange={e => setShieldAuthor(e.target.value)} 
                        className="w-full bg-[#0d1117] text-white text-sm border border-[#30363d] rounded-lg p-2.5 focus:border-indigo-500 outline-none transition-colors" 
                        placeholder="Ex: Dr. Silva" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2">Organização</label>
                      <input 
                        type="text" 
                        value={shieldOrg} 
                        onChange={e => setShieldOrg(e.target.value)} 
                        className="w-full bg-[#0d1117] text-white text-sm border border-[#30363d] rounded-lg p-2.5 focus:border-indigo-500 outline-none transition-colors" 
                        placeholder="Ex: Universidade XYZ" 
                      />
                    </div>
                  </div>

                  <button disabled={isShielding} type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 mt-4">
                    {isShielding ? <Loader2 className="animate-spin" size={18} /> : <FileCheck size={18} />}
                    {isShielding ? 'A Injetar Criptografia C2PA...' : 'Assinar Criptograficamente'}
                  </button>
                </form>

                {shieldSuccess && (
                  <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center gap-2 text-emerald-400 text-sm font-semibold">
                    <CheckCircle2 size={16} /> Arquivo blindado e descarregado com sucesso!
                  </div>
                )}
              </div>
            </div>
          )}

          {}
          {activeTab === 'lens' && (
            <div className="space-y-6 animate-in fade-in duration-300">
               <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Eye className="text-amber-500" /> VerisignumLens
                </h2>
                <p className="text-sm text-gray-400 mt-1">Auditoria heurística de Deepfakes e decodificação C2PA. Submeta um arquivo suspeito para triagem.</p>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-lg max-w-2xl">
                <form onSubmit={handleLensScan} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Evidência / Arquivo Suspeito</label>
                    <div className="relative border-2 border-dashed border-[#30363d] hover:border-amber-500 bg-[#0d1117] rounded-xl p-8 text-center transition-colors">
                      <input 
                        type="file" 
                        onChange={(e) => setLensFile(e.target.files?.[0] || null)} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                        required 
                      />
                      
                      {lensPreview ? (
                        <div className="flex flex-col items-center pointer-events-none">
                          <img src={lensPreview} alt="Preview" className="max-h-40 rounded-lg shadow-md mb-3 object-contain border border-[#30363d]" />
                          <p className="text-sm text-amber-400 font-bold">{lensFile?.name}</p>
                          <p className="text-xs text-gray-500">{(lensFile?.size ? (lensFile.size / (1024 * 1024)).toFixed(2) : 0)} MB</p>
                        </div>
                      ) : lensFile ? (
                        <div className="flex flex-col items-center pointer-events-none">
                          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-3">
                            <FileText className="text-amber-500" size={32} />
                          </div>
                          <p className="text-sm text-amber-400 font-bold">{lensFile.name}</p>
                          <p className="text-xs text-gray-500">{(lensFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                      ) : (
                        <div className="pointer-events-none">
                          <Search className="mx-auto text-amber-500 mb-3" size={32} />
                          <p className="text-sm text-gray-300 font-medium">Selecione o ativo digital para inspeção</p>
                          <p className="text-xs text-gray-500 mt-1">Formatos suportados: JPEG, PNG, MP4, PDF</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <button disabled={isScanning} type="submit" className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                    {isScanning ? <Loader2 className="animate-spin" size={18} /> : <Eye size={18} />}
                    {isScanning ? scanStep : 'Auditar Arquivo no Motor Lens'}
                  </button>
                </form>

                {scanResult && (
                  <div className="mt-6 p-5 bg-[#0d1117] border border-[#30363d] rounded-xl animate-in fade-in slide-in-from-bottom-2">
                    <h4 className="text-white font-bold mb-4 flex items-center gap-2 border-b border-[#30363d] pb-2">
                      <Terminal size={16} className="text-gray-400" /> Relatório Pericial Forense
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-[#161b22] p-3 rounded-lg border border-[#30363d]">
                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Status C2PA</p>
                        <p className={`font-mono text-sm font-bold ${scanResult.has_c2pa ? 'text-emerald-400' : 'text-gray-300'}`}>
                          {scanResult.has_c2pa ? '✅ Assinatura Encontrada' : '❌ Ausente'}
                        </p>
                      </div>
                      <div className="bg-[#161b22] p-3 rounded-lg border border-[#30363d]">
                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Score Orgânico</p>
                        <p className={`font-mono text-lg font-bold ${scanResult.ai_analysis?.score > 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {scanResult.ai_analysis?.score}% Humano
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#161b22] p-3 rounded-lg border border-[#30363d]">
                      <p className="text-xs text-gray-500 uppercase font-bold mb-2">Anomalias Detectadas (Matriz de Pixels):</p>
                      <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                        {scanResult.ai_analysis?.anomalies?.map((an: string, i: number) => <li key={i}>{an}</li>)}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {}
          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Users className="text-indigo-500" /> Gestão de Tenants (B2B)
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Painel restrito para administração de contas e emissão de links de pagamento Stripe.</p>
                </div>
                <button onClick={() => fetchAdminClients(localStorage.getItem('access_token') || '')} className="flex items-center gap-2 px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded-lg text-xs font-semibold text-gray-300 hover:text-white transition-colors">
                  <Activity size={14} /> Atualizar
                </button>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-sm text-gray-400">
                  <thead className="bg-[#0d1117] border-b border-[#30363d] text-xs uppercase font-semibold">
                    <tr>
                      <th className="p-4">Instituição / Email</th>
                      <th className="p-4">Status & Stripe ID</th>
                      <th className="p-4">Uso Forense</th>
                      <th className="p-4">Ações (Faturação)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363d]">
                    {adminLoading ? (
                      <tr><td colSpan={4} className="p-8 text-center text-gray-500">A carregar banco de dados...</td></tr>
                    ) : adminClients.map(client => (
                      <tr key={client.id} className="hover:bg-[#21262d] transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white mb-0.5">{client.name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1.5"><Key size={12}/> {client.api_key ? `${client.api_key.substring(0, 15)}...` : 'Sem chave'}</div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${client.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {client.is_active ? '✅ Pagamento Ativo' : '❌ Inativo / Trial'}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-gray-300">{client.usage_count} processamentos</td>
                        <td className="p-4">
                          <button className="flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded border border-indigo-500/20 transition-all">
                             <CreditCard size={14} /> Emitir Fatura
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {}
          {activeTab === 'api' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Code className="text-indigo-500" /> API Developer Hub
                </h2>
                <p className="text-sm text-gray-400 mt-1">Acesso à documentação de integração, chaves de API e configuração do Model Context Protocol (MCP).</p>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg p-6">
                 <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">A Sua Chave de Acesso Corporativa</h3>
                      <p className="text-xs text-gray-400">Utilize esta chave para autenticar requisições HTTP e Agentes MCP.</p>
                    </div>
                    <button 
                      onClick={() => safeCopyToClipboard(clientData?.api_key || '', 'key')}
                      className="flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-2 rounded-lg border border-indigo-500/20 transition-all"
                    >
                      <Key size={14} /> {copyStatus.key ? 'Copiada com Sucesso!' : 'Copiar API Key Secreta'}
                    </button>
                 </div>
                 
                 <div className="bg-[#0d1117] p-4 rounded-lg border border-[#30363d] font-mono text-sm text-emerald-400 flex items-center gap-3">
                    <Lock size={16} className="text-gray-500" />
                    {clientData?.api_key || 'Chave não disponível'}
                 </div>
              </div>
              
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  <strong>Proteja as suas credenciais:</strong> A sua API Key dá acesso direto ao processamento forense e ao faturamento. Nunca a exponha em repositórios públicos.
                </p>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg mt-8">
                <div className="border-b border-[#30363d] bg-[#0d1117] p-4 flex items-center gap-2">
                    <Terminal size={18} className="text-gray-400" />
                    <span className="text-sm font-mono font-semibold text-gray-300">Integração MCP (Model Context Protocol)</span>
                </div>
                
                <div className="p-6 md:p-8 space-y-6">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-semibold mb-4">
                      <Sparkles size={12} /> 100% MCP READY
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-3xl">
                      Integre a inteligência forense da Verisignum diretamente aos seus Agentes de Inteligência Artificial internos e ao Claude Desktop.
                    </p>
                  </div>
                  
                  <div className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d] text-sm font-mono text-gray-300 relative group overflow-x-auto">
                    <pre>
{`{
  "mcpServers": {
    "verisignum": {
      "command": "uv",
      "args": ["run", "--with", "mcp", "--with", "httpx", "/caminho/mcp_server.py"],
      "env": { "VERISIGNUM_API_KEY": "${clientData?.api_key || 'SUA_CHAVE_AQUI'}" }
    }
  }
}`}
                    </pre>
                    <button 
                          onClick={() => safeCopyToClipboard(`{"mcpServers": {"verisignum": {"command": "uv", "args": ["run", "--with", "mcp", "--with", "httpx", "/caminho/mcp_server.py"], "env": { "VERISIGNUM_API_KEY": "${clientData?.api_key || ''}" }}}}`, 'mcp')}
                          className="absolute top-3 right-3 p-2 bg-[#21262d] text-gray-400 hover:text-white rounded-md border border-[#30363d] opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                        >
                          <Copy size={16} />
                    </button>
                  </div>
                  
                  <div className="pt-4 flex">
                     <button className="flex items-center gap-2 px-5 py-2.5 bg-[#21262d] hover:bg-[#30363d] text-white text-sm font-semibold rounded-lg border border-[#30363d] transition-all shadow-sm">
                       <ExternalLink size={16} className="text-gray-400" />
                       Descarregar mcp_server.py
                     </button>
                  </div>
                </div>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg mt-8">
                <div className="border-b border-[#30363d] bg-[#0d1117] p-4 flex items-center gap-2">
                    <Monitor size={18} className="text-gray-400" />
                    <span className="text-sm font-mono font-semibold text-gray-300">Verisignum Local Agent (Desktop)</span>
                </div>
                <div className="p-6 md:p-8">
                   <p className="text-sm text-gray-400 leading-relaxed mb-6">
                      Descarregue o nosso Agente Local para processar pastas inteiras no seu computador de forma automática.
                    </p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#0d1117] border border-[#30363d] p-6 rounded-xl flex flex-col items-center text-center hover:border-indigo-500/50 transition-colors">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                        <Monitor size={24} className="text-blue-400" />
                      </div>
                      <h4 className="text-white font-semibold mb-1">Windows (64-bit)</h4>
                      <p className="text-xs text-gray-500 mb-6">Compatível com Windows 10 e 11.</p>
                      <button onClick={() => downloadFakeExecutable('windows')} className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors">
                        <Download size={16} /> Download .EXE
                      </button>
                    </div>
                    <div className="bg-[#0d1117] border border-[#30363d] p-6 rounded-xl flex flex-col items-center text-center hover:border-indigo-500/50 transition-colors">
                      <div className="w-12 h-12 bg-gray-500/10 rounded-full flex items-center justify-center mb-4">
                        <Monitor size={24} className="text-gray-400" />
                      </div>
                      <h4 className="text-white font-semibold mb-1">macOS (Intel/Silicon)</h4>
                      <p className="text-xs text-gray-500 mb-6">Compatível com macOS 12+.</p>
                      <button onClick={() => downloadFakeExecutable('mac')} className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 bg-[#30363d] hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors">
                        <Download size={16} /> Download .APP
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-[#30363d]">
                    <button onClick={downloadManual} className="w-full flex items-center justify-center gap-2 py-3 bg-[#21262d] hover:bg-[#30363d] text-gray-300 text-sm font-semibold rounded-lg border border-[#30363d] transition-colors">
                      <FileText size={18} /> Baixar Guia de Instalação do Agente (Manual em PDF/MD)
                    </button>
                  </div>

                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}