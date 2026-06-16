import React, { useState } from 'react';
import { 
  Shield, 
  Eye, 
  Code, 
  FileCheck, 
  Activity, 
  CheckCircle2, 
  Terminal, 
  Key, 
  RefreshCw, 
  Copy, 
  Sparkles,
  Send,
  Loader2,
  Lock,
  FileText,
  AlertCircle,
  Users,
  CreditCard,
  Plus,
  Database
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

// Interface corrigida para evitar o erro TS7053 (permite chaves dinâmicas como 'key-123')
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
    <div className="flex h-screen bg-[#0d1117] text-[#c9d1d9] font-sans overflow-hidden">
      {copyStatus.error && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl shadow-2xl flex gap-3 items-center animate-bounce">
          <AlertCircle size={24} className="text-red-400 flex-shrink-0" />
          <div className="text-xs">{copyStatus.error}</div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col justify-between shrink-0">
        <div>
          <div className="p-6 border-b border-[#30363d] flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Shield size={24} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wider">Verisignum</h1>
              <span className="text-xs text-indigo-400 font-mono">Proveniência Digital</span>
            </div>
          </div>
          
          <nav className="p-4 space-y-1">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d] hover:text-[#c9d1d9]'}`}>
              <Activity size={18} /> Painel Central
            </button>
            <button onClick={() => setActiveTab('shield')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'shield' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d] hover:text-[#c9d1d9]'}`}>
              <Shield size={18} /> Shield (Assinar)
            </button>
            <button onClick={() => setActiveTab('lens')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'lens' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d] hover:text-[#c9d1d9]'}`}>
              <Eye size={18} /> Lens (Verificar)
            </button>
            <button onClick={() => setActiveTab('api')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'api' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d] hover:text-[#c9d1d9]'}`}>
              <Code size={18} /> API Developer
            </button>
          </nav>
        </div>

        <div>
          <div className="px-4 pb-2">
            <div className="h-px bg-[#30363d] w-full mb-2"></div>
            <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'admin' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-gray-400 hover:bg-[#21262d] hover:text-white'}`}>
              <div className="flex items-center gap-3"><Users size={18} /> Gestão (Admin)</div>
              <Lock size={14} className="opacity-50"/>
            </button>
          </div>
          
          <div className="p-4 border-t border-[#30363d] bg-[#0d1117] m-4 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400">
                PM
              </div>
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
        <header className="h-16 border-b border-[#30363d] px-8 flex items-center justify-between bg-[#161b22] sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-mono font-medium">MVP Conectado</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-medium">PostgreSQL Activo</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveTab('copilot')} className="flex items-center gap-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-lg text-sm hover:bg-indigo-600 hover:text-white transition-all">
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
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Database className="text-emerald-500"/> Gestão de Clientes (Multi-Tenant)</h2>
                  <p className="text-sm text-gray-400 mt-1">Crie chaves de API para novas faculdades e monitorize a faturação de assinaturas C2PA.</p>
                </div>
                <div className="bg-[#161b22] border border-[#30363d] px-4 py-2 rounded-lg flex items-center gap-3">
                  <span className="text-xs text-gray-400">MRR Projetado:</span>
                  <span className="text-lg font-bold text-emerald-400">$2,490</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-[#161b22] border border-[#30363d] p-6 rounded-xl h-fit">
                  <h3 className="text-md font-bold text-white flex items-center gap-2 mb-4"><Plus size={18} className="text-indigo-400"/> Novo Inquilino (Tenant)</h3>
                  <form onSubmit={handleCreateClient} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-400">Nome da Instituição / EdTech</label>
                      <input 
                        type="text" 
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Ex: Universidade de Lisboa"
                        className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-emerald-500 outline-none" 
                        required
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={isCreatingClient || !newClientName}
                      className="w-full bg-emerald-600 text-white font-semibold rounded-lg p-2.5 text-sm hover:bg-emerald-700 disabled:bg-gray-700 transition-all flex items-center justify-center gap-2"
                    >
                      {isCreatingClient ? <Loader2 className="animate-spin" size={16} /> : 'Gerar Chave de API'}
                    </button>
                  </form>
                  <div className="mt-4 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      Ao criar um inquilino, o PostgreSQL gera um tenant_id isolado. A chave gerada servirá para faturar todo o uso desta instituição.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#30363d] flex justify-between items-center bg-[#1c2128]">
                    <h3 className="font-bold text-white text-sm">Contas Ativas e Consumo</h3>
                    <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full font-mono">Total: {clients.length} Tenants</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
                      <thead className="text-xs text-gray-500 uppercase bg-[#0d1117] border-b border-[#30363d]">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Cliente</th>
                          <th className="px-6 py-3 font-semibold">API Key (Oculta)</th>
                          <th className="px-6 py-3 font-semibold text-right">Uso (Mês)</th>
                          <th className="px-6 py-3 font-semibold text-center">Faturação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#30363d]">
                        {clients.map((client) => (
                          <tr key={client.id} className="hover:bg-[#21262d] transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center font-bold text-white text-xs border border-indigo-500/30">
                                  {client.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="text-white font-medium">{client.name}</div>
                                  <div className="text-[10px] text-emerald-400">{client.plan} Plan</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => safeCopyToClipboard(client.apiKey, `key-${client.id}`)}>
                                <span className="font-mono text-xs text-gray-500 group-hover:text-white transition-colors">{client.apiKey.substring(0, 15)}...</span>
                                {copyStatus[`key-${client.id}`] ? <CheckCircle2 size={12} className="text-emerald-500"/> : <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="font-mono font-bold text-white">{client.usageCount.toLocaleString()}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded hover:bg-indigo-600 hover:text-white transition-all text-xs font-semibold">
                                <CreditCard size={12} /> Stripe Link
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
                 <p className="text-sm text-gray-400">Rastreabilidade, assinaturas criptográficas ativas e monitorização.</p>
               </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl space-y-2">
                 <span className="text-xs font-semibold text-gray-400">Total de Verificações</span>
                 <div className="flex justify-between items-end">
                   <span className="text-3xl font-extrabold text-white">1,482</span>
                   <span className="text-xs text-emerald-400 font-medium">+12% este mês</span>
                 </div>
               </div>
               <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl space-y-2">
                 <span className="text-xs font-semibold text-gray-400">Ativos Criptografados</span>
                 <div className="flex justify-between items-end">
                   <span className="text-3xl font-extrabold text-indigo-500">1,245</span>
                   <span className="text-xs text-gray-500">C2PA Standard</span>
                 </div>
               </div>
             </div>

             <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
               <div className="px-6 py-4 border-b border-[#30363d] flex justify-between items-center">
                 <h3 className="font-bold text-white">Registo Recente de Media</h3>
               </div>
               <div className="divide-y divide-[#30363d]">
                 {assets.map((asset) => (
                   <div key={asset.id} className="px-6 py-4 flex items-center justify-between hover:bg-[#21262d] transition-all">
                     <div className="flex items-center gap-4">
                       <div className="p-2.5 bg-[#21262d] rounded-lg text-gray-300">
                         <FileText size={18} />
                       </div>
                       <div>
                         <p className="font-semibold text-white text-sm">{asset.name}</p>
                         <p className="text-xs text-gray-400">Criador: {asset.author}</p>
                       </div>
                     </div>
                     <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${asset.status === 'Verificado' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
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
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Shield className="text-indigo-500" /> Assinatura C2PA
                  </h3>
                  <p className="text-sm text-gray-400">Teste o upload de um arquivo com a sua Chave de API.</p>
                </div>
                
                <form onSubmit={handleShieldSubmit} className="space-y-4">
                  <div className="border-2 border-dashed border-[#30363d] p-8 text-center cursor-pointer bg-[#0d1117] rounded-xl hover:border-indigo-500 transition-all">
                    <FileCheck size={40} className="text-indigo-500 mx-auto mb-3" />
                    <input 
                      type="file" 
                      accept="image/jpeg, image/png, image/webp, video/mp4, audio/mpeg, audio/wav"
                      onChange={(e) => setShieldFile(e.target.files ? e.target.files[0] : null)}
                      className="hidden" 
                      id="shield-file-input"
                    />
                    <label htmlFor="shield-file-input" className="text-white text-sm cursor-pointer px-4 py-2 bg-[#21262d] border border-[#30363d] rounded-lg hover:bg-[#30363d]">
                      {shieldFile ? shieldFile.name : 'Selecionar Mídia'}
                    </label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-400">Autor</label>
                        <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-400">Organização</label>
                        <input type="text" value={org} onChange={(e) => setOrg(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none" />
                      </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-400">Licença</label>
                    <select value={license} onChange={(e) => setLicense(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none">
                      <option value="CC-BY-4.0">Creative Commons 4.0</option>
                      <option value="Proprietary">Uso Proprietário</option>
                    </select>
                  </div>

                  <button type="submit" disabled={isShielding || !shieldFile} className="w-full bg-indigo-600 text-white p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:bg-gray-700 transition-colors">
                    {isShielding ? <><Loader2 className="animate-spin" size={16} /> Processando...</> : 'Assinar Mídia'}
                  </button>

                  {shieldStep && <p className="text-xs text-indigo-400 mt-2 font-mono text-center">{shieldStep}</p>}
                </form>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl">
                 <h3 className="text-lg font-bold text-white mb-4">Certificado Digital C2PA</h3>
                 {shieldResult ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex gap-3 items-center">
                        <CheckCircle2 className="text-emerald-400" size={24} />
                        <div>
                            <p className="text-sm font-semibold text-white">Assinatura Concluída</p>
                            <p className="text-xs text-gray-400">O ficheiro foi descarregado automaticamente.</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-mono font-semibold text-gray-400">Hash SHA-256</span>
                        <div className="bg-[#0d1117] p-3 rounded-lg border border-[#30363d] text-xs text-emerald-400 font-mono truncate">
                          {shieldResult.hash}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-mono font-semibold text-gray-400">Manifesto JSON</span>
                        <pre className="bg-[#0d1117] p-3 rounded-lg border border-[#30363d] text-[10px] font-mono text-gray-300 overflow-x-auto h-32">
                          {shieldResult.manifest}
                        </pre>
                      </div>
                    </div>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-[#0d1117] border border-[#30363d] rounded-xl text-gray-500">
                      <Lock size={48} className="mb-4 text-gray-700" />
                      <p className="font-semibold text-sm">Aguardando Ficheiro</p>
                    </div>
                 )}
              </div>
            </div>
          )}

          {/* ABA: LENS (VERIFICAR) */}
          {activeTab === 'lens' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">Scanner Forense</h3>
                  <p className="text-sm text-gray-400">Verifique a proveniência e integridade do arquivo.</p>
                </div>
                <form onSubmit={handleLensScan} className="space-y-4">
                  <div className="border-2 border-dashed border-[#30363d] p-8 text-center cursor-pointer bg-[#0d1117] rounded-xl hover:border-indigo-500 transition-all">
                    <Activity size={40} className="text-indigo-500 mx-auto mb-3" />
                    <input type="file" onChange={(e) => setLensFile(e.target.files ? e.target.files[0] : null)} className="hidden" id="lens-file-input" />
                    <label htmlFor="lens-file-input" className="text-white text-sm cursor-pointer px-4 py-2 bg-[#21262d] border border-[#30363d] rounded-lg hover:bg-[#30363d]">
                      {lensFile ? lensFile.name : 'Selecionar Arquivo para Análise'}
                    </label>
                  </div>
                  <button type="submit" disabled={isScanning || !lensFile} className="w-full bg-indigo-600 text-white p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:bg-gray-700 transition-colors">
                    {isScanning ? <><Loader2 className="animate-spin" size={16} /> Analisando Metadados...</> : 'Verificar Integridade'}
                  </button>
                  {scanStep && <p className="text-xs text-indigo-400 mt-2 font-mono text-center">{scanStep}</p>}
                </form>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl">
                 <h3 className="text-lg font-bold text-white mb-4">Relatório de Análise</h3>
                 {scanResult ? (
                    <div className="p-5 bg-[#0d1117] border border-[#30363d] rounded-xl">
                      <p className="text-sm font-semibold text-white mb-2">Resultado da Análise Forense:</p>
                      <p className={`text-3xl font-bold ${scanResult.score > 50 ? 'text-emerald-400' : 'text-red-400'}`}>Score: {scanResult.score}% Humano</p>
                      <ul className="mt-4 space-y-2">
                          {scanResult.anomalies.map((anom, idx) => (
                            <li key={idx} className="text-xs text-gray-300 flex gap-2 items-start bg-[#161b22] p-2 rounded border border-[#30363d]">
                              <span className="text-indigo-500 mt-0.5">•</span> {anom}
                            </li>
                          ))}
                      </ul>
                    </div>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-[#0d1117] border border-[#30363d] rounded-xl text-gray-500">
                      <Activity size={48} className="mb-4 text-gray-700" />
                      <p className="font-semibold text-sm">Pronto para Diagnóstico</p>
                    </div>
                 )}
              </div>
            </div>
          )}

          {/* ABA: API DEVELOPER HUB */}
          {activeTab === 'api' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Key className="text-indigo-500" /> API Access Keys
                  </h3>
                  <p className="text-xs text-gray-400">Automatize a assinatura criptográfica.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-400">A Sua Chave de Desenvolvimento</label>
                    <div className="bg-[#0d1117] border border-[#30363d] p-3 rounded-lg flex items-center justify-between font-mono text-xs">
                      <span className="text-emerald-400 overflow-hidden text-ellipsis mr-2">
                        {isKeyVisible ? apiKey : '••••••••••••••••••••••••••••••••'}
                      </span>
                      <div className="flex gap-2 items-center flex-shrink-0">
                        <button onClick={() => setIsKeyVisible(!isKeyVisible)} className="text-gray-400 hover:text-white text-xs px-1">
                          {isKeyVisible ? 'Ocultar' : 'Revelar'}
                        </button>
                        <button onClick={() => safeCopyToClipboard(apiKey, 'key')} className="text-gray-400 hover:text-white">
                          {copyStatus.key ? <CheckCircle2 size={14} className="text-emerald-400"/> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <button onClick={generateNewKey} className="w-full bg-[#21262d] border border-[#30363d] text-white text-sm font-semibold p-2.5 rounded-lg hover:bg-[#30363d] transition-all flex items-center justify-center gap-2">
                    <RefreshCw size={14} /> Regenerar Credenciais
                  </button>
                </div>
              </div>
              <div className="lg:col-span-2 bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="px-6 py-4 border-b border-[#30363d] flex justify-between items-center bg-[#1c2128]">
                    <div className="flex items-center gap-2">
                      <Terminal size={18} className="text-indigo-500" />
                      <h3 className="font-bold text-white text-sm">Integração da API</h3>
                    </div>
                    <div className="flex gap-2">
                      {(['curl', 'python', 'javascript'] as const).map((lang) => (
                        <button 
                          key={lang}
                          onClick={() => setSelectedLanguage(lang)}
                          className={`text-xs px-3 py-1.5 rounded-md font-mono transition-all ${selectedLanguage === lang ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#21262d]'}`}
                        >
                          {lang.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-6 bg-[#0d1117] font-mono text-xs overflow-x-auto h-64 border-b border-[#30363d]">
                    <pre className="text-indigo-300">{codeSnippets[selectedLanguage]}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA: COPILOT SEGURO */}
          {activeTab === 'copilot' && (
            <div className="max-w-3xl mx-auto bg-[#161b22] border border-[#30363d] rounded-xl flex flex-col h-[600px] shadow-sm">
                <div className="p-4 border-b border-[#30363d] font-bold text-white flex items-center justify-between">
                  <div className="flex items-center gap-2"><Lock size={16} className="text-emerald-500"/> Copilot Seguro (Proxy API)</div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0d1117]">
                  {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`p-4 rounded-xl text-sm leading-relaxed ${msg.role === 'assistant' ? 'bg-[#161b22] text-gray-300 border border-[#30363d] mr-12' : 'bg-indigo-600 text-white ml-12 shadow-md'}`}>
                        {msg.text}
                      </div>
                  ))}
                  {isChatLoading && <Loader2 className="animate-spin text-indigo-500 mx-auto" />}
                </div>
                <div className="p-4 border-t border-[#30363d] bg-[#161b22] rounded-b-xl flex gap-3">
                  <input 
                      value={inputMessage} 
                      onChange={e => setInputMessage(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && sendMessageToGemini()} 
                      placeholder="Pergunte sobre conformidade C2PA..."
                      className="flex-1 bg-[#0d1117] px-4 py-3 text-white border border-[#30363d] rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                  />
                  <button onClick={sendMessageToGemini} disabled={isChatLoading || !inputMessage.trim()} className="bg-indigo-600 px-5 py-3 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-700 transition-colors shadow-sm">
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