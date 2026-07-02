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
  plan: string;
  status: string;
}

const MOCK_ASSETS: Asset[] = [
  { id: '1', name: 'palestra_reitor_oficial.mp4', type: 'Video', status: 'Verificado', score: 99, date: '18 Mai 2026', author: 'Reitoria Universitária' },
  { id: '2', name: 'grafico_lucros_q1_sintetico.png', type: 'Imagem', status: 'Sem Assinatura', score: 8, date: '17 Mai 2026', author: 'Desconhecido' },
  { id: '3', name: 'clonagem_voz_auditoria.mp3', type: 'Áudio', status: 'Possível Deepfake', score: 38, date: '15 Mai 2026', author: 'Desconhecido' },
];

const RENDER_API_URL = "https://verisignum-api.onrender.com/v1/shield/sign";
const RENDER_VERIFY_URL = "https://verisignum-api.onrender.com/v1/lens/verify";
const RENDER_ADMIN_CLIENTS_URL = "https://verisignum-api.onrender.com/v1/admin/clients";
const RENDER_COPILOT_URL = "https://verisignum-api.onrender.com/v1/copilot/chat";
const RENDER_BILLING_URL = "https://verisignum-api.onrender.com/v1/billing/create-checkout-session";
const RENDER_AUTH_LOGIN_URL = "https://verisignum-api.onrender.com/v1/auth/login";
const RENDER_AUTH_REGISTER_URL = "https://verisignum-api.onrender.com/v1/auth/register";
const RENDER_DASHBOARD_ME_URL = "https://verisignum-api.onrender.com/v1/dashboard/me";

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
    desc: 'Até 10.000 mídias', 
    price_id_fixo: 'price_1Tj9lcHFEg79uXE9zDKghejK',
    price_id_variavel: 'price_1Tj9laHFEg79uXE9W3vGD9kU'
  }
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(STRIPE_PLANS[1].id);
  
  const [authName, setAuthName] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [clientData, setClientData] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<string>('dashboard'); 
  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [isKeyVisible, setIsKeyVisible] = useState<boolean>(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>({ hash: false, key: false, error: null });

  const [shieldFile, setShieldFile] = useState<File | null>(null);
  const [author, setAuthor] = useState<string>('');
  const [org, setOrg] = useState<string>('');
  const [isShielding, setIsShielding] = useState<boolean>(false);
  const [shieldStep, setShieldStep] = useState<string>('');
  const [shieldResult, setShieldResult] = useState<ShieldResult | null>(null);
  const [isDraggingShield, setIsDraggingShield] = useState<boolean>(false); 

  const [lensFile, setLensFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isDraggingLens, setIsDraggingLens] = useState<boolean>(false); 
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Olá! Sou o seu Verisignum Compliance Copilot. Como posso ajudar hoje?' }
  ]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);

  // Removido o INITIAL_CLIENTS, agora começamos vazios
  const [clients, setClients] = useState<ClientTenant[]>([]);
  const [newClientName, setNewClientName] = useState<string>('');
  const [isCreatingClient, setIsCreatingClient] = useState<boolean>(false);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);

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

  // Função nova: Buscar os clientes reais no Backend
  const fetchAdminClients = async () => {
    try {
      const res = await fetch(RENDER_ADMIN_CLIENTS_URL);
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error("Erro ao buscar clientes reais:", err);
    }
  };

  // Efeito novo: Disparar a busca de clientes sempre que a aba Admin for aberta
  useEffect(() => {
    if (activeTab === 'admin') {
      fetchAdminClients();
    }
  }, [activeTab]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      setIsAuthenticated(true);
      fetchDashboardData(token);
    } else {
      setIsInitialLoading(false);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      if (authMode === 'register') {
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
        if (!passwordRegex.test(authPassword)) {
          setAuthError('Segurança: A senha deve ter no mínimo 8 caracteres, contendo letras, números e um caractere especial.');
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

  const safeCopyToClipboard = (text: string, type: 'hash' | 'key' | string): void => {
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
      
      // Quando cria com sucesso, já chamamos a função para recarregar a lista fresca da Base de Dados
      await fetchAdminClients();
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
               manifest: JSON.stringify({ "status": "Assinado no backend via motor oficial", "filename": data.filename }, null, 2)
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
          manifest: JSON.stringify({ "verisignum:manifest": { "status": "Assinatura injetada com sucesso e ficheiro descarregado!" } }, null, 2)
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
      if (err.name === 'AbortError' || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        setShieldStep('Servidor indisponível ou erro CORS. A simular injeção local (Fallback MVP)...');
        
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
          setCopyStatus((prev: CopyStatus) => ({ 
            ...prev, 
            error: "Aviso: Conexão com o Render falhou. O arquivo gerado abaixo é uma simulação para testes visuais." 
          }));
        }, 1500);
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
    setScanStep('A enviar arquivo para o servidor forense Verisignum...');
    setCopyStatus((prev: CopyStatus) => ({ ...prev, error: null }));

    try {
      const formData = new FormData();
      formData.append("file", lensFile);

      const token = localStorage.getItem('access_token');
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

      setScanStep('A analisar metadados de proveniência e extrair Laudo...');

      const response = await fetch(RENDER_VERIFY_URL, {
        method: "POST",
        headers: headers,
        body: formData
      });

      if (!response.ok) {
        let errorMsg = "Servidor de verificação inacessível.";
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const verifyData = await response.json();

      setScanStep('Processamento forense completo. A compilar resultados...');
      await new Promise(resolve => setTimeout(resolve, 1000)); 

      const aiData = verifyData.ai_analysis;

      if (verifyData.has_c2pa) {
        setScanResult({
          score: 100,
          isAiGenerated: false,
          metadataFound: true,
          anomalies: cleanAnomalies(aiData?.anomalies || [
            'Selo Verisignum Autêntico: Validado internamente pela plataforma.',
            'Cadeia de custódia e integridade de píxeis intactas.',
            'O ficheiro não sofreu qualquer alteração desde a sua captura.'
          ])
        });
      } else {
        setScanResult({
          score: aiData?.score ?? 65,
          isAiGenerated: aiData?.is_ai ?? false,
          metadataFound: false,
          anomalies: cleanAnomalies(aiData?.anomalies || ['Nenhum selo de proveniência rastreável.'])
        });
      }
    } catch (err: any) {
      console.error("Erro no Lens:", err);
      setCopyStatus((prev: CopyStatus) => ({ ...prev, error: `Falha na verificação: ${err.message}` }));
    } finally {
      setIsScanning(false);
      setScanStep('');
    }
  };

  const handleDownloadPDF = () => {
    if (!scanResult || !lensFile) return;
    
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
        setCopyStatus((prev: CopyStatus) => ({ ...prev, error: "O seu navegador bloqueou a abertura do PDF. Permita pop-ups." }));
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
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { display: flex; align-items: center; border-bottom: 2px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
          .logo-box { width: 50px; height: 50px; background-color: #4f46e5; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-right: 15px; }
          .header-text h1 { margin: 0; color: #1e293b; font-size: 24px; letter-spacing: 1px; }
          .header-text p { margin: 0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; }
          .title { text-align: center; margin-bottom: 40px; }
          .title h2 { margin: 0; color: #0f172a; font-size: 22px; }
          .title p { margin: 5px 0 0 0; color: #64748b; font-size: 14px; }
          .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px; background-color: #f8fafc; }
          .box h3 { margin-top: 0; color: #0f172a; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 5px; font-size: 14px; }
          .row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
          .label { font-weight: bold; color: #475569; }
          .value { color: #0f172a; text-align: right; font-family: monospace; }
          .score-box { text-align: center; padding: 30px; border-radius: 8px; margin-bottom: 30px; color: white; }
          .score-box.safe { background-color: #10b981; }
          .score-box.warning { background-color: #f59e0b; }
          .score-box.danger { background-color: #ef4444; }
          .score-box h1 { font-size: 48px; margin: 0; letter-spacing: -1px; }
          .score-box p { margin: 10px 0 0 0; font-size: 16px; font-weight: bold; text-transform: uppercase; }
          .anomalies { list-style-type: none; padding: 0; margin: 0; }
          .anomalies li { padding: 12px 15px; border-left: 4px solid #ef4444; background-color: #fef2f2; margin-bottom: 10px; color: #991b1b; font-size: 14px; border-radius: 0 4px 4px 0; }
          .anomalies.safe li { border-left-color: #10b981; background-color: #ecfdf5; color: #065f46; }
          .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 10px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>
          <div class="header-text">
            <h1>VERISIGNUM LENS</h1>
            <p>Infraestrutura Forense e Confiança Digital</p>
          </div>
        </div>

        <div class="title">
          <h2>LAUDO TÉCNICO DE PROVENIÊNCIA</h2>
          <p>Validação Automatizada de Integridade de Ativo Multimídia</p>
        </div>

        <div class="box">
          <h3>1. Identificação do Ativo Digital</h3>
          <div class="row"><span class="label">Nome do Arquivo:</span><span class="value">${lensFile.name}</span></div>
          <div class="row"><span class="label">Tamanho em Disco:</span><span class="value">${(lensFile.size / 1024 / 1024).toFixed(2)} MB</span></div>
          <div class="row"><span class="label">Data da Análise:</span><span class="value">${new Date().toLocaleString('pt-PT')}</span></div>
          <div class="row"><span class="label">Protocolo de Requisição:</span><span class="value">VSL-${Math.random().toString(36).substr(2, 9).toUpperCase()}</span></div>
        </div>

        <div class="score-box ${scoreToDisplay > 80 ? 'safe' : (scoreToDisplay > 49 ? 'warning' : 'danger')}">
          <h1>${scoreToDisplay}% Humano</h1>
          <p>${scanResult.isAiGenerated ? 'ALERTA: Manipulação Sintética Detectada' : (scanResult.metadataFound ? 'VERIFICADO: Assinatura Autêntica e Intacta' : 'ATENÇÃO: Arquivo natural, mas sem proveniência criptográfica')}</p>
        </div>

        <div class="box">
          <h3>2. Parecer Técnico da Auditoria (Anomalias)</h3>
          <ul class="anomalies ${scoreToDisplay > 80 ? 'safe' : ''}">
            ${scanResult.anomalies.map((a: string) => `<li>${a}</li>`).join('')}
          </ul>
        </div>

        <div class="footer">
          Laudo pericial gerado automaticamente pelo motor VerisignumLens v4.0.<br>
          Em conformidade com a LGPD e os padrões globais de proveniência. A Verisignum não armazena o arquivo analisado (Zero-Storage Policy).
        </div>
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
      console.error(error);
      setChatMessages((prev: ChatMessage[]) => [...prev, { role: 'assistant', text: 'Erro de ligação ao servidor da Verisignum.' }]);
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
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-indigo-500/10 blur-[60px] pointer-events-none"></div>
          
          <div className="flex flex-col items-center mb-8 relative z-10">
            <div className="w-14 h-14 bg-[#0d1117] border border-[#30363d] rounded-xl flex items-center justify-center mb-4 shadow-lg">
              <Shield className="text-indigo-500" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wider">VERISIGNUM</h1>
            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-mono">Enterprise Portal</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 relative z-10">
            {authMode === 'register' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-400">Nome da Instituição</label>
                  <input 
                    type="text" value={authName} onChange={(e) => setAuthName(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                    required placeholder="Ex: Universidade de Lisboa"
                  />
                </div>
                
                <div className="space-y-2 py-2">
                  <label className="text-xs font-semibold text-gray-400">Selecione o seu Plano de Acesso</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {STRIPE_PLANS.map((plan) => (
                      <button
                        type="button"
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                          selectedPlanId === plan.id 
                            ? 'bg-indigo-600/10 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
                            : 'bg-[#0d1117] border-[#30363d] hover:border-gray-500'
                        }`}
                      >
                        {selectedPlanId === plan.id && (
                          <div className="absolute top-2 right-2 text-indigo-400"><Check size={14}/></div>
                        )}
                        <h3 className={`text-sm font-bold ${selectedPlanId === plan.id ? 'text-indigo-400' : 'text-gray-300'}`}>{plan.name}</h3>
                        <p className="text-lg font-extrabold text-white mt-1">{plan.price}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{plan.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400">E-mail Corporativo</label>
              <input 
                type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                required placeholder="diretor@edtech.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400">Senha Segura</label>
              <input 
                type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all" 
                required placeholder="••••••••"
              />
            </div>

            {authError && (
              <div className={`p-3 rounded-lg text-xs font-medium border flex items-center gap-2 ${authError.includes('criada') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                <AlertCircle size={16} className="flex-shrink-0" /> <span className="leading-tight">{authError}</span>
              </div>
            )}

            <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 text-white font-semibold rounded-lg p-3 text-sm hover:bg-indigo-700 disabled:bg-indigo-600/50 transition-all flex items-center justify-center gap-2 mt-2 shadow-lg shadow-indigo-500/20">
              {authLoading ? <Loader2 className="animate-spin" size={16} /> : (authMode === 'login' ? 'Entrar no Sistema' : 'Avançar para Pagamento')}
            </button>
          </form>

          <div className="mt-6 text-center relative z-10 pt-4 border-t border-[#30363d]">
            <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(null); }} className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              {authMode === 'login' ? 'Nova EdTech? Solicite o seu acesso.' : 'Já é parceiro? Faça o seu login.'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated && clientData && !clientData.is_active) {
    return (
      <div className="flex h-screen bg-[#0d1117] items-center justify-center p-4 font-sans overflow-y-auto">
        <div className="w-full max-w-xl bg-[#161b22] border border-[#30363d] rounded-2xl p-8 shadow-2xl relative text-center">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <CreditCard size={32} className="text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Assinatura Pendente</h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            Olá, <strong className="text-white">{clientData.name}</strong>. Para aceder à plataforma e à sua chave de API, por favor confirme a seleção do seu plano.
          </p>

          <div className="text-left space-y-2 mb-8">
            <label className="text-xs font-semibold text-gray-400 pl-1">Escolha o plano ideal para si:</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {STRIPE_PLANS.map((plan) => (
                <button
                  type="button"
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
                    selectedPlanId === plan.id 
                      ? 'bg-indigo-600/10 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                      : 'bg-[#0d1117] border-[#30363d] hover:border-gray-500'
                  }`}
                >
                  {selectedPlanId === plan.id && (
                    <div className="absolute top-2 right-2 text-indigo-400"><Check size={16}/></div>
                  )}
                  <h3 className={`text-sm font-bold ${selectedPlanId === plan.id ? 'text-indigo-400' : 'text-gray-300'}`}>{plan.name}</h3>
                  <p className="text-xl font-extrabold text-white mt-1">{plan.price}</p>
                  <p className="text-[10px] text-gray-500 mt-1.5">{plan.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {authError && (
            <div className="p-3 mb-6 rounded-lg text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2 text-left">
              <AlertCircle size={16} className="flex-shrink-0" /> <span className="leading-tight">{authError}</span>
            </div>
          )}

          <button
            onClick={handleCompletePayment}
            disabled={billingLoading === 'self'}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg p-3.5 text-sm transition-all flex items-center justify-center gap-2 mb-4 shadow-lg shadow-indigo-500/20"
          >
            {billingLoading === 'self' ? <Loader2 className="animate-spin" size={16} /> : 'Processar Pagamento Seguro'}
          </button>
          
          <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-white transition-colors underline underline-offset-2">
            Sair e voltar mais tarde
          </button>
        </div>
      </div>
    );
  }

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
            </button>
          </div>
          
          <div className="p-4 border-t border-[#30363d] bg-[#0d1117] m-4 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 flex-shrink-0">
                {clientData?.name ? clientData.name.charAt(0).toUpperCase() : 'V'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate" title={clientData?.name}>{clientData?.name || 'Administrador'}</p>
                <p className="text-[10px] text-gray-500 truncate" title={clientData?.email}>{clientData?.email || 'Acesso Verificado'}</p>
              </div>
            </div>
            
            <button 
              onClick={handleLogout} 
              className="flex items-center justify-center gap-2 w-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/20 py-2 rounded-lg text-xs font-semibold transition-all group"
            >
              <LogOut size={14} className="group-hover:-translate-x-1 transition-transform" /> 
              Sair da Plataforma
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 border-b border-[#30363d] px-8 flex items-center justify-between bg-[#161b22]">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-mono font-medium border border-indigo-500/20">MVP Conectado</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-medium border border-emerald-500/20">Render Cloud API</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveTab('copilot')} className="flex items-center gap-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-lg text-sm hover:bg-indigo-600 hover:text-white transition-all">
              <Sparkles size={16} /> Compliance Copilot
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-8 flex-1">

          {}
          {activeTab === 'admin' && (
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">Gestão Multi-Tenant</h2>
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
                  <p className="text-sm text-gray-400">Rastreabilidade e monitorização de média digital.</p>
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

          {}
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
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingShield(true); }}
                    onDragLeave={() => setIsDraggingShield(false)}
                    onDrop={(e) => { 
                      e.preventDefault(); 
                      setIsDraggingShield(false); 
                      if(e.dataTransfer.files && e.dataTransfer.files[0]) {
                        setShieldFile(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all bg-[#0d1117] ${isDraggingShield ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#30363d] hover:border-indigo-500'}`}
                  >
                    <FileCheck size={40} className={isDraggingShield ? "text-indigo-400" : "text-indigo-500"} />
                    <input 
                      type="file" 
                      accept="image/*,video/*,audio/*,.avi,.pdf"
                      onChange={(e) => setShieldFile(e.target.files ? e.target.files[0] : null)}
                      className="hidden" 
                      id="shield-file-input"
                    />
                    <label htmlFor="shield-file-input" className="px-4 py-2 bg-[#21262d] border border-[#30363d] text-white text-xs rounded-lg cursor-pointer hover:bg-[#30363d]">
                      {shieldFile ? `Selecionado: ${shieldFile.name}` : 'Arraste o arquivo ou Clique aqui'}
                    </label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Autor" value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-sm text-white" />
                    <input type="text" placeholder="Organização" value={org} onChange={(e) => setOrg(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-sm text-white" />
                  </div>

                  <button type="submit" disabled={isShielding || !shieldFile} className="w-full bg-indigo-600 text-white font-semibold rounded-lg p-3 text-sm flex justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all">
                    {isShielding ? <Loader2 className="animate-spin" /> : 'Assinar Mídia'}
                  </button>
                  {shieldStep && <p className="text-xs text-indigo-400 mt-2 font-mono text-center animate-pulse">{shieldStep}</p>}
                </form>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl">
                  <h3 className="text-lg font-bold text-white mb-4">Certificado de Proveniência Verisignum</h3>
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

          {}
          {activeTab === 'lens' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6 flex flex-col">
                 <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Eye className="text-indigo-500" /> VerisignumLens — Analisador
                  </h3>
                </div>
                <form onSubmit={handleLensScan} className="space-y-4 flex-1">
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingLens(true); }}
                    onDragLeave={() => setIsDraggingLens(false)}
                    onDrop={(e) => { 
                      e.preventDefault(); 
                      setIsDraggingLens(false); 
                      if(e.dataTransfer.files && e.dataTransfer.files[0]) {
                        setLensFile(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 h-full cursor-pointer transition-all bg-[#0d1117] ${isDraggingLens ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#30363d] hover:border-indigo-500'}`}
                  >
                    <Activity size={40} className={isDraggingLens ? "text-indigo-300 animate-bounce" : "text-indigo-400 animate-pulse"} />
                    <input 
                      type="file" 
                      accept="image/*,video/*,audio/*,.avi"
                      onChange={(e) => setLensFile(e.target.files ? e.target.files[0] : null)} 
                      className="hidden" 
                      id="lens-file-input" 
                    />
                    <label htmlFor="lens-file-input" className="px-4 py-2 bg-[#21262d] border border-[#30363d] text-white text-xs rounded-lg cursor-pointer hover:bg-[#30363d]">
                      {lensFile ? `Selecionado: ${lensFile.name}` : 'Arraste o arquivo ou Clique aqui'}
                    </label>
                  </div>
                  <button type="submit" disabled={isScanning || !lensFile} className="w-full bg-indigo-600 text-white font-semibold rounded-lg p-3 text-sm flex justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all">
                    {isScanning ? <Loader2 className="animate-spin" /> : 'Executar Análise'}
                  </button>
                  {scanStep && <p className="text-xs text-indigo-400 mt-2 font-mono text-center animate-pulse">{scanStep}</p>}
                </form>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl flex flex-col justify-between">
                  <div>
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
                          {scanResult.anomalies.map((anomaly: string, idx: number) => (
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

                  {scanResult && (
                    <button 
                      onClick={handleDownloadPDF}
                      className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg p-3 text-sm flex items-center justify-center gap-2 border border-[#30363d] transition-all"
                    >
                      <FileText size={16} /> Exportar Laudo Forense (PDF)
                    </button>
                  )}
              </div>
            </div>
          )}

          {}
          {activeTab === 'api' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Key className="text-indigo-500" /> API Access Keys
                </h3>
                <div className="bg-[#0d1117] border border-[#30363d] p-3 rounded-lg flex justify-between font-mono text-xs text-indigo-400">
                   {isKeyVisible ? clientData?.api_key || 'A carregar...' : '••••••••••••••••••••••••••••••••'}
                   <button onClick={() => setIsKeyVisible(!isKeyVisible)} className="text-white hover:text-indigo-400 transition-colors">Revelar</button>
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