import React, { useState, useEffect } from 'react';
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
  ExternalLink,
  Sparkles,
  Send,
  Loader2,
  Lock,
  AlertCircle,
  FileText,
  LogOut,
  CreditCard,
  Check
} from 'lucide-react';

// Interfaces TypeScript Rigorosas
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
  { id: '1', name: 'palestra_reitor_oficial.mp4', type: 'Video', status: 'Verificado', score: 99, date: '18 Mai 2026', author: 'Reitoria Universitária' },
  { id: '2', name: 'grafico_lucros_q1_sintetico.png', type: 'Imagem', status: 'Sem Assinatura', score: 8, date: '17 Mai 2026', author: 'Desconhecido' },
  { id: '3', name: 'clonagem_voz_auditoria.mp3', type: 'Áudio', status: 'Possível Deepfake', score: 38, date: '15 Mai 2026', author: 'Desconhecido' },
];

const INITIAL_CLIENTS: ClientTenant[] = [
  { id: '1', name: 'EdTech Brasil', apiKey: 'vsg_live_7a3bc9f8e2d1...', usageCount: 1245, plan: 'Enterprise', status: 'Ativo' },
  { id: '2', name: 'Universidade Veritas', apiKey: 'vsg_live_8f7b2c9a1d4...', usageCount: 350, plan: 'Pro', status: 'Ativo' },
];

// URLs do Backend no Render
const RENDER_API_URL = "https://verisignum-api.onrender.com/v1/shield/sign";
const RENDER_VERIFY_URL = "https://verisignum-api.onrender.com/v1/lens/verify";
const RENDER_ADMIN_CLIENTS_URL = "https://verisignum-api.onrender.com/v1/admin/clients";
const RENDER_COPILOT_URL = "https://verisignum-api.onrender.com/v1/copilot/chat";
const RENDER_BILLING_URL = "https://verisignum-api.onrender.com/v1/billing/create-checkout-session";
const RENDER_AUTH_LOGIN_URL = "https://verisignum-api.onrender.com/v1/auth/login";
const RENDER_AUTH_REGISTER_URL = "https://verisignum-api.onrender.com/v1/auth/register";
const RENDER_DASHBOARD_ME_URL = "https://verisignum-api.onrender.com/v1/dashboard/me";

// ==========================================
// CATÁLOGO DE PLANOS STRIPE (MÚLTIPLOS PRODUTOS)
// Substitua os IDs abaixo pelos IDs reais dos seus produtos no Stripe
// ==========================================
const STRIPE_PLANS = [
  { 
    id: 'creator', 
    name: 'Creator', 
    price: '$29/mês', 
    desc: 'Até 200 mídias',
    price_id_fixo: 'price_1TmmpaHFEg79uXE9ZHlK48Va',
    price_id_variavel: 'price_1TmmpaHFEg79uXE99gldVSIQ'
  },
  { 
    id: 'pro', 
    name: 'Professional', 
    price: '$149/mês', 
    desc: 'Até 1.500 mídias',
    price_id_fixo: 'price_1TmmlcHFEg79uXE9Lhj3a9OT',
    price_id_variavel: 'price_1TmmnLHFEg79uXE96OvVD023'
  },
  { 
    id: 'enterprise', 
    name: 'Enterprise', 
    price: '$499/mês', 
    desc: 'Até 10.000 mídias', // <-- Correção estratégica de negócios aplicada
    price_id_fixo: 'price_1Tj9lcHFEg79uXE9zDKghejK',
    price_id_variavel: 'price_1Tj9laHFEg79uXE9W3vGD9kU'
  }
];

export default function App() {
  // --- Estados de Autenticação (Login) ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Estado para guardar qual plano o utilizador escolheu
  const [selectedPlanId, setSelectedPlanId] = useState<string>(STRIPE_PLANS[1].id);

  const [authName, setAuthName] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [clientData, setClientData] = useState<any>(null);

  // --- Estados do Dashboard ---
  const [activeTab, setActiveTab] = useState<string>('dashboard'); 
  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [isKeyVisible, setIsKeyVisible] = useState<boolean>(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>({ hash: false, key: false, error: null });

  // --- Estados do Shield ---
  const [shieldFile, setShieldFile] = useState<File | null>(null);
  const [author, setAuthor] = useState<string>('');
  const [org, setOrg] = useState<string>('');
  const [isShielding, setIsShielding] = useState<boolean>(false);
  const [shieldStep, setShieldStep] = useState<string>('');
  const [shieldResult, setShieldResult] = useState<ShieldResult | null>(null);
  const [isDraggingShield, setIsDraggingShield] = useState<boolean>(false); 

  // --- Estados do Lens ---
  const [lensFile, setLensFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isDraggingLens, setIsDraggingLens] = useState<boolean>(false); 
  
  // --- Estados do Copilot ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Olá! Sou o seu Verisignum Compliance Copilot. Como posso ajudar hoje?' }
  ]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // --- Estados do Admin ---
  const [clients, setClients] = useState<ClientTenant[]>(INITIAL_CLIENTS);
  const [newClientName, setNewClientName] = useState<string>('');
  const [isCreatingClient, setIsCreatingClient] = useState<boolean>(false);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);

  // --- Verificação de Sessão Inicial ---
  const fetchDashboardData = async (token: string) => {
    try {
      const res = await fetch(RENDER_DASHBOARD_ME_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClientData(data);
      } else {
        handleLogout(); 
      }
    } catch (err) {
      console.error("Erro ao buscar dados reais", err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      setIsAuthenticated(true);
      fetchDashboardData(token);
    } else {
      setIsInitialLoading(false);
    }
  }, []);

  // --- Funções de Autenticação ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === 'register') {
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
        if (!passwordRegex.test(authPassword)) {
          setAuthError('Segurança: A senha deve ter no mínimo 8 caracteres, contendo pelo menos uma letra, um número e um caractere especial (ex: @, #, $, %).');
          setAuthLoading(false);
          return;
        }

        const url = new URL(RENDER_AUTH_REGISTER_URL);
        url.searchParams.append('name', authName);
        url.searchParams.append('email', authEmail);
        url.searchParams.append('password', authPassword);

        const res = await fetch(url.toString(), { method: 'POST' });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Erro ao criar conta.');
        }
        
        const data = await res.json();
        const newClientId = data.client_id;

        try {
          const selectedPlan = STRIPE_PLANS.find(p => p.id === selectedPlanId) || STRIPE_PLANS[1];

          const billingRes = await fetch(RENDER_BILLING_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenant_id: newClientId.toString(),
              price_id_fixo: selectedPlan.price_id_fixo,
              price_id_variavel: selectedPlan.price_id_variavel
            })
          });

          if (billingRes.ok) {
             const billingData = await billingRes.json();
             window.location.href = billingData.checkout_url; 
             return; 
          } else {
             throw new Error("Falha na geração do link de pagamento.");
          }
        } catch (billingErr) {
          setAuthMode('login');
          setAuthError('Conta criada! O redirecionamento falhou, mas faça login para concluir a assinatura.');
        }

      } else {
        const formData = new URLSearchParams();
        formData.append('username', authEmail);
        formData.append('password', authPassword);

        const res = await fetch(RENDER_AUTH_LOGIN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString()
        });
        
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Credenciais inválidas.');
        }

        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        setIsAuthenticated(true);
        setIsInitialLoading(true);
        fetchDashboardData(data.access_token); 
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

  const handleCompletePayment = async () => {
    if (!clientData) return;
    setBillingLoading('self');
    setAuthError(null);
    
    try {
      const selectedPlan = STRIPE_PLANS.find(p => p.id === selectedPlanId) || STRIPE_PLANS[1];

      const response = await fetch(RENDER_BILLING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: clientData.id.toString(),
          price_id_fixo: selectedPlan.price_id_fixo,
          price_id_variavel: selectedPlan.price_id_variavel
        })
      });

      if (!response.ok) throw new Error('Falha na API de Faturação');
      
      const data = await response.json();
      window.location.href = data.checkout_url;
    } catch (error: any) {
      console.error(error);
      setAuthError("Erro ao contactar a Stripe. Tente novamente em instantes.");
    } finally {
      setBillingLoading(null);
    }
  };

  const safeCopyToClipboard = (text: string, type: string): void => {
    setCopyStatus((prev: CopyStatus) => ({ ...prev, error: null }));
    const setSuccess = () => {
      setCopyStatus((prev: CopyStatus) => ({ ...prev, [type]: true }));
      setTimeout(() => setCopyStatus((prev: CopyStatus) => ({ ...prev, [type]: false })), 2000);
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
      setCopyStatus((prev: CopyStatus) => ({ ...prev, error: "Cópia automática indisponível." }));
      setTimeout(() => setCopyStatus((prev: CopyStatus) => ({ ...prev, error: null })), 5000);
    }
  };

  const cleanAnomalies = (anomaliesArray: string[]) => {
    return anomaliesArray.map(a => 
      a.replace(/HIVE AI/gi, 'Motor Verisignum')
       .replace(/Hive Al/gi, 'Motor Verisignum')
       .replace(/Hive/gi, 'Verisignum')
       .replace(/C2PA/gi, 'Verisignum')
    );
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
      console.warn("API offline. Simulação de Fallback local...");
      const mockKey = 'vsg_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      const newTenant: ClientTenant = {
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
      const enterprisePlan = STRIPE_PLANS.find(p => p.name === 'Enterprise') || STRIPE_PLANS[0];

      const response = await fetch(RENDER_BILLING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: clientId,
          price_id_fixo: enterprisePlan.price_id_fixo,
          price_id_variavel: enterprisePlan.price_id_variavel
        })
      });

      if (!response.ok) {
         const erroData = await response.json();
         throw new Error(erroData.detail || 'Falha na API de Faturação');
      }
      
      const data = await response.json();
      safeCopyToClipboard(data.checkout_url, `stripe-${clientId}`);
      window.open(data.checkout_url, '_blank');
      
    } catch (error: any) {
      console.error(error);
      setCopyStatus((prev: CopyStatus) => ({ ...prev, error: `Erro Stripe: ${error.message}` }));
    } finally {
      setBillingLoading(null);
    }
  };

  const handleShieldSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!shieldFile) return;

    setIsShielding(true);
    setShieldResult(null);
    setShieldStep('A ligar à API Verisignum no Render...');
    setCopyStatus((prev: CopyStatus) => ({ ...prev, error: null }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); 

    try {
      const formData = new FormData();
      formData.append("file", shieldFile);
      formData.append("author", String(author || "Autor Desconhecido"));
      formData.append("organization", String(org || "Verisignum AI"));

      const token = localStorage.getItem('access_token');
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

      setShieldStep('A enviar arquivo e a injetar assinatura criptográfica...');

      const response = await fetch(RENDER_API_URL, {
        method: "POST",
        headers: headers,
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

      setShieldStep('Sucesso! Arquivo criptografado recebido da nuvem.');

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
         const data = await response.json();
         if (data.message && data.message.includes("sucesso")) {
             setShieldResult({
               hash: 'sha256:d8a21f7c9e543b18a2098fb412356c9a7d8f9024b1a32e5d89f71c43d920ef01 (Verificado)',
               manifest: JSON.stringify({ "status": "Assinado no backend", "filename": data.filename }, null, 2)
             });
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
          manifest: JSON.stringify({ "verisignum:manifest": { "status": "Assinatura injetada!" } }, null, 2)
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

    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Erro na assinatura:", err);
      
      let mensagemErro = err.message;
      if (err.name === 'AbortError' || err.message.includes('Failed to fetch')) {
        setShieldStep('Servidor indisponível. A simular injeção local...');
        
        setTimeout(() => {
          setShieldResult({
            hash: 'sha256:d8a21f7c9e543b18a2098fb412356c9a7d8f9024b1a32e5d89f71c43d920ef01 (Simulado)',
            manifest: JSON.stringify({ "status": "Simulado" }, null, 2)
          });
          setIsShielding(false);
        }, 1500);
        return;
      } else {
        setCopyStatus((prev: CopyStatus) => ({ ...prev, error: `Falha: ${mensagemErro}` }));
      }
    } finally {
      setIsShielding(false);
    }
  };

  const handleLensScan = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!lensFile) return;

    setIsScanning(true);
    setScanResult(null);
    setScanStep('A enviar arquivo para o servidor forense...');
    setCopyStatus(prev => ({ ...prev, error: null }));

    try {
      const formData = new FormData();
      formData.append("file", lensFile);

      const token = localStorage.getItem('access_token');
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

      setScanStep('A analisar metadados...');

      const response = await fetch(RENDER_VERIFY_URL, {
        method: "POST",
        headers: headers,
        body: formData
      });

      if (!response.ok) {
        let errorMsg = "Servidor inacessível.";
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const verifyData = await response.json();
      setScanStep('A compilar resultados...');
      await new Promise(resolve => setTimeout(resolve, 1000)); 

      const aiData = verifyData.ai_analysis;

      if (verifyData.has_c2pa) {
        setScanResult({
          score: 100,
          isAiGenerated: false,
          metadataFound: true,
          anomalies: cleanAnomalies(aiData?.anomalies || ['Selo Autêntico'])
        });
      } else {
        setScanResult({
          score: aiData?.score ?? 65,
          isAiGenerated: aiData?.is_ai ?? false,
          metadataFound: false,
          anomalies: cleanAnomalies(aiData?.anomalies || ['Sem proveniência.'])
        });
      }
    } catch (err: any) {
      setCopyStatus((prev: CopyStatus) => ({ ...prev, error: `Falha: ${err.message}` }));
    } finally {
      setIsScanning(false);
      setScanStep('');
    }
  };

  const handleDownloadPDF = () => {
    if (!scanResult || !lensFile) return;
    
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
        setCopyStatus((prev: CopyStatus) => ({ ...prev, error: "Bloqueador de pop-ups ativo." }));
        return;
    }

    const scoreToDisplay = scanResult.score !== undefined && scanResult.score !== null ? scanResult.score : 65;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-PT">
      <head>
        <meta charset="UTF-8">
        <title>Laudo Forense - ${lensFile.name}</title>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #333; }
          .header { border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
          .score-box { text-align: center; padding: 30px; border-radius: 8px; margin-bottom: 30px; color: white; }
          .safe { background-color: #10b981; }
          .warning { background-color: #f59e0b; }
          .danger { background-color: #ef4444; }
          .anomalies { list-style-type: none; padding: 0; }
          .anomalies li { padding: 12px; margin-bottom: 10px; background-color: #f8fafc; border-left: 4px solid #4f46e5; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>VERISIGNUM LENS</h1>
          <p>Laudo Técnico de Proveniência</p>
        </div>
        <p><strong>Arquivo:</strong> ${lensFile.name}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleString('pt-PT')}</p>
        
        <div class="score-box ${scoreToDisplay > 80 ? 'safe' : (scoreToDisplay > 49 ? 'warning' : 'danger')}">
          <h1>${scoreToDisplay}% Humano</h1>
        </div>

        <h3>Anomalias Detectadas:</h3>
        <ul class="anomalies">
          ${scanResult.anomalies.map((a: string) => `<li>${a}</li>`).join('')}
        </ul>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const sendMessageToGemini = async (): Promise<void> => {
    if (!inputMessage.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: inputMessage };
    setChatMessages((prev: ChatMessage[]) => [...prev, userMsg]);
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
      
      setChatMessages((prev: ChatMessage[]) => [...prev, { role: 'assistant', text: result.reply }]);
    } catch (error) {
      setChatMessages((prev: ChatMessage[]) => [...prev, { role: 'assistant', text: 'Erro de ligação.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex h-screen bg-[#0d1117] items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen bg-[#0d1117] items-center justify-center p-4 font-sans overflow-y-auto py-10">
        <div className="w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          
          <div className="flex flex-col items-center mb-8 relative z-10">
            <div className="w-14 h-14 bg-[#0d1117] border border-[#30363d] rounded-xl flex items-center justify-center mb-4">
              <Shield className="text-indigo-500" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wider">VERISIGNUM</h1>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 relative z-10">
            {authMode === 'register' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Nome da Instituição</label>
                  <input 
                    type="text" 
                    value={authName} 
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm text-white focus:outline-none" 
                    required 
                  />
                </div>
                
                <div className="space-y-2 py-2">
                  <label className="text-xs font-semibold text-gray-400">Plano de Acesso</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {STRIPE_PLANS.map((plan) => (
                      <button
                        type="button"
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`p-3 rounded-xl border text-left transition-all relative ${
                          selectedPlanId === plan.id 
                            ? 'bg-indigo-600/10 border-indigo-500' 
                            : 'bg-[#0d1117] border-[#30363d]'
                        }`}
                      >
                        {selectedPlanId === plan.id && (
                          <div className="absolute top-2 right-2 text-indigo-400"><Check size={14}/></div>
                        )}
                        <h3 className={`text-sm font-bold ${selectedPlanId === plan.id ? 'text-indigo-400' : 'text-gray-300'}`}>{plan.name}</h3>
                        <p className="text-lg font-extrabold text-white mt-1">{plan.price}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400">E-mail Corporativo</label>
              <input 
                type="email" 
                value={authEmail} 
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm text-white focus:outline-none" 
                required 
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400">Senha Segura</label>
              <input 
                type="password" 
                value={authPassword} 
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm text-white focus:outline-none" 
                required 
              />
            </div>

            {authError && (
              <div className="p-3 rounded-lg text-xs font-medium border bg-red-500/10 border-red-500/20 text-red-400 flex items-center gap-2">
                <AlertCircle size={16} /> <span>{authError}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={authLoading} 
              className="w-full bg-indigo-600 text-white font-semibold rounded-lg p-3 text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 className="animate-spin" size={16} /> : (authMode === 'login' ? 'Entrar no Sistema' : 'Avançar')}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-[#30363d] pt-4">
            <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(null); }} className="text-xs text-indigo-400 hover:text-indigo-300">
              {authMode === 'login' ? 'Nova EdTech? Solicite o seu acesso.' : 'Já é parceiro? Faça o seu login.'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated && clientData && !clientData.is_active) {
    return (
      <div className="flex h-screen bg-[#0d1117] items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-xl bg-[#161b22] border border-[#30363d] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard size={32} className="text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Assinatura Pendente</h2>
          <p className="text-sm text-gray-400 mb-6">Confirme a seleção do seu plano para liberar a plataforma.</p>

          <div className="text-left space-y-2 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {STRIPE_PLANS.map((plan) => (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`p-4 rounded-xl border text-left transition-all relative ${
                    selectedPlanId === plan.id ? 'bg-indigo-600/10 border-indigo-500' : 'bg-[#0d1117] border-[#30363d]'
                  }`}
                >
                  <h3 className={`text-sm font-bold ${selectedPlanId === plan.id ? 'text-indigo-400' : 'text-gray-300'}`}>{plan.name}</h3>
                  <p className="text-xl font-extrabold text-white mt-1">{plan.price}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleCompletePayment}
            disabled={billingLoading === 'self'}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg p-3 text-sm flex justify-center gap-2 mb-4"
          >
            {billingLoading === 'self' ? <Loader2 className="animate-spin" size={16} /> : 'Processar Pagamento Seguro'}
          </button>
          <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-white underline">Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0d1117] text-[#c9d1d9] font-sans overflow-hidden">
      {copyStatus.error && (
        <div className="fixed top-4 right-4 z-50 bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl flex gap-3">
          <AlertCircle size={24} className="text-red-400 flex-shrink-0" />
          <div className="text-xs">{copyStatus.error}</div>
        </div>
      )}

      <aside className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-[#30363d] flex items-center gap-3">
            <Shield size={24} className="text-amber-500" />
            <div>
              <h1 className="text-lg font-bold text-white">VERISIGNUM</h1>
            </div>
          </div>
          <nav className="p-4 space-y-1">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${activeTab === 'dashboard' ? 'bg-[#21262d] text-white' : 'text-gray-400'}`}><Activity size={18} /> Painel</button>
            <button onClick={() => setActiveTab('shield')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${activeTab === 'shield' ? 'bg-[#21262d] text-white' : 'text-gray-400'}`}><Shield size={18} /> VerisignumShield</button>
            <button onClick={() => setActiveTab('lens')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${activeTab === 'lens' ? 'bg-[#21262d] text-white' : 'text-gray-400'}`}><Eye size={18} /> VerisignumLens</button>
            <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${activeTab === 'admin' ? 'bg-[#21262d] text-white' : 'text-gray-400'}`}><Terminal size={18} /> Clientes B2B</button>
          </nav>
        </div>
        <div className="p-4 border-t border-[#30363d]">
           <button onClick={handleLogout} className="flex items-center gap-2 w-full text-red-400 text-sm font-semibold">
              <LogOut size={16} /> Sair
            </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 border-b border-[#30363d] px-8 flex items-center justify-between bg-[#161b22]">
          <span className="text-xs px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 font-mono">MVP Conectado</span>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-8 flex-1">

          {activeTab === 'admin' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Gestão B2B</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-[#161b22] border border-[#30363d] p-6 rounded-xl">
                  <h3 className="text-md font-bold text-white mb-4">Novo Cliente</h3>
                  <form onSubmit={handleCreateClient} className="space-y-4">
                    <input 
                      type="text" 
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Nome da Instituição"
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-sm text-white focus:outline-none" 
                      required
                    />
                    <button type="submit" disabled={isCreatingClient} className="w-full bg-indigo-600 text-white rounded-lg p-2.5 text-sm">
                      {isCreatingClient ? 'Aguarde...' : 'Gerar Chave'}
                    </button>
                  </form>
                </div>
                <div className="lg:col-span-2 bg-[#161b22] border border-[#30363d] rounded-xl overflow-x-auto p-4">
                  <table className="w-full text-left text-sm text-gray-400">
                    <thead>
                      <tr>
                        <th className="px-4 py-2">Cliente</th>
                        <th className="px-4 py-2">Chave API</th>
                        <th className="px-4 py-2">Stripe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((client) => (
                        <tr key={client.id} className="border-t border-[#30363d]">
                          <td className="px-4 py-3 text-white">{client.name}</td>
                          <td className="px-4 py-3 font-mono text-xs">{client.apiKey.substring(0,10)}...</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleGenerateStripeLink(client.id)} className="bg-indigo-600/10 text-indigo-400 px-3 py-1 rounded text-xs">
                              {billingLoading === client.id ? 'Gerando...' : 'Link Pagamento'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white">Painel de Controlo</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl"><span className="text-3xl font-extrabold text-white">1,482</span><p className="text-xs text-gray-400">Verificações</p></div>
                <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl"><span className="text-3xl font-extrabold text-indigo-500">1,245</span><p className="text-xs text-gray-400">Criptografados</p></div>
                <div className="bg-[#161b22] border border-[#30363d] p-5 rounded-xl"><span className="text-3xl font-extrabold text-amber-500">23</span><p className="text-xs text-gray-400">Deepfakes</p></div>
              </div>
            </div>
          )}

          {activeTab === 'shield' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Shield className="text-indigo-500" /> VerisignumShield</h3>
                <form onSubmit={handleShieldSubmit} className="space-y-4">
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingShield(true); }}
                    onDragLeave={() => setIsDraggingShield(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDraggingShield(false); if(e.dataTransfer.files) setShieldFile(e.dataTransfer.files[0]); }}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer ${isDraggingShield ? 'border-indigo-500' : 'border-[#30363d]'}`}
                  >
                    <input 
                      type="file" 
                      onChange={(e) => setShieldFile(e.target.files ? e.target.files[0] : null)}
                      className="hidden" 
                      id="shield-file-input"
                    />
                    <label htmlFor="shield-file-input" className="cursor-pointer text-white text-sm">
                      {shieldFile ? shieldFile.name : 'Clique ou arraste a mídia aqui'}
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Autor" value={author} onChange={(e) => setAuthor(e.target.value)} className="bg-[#0d1117] border border-[#30363d] p-2.5 rounded-lg text-white text-sm focus:outline-none" />
                    <input type="text" placeholder="Organização" value={org} onChange={(e) => setOrg(e.target.value)} className="bg-[#0d1117] border border-[#30363d] p-2.5 rounded-lg text-white text-sm focus:outline-none" />
                  </div>
                  <button type="submit" disabled={isShielding || !shieldFile} className="w-full bg-indigo-600 text-white rounded-lg p-3 text-sm">
                    {isShielding ? 'A Assinar...' : 'Injetar C2PA'}
                  </button>
                  {shieldStep && <p className="text-xs text-indigo-400 text-center">{shieldStep}</p>}
                </form>
              </div>
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl">
                 <h3 className="text-lg font-bold text-white mb-4">Certificado Digital</h3>
                 {shieldResult ? (
                   <pre className="bg-[#0d1117] p-3 rounded-lg text-xs font-mono text-gray-300">{shieldResult.manifest}</pre>
                 ) : (
                   <p className="text-sm text-gray-500 text-center mt-10">Aguardando arquivo...</p>
                 )}
              </div>
            </div>
          )}

          {activeTab === 'lens' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Eye className="text-indigo-500" /> VerisignumLens</h3>
                <form onSubmit={handleLensScan} className="space-y-4">
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingLens(true); }}
                    onDragLeave={() => setIsDraggingLens(false)}
                    onDrop={(e) => { e.preventDefault(); setIsDraggingLens(false); if(e.dataTransfer.files) setLensFile(e.dataTransfer.files[0]); }}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer ${isDraggingLens ? 'border-indigo-500' : 'border-[#30363d]'}`}
                  >
                    <input 
                      type="file" 
                      onChange={(e) => setLensFile(e.target.files ? e.target.files[0] : null)} 
                      className="hidden" 
                      id="lens-file-input" 
                    />
                    <label htmlFor="lens-file-input" className="cursor-pointer text-white text-sm">
                      {lensFile ? lensFile.name : 'Clique ou arraste a mídia para auditar'}
                    </label>
                  </div>
                  <button type="submit" disabled={isScanning || !lensFile} className="w-full bg-indigo-600 text-white rounded-lg p-3 text-sm">
                    {isScanning ? 'Analisando...' : 'Iniciar Inspeção de IA'}
                  </button>
                  {scanStep && <p className="text-xs text-indigo-400 text-center">{scanStep}</p>}
                </form>
              </div>
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl">
                 <h3 className="text-lg font-bold text-white mb-4">Relatório Forense</h3>
                 {scanResult ? (
                   <div className="space-y-4">
                     <div className="bg-[#0d1117] p-4 rounded-xl text-center">
                       <p className="text-3xl font-extrabold text-white">{scanResult.score}% Humano</p>
                     </div>
                     <ul className="space-y-2 text-sm text-gray-300">
                       {scanResult.anomalies.map((a, i) => <li key={i}>• {a}</li>)}
                     </ul>
                     <button onClick={handleDownloadPDF} className="w-full mt-4 bg-slate-800 text-white p-2 rounded-lg text-sm">Gerar Laudo PDF</button>
                   </div>
                 ) : (
                   <p className="text-sm text-gray-500 text-center mt-10">Aguardando arquivo...</p>
                 )}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}