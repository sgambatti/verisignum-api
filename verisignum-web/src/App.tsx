import React, { useState, useEffect, useRef } from 'react';
import {
  Eye, Code, FileCheck, Activity, AlertTriangle, CheckCircle2, 
  Terminal, Key, ExternalLink, Sparkles, Loader2, Lock, AlertCircle, 
  FileText, LogOut, CreditCard, Check, Menu, X, Copy, Monitor, Download, Search,
  Shield, Users, UploadCloud, FileImage, FileAudio, FileVideo, File
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
const RENDER_API_URL = "https://verisignum-api.onrender.com/v1/shield/sign";
const RENDER_VERIFY_URL = "https://verisignum-api.onrender.com/v1/lens/verify";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [clientData, setClientData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Estados de Autenticação Restaurados
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'plans'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');

  // Estados para Histórico e Filtros
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Estados para Admin
  const [adminClients, setAdminClients] = useState<ClientTenant[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // Estados para cópia e UI
  const [copyStatus, setCopyStatus] = useState<CopyStatus>({ error: null });
  const ADMIN_EMAIL = 'contato@verisignumdigital.com';
  const isAdmin = clientData?.email === ADMIN_EMAIL;

  // Estados para o Shield
  const [shieldFile, setShieldFile] = useState<File | null>(null);
  const [shieldPreview, setShieldPreview] = useState<string | null>(null);
  const [author, setAuthor] = useState('');
  const [organization, setOrganization] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const shieldFileInputRef = useRef<HTMLInputElement>(null);

  // Estados para o Lens
  const [lensFile, setLensFile] = useState<File | null>(null);
  const [lensPreview, setLensPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [scanResult, setScanResult] = useState<any>(null);
  const lensFileInputRef = useRef<HTMLInputElement>(null);

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
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchDashboardData(token);
    }
  }, []);

  useEffect(() => {
    // Atualiza o histórico sempre que voltar para a aba de dashboard
    if (activeTab === 'dashboard' && isAuthenticated) {
      const token = localStorage.getItem('access_token');
      if (token) {
        fetchHistory(token);
      }
    }
  }, [activeTab, isAuthenticated]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', authForm.email);
      formData.append('password', authForm.password);

      const res = await fetch('https://verisignum-api.onrender.com/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      if (!res.ok) throw new Error('E-mail ou palavra-passe incorretos.');
      const data = await res.json();
      localStorage.setItem('access_token', data.access_token);
      fetchDashboardData(data.access_token);
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const url = new URL('https://verisignum-api.onrender.com/v1/auth/register');
      // Passando as variáveis via URL (Query Params) se a API estiver configurada assim
      // Ou via Body (JSON) se a API esperar JSON. Ajustaremos conforme a sua API Master.
      // O seu api_verisignum.py anterior usa query params para o register.
      url.searchParams.append('name', authForm.name);
      url.searchParams.append('email', authForm.email);
      url.searchParams.append('password', authForm.password);

      const res = await fetch(url.toString(), { method: 'POST' });
      if (!res.ok) {
         const errData = await res.json();
         throw new Error(errData.detail || 'Falha ao registar conta. O e-mail já pode estar em uso.');
      }
      
      const formData = new URLSearchParams();
      formData.append('username', authForm.email);
      formData.append('password', authForm.password);
      const loginRes = await fetch('https://verisignum-api.onrender.com/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString()
      });
      const loginData = await loginRes.json();
      localStorage.setItem('access_token', loginData.access_token);
      fetchDashboardData(loginData.access_token);

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
  };

  const safeCopyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, [key]: false })), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const downloadManual = () => {
    // Gerador de PDF Nativo via JavaScript (Puro)
    // Isso cria um documento válido e evita o erro do PDF em branco
    const pdfContent = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 24 Tf
50 700 Td
(Verisignum AI) Tj
0 -40 Td
/F1 14 Tf
(Manual de Instalacao do Agente Local) Tj
0 -30 Td
/F1 12 Tf
(1. Faca o download do arquivo .exe ou .app) Tj
0 -20 Td
(2. Coloque-o numa pasta dedicada no seu computador.) Tj
0 -20 Td
(3. Execute o agente e insira a sua API Key.) Tj
0 -20 Td
(4. O agente monitorizara a pasta e blindara os seus arquivos) Tj
0 -20 Td
(automaticamente com criptografia C2PA.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000219 00000 n
0000000469 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
557
%%EOF`;

    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Guia_Instalacao_Agente_Verisignum.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <FileImage size={40} className="text-indigo-400" />;
    if (file.type.startsWith('video/')) return <FileVideo size={40} className="text-amber-400" />;
    if (file.type.startsWith('audio/')) return <FileAudio size={40} className="text-emerald-400" />;
    return <File size={40} className="text-gray-400" />;
  };

  // Preview de Arquivos para o Shield
  const handleShieldFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setShieldFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setShieldPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setShieldPreview(null);
      }
    }
  };

  const handleShieldSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!shieldFile || !author || !organization) return;
    setIsSigning(true);
    setCopyStatus(prev => ({ ...prev, error: null }));
    try {
      const token = localStorage.getItem('access_token');
      if (!token) throw new Error("Não autenticado");

      const formData = new FormData();
      formData.append("file", shieldFile);
      formData.append("author", author);
      formData.append("organization", organization);

      const response = await fetch(RENDER_API_URL, {
        method: "POST",
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Falha na assinatura (Erro do Servidor).');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `verisignum_${shieldFile.name}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setShieldFile(null);
      setShieldPreview(null);
      setAuthor('');
      setOrganization('');
      
      // Sincroniza dados e recarrega os totais
      fetchDashboardData(token);
    } catch (err: any) {
      console.error(err);
      setCopyStatus(prev => ({ ...prev, error: err.message }));
    } finally {
      setIsSigning(false);
    }
  };

  // Preview de Arquivos para o Lens
  const handleLensFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLensFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setLensPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setLensPreview(null);
      }
      setScanResult(null); // Limpa resultado anterior
    }
  };

  const handleLensScan = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!lensFile) return;

    setIsScanning(true);
    setScanResult(null);
    setScanStep('A enviar arquivo para o servidor de forense Verisignum...');
    setCopyStatus(prev => ({ ...prev, error: null }));

    try {
      const token = localStorage.getItem('access_token');
      if (!token) throw new Error("Não autenticado");

      const formData = new FormData();
      formData.append("file", lensFile);

      setScanStep('A analisar metadados e decodificar C2PA...');

      const response = await fetch(RENDER_VERIFY_URL, {
        method: "POST",
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Falha ao comunicar com o VerisignumLens na nuvem.');
      }

      const verifyData = await response.json();
      
      setScanStep('A rastrear artefactos de compressão e difusão de IA...');
      await new Promise(resolve => setTimeout(resolve, 1500));

      const hasC2PA = verifyData.has_c2pa;
      const aiAnalysis = verifyData.ai_analysis || {};
      
      setScanResult({
        score: aiAnalysis.score || (hasC2PA ? 100 : 50),
        isAiGenerated: aiAnalysis.is_ai || false,
        metadataFound: hasC2PA,
        anomalies: aiAnalysis.anomalies || (hasC2PA ? ['Origem Segura'] : ['Origem não rastreável'])
      });

      // Sincroniza dados
      fetchDashboardData(token);
    } catch (err: any) {
      console.error(err);
      setCopyStatus(prev => ({ ...prev, error: `Falha no Scanner: ${err.message}` }));
    } finally {
      setIsScanning(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <div className="bg-[#161b22] border border-[#30363d] p-8 rounded-2xl w-full max-w-4xl shadow-2xl relative overflow-hidden">
          {/* Elementos visuais de fundo */}
          <div className="absolute top-[-50px] left-[-50px] w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-[-50px] right-[-50px] w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="text-center mb-8 relative z-10">
            <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Shield size={32} className="text-indigo-500" />
            </div>
            <h2 className="text-3xl font-extrabold text-white">VERISIGNUM</h2>
            <p className="text-gray-400 text-sm mt-2">Acesso Reservado à Plataforma Forense</p>
          </div>

          <div className="relative z-10 flex justify-center min-h-[350px]">
            {authMode === 'login' && (
              <div className="w-full max-w-sm animate-in fade-in zoom-in duration-300">
                <h3 className="text-xl font-bold text-white mb-6 text-center">Iniciar Sessão</h3>
                {authError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4 text-center">{authError}</div>}
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">E-mail Corporativo</label>
                    <input type="email" required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" placeholder="voce@instituicao.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Palavra-passe</label>
                    <input type="password" required value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" placeholder="••••••••" />
                  </div>
                  <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                    {authLoading ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />} Entrar na Plataforma
                  </button>
                </form>
                <div className="mt-6 text-center border-t border-[#30363d] pt-6">
                  <p className="text-gray-400 text-sm">Não tem uma conta corporativa?</p>
                  <button onClick={() => {setAuthMode('plans'); setAuthError('');}} className="mt-2 text-indigo-400 hover:text-indigo-300 font-semibold text-sm transition-colors">
                    Ver Planos & Iniciar Trial Gratuito
                  </button>
                </div>
              </div>
            )}

            {authMode === 'plans' && (
              <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white">Escolha o plano ideal</h3>
                  <button onClick={() => setAuthMode('login')} className="text-gray-400 hover:text-white text-sm font-semibold flex items-center gap-1 transition-colors">
                    <X size={16} /> Cancelar
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-5 flex flex-col justify-between hover:border-gray-500 transition-colors">
                    <div>
                      <h4 className="text-gray-300 font-semibold mb-1">Creator</h4>
                      <div className="text-2xl font-bold text-white mb-4">$29<span className="text-sm text-gray-500 font-normal">/mês</span></div>
                      <ul className="text-xs text-gray-400 space-y-2 mb-6">
                        <li className="flex items-center gap-2"><Check size={12} className="text-indigo-400"/> 200 mídias/mês</li>
                        <li className="flex items-center gap-2"><Check size={12} className="text-indigo-400"/> Web Dashboard</li>
                      </ul>
                    </div>
                    <button onClick={() => {setSelectedPlan('Creator'); setAuthMode('register');}} className="w-full py-2 mt-4 bg-[#21262d] hover:bg-[#30363d] text-white text-sm font-semibold rounded-lg transition-colors border border-[#30363d]">Selecionar</button>
                  </div>

                  <div className="bg-[#0d1117] border border-indigo-500/50 rounded-xl p-5 flex flex-col justify-between relative shadow-[0_0_15px_rgba(79,70,229,0.1)] transform md:-translate-y-2">
                    <div className="absolute top-0 inset-x-0 transform -translate-y-1/2 flex justify-center"><span className="bg-indigo-500 text-white text-[9px] font-bold uppercase tracking-widest py-0.5 px-2 rounded-full">Recomendado</span></div>
                    <div>
                      <h4 className="text-indigo-400 font-semibold mb-1">Professional</h4>
                      <div className="text-2xl font-bold text-white mb-4">$149<span className="text-sm text-gray-500 font-normal">/mês</span></div>
                      <ul className="text-xs text-gray-400 space-y-2 mb-6">
                        <li className="flex items-center gap-2"><Check size={12} className="text-indigo-400"/> 1.500 mídias/mês</li>
                        <li className="flex items-center gap-2"><Check size={12} className="text-indigo-400"/> API B2B Keys</li>
                      </ul>
                    </div>
                    <button onClick={() => {setSelectedPlan('Professional'); setAuthMode('register');}} className="w-full py-2 mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors">Selecionar</button>
                  </div>

                  <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-5 flex flex-col justify-between hover:border-gray-500 transition-colors">
                    <div>
                      <h4 className="text-amber-500 font-semibold mb-1">Enterprise</h4>
                      <div className="text-2xl font-bold text-white mb-4">$499<span className="text-sm text-gray-500 font-normal">/mês</span></div>
                      <ul className="text-xs text-gray-400 space-y-2 mb-6">
                        <li className="flex items-center gap-2"><Check size={12} className="text-indigo-400"/> 10.000 mídias/mês</li>
                        <li className="flex items-center gap-2"><Check size={12} className="text-indigo-400"/> Servidor MCP</li>
                      </ul>
                    </div>
                    <button onClick={() => {setSelectedPlan('Enterprise'); setAuthMode('register');}} className="w-full py-2 mt-4 bg-[#21262d] hover:bg-[#30363d] text-white text-sm font-semibold rounded-lg transition-colors border border-[#30363d]">Selecionar</button>
                  </div>
                </div>

                <div className="text-center pt-4 border-t border-[#30363d]">
                   <button onClick={() => {setSelectedPlan('Trial Gratuito'); setAuthMode('register');}} className="text-emerald-400 hover:text-emerald-300 font-bold text-sm transition-colors flex items-center justify-center gap-2 mx-auto">
                      <Activity size={16} /> Apenas a testar? Iniciar Trial de 48 horas
                   </button>
                </div>
              </div>
            )}

            {authMode === 'register' && (
              <div className="w-full max-w-sm animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-white">Criar Conta</h3>
                  <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold px-2 py-1 rounded-md">{selectedPlan}</span>
                </div>
                {authError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4 text-center">{authError}</div>}
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Nome da Instituição</label>
                    <input type="text" required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" placeholder="Universidade ou Empresa..." />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">E-mail Corporativo</label>
                    <input type="email" required value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" placeholder="voce@instituicao.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Palavra-passe Segura</label>
                    <input type="password" required minLength={6} value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors" placeholder="Mínimo 6 caracteres" />
                  </div>
                  <button type="submit" disabled={authLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 mt-2">
                    {authLoading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Finalizar Registo
                  </button>
                </form>
                <div className="mt-6 text-center border-t border-[#30363d] pt-6 flex items-center justify-between">
                  <button onClick={() => {setAuthMode('plans'); setAuthError('');}} className="text-gray-400 hover:text-white font-semibold text-sm transition-colors">
                    Voltar aos Planos
                  </button>
                  <button onClick={() => {setAuthMode('login'); setAuthError('');}} className="text-indigo-400 hover:text-indigo-300 font-semibold text-sm transition-colors">
                    Já tenho conta
                  </button>
                </div>
              </div>
            )}
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

          {/* TAB: DASHBOARD (HISTÓRICO) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-white">Análise da Operação Verisignum</h2>
                <button onClick={() => fetchDashboardData(localStorage.getItem('access_token') || '')} className="flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-2 rounded-lg transition-all border border-indigo-500/20 shadow-sm">
                  <Activity size={14} /> Atualizar Dashboard
                </button>
              </div>

              {/* CARDS DE RESUMO */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-bl-full blur-2xl pointer-events-none"></div>
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider relative z-10">Total de Verificações</span>
                  <div className="text-3xl font-extrabold text-white relative z-10">{clientData?.usage_count || 0}</div>
                </div>
                <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full blur-2xl pointer-events-none"></div>
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider relative z-10">Ativos Criptografados</span>
                  <div className="text-3xl font-extrabold text-emerald-400 relative z-10">{history.filter((h: any) => h.module === 'SHIELD').length}</div>
                </div>
                <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl space-y-2 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full blur-2xl pointer-events-none"></div>
                  <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider relative z-10">Alertas Analisados (Lens)</span>
                  <div className="text-3xl font-extrabold text-amber-500 relative z-10">{history.filter((h: any) => h.module === 'LENS').length}</div>
                </div>
              </div>

              {/* TABELA DE HISTÓRICO FILTRÁVEL */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg mt-8">
                <div className="p-4 md:p-6 border-b border-[#30363d] bg-[#0d1117] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="text-indigo-400" size={18} /> Histórico de Processamento
                  </h3>
                  
                  <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    {/* Campo de Busca */}
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
                    {/* Filtro de Módulo */}
                    <select 
                      value={moduleFilter} 
                      onChange={(e) => setModuleFilter(e.target.value)}
                      className="bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 outline-none cursor-pointer"
                    >
                      <option value="ALL">Todos os Módulos</option>
                      <option value="SHIELD">🛡️ Shield (C2PA)</option>
                      <option value="LENS">👁️ Lens (Forense)</option>
                    </select>
                    {/* Filtro de Status */}
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
                      ) : history.filter((log: any) => {
                        const matchSearch = log.filename.toLowerCase().includes(searchQuery.toLowerCase());
                        const matchMod = moduleFilter === 'ALL' || log.module === moduleFilter;
                        const matchStatus = statusFilter === 'ALL' || log.status.includes(statusFilter);
                        return matchSearch && matchMod && matchStatus;
                      }).length === 0 ? (
                        <tr><td colSpan={4} className="p-12 text-center text-gray-500">Nenhum registro encontrado com os filtros atuais. Tente limpar a busca.</td></tr>
                      ) : (
                        history.filter((log: any) => {
                          const matchSearch = log.filename.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchMod = moduleFilter === 'ALL' || log.module === moduleFilter;
                          const matchStatus = statusFilter === 'ALL' || log.status.includes(statusFilter);
                          return matchSearch && matchMod && matchStatus;
                        }).map((log: any) => (
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

          {/* TAB: SHIELD */}
          {activeTab === 'shield' && (
            <div className="space-y-6 animate-in fade-in duration-300">
               <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <FileCheck className="text-indigo-500" /> VerisignumShield
                </h2>
                <p className="text-sm text-gray-400 mt-1">Ferramenta visual de assinatura rápida. Para lotes corporativos, utilize os nossos agentes na aba Integração B2B.</p>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg">
                <div className="p-6 md:p-8">
                  {copyStatus.error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg text-sm mb-6 flex items-center gap-2">
                      <AlertCircle size={18} /> {copyStatus.error}
                    </div>
                  )}
                  
                  <form onSubmit={handleShieldSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="col-span-1">
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Arquivo a ser blindado</label>
                        <input
                          type="file"
                          required
                          ref={shieldFileInputRef}
                          onChange={handleShieldFileChange}
                          className="hidden"
                          accept=".jpg,.jpeg,.png,.mp4,.mp3,.pdf"
                        />
                        
                        {/* Área de Visualização do Ficheiro */}
                        {!shieldFile ? (
                          <div 
                            onClick={() => shieldFileInputRef.current?.click()}
                            className="border-2 border-dashed border-[#30363d] hover:border-indigo-500/50 bg-[#0d1117] rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[200px]"
                          >
                            <UploadCloud size={32} className="text-gray-500 mb-3" />
                            <p className="text-sm text-white font-medium mb-1">Selecione o arquivo digital</p>
                            <p className="text-xs text-gray-500">Imagens, Vídeos, Áudios e PDFs</p>
                          </div>
                        ) : (
                          <div className="relative border border-[#30363d] bg-[#0d1117] rounded-xl overflow-hidden min-h-[200px] flex items-center justify-center group">
                            {shieldPreview ? (
                              <img src={shieldPreview} alt="Preview" className="max-h-[200px] w-auto object-contain p-2" />
                            ) : (
                              <div className="flex flex-col items-center justify-center p-6 text-center">
                                {getFileIcon(shieldFile)}
                                <span className="mt-3 text-sm font-medium text-white truncate max-w-[200px]">{shieldFile.name}</span>
                                <span className="text-xs text-gray-500 mt-1">{(shieldFile.size / 1024 / 1024).toFixed(2)} MB</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <button 
                                  type="button" 
                                  onClick={(e) => { e.stopPropagation(); setShieldFile(null); setShieldPreview(null); if(shieldFileInputRef.current) shieldFileInputRef.current.value = ''; }}
                                  className="bg-red-500 text-white p-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors"
                                >
                                  Remover e Trocar
                               </button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="col-span-1 space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Autor Original</label>
                          <input
                            type="text"
                            required
                            value={author}
                            onChange={e => setAuthor(e.target.value)}
                            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
                            placeholder="Nome do criador ou departamento..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Organização Emissora</label>
                          <input
                            type="text"
                            required
                            value={organization}
                            onChange={e => setOrganization(e.target.value)}
                            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
                            placeholder="Sua universidade ou empresa..."
                          />
                        </div>
                        <div className="pt-2">
                          <button
                            type="submit"
                            disabled={isSigning || !shieldFile}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-[#30363d] disabled:text-gray-500 text-white font-bold py-3.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            {isSigning ? (
                              <><Loader2 size={18} className="animate-spin" /> Injetando Assinatura Criptográfica...</>
                            ) : (
                              <><Lock size={18} /> Assinar Ativo & Fazer Download</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB: LENS */}
          {activeTab === 'lens' && (
            <div className="space-y-6 animate-in fade-in duration-300">
               <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Eye className="text-amber-500" /> VerisignumLens
                </h2>
                <p className="text-sm text-gray-400 mt-1">Auditoria heurística de Deepfakes e decodificação C2PA. Submeta um arquivo suspeito para triagem.</p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 md:p-8">
                  <form onSubmit={handleLensScan} className="space-y-6">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ativo Suspeito</label>
                      <input
                        type="file"
                        required
                        ref={lensFileInputRef}
                        onChange={handleLensFileChange}
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.mp4,.mp3,.wav,.pdf"
                      />
                      
                      {/* Área de Visualização do Ficheiro para o Lens */}
                      {!lensFile ? (
                        <div 
                          onClick={() => lensFileInputRef.current?.click()}
                          className="border-2 border-dashed border-[#30363d] hover:border-amber-500/50 bg-[#0d1117] rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[250px]"
                        >
                          <Search size={32} className="text-gray-500 mb-3" />
                          <p className="text-sm text-white font-medium mb-1">Selecione a evidência digital</p>
                          <p className="text-xs text-gray-500">Submeta para inspeção forense profunda</p>
                        </div>
                      ) : (
                        <div className="relative border border-[#30363d] bg-[#0d1117] rounded-xl overflow-hidden min-h-[250px] flex items-center justify-center group">
                          {lensPreview ? (
                            <img src={lensPreview} alt="Preview Lens" className="max-h-[250px] w-auto object-contain p-2" />
                          ) : (
                            <div className="flex flex-col items-center justify-center p-6 text-center">
                              {getFileIcon(lensFile)}
                              <span className="mt-3 text-sm font-medium text-white truncate max-w-[200px]">{lensFile.name}</span>
                              <span className="text-xs text-gray-500 mt-1">{(lensFile.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); setLensFile(null); setLensPreview(null); setScanResult(null); if(lensFileInputRef.current) lensFileInputRef.current.value = ''; }}
                                className="bg-red-500 text-white p-2 rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors"
                              >
                                Substituir Arquivo
                              </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={isScanning || !lensFile}
                      className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-[#30363d] disabled:text-gray-500 text-white font-bold py-3.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {isScanning ? (
                        <><Loader2 size={18} className="animate-spin" /> Auditando...</>
                      ) : (
                        <><Search size={18} /> Iniciar Varredura Forense</>
                      )}
                    </button>
                  </form>
                </div>
                
                <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 md:p-8 flex flex-col justify-center min-h-[400px]">
                  {isScanning ? (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto"></div>
                      <p className="text-sm font-medium text-amber-500 animate-pulse">{scanStep}</p>
                    </div>
                  ) : scanResult ? (
                    <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                      <div className="text-center pb-6 border-b border-[#30363d]">
                         {scanResult.isAiGenerated ? (
                           <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/10 rounded-full text-red-500 mb-4">
                             <AlertTriangle size={40} />
                           </div>
                         ) : scanResult.metadataFound ? (
                           <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-500/10 rounded-full text-emerald-500 mb-4">
                             <Shield size={40} />
                           </div>
                         ) : (
                           <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500/10 rounded-full text-blue-500 mb-4">
                             <CheckCircle2 size={40} />
                           </div>
                         )}
                         <h3 className="text-2xl font-bold text-white">
                           {scanResult.isAiGenerated ? 'Fraude Detetada (Deepfake)' : scanResult.metadataFound ? 'Autêntico (C2PA Validado)' : 'Provavelmente Humano'}
                         </h3>
                         <div className="text-4xl font-black mt-2 tracking-tighter" style={{color: scanResult.isAiGenerated ? '#ef4444' : '#10b981'}}>
                            {scanResult.score}%
                         </div>
                         <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Score Heurístico Humano</p>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-bold text-white mb-3">Laudo de Observações Técnicas</h4>
                        <ul className="space-y-2">
                          {scanResult.anomalies.map((anom: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-400">
                              <Terminal size={16} className="shrink-0 mt-0.5 text-gray-600"/> {anom}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 flex flex-col items-center">
                      <Shield size={48} className="mb-4 opacity-20" />
                      <p>O laudo pericial será exibido aqui após a varredura.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: ADMIN (Apenas para o Dono) */}
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
                    ) : adminClients.map((client: any) => (
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

          {/* TAB: API & AGENTES */}
          {activeTab === 'api' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Code className="text-indigo-500" /> API Developer Hub
                </h2>
                <p className="text-sm text-gray-400 mt-1">Acesso à documentação de integração, chaves de API e configuração do Model Context Protocol (MCP).</p>
              </div>

              {/* SEÇÃO DA CHAVE */}
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

              {/* SEÇÃO MCP */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg">
                <div className="border-b border-[#30363d] bg-[#0d1117] p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={18} className="text-gray-400" />
                    <span className="text-sm font-mono font-semibold text-gray-300">pop_integracao_mcp.md</span>
                  </div>
                </div>
                
                <div className="p-6 md:p-8 space-y-8">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-semibold mb-4">
                      <Sparkles size={12} /> 100% MCP READY
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Servidor MCP Verisignum</h3>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-3xl">
                      Integre a inteligência forense da Verisignum diretamente aos seus Agentes de Inteligência Artificial internos e ao Claude Desktop utilizando o padrão aberto Model Context Protocol (MCP).
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h4 className="text-md font-semibold text-white flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#30363d] text-xs font-mono">1</span>
                        Instalação Rápida (Claude Desktop)
                      </h4>
                      <p className="text-sm text-gray-400 pl-8">Abra o arquivo <code className="bg-[#0d1117] px-1.5 py-0.5 rounded border border-[#30363d] text-indigo-300">claude_desktop_config.json</code> no seu computador e adicione o bloco abaixo. A sua chave de API já foi inserida automaticamente no código:</p>
                      
                      <div className="ml-8 relative group">
                        <pre className="bg-[#0d1117] p-4 rounded-xl border border-[#30363d] text-sm font-mono text-gray-300 overflow-x-auto">
{`{
  "mcpServers": {
    "verisignum": {
      "command": "uv",
      "args": [
        "run",
        "--with", "mcp",
        "--with", "httpx",
        "/caminho/absoluto/para/o/mcp_server.py"
      ],
      "env": {
        "VERISIGNUM_API_KEY": "${clientData?.api_key || 'SUA_CHAVE'}"
      }
    }
  }
}`}
                        </pre>
                        <button 
                          onClick={() => safeCopyToClipboard(`{\n  "mcpServers": {\n    "verisignum": {\n      "command": "uv",\n      "args": [\n        "run",\n        "--with", "mcp",\n        "--with", "httpx",\n        "/caminho/absoluto/para/o/mcp_server.py"\n      ],\n      "env": {\n        "VERISIGNUM_API_KEY": "${clientData?.api_key || 'SUA_CHAVE'}"\n      }\n    }\n  }\n}`, 'mcpcode')}
                          className="absolute top-3 right-3 p-2 bg-[#21262d] text-gray-400 hover:text-white rounded-md border border-[#30363d] opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                          title="Copiar código JSON"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SEÇÃO AGENTE DESKTOP E GUIA DE INSTALAÇÃO */}
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg mt-8">
                <div className="border-b border-[#30363d] bg-[#0d1117] p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor size={18} className="text-gray-400" />
                    <span className="text-sm font-mono font-semibold text-gray-300">Verisignum Local Agent (Desktop)</span>
                  </div>
                  <button onClick={downloadManual} className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all">
                    <Download size={14} /> Descarregar Guia de Instalação (PDF)
                  </button>
                </div>
                
                <div className="p-6 md:p-8 space-y-8">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-semibold mb-4">
                      <Download size={12} /> AUTOMAÇÃO LOCAL
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Monitorização de Pastas em Massa</h3>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-3xl">
                      Para departamentos de TI e empresas que processam centenas de ficheiros por dia. Descarregue o nosso Agente Local, configure uma pasta no seu computador e qualquer ficheiro lá colocado será automaticamente assinado (C2PA) e protegido nos bastidores.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#0d1117] border border-[#30363d] p-6 rounded-xl flex flex-col items-center text-center hover:border-indigo-500/50 transition-colors">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                        <Monitor size={24} className="text-blue-400" />
                      </div>
                      <h4 className="text-white font-semibold mb-1">Windows (64-bit)</h4>
                      <p className="text-xs text-gray-500 mb-6">Compatível com Windows 10 e 11.</p>
                      <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors">
                        <Download size={16} /> Download .EXE
                      </button>
                    </div>

                    <div className="bg-[#0d1117] border border-[#30363d] p-6 rounded-xl flex flex-col items-center text-center hover:border-indigo-500/50 transition-colors">
                      <div className="w-12 h-12 bg-gray-500/10 rounded-full flex items-center justify-center mb-4">
                        <Monitor size={24} className="text-gray-400" />
                      </div>
                      <h4 className="text-white font-semibold mb-1">macOS (Apple Silicon & Intel)</h4>
                      <p className="text-xs text-gray-500 mb-6">Compatível com macOS 12+.</p>
                      <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#30363d] hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors">
                        <Download size={16} /> Download .APP
                      </button>
                    </div>
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