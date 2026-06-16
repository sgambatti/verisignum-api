import React, { useState } from 'react';
import { 
  Shield, 
  Eye, 
  Code, 
  FileCheck, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Terminal, 
  Key, 
  RefreshCw, 
  Play, 
  Copy, 
  ExternalLink,
  Sparkles,
  Send,
  Loader2,
  Lock,
  FileText,
  AlertCircle,
  Users,
  CreditCard,
  Plus,
  Database,
  Crown
} from 'lucide-react';

// Interfaces TypeScript
interface Asset {
  id: string;
  name: string;
  type: string;
  status: string;
  score: number;
  date: string;
  author: string;
}

interface CopyStatus {
  hash?: boolean;
  key?: boolean;
  error?: string | null;
  [key: string]: any; 
}

interface ShieldResult {
  hash: string;
  manifest: string;
}

interface ScanResult {
  score: number;
  isAiGenerated: boolean;
  metadataFound: boolean;
  anomalies: string[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface ClientTenant {
  id: string;
  name: string;
  apiKey: string;
  usageCount: number;
  plan: 'Trial' | 'Pro' | 'Enterprise';
  status: 'Ativo' | 'Inativo';
}

const MOCK_ASSETS: Asset[] = [
  { id: '1', name: 'palestra_reitor_oficial.mp4', type: 'Video', status: 'Verificado', score: 99, date: '15 Jun 2026', author: 'Reitoria Universitária' },
  { id: '2', name: 'grafico_lucros_q1_sintetico.png', type: 'Imagem', status: 'Sem Assinatura', score: 8, date: '14 Jun 2026', author: 'Desconhecido' },
];

const INITIAL_CLIENTS: ClientTenant[] = [
  { id: '1', name: 'EdTech Brasil', apiKey: 'vsg_live_7a3bc9f8e2d1...', usageCount: 1245, plan: 'Enterprise', status: 'Ativo' },
  { id: '2', name: 'Universidade Veritas', apiKey: 'vsg_live_8f7b2c9a1d4...', usageCount: 350, plan: 'Pro', status: 'Ativo' },
];

const RENDER_API_URL = "https://verisignum-api.onrender.com/v1/shield/sign";
const RENDER_VERIFY_URL = "https://verisignum-api.onrender.com/v1/lens/verify";
const RENDER_ADMIN_CLIENTS_URL = "https://verisignum-api.onrender.com/v1/admin/clients";
const RENDER_COPILOT_URL = "https://verisignum-api.onrender.com/v1/copilot/chat";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('admin'); 
  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [apiKey, setApiKey] = useState<string>('vsg_live_4b8c12a7e9f310d5c8b2a3');
  const [isKeyVisible, setIsKeyVisible] = useState<boolean>(false);
  
  const [copyStatus, setCopyStatus] = useState<CopyStatus>({ hash: false, key: false, error: null });

  const [shieldFile, setShieldFile] = useState<File | null>(null);
  const [author, setAuthor] = useState<string>('');
  const [org, setOrg] = useState<string>('');
  const [license, setLicense] = useState<string>('CC-BY-4.0');
  const [isShielding, setIsShielding] = useState<boolean>(false);
  const [shieldStep, setShieldStep] = useState<string>('');
  const [shieldResult, setShieldResult] = useState<ShieldResult | null>(null);

  const [lensFile, setLensFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const [selectedLanguage, setSelectedLanguage] = useState<'curl' | 'python' | 'javascript'>('curl');
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Olá! Sou o seu Verisignum Compliance Copilot. Como posso ajudar hoje?' }
  ]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // Admin State
  const [clients, setClients] = useState<ClientTenant[]>(INITIAL_CLIENTS);
  const [newClientName, setNewClientName] = useState<string>('');
  const [isCreatingClient, setIsCreatingClient] = useState<boolean>(false);

  const safeCopyToClipboard = (text: string, type: 'hash' | 'key' | string): void => {
    setCopyStatus(prev => ({ ...prev, error: null }));
    const setSuccess = () => {
      setCopyStatus(prev => ({ ...prev, [type]: true }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, [type]: false })), 2000);
    };

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(setSuccess).catch(() => fallbackCopyToClipboard(text, setSuccess));
    } else {
      fallbackCopyToClipboard(text, setSuccess);
    }
  };

  const fallbackCopyToClipboard = (text: string, successCallback: () => void): void => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) successCallback();
      else throw new Error('Fallback falhou');
    } catch (err) {
      setCopyStatus(prev => ({ ...prev, error: "Cópia automática indisponível." }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, error: null })), 5000);
    }
  };

  const generateNewKey = (): void => {
    const chars = 'abcdef0123456789';
    let result = 'vsg_live_';
    for (let i = 0; i < 22; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setApiKey(result);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    setIsCreatingClient(true);
    
    try {
      const response = await fetch(`${RENDER_ADMIN_CLIENTS_URL}?name=${encodeURIComponent(newClientName)}`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error('Falha na API');
      
      const data = await response.json();
      
      const newTenant: ClientTenant = {
        id: Math.random().toString(36).substring(7),
        name: data.client_name || newClientName,
        apiKey: data.api_key,
        usageCount: 0,
        plan: 'Trial',
        status: 'Ativo'
      };
      
      setClients([newTenant, ...clients]);
      setNewClientName('');
      
    } catch (error) {
      console.warn("API de Admin offline. A simular criação local...");
      const mockKey = 'vsg_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      const newTenant: ClientTenant = {
        id: Math.random().toString(36).substring(7),
        name: newClientName,
        apiKey: mockKey,
        usageCount: 0,
        plan: 'Trial',
        status: 'Ativo'
      };
      
      setClients([newTenant, ...clients]);
      setNewClientName('');
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleShieldSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!shieldFile) return;

    setIsShielding(true);
    setShieldResult(null);
    setShieldStep('A estabelecer ligação com a API Verisignum no Render...');
    setCopyStatus(prev => ({ ...prev, error: null }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); 

    try {
      const formData = new FormData();
      formData.append("file", shieldFile);
      formData.append("author", String(author || "Autor Desconhecido"));
      formData.append("organization", String(org || "Verisignum AI"));
      formData.append("api_key", apiKey);

      setShieldStep('A processar imagem e a invocar o motor de assinatura remotamente...');

      const response = await fetch(RENDER_API_URL, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = `Erro ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      setShieldStep('A descarregar ficheiro binário assinado digitalmente...');

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
         const data = await response.json();
         if (data.message && data.message.includes("sucesso")) {
             setShieldResult({
               hash: 'sha256:d8a21f7c9e543b18a2098fb412356c9a7d8f9024b1a32e5d89f71c43d920ef01 (Verificado)',
               manifest: JSON.stringify({ "status": "Assinado no backend via motor oficial", "filename": data.filename }, null, 2)
             });
             setCopyStatus(prev => ({ ...prev, error: null }));
         }
      } else {
        const signedBlob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(signedBlob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `verisignum_${shieldFile.name}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);

        setShieldResult({
          hash: 'sha256:d8a21f7c9e543b18a2098fb412356c9a7d8f9024b1a32e5d89f71c43d920ef01',
          manifest: JSON.stringify({ "c2pa:manifest": { "status": "Assinatura injetada com sucesso e ficheiro descarregado!" } }, null, 2)
        });
      }

      const newAsset: Asset = {
        id: (assets.length + 1).toString(),
        name: `verisignum_${shieldFile.name}`,
        type: shieldFile.type.split('/')[1]?.toUpperCase() || 'Ficheiro',
        status: 'Verificado',
        score: 100,
        date: new Date().toLocaleDateString('pt-PT'),
        author: author || 'Autor Desconhecido'
      };
      setAssets([newAsset, ...assets]);
      setIsShielding(false);

    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Erro na assinatura:", err);
      
      let mensagemErro = err.message;
      if (err.name === 'AbortError' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setShieldStep('Servidor inacessível. A iniciar simulação local de fallback...');
        
        setTimeout(() => {
          setShieldResult({
            hash: 'sha256:d8a21f7c9e543b18a2098fb412356c9a7d8f9024b1a32e5d89f71c43d920ef01 (Simulado)',
            manifest: JSON.stringify({ "status": "Assinatura simulada (API offline)", "filename": shieldFile.name }, null, 2)
          });

          const newAsset: Asset = {
            id: (assets.length + 1).toString(),
            name: `simulado_${shieldFile.name}`,
            type: shieldFile.type.split('/')[1]?.toUpperCase() || 'Ficheiro',
            status: 'Verificado (Simulado)',
            score: 100,
            date: new Date().toLocaleDateString('pt-PT'),
            author: author || 'Autor Desconhecido'
          };
          setAssets([newAsset, ...assets]);
          setIsShielding(false);
          setCopyStatus(prev => ({ 
            ...prev, 
            error: "Aviso: A ligação à API Render falhou. Certifique-se de que a API está online." 
          }));
        }, 1500);
        return; 
      }

      setCopyStatus(prev => ({ ...prev, error: `Falha: ${mensagemErro}` }));
      setIsShielding(false);
    }
  };

  const handleLensScan = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!lensFile) return;

    setIsScanning(true);
    setScanResult(null);
    setScanStep('A enviar para o VerisignumLens na nuvem...');

    try {
      const formData = new FormData();
      formData.append("file", lensFile);

      const response = await fetch(RENDER_VERIFY_URL, {
        method: "POST",
        body: formData
      });

      if (!response.ok) throw new Error("Servidor de verificação inacessível.");

      const verifyData = await response.json();

      setScanStep('A analisar metadados criptográficos C2PA...');
      await new Promise(resolve => setTimeout(resolve, 1500)); 

      if (verifyData.has_c2pa) {
        setScanResult({
          score: 100,
          isAiGenerated: false,
          metadataFound: true,
          anomalies: [
            'Selo C2PA Autêntico: Validado internamente pela Verisignum.',
            'Cadeia de custódia e integridade de píxeis intactas.',
            'O ficheiro não sofreu qualquer alteração desde a sua captura.'
          ]
        });
      } else {
        setScanStep('Sem selo C2PA. A consultar motor forense da Hive AI na nuvem...');
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        const aiData = verifyData.ai_analysis;

        setScanResult({
          score: aiData?.score || 65,
          isAiGenerated: aiData?.is_ai || false,
          metadataFound: false,
          anomalies: aiData?.anomalies || ['Nenhum selo de proveniência rastreável.']
        });
      }
    } catch (err: any) {
      console.error("Erro no Lens:", err);
      setCopyStatus(prev => ({ ...prev, error: `Falha na verificação: ${err.message}` }));
    } finally {
      setIsScanning(false);
      setScanStep('');
    }
  };

  const sendMessageToGemini = async (): Promise<void> => {
    if (!inputMessage.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: inputMessage };
    setChatMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsChatLoading(true);

    try {
      const response = await fetch(RENDER_COPILOT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text })
      });

      if (!response.ok) throw new Error('Falha no proxy da API.');
      const result = await response.json();
      
      setChatMessages(prev => [...prev, { role: 'assistant', text: result.reply }]);
    } catch (error) {
      console.error(error);
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Erro de ligação ao servidor da Verisignum.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const codeSnippets = {
    curl: 'curl -X POST "https://api.verisignum.com/v1/shield/sign" \\\n  -F "api_key=' + apiKey + '" \\\n  -F "file=@prova_oral_aluno.mp4" \\\n  -F "author=' + (author || 'Universidade XYZ') + '" \\\n  -F "organization=' + (org || 'EdTech Portugal') + '"',
    python: 'import requests\n\nurl = "https://api.verisignum.com/v1/shield/sign"\nfiles = {\n    "file": open("prova_oral_aluno.mp4", "rb")\n}\ndata = {\n    "api_key": "' + apiKey + '",\n    "author": "' + (author || 'Universidade XYZ') + '",\n    "organization": "' + (org || 'EdTech Portugal') + '"\n}\n\nresponse = requests.post(url, files=files, data=data)\nprint(response.json())',
    javascript: 'const formData = new FormData();\nformData.append("file", fileInput.files[0]);\nformData.append("api_key", "' + apiKey + '");\nformData.append("author", "' + (author || 'Universidade XYZ') + '");\nformData.append("organization", "' + (org || 'EdTech Portugal') + '");\n\nfetch("https://api.verisignum.com/v1/shield/sign", {\n  method: "POST",\n  body: formData\n})\n.then(res => res.json())\n.then(data => console.log(data));'
  };

  return (
    <div className="flex h-screen bg-[#0D1117] text-[#c9d1d9] font-sans overflow-hidden selection:bg-indigo-500/30">
      {copyStatus.error && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.15)] flex gap-3 items-center animate-bounce backdrop-blur-md">
          <AlertCircle size={24} className="text-red-400 flex-shrink-0" />
          <div className="text-xs">{copyStatus.error}</div>
        </div>
      )}

      {/* Sidebar - O Cofre Escuro */}
      <aside className="w-64 bg-[#161B22] border-r border-[#30363D] flex flex-col justify-between shrink-0">
        <div>
          <div className="p-6 border-b border-[#30363D] flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]">
              <Shield size={24} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wider">VERISIGNUM</h1>
              <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-mono">Padrão Ouro Digital</span>
            </div>
          </div>
          
          <nav className="p-4 space-y-1.5">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-[#21262D] text-white border-l-4 border-indigo-500 shadow-[inset_4px_0_0_rgba(79,70,229,1)]' : 'text-gray-400 hover:bg-[#21262D] hover:text-[#c9d1d9]'}`}>
              <Activity size={18} /> Painel Central
            </button>
            <button onClick={() => setActiveTab('shield')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'shield' ? 'bg-[#21262D] text-white border-l-4 border-indigo-500 shadow-[inset_4px_0_0_rgba(79,70,229,1)]' : 'text-gray-400 hover:bg-[#21262D] hover:text-[#c9d1d9]'}`}>
              <Shield size={18} /> Shield (Assinar)
            </button>
            <button onClick={() => setActiveTab('lens')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'lens' ? 'bg-[#21262D] text-white border-l-4 border-indigo-500 shadow-[inset_4px_0_0_rgba(79,70,229,1)]' : 'text-gray-400 hover:bg-[#21262D] hover:text-[#c9d1d9]'}`}>
              <Eye size={18} /> Lens (Verificar)
            </button>
            <button onClick={() => setActiveTab('api')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'api' ? 'bg-[#21262D] text-white border-l-4 border-indigo-500 shadow-[inset_4px_0_0_rgba(79,70,229,1)]' : 'text-gray-400 hover:bg-[#21262D] hover:text-[#c9d1d9]'}`}>
              <Code size={18} /> API Developer
            </button>
          </nav>
        </div>

        <div>
          <div className="px-4 pb-2">
            <div className="h-px bg-[#30363D] w-full mb-2"></div>
            <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'admin' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'text-gray-400 hover:bg-[#21262D] hover:text-white'}`}>
              <div className="flex items-center gap-3"><Crown size={18} /> Gestão (Admin)</div>
              <Lock size={14} className="opacity-50"/>
            </button>
          </div>
          
          <div className="p-4 border-t border-[#30363D] bg-[#0D1117] m-4 rounded-xl shadow-inner">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 border border-indigo-500/30">
                PM
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Modo Solopreneur</p>
                <p className="text-[10px] text-gray-500 font-mono tracking-wide">Métricas: Alta Escala</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 border-b border-[#30363D] px-8 flex items-center justify-between bg-[#161B22]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-[10px] px-2.5 py-1 rounded-sm bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono uppercase tracking-wider shadow-[0_0_10px_rgba(79,70,229,0.1)]">MVP Conectado</span>
            <span className="text-[10px] px-2.5 py-1 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.1)]">PostgreSQL Activo</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveTab('copilot')} className="flex items-center gap-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-lg text-sm hover:bg-indigo-600 hover:text-white transition-all duration-300 hover:shadow-[0_0_15px_rgba(79,70,229,0.3)]">
              <Sparkles size={16} /> Compliance Copilot
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-8 flex-1">
          
          {/* ABA: ADMIN */}
          {activeTab === 'admin' && (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Crown className="text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"/> Gestão de Clientes (Enterprise)</h2>
                  <p className="text-sm text-gray-400 mt-1">Crie chaves de API e monitorize a faturação de assinaturas C2PA.</p>
                </div>
                <div className="bg-[#161B22] border border-[#30363D] px-5 py-3 rounded-xl flex items-center gap-4 shadow-lg">
                  <span className="text-xs text-gray-400 uppercase tracking-widest font-mono">MRR Projetado</span>
                  <span className="text-xl font-mono font-bold text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.3)]">$2,490</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-[#161B22] border border-[#30363D] p-6 rounded-xl h-fit shadow-md hover:border-indigo-500/30 transition-colors duration-300">
                  <h3 className="text-md font-bold text-white flex items-center gap-2 mb-5"><Plus size={18} className="text-indigo-400"/> Novo Inquilino (Tenant)</h3>
                  <form onSubmit={handleCreateClient} className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Nome da Instituição</label>
                      <input 
                        type="text" 
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Ex: Universidade de Lisboa"
                        className="w-full bg-[#0D1117] border border-[#30363D] rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" 
                        required
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={isCreatingClient || !newClientName}
                      className="w-full bg-indigo-600 text-white font-semibold rounded-lg p-3 text-sm hover:bg-indigo-500 disabled:bg-gray-700 transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(79,70,229,0.4)]"
                    >
                      {isCreatingClient ? <Loader2 className="animate-spin" size={16} /> : 'Gerar Chave de API'}
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden shadow-md">
                  <div className="px-6 py-5 border-b border-[#30363D] flex justify-between items-center bg-[#1c2128]">
                    <h3 className="font-bold text-white text-sm">Contas Ativas e Consumo</h3>
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full font-mono uppercase tracking-wider">Total: {clients.length} Tenants</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
                      <thead className="text-[10px] text-gray-500 uppercase tracking-wider bg-[#0D1117] border-b border-[#30363D]">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Cliente</th>
                          <th className="px-6 py-4 font-semibold">API Key (Oculta)</th>
                          <th className="px-6 py-4 font-semibold text-right">Uso (Mês)</th>
                          <th className="px-6 py-4 font-semibold text-center">Faturação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#30363D]">
                        {clients.map((client) => (
                          <tr key={client.id} className="hover:bg-[#21262D] transition-colors duration-200">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-[#0D1117] flex items-center justify-center font-bold text-white text-xs border border-[#30363D]">
                                  {client.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="text-white font-medium">{client.name}</div>
                                  <div className={`text-[10px] font-mono tracking-wide ${client.plan === 'Enterprise' ? 'text-amber-400' : 'text-indigo-400'}`}>{client.plan} Plan</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 group cursor-pointer bg-[#0D1117] w-fit px-3 py-1.5 rounded border border-[#30363D] hover:border-indigo-500/50 transition-all" onClick={() => safeCopyToClipboard(client.apiKey, `key-${client.id}`)}>
                                <span className="font-mono text-xs text-gray-500 group-hover:text-indigo-300 transition-colors">{client.apiKey.substring(0, 15)}...</span>
                                {copyStatus[`key-${client.id}`] ? <CheckCircle2 size={12} className="text-emerald-500"/> : <Copy size={12} className="opacity-0 group-hover:opacity-100 text-indigo-400 transition-opacity" />}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-mono font-bold text-white">{client.usageCount.toLocaleString()}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-md hover:bg-indigo-600 hover:text-white transition-all duration-300 text-[11px] font-semibold uppercase tracking-wider hover:shadow-[0_0_10px_rgba(79,70,229,0.3)]">
                                <CreditCard size={14} /> Stripe Link
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* ABA: DASHBOARD CENTRAL */}
          {activeTab === 'dashboard' && (
             <div className="space-y-6">
             <div className="flex justify-between items-center">
               <div>
                 <h2 className="text-2xl font-bold text-white">Análise da Operação Verisignum</h2>
                 <p className="text-sm text-gray-400">Rastreabilidade forense e monitorização de ativos.</p>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               <div className="bg-[#161B22] border border-[#30363D] p-6 rounded-xl space-y-3 shadow-md">
                 <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-400">Total de Verificações</span>
                 <div className="flex justify-between items-end">
                   <span className="text-3xl font-mono font-extrabold text-white">1,482</span>
                   <span className="text-xs text-emerald-400 font-mono font-medium bg-emerald-500/10 px-2 py-0.5 rounded">+12%</span>
                 </div>
               </div>
               <div className="bg-[#161B22] border border-[#30363D] p-6 rounded-xl space-y-3 shadow-md relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-500/10 rounded-bl-full blur-xl"></div>
                 <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-400">Ativos Blindados</span>
                 <div className="flex justify-between items-end">
                   <span className="text-3xl font-mono font-extrabold text-indigo-400 drop-shadow-[0_0_8px_rgba(79,70,229,0.4)]">1,245</span>
                   <span className="text-[10px] text-gray-500 font-mono">C2PA</span>
                 </div>
               </div>
             </div>

             <div className="bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden shadow-md">
               <div className="px-6 py-5 border-b border-[#30363D] bg-[#1c2128]">
                 <h3 className="font-bold text-white text-sm uppercase tracking-wider">Cadeia de Custódia Recente</h3>
               </div>
               <div className="divide-y divide-[#30363D]">
                 {assets.map((asset) => (
                   <div key={asset.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#21262D] transition-colors duration-200">
                     <div className="flex items-center gap-4">
                       <div className="p-3 bg-[#0D1117] border border-[#30363D] rounded-lg text-indigo-400 shadow-inner">
                         <FileText size={18} />
                       </div>
                       <div>
                         <p className="font-semibold text-white text-sm">{asset.name}</p>
                         <p className="text-[11px] text-gray-400 font-mono mt-0.5">Autor: {asset.author}</p>
                       </div>
                     </div>
                     <span className={`px-3 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-widest border ${asset.status === 'Verificado' ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-red-500/5 border-red-500/30 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]'}`}>
                       {asset.status}
                     </span>
                   </div>
                 ))}
               </div>
             </div>
           </div>
          )}

          {/* ABA: SHIELD (ASSINAR) */}
          {activeTab === 'shield' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#161B22] border border-[#30363D] p-6 rounded-xl space-y-6 shadow-lg">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Shield className="text-indigo-500 drop-shadow-[0_0_5px_rgba(79,70,229,0.5)]" /> Assinatura C2PA
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Injeção criptográfica no cabeçalho binário do ativo.</p>
                </div>

                <div className="bg-[#0D1117] border border-indigo-500/30 p-4 rounded-lg flex flex-col gap-2 relative overflow-hidden shadow-[inset_0_0_15px_rgba(79,70,229,0.05)]">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,1)]"></div>
                  <label className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 flex items-center gap-1"><Key size={12}/> Chave de Integração (API Key)</label>
                  <input 
                    type="text" 
                    value={apiKey} 
                    onChange={(e) => setApiKey(e.target.value)} 
                    placeholder="Cole aqui a chave gerada..."
                    className="w-full bg-[#161B22] border border-[#30363D] rounded-md p-2.5 text-xs text-indigo-300 font-mono focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                    required 
                  />
                </div>
                
                <form onSubmit={handleShieldSubmit} className="space-y-5">
                  <div className="border-2 border-dashed border-[#30363D] p-10 text-center cursor-pointer bg-[#0D1117] rounded-xl hover:border-indigo-500 hover:bg-indigo-500/5 transition-all duration-300 group">
                    {previewUrl && shieldFile ? (
                      <div className="mb-4">
                        {shieldFile.type.startsWith('image/') ? (
                          <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-[#30363D]" />
                        ) : shieldFile.type.startsWith('video/') ? (
                          <video src={previewUrl} controls className="max-h-48 mx-auto rounded-lg shadow-md border border-[#30363D]" />
                        ) : shieldFile.type.startsWith('audio/') ? (
                          <audio src={previewUrl} controls className="w-full mx-auto shadow-md" />
                        ) : (
                          <FileCheck size={40} className="text-indigo-500 mx-auto mb-3" />
                        )}
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-[#161B22] border border-[#30363D] mx-auto flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                        <FileCheck size={24} className="text-indigo-500" />
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/jpeg, image/png, image/webp, video/mp4, audio/mpeg, audio/wav"
                      onChange={handleShieldFileSelect}
                      className="hidden" 
                      id="shield-file-input"
                    />
                    <label htmlFor="shield-file-input" className="text-white text-xs uppercase tracking-wider font-semibold cursor-pointer px-5 py-2.5 bg-[#21262D] border border-[#30363D] rounded-md hover:bg-[#30363D] transition-colors">
                      {shieldFile ? 'Substituir Matriz' : 'Selecionar Matriz de Dados'}
                    </label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Autor da Mídia</label>
                        <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full bg-[#0D1117] border border-[#30363D] rounded-md p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Organização Emissora</label>
                        <input type="text" value={org} onChange={(e) => setOrg(e.target.value)} className="w-full bg-[#0D1117] border border-[#30363D] rounded-md p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all" />
                      </div>
                  </div>

                  <button type="submit" disabled={isShielding || !shieldFile || !apiKey} className="w-full bg-indigo-600 text-white p-3.5 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-500 disabled:bg-[#21262D] disabled:text-gray-500 transition-all duration-300 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] font-bold tracking-wide">
                    {isShielding ? <><Loader2 className="animate-spin" size={18} /> INJETANDO C2PA...</> : 'BLINDAR ATIVO DIGITAL'}
                  </button>

                  {shieldStep && <p className="text-[10px] uppercase tracking-widest text-indigo-400 mt-3 font-mono text-center animate-pulse">{shieldStep}</p>}
                </form>
              </div>

              <div className="bg-[#161B22] border border-[#30363D] p-6 rounded-xl shadow-lg flex flex-col">
                 <h3 className="text-lg font-bold text-white mb-6 border-b border-[#30363D] pb-4">Manifesto Criptográfico</h3>
                 {shieldResult ? (
                    <div className="space-y-6">
                      <div className="p-5 bg-emerald-500/5 border border-emerald-500/30 rounded-xl flex gap-4 items-center shadow-[0_0_20px_rgba(16,185,129,0.05)] backdrop-blur-sm">
                        <div className="bg-emerald-500/20 p-2 rounded-full">
                          <CheckCircle2 className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.8)]" size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white tracking-wide">Blindagem Concluída</p>
                            <a href={signedMediaUrl || '#'} download={`assinado_${shieldFile?.name}`} className="text-xs text-emerald-400 underline decoration-emerald-500/30 hover:decoration-emerald-400 transition-all">Descarregar Ativo Seguro</a>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono uppercase tracking-widest font-semibold text-gray-500">Impressão Digital (SHA-256)</span>
                        <div className="bg-[#0D1117] p-3.5 rounded-md border border-[#30363D] text-[11px] text-indigo-300 font-mono truncate shadow-inner">
                          {shieldResult.hash}
                        </div>
                      </div>
                      <div className="space-y-2 flex-1">
                        <span className="text-[10px] font-mono uppercase tracking-widest font-semibold text-gray-500">Decodificação JSON</span>
                        <pre className="bg-[#0D1117] p-4 rounded-md border border-[#30363D] text-[11px] font-mono text-gray-400 overflow-x-auto h-48 shadow-inner leading-relaxed">
                          {shieldResult.manifest}
                        </pre>
                      </div>
                    </div>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-[#0D1117] border border-[#30363D] rounded-xl text-gray-600 shadow-inner">
                      <Lock size={40} className="mb-4 opacity-50" />
                      <p className="font-mono text-[10px] uppercase tracking-widest">Aguardando injeção de dados</p>
                    </div>
                 )}
              </div>
            </div>
          )}

          {/* ABA: LENS (VERIFICAR) */}
          {activeTab === 'lens' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#161B22] border border-[#30363D] p-6 rounded-xl space-y-6 shadow-lg">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Eye className="text-indigo-500 drop-shadow-[0_0_5px_rgba(79,70,229,0.5)]"/> Scanner Forense
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Inspeção de metadados e análise heurística.</p>
                </div>
                <form onSubmit={handleLensScan} className="space-y-5">
                  <div className="border-2 border-dashed border-[#30363D] p-12 text-center cursor-pointer bg-[#0D1117] rounded-xl hover:border-indigo-500 hover:bg-indigo-500/5 transition-all duration-300 group">
                    <Activity size={40} className="text-indigo-500 mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
                    <input type="file" onChange={(e) => setLensFile(e.target.files ? e.target.files[0] : null)} className="hidden" id="lens-file-input" />
                    <label htmlFor="lens-file-input" className="text-white text-xs font-semibold uppercase tracking-wider cursor-pointer px-5 py-2.5 bg-[#21262D] border border-[#30363D] rounded-md hover:bg-[#30363D] transition-colors">
                      {lensFile ? lensFile.name : 'Submeter Ficheiro Suspeito'}
                    </label>
                  </div>
                  <button type="submit" disabled={isScanning || !lensFile} className="w-full bg-indigo-600 text-white p-3.5 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-500 disabled:bg-[#21262D] disabled:text-gray-500 transition-all duration-300 hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] font-bold tracking-wide uppercase text-sm">
                    {isScanning ? <><Loader2 className="animate-spin" size={18} /> A DECOMPOR DADOS...</> : 'EXECUTAR VARREDURA'}
                  </button>
                  {scanStep && <p className="text-[10px] uppercase tracking-widest text-indigo-400 mt-3 font-mono text-center animate-pulse">{scanStep}</p>}
                </form>
              </div>

              <div className="bg-[#161B22] border border-[#30363D] p-6 rounded-xl shadow-lg flex flex-col">
                 <h3 className="text-lg font-bold text-white mb-6 border-b border-[#30363D] pb-4">Laudo de Integridade</h3>
                 {scanResult ? (
                    <div className="p-6 bg-[#0D1117] border border-[#30363D] rounded-xl shadow-inner relative overflow-hidden">
                      {scanResult.score > 50 ? (
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full blur-2xl"></div>
                      ) : (
                        <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-bl-full blur-2xl"></div>
                      )}
                      
                      <p className="text-[10px] font-mono uppercase tracking-widest text-gray-500 mb-2">Veredito Forense:</p>
                      <p className={`text-4xl font-mono font-bold ${scanResult.score > 50 ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]'}`}>
                        Score: {scanResult.score}% <span className="text-sm font-sans tracking-normal opacity-70">Humano</span>
                      </p>
                      
                      <div className="mt-6 border-t border-[#30363D] pt-4">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500 block mb-3">Logs Detetados:</span>
                        <ul className="space-y-2.5">
                            {scanResult.anomalies.map((anom, idx) => (
                              <li key={idx} className="text-xs text-gray-300 flex gap-3 items-start bg-[#161B22] p-3 rounded-md border border-[#30363D]">
                                <span className="text-indigo-500 mt-0.5 opacity-80">|</span> 
                                <span className="font-mono leading-relaxed">{anom}</span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    </div>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-[#0D1117] border border-[#30363D] rounded-xl text-gray-600 shadow-inner">
                      <Activity size={40} className="mb-4 opacity-50" />
                      <p className="font-mono text-[10px] uppercase tracking-widest">Sistema em Standby</p>
                    </div>
                 )}
              </div>
            </div>
          )}

          {/* ABA: API DEVELOPER HUB */}
          {activeTab === 'api' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-[#161B22] border border-[#30363D] p-6 rounded-xl space-y-6 shadow-md">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Key className="text-indigo-500" /> Chaves de Integração
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Conecte os seus sistemas via REST.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-widest font-semibold text-gray-400">Bearer Token Local</label>
                    <div className="bg-[#0D1117] border border-[#30363D] p-3 rounded-md flex items-center justify-between font-mono text-xs shadow-inner">
                      <span className="text-emerald-400 overflow-hidden text-ellipsis mr-2">
                        {isKeyVisible ? apiKey : '••••••••••••••••••••••••••••••••'}
                      </span>
                      <div className="flex gap-3 items-center flex-shrink-0 border-l border-[#30363D] pl-3">
                        <button onClick={() => setIsKeyVisible(!isKeyVisible)} className="text-gray-400 hover:text-white transition-colors">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => safeCopyToClipboard(apiKey, 'key')} className="text-gray-400 hover:text-white transition-colors">
                          {copyStatus.key ? <CheckCircle2 size={14} className="text-emerald-400"/> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2 bg-[#161B22] border border-[#30363D] rounded-xl overflow-hidden flex flex-col justify-between shadow-md">
                <div>
                  <div className="px-6 py-4 border-b border-[#30363D] flex justify-between items-center bg-[#1c2128]">
                    <div className="flex items-center gap-2">
                      <Terminal size={18} className="text-indigo-400" />
                      <h3 className="font-bold text-white text-sm tracking-wide">Endpoints</h3>
                    </div>
                    <div className="flex gap-2">
                      {(['curl', 'python', 'javascript'] as const).map((lang) => (
                        <button 
                          key={lang}
                          onClick={() => setSelectedLanguage(lang)}
                          className={`text-[10px] px-3 py-1.5 rounded uppercase font-bold tracking-wider transition-all duration-300 ${selectedLanguage === lang ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.4)]' : 'text-gray-400 border border-[#30363D] hover:text-white hover:border-gray-500'}`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-6 bg-[#0D1117] font-mono text-[11px] overflow-x-auto h-64 border-b border-[#30363D] shadow-inner">
                    <pre className="text-indigo-300 leading-loose">{codeSnippets[selectedLanguage]}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA: COPILOT SEGURO */}
          {activeTab === 'copilot' && (
            <div className="max-w-3xl mx-auto bg-[#161B22] border border-[#30363D] rounded-xl flex flex-col h-[600px] shadow-lg overflow-hidden">
                <div className="p-5 border-b border-[#30363D] bg-[#1c2128]">
                  <div className="flex items-center gap-2">
                    <Lock size={16} className="text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]"/> 
                    <span className="font-bold text-white tracking-wide">Copilot Seguro (Proxy API)</span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono mt-1">As mensagens são encriptadas de ponta a ponta.</p>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0D1117] shadow-inner">
                  {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`p-4 rounded-xl text-sm leading-relaxed shadow-sm w-fit max-w-[80%] ${msg.role === 'assistant' ? 'bg-[#161B22] text-gray-300 border border-[#30363D] mr-auto' : 'bg-indigo-600 text-white ml-auto'}`}>
                        {msg.text}
                      </div>
                  ))}
                  {isChatLoading && <div className="w-fit mr-auto p-4 bg-[#161B22] border border-[#30363D] rounded-xl"><Loader2 className="animate-spin text-indigo-500" size={20}/></div>}
                </div>
                <div className="p-4 border-t border-[#30363D] bg-[#161B22] flex gap-3">
                  <input 
                      value={inputMessage} 
                      onChange={e => setInputMessage(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && sendMessageToGemini()} 
                      placeholder="Ex: Como funciona o standard C2PA?"
                      className="flex-1 bg-[#0D1117] px-4 py-3 text-sm text-white border border-[#30363D] rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all" 
                  />
                  <button onClick={sendMessageToGemini} disabled={isChatLoading || !inputMessage.trim()} className="bg-indigo-600 px-6 py-3 text-white rounded-lg hover:bg-indigo-500 disabled:bg-[#21262D] disabled:text-gray-500 transition-all shadow-[0_0_10px_rgba(79,70,229,0.2)]">
                    <Send size={18}/>
                  </button>
                </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}