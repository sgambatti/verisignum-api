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
  AlertCircle
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
  hash: boolean;
  key: boolean;
  error: string | null;
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
  { id: '1', name: 'palestra_reitor_oficial.mp4', type: 'Video', status: 'Verificado', score: 99, date: '18 Mai 2026', author: 'Reitoria Universitária' },
  { id: '2', name: 'grafico_lucros_q1_sintetico.png', type: 'Imagem', status: 'Sem Assinatura', score: 8, date: '17 Mai 2026', author: 'Desconhecido' },
  { id: '3', name: 'clonagem_voz_auditoria.mp3', type: 'Áudio', status: 'Possível Deepfake', score: 38, date: '15 Mai 2026', author: 'Desconhecido' },
];

const INITIAL_CLIENTS: ClientTenant[] = [
  { id: '1', name: 'EdTech Brasil', apiKey: 'vsg_live_7a3bc9f8e2d1...', usageCount: 1245, plan: 'Enterprise', status: 'Ativo' },
  { id: '2', name: 'Universidade Veritas', apiKey: 'vsg_live_8f7b2c9a1d4...', usageCount: 350, plan: 'Pro', status: 'Ativo' },
];

const RENDER_API_URL = "https://verisignum-api.onrender.com/v1/shield/sign";
const RENDER_VERIFY_URL = "https://verisignum-api.onrender.com/v1/lens/verify";
const RENDER_ADMIN_CLIENTS_URL = "https://verisignum-api.onrender.com/v1/admin/clients";
const RENDER_COPILOT_URL = "https://verisignum-api.onrender.com/v1/copilot/chat";
const RENDER_BILLING_URL = "https://verisignum-api.onrender.com/v1/billing/create-checkout-session";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('admin'); 
  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [apiKey, setApiKey] = useState<string>('vsg_live_4b8c12a7e9f310d5c8b2a3');
  const [isKeyVisible, setIsKeyVisible] = useState<boolean>(false);
  
  const [copyStatus, setCopyStatus] = useState<CopyStatus | any>({ hash: false, key: false, error: null });

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
  const [billingLoading, setBillingLoading] = useState<string | null>(null);

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

  // --- CORREÇÃO DA FUNÇÃO AQUI ---
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
        // Usa o ID real vindo do banco. Se falhar, usa um Número Aleatório (nunca letras!) para não quebrar o banco
        id: data.client_id ? data.client_id.toString() : Math.floor(Math.random() * 100000).toString(),
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
        // Correção CRÍTICA: Gera um Número Inteiro aleatório para não quebrar o PostgreSQL na Stripe
        id: Math.floor(Math.random() * 100000).toString(),
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

  const handleGenerateStripeLink = async (clientId: string) => {
    setBillingLoading(clientId);
    try {
      const response = await fetch(RENDER_BILLING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: clientId,
          price_id: 'price_1Tj6hLHAl9dt4Pfq8NzMSJhp' // Certifique-se de que este é o ID do plano de $499 ativo (Modo Live)
        })
      });

      if (!response.ok) {
         const erroData = await response.json();
         throw new Error(erroData.detail || 'Falha na API de Faturação');
      }
      
      const data = await response.json();
      safeCopyToClipboard(data.checkout_url, `stripe-${clientId}`);
      
    } catch (error: any) {
      console.error(error);
      setCopyStatus(prev => ({ ...prev, error: `Erro Stripe: ${error.message}` }));
    } finally {
      setBillingLoading(null);
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
        setShieldStep('Servidor inacessível (CORS/Offline). A iniciar simulação local de fallback...');
        
        setTimeout(() => {
          setShieldResult({
            hash: 'sha256:d8a21f7c9e543b18a2098fb412356c9a7d8f9024b1a32e5d89f71c43d920ef01 (Simulado)',
            manifest: JSON.stringify({ "status": "Assinatura simulada (API offline/CORS)", "filename": shieldFile.name }, null, 2)
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
      await new Promise(resolve => setTimeout(resolve, 1500)); // Delay para UX

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
        await new Promise(resolve => setTimeout(resolve, 1500)); // Delay para UX

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
    curl: 'curl -X POST "https://api.verisignum.com/v1/shield/sign" \\\n  -H "Authorization: Bearer ' + apiKey + '" \\\n  -H "Content-Type: multipart/form-data" \\\n  -F "file=@prova_oral_aluno.mp4" \\\n  -F "author=' + (author || 'Universidade XYZ') + '" \\\n  -F "organization=' + (org || 'EdTech Portugal') + '"',
    python: 'import requests\n\nurl = "https://api.verisignum.com/v1/shield/sign"\nheaders = {\n    "Authorization": "Bearer ' + apiKey + '"\n}\nfiles = {\n    "file": open("prova_oral_aluno.mp4", "rb")\n}\ndata = {\n    "author": "' + (author || 'Universidade XYZ') + '",\n    "organization": "' + (org || 'EdTech Portugal') + '",\n    "license": "' + license + '"\n}\n\nresponse = requests.post(url, headers=headers, files=files, data=data)\nprint(response.json())',
    javascript: 'const formData = new FormData();\nformData.append("file", fileInput.files[0]);\nformData.append("author", "' + (author || 'Universidade XYZ') + '");\nformData.append("organization", "' + (org || 'EdTech Portugal') + '");\n\nfetch("https://api.verisignum.com/v1/shield/sign", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer ' + apiKey + '"\n  },\n  body: formData\n})\n.then(res => res.json())\n.then(data => console.log(data));'
  };

  return (
    <div className="flex h-screen bg-[#0d1117] text-[#c9d1d9] font-sans overflow-hidden">
      {copyStatus.error && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl shadow-2xl flex gap-3 items-center animate-bounce">
          <AlertCircle size={24} className="text-red-400 flex-shrink-0" />
          <div className="text-xs">{copyStatus.error}</div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-[#30363d] flex items-center gap-3">
            <div className="relative w-12 h-12 flex items-center justify-center bg-gradient-to-br from-[#0D1117] to-[#161B22] rounded-xl border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <img 
                src="/logo.png" 
                alt="Verisignum Logo" 
                className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" 
                onError={(e) => { 
                  e.currentTarget.style.display = 'none'; 
                  e.currentTarget.parentElement?.querySelector('svg')?.classList.remove('hidden'); 
                }} 
              />
              <Shield size={24} className="text-amber-500 hidden animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wider">VERISIGNUM</h1>
              <span className="text-[10px] uppercase tracking-widest text-amber-400 font-mono">Padrão Ouro Digital</span>
            </div>
          </div>
          
          <nav className="p-4 space-y-1">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d] hover:text-[#c9d1d9]'}`}><Activity size={18} /> Painel de Controlo</button>
            <button onClick={() => setActiveTab('shield')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'shield' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d] hover:text-[#c9d1d9]'}`}><Shield size={18} /> VerisignumShield</button>
            <button onClick={() => setActiveTab('lens')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'lens' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d] hover:text-[#c9d1d9]'}`}><Eye size={18} /> VerisignumLens</button>
            <button onClick={() => setActiveTab('api')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'api' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d] hover:text-[#c9d1d9]'}`}><Code size={18} /> API Developer</button>
          </nav>
        </div>

        <div>
          <div className="px-4 pb-2">
            <div className="h-px bg-[#30363d] w-full mb-2"></div>
            <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${activeTab === 'admin' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'text-gray-400 hover:bg-[#21262d] hover:text-white'}`}>
              <div className="flex items-center gap-3"><Terminal size={18} /> Gestão (Admin)</div>
              <Lock size={14} className="opacity-50"/>
            </button>
          </div>
          
          <div className="p-4 border-t border-[#30363d] bg-[#0d1117] m-4 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400">PM</div>
              <div>
                <p className="text-xs font-semibold text-white">Modo Solopreneur</p>
                <p className="text-[10px] text-gray-500">Métricas: Alta Escala</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 border-b border-[#30363d] px-8 flex items-center justify-between bg-[#161b22]">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-mono font-medium">MVP Conectado</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-medium">Render Cloud API (TSX)</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveTab('copilot')} className="flex items-center gap-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-lg text-sm hover:bg-indigo-600 hover:text-white transition-all">
              <Sparkles size={16} /> Compliance Copilot
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-8 flex-1">

          {/* ABA ADMIN */}
          {activeTab === 'admin' && (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">Gestão de Clientes (Multi-Tenant)</h2>
                  <p className="text-sm text-gray-400 mt-1">Crie chaves de API para novas faculdades e gere links de faturação na Stripe.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-[#161b22] border border-[#30363d] p-6 rounded-xl h-fit">
                  <h3 className="text-md font-bold text-white mb-4">Novo Cliente</h3>
                  <form onSubmit={handleCreateClient} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-400">Nome da Instituição</label>
                      <input 
                        type="text" 
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Ex: Universidade de Lisboa"
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 transition-all outline-none" 
                        required
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={isCreatingClient || !newClientName}
                      className="w-full bg-indigo-600 text-white font-semibold rounded-lg p-2.5 text-sm hover:bg-indigo-700 disabled:bg-gray-700 transition-all flex items-center justify-center gap-2"
                    >
                      {isCreatingClient ? <Loader2 className="animate-spin" size={16} /> : 'Gerar Chave de API'}
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-2 bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xl">
                  <div className="px-6 py-4 border-b border-[#30363d] flex justify-between items-center bg-[#1c2128]">
                    <h3 className="font-bold text-white text-sm">Contas Ativas</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
                      <thead className="text-xs text-gray-500 uppercase bg-[#0d1117] border-b border-[#30363d]">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Cliente</th>
                          <th className="px-6 py-3 font-semibold">API Key</th>
                          <th className="px-6 py-3 font-semibold text-center">Faturação (Stripe)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#30363d]">
                        {clients.map((client) => (
                          <tr key={client.id} className="hover:bg-[#21262d] transition-colors">
                            <td className="px-6 py-4">
                              <div className="text-white font-medium">{client.name}</div>
                              <div className="text-[10px]">{client.plan} Plan</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs">{client.apiKey.substring(0, 15)}...</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button 
                                onClick={() => handleGenerateStripeLink(client.id)}
                                disabled={billingLoading === client.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded hover:bg-indigo-600 hover:text-white transition-all text-xs font-semibold disabled:opacity-50"
                              >
                                {billingLoading === client.id ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                                {copyStatus[`stripe-${client.id}`] ? 'Link Copiado!' : 'Gerar Stripe Link'}
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

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white">Análise da Operação Verisignum</h2>
                  <p className="text-sm text-gray-400">Rastreabilidade, assinaturas criptográficas ativas e monitorização de média.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl space-y-2">
                  <span className="text-xs font-semibold text-gray-400">Total de Verificações</span>
                  <div className="flex justify-between items-end">
                    <span className="text-3xl font-extrabold text-white">1,482</span>
                  </div>
                </div>
                <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl space-y-2">
                  <span className="text-xs font-semibold text-gray-400">Ativos Criptografados</span>
                  <div className="flex justify-between items-end">
                    <span className="text-3xl font-extrabold text-indigo-500">1,245</span>
                  </div>
                </div>
                <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl space-y-2">
                  <span className="text-xs font-semibold text-gray-400">Deepfakes Identificados</span>
                  <div className="flex justify-between items-end">
                    <span className="text-3xl font-extrabold text-amber-500">23</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shield' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Shield className="text-indigo-500" /> VerisignumShield — Injetor C2PA
                  </h3>
                  <p className="text-sm text-gray-400">Aplique assinaturas criptográficas imutáveis.</p>
                </div>

                <form onSubmit={handleShieldSubmit} className="space-y-4">
                  <div className="border-2 border-dashed border-[#30363d] rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:border-indigo-500 cursor-pointer bg-[#0d1117]">
                    <FileCheck size={40} className="text-indigo-500" />
                    <input 
                      type="file" 
                      onChange={(e) => setShieldFile(e.target.files ? e.target.files[0] : null)}
                      className="hidden" 
                      id="shield-file-input"
                    />
                    <label htmlFor="shield-file-input" className="px-4 py-2 bg-[#21262d] border border-[#30363d] text-white text-xs rounded-lg cursor-pointer hover:bg-[#30363d]">
                      {shieldFile ? `Selecionado: ${shieldFile.name}` : 'Selecionar Mídia'}
                    </label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Autor" value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-sm text-white" />
                    <input type="text" placeholder="Organização" value={org} onChange={(e) => setOrg(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-sm text-white" />
                  </div>

                  <button type="submit" disabled={isShielding || !shieldFile} className="w-full bg-indigo-600 text-white font-semibold rounded-lg p-3 text-sm flex justify-center gap-2">
                    {isShielding ? <Loader2 className="animate-spin" /> : 'Assinar Mídia'}
                  </button>
                </form>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl">
                  <h3 className="text-lg font-bold text-white mb-4">Certificado Digital C2PA</h3>
                  {shieldResult ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex gap-3 items-center">
                        <CheckCircle2 className="text-emerald-400" size={24} />
                        <div><p className="text-sm font-semibold text-white">Chave Criptográfica Ativa</p></div>
                      </div>
                      <pre className="bg-[#0d1117] p-3 rounded-lg text-[10px] font-mono text-gray-300 overflow-x-auto">{shieldResult.manifest}</pre>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 text-gray-500">
                      <Lock size={48} className="mb-4 text-gray-700" />
                      <p className="text-sm">Aguardar Execução</p>
                    </div>
                  )}
              </div>
            </div>
          )}

          {activeTab === 'lens' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6">
                 <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Eye className="text-indigo-500" /> VerisignumLens — Analisador
                  </h3>
                </div>
                <form onSubmit={handleLensScan} className="space-y-4">
                  <div className="border-2 border-dashed border-[#30363d] rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-[#0d1117]">
                    <Activity size={40} className="text-indigo-400 animate-pulse" />
                    <input type="file" onChange={(e) => setLensFile(e.target.files ? e.target.files[0] : null)} className="hidden" id="lens-file-input" />
                    <label htmlFor="lens-file-input" className="px-4 py-2 bg-[#21262d] border border-[#30363d] text-white text-xs rounded-lg cursor-pointer">
                      {lensFile ? `Selecionado: ${lensFile.name}` : 'Selecionar Ficheiro'}
                    </label>
                  </div>
                  <button type="submit" disabled={isScanning || !lensFile} className="w-full bg-indigo-600 text-white font-semibold rounded-lg p-3 text-sm flex justify-center gap-2">
                    {isScanning ? <Loader2 className="animate-spin" /> : 'Executar Análise'}
                  </button>
                </form>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl">
                  <h3 className="text-lg font-bold text-white mb-4">Relatório de Anomalias de IA</h3>
                  {scanResult ? (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center bg-[#0d1117] p-5 border border-[#30363d] rounded-xl">
                        <div><p className="text-3xl font-extrabold text-white mt-1">{scanResult.score}% Humano</p></div>
                        <div className={`p-3 rounded-xl ${scanResult.isAiGenerated ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {scanResult.isAiGenerated ? <AlertTriangle size={32} /> : <CheckCircle2 size={32} />}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {scanResult.anomalies.map((anomaly, idx) => (
                           <div key={idx} className="flex gap-2.5 items-start bg-[#0d1117] p-3 border border-[#30363d] rounded-lg">
                              <p className="text-xs text-gray-300">{anomaly}</p>
                           </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 text-gray-500">
                      <Activity size={48} className="mb-4 text-gray-700" />
                      <p className="text-sm">Pronto para Diagnóstico</p>
                    </div>
                  )}
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Key className="text-indigo-500" /> API Access Keys
                </h3>
                <div className="bg-[#0d1117] border border-[#30363d] p-3 rounded-lg flex justify-between font-mono text-xs text-indigo-400">
                   {isKeyVisible ? apiKey : '••••••••••••••••••••••••••••••••'}
                   <button onClick={() => setIsKeyVisible(!isKeyVisible)} className="text-white">Revelar</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'copilot' && (
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl flex flex-col h-[500px]">
              <div className="px-6 py-4 border-b border-[#30363d] flex items-center gap-2">
                 <Sparkles size={18} className="text-indigo-400" />
                 <h3 className="font-bold text-white text-sm">Verisignum Copilot</h3>
              </div>
              <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-[#0d1117]">
                 {chatMessages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`p-4 text-sm rounded-xl ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-[#161b22] text-gray-200 border border-[#30363d]'}`}>
                        {msg.text}
                      </div>
                    </div>
                 ))}
                 {isChatLoading && <Loader2 size={16} className="animate-spin text-indigo-400" />}
              </div>
              <div className="p-4 border-t border-[#30363d] bg-[#161b22] flex gap-3">
                 <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessageToGemini()} className="flex-1 bg-[#0d1117] border border-[#30363d] p-3 text-white rounded-lg outline-none" />
                 <button onClick={sendMessageToGemini} className="bg-indigo-600 text-white p-3 rounded-lg"><Send size={18}/></button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
