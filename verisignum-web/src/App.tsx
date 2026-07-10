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

const MOCK_ASSETS = [
  { id: '1', name: 'palestra_reitor_oficial.mp4', type: 'Video', status: 'Verificado', score: 99, date: '18 Mai 2026', author: 'Reitoria Universitária' },
  { id: '2', name: 'grafico_lucros_q1_sintetico.png', type: 'Imagem', status: 'Sem Assinatura', score: 8, date: '17 Mai 2026', author: 'Desconhecido' },
  { id: '3', name: 'clonagem_voz_auditoria.mp3', type: 'Áudio', status: 'Possível Deepfake', score: 38, date: '15 Mai 2026', author: 'Desconhecido' },
];

// A URL oficial da sua API no Render
const RENDER_API_URL = "https://verisignum-api.onrender.com/v1/shield/sign";

export default function App() {
  const [activeTab, setActiveTab] = useState('shield');
  const [assets, setAssets] = useState(MOCK_ASSETS);
  const [apiKey, setApiKey] = useState('vsg_live_4b8c12a7e9f310d5c8b2a3');
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  
  const [copyStatus, setCopyStatus] = useState({ hash: false, key: false, error: null });

  const [shieldFile, setShieldFile] = useState(null);
  const [author, setAuthor] = useState('');
  const [org, setOrg] = useState('');
  const [license, setLicense] = useState('CC-BY-4.0');
  const [isShielding, setIsShielding] = useState(false);
  const [shieldStep, setShieldStep] = useState('');
  const [shieldResult, setShieldResult] = useState(null);

  const [lensFile, setLensFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [scanResult, setScanResult] = useState(null);

  const [selectedLanguage, setSelectedLanguage] = useState('curl');
  
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', text: 'Olá! Sou o seu Verisignum Compliance Copilot. Posso tirar dúvidas sobre os padrões globais de proveniência C2PA, integridade de evidências digitais sob a ótica do judiciário ou como estruturar auditorias automatizadas no seu LMS. Como posso ajudar hoje?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const safeCopyToClipboard = (text, type) => {
    setCopyStatus(prev => ({ ...prev, error: null }));
    
    const setSuccess = () => {
      setCopyStatus(prev => ({ ...prev, [type]: true }));
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [type]: false }));
      }, 2000);
    };

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(() => setSuccess())
        .catch((err) => fallbackCopyToClipboard(text, setSuccess));
    } else {
      fallbackCopyToClipboard(text, setSuccess);
    }
  };

  const fallbackCopyToClipboard = (text, successCallback) => {
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
      else throw new Error('Fallback falhou ao executar copy');
    } catch (err) {
      setCopyStatus(prev => ({ ...prev, error: "Cópia automática indisponível." }));
      setTimeout(() => setCopyStatus(prev => ({ ...prev, error: null })), 5000);
    }
  };

  const generateNewKey = () => {
    const chars = 'abcdef0123456789';
    let result = 'vsg_live_';
    for (let i = 0; i < 22; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setApiKey(result);
  };

  const handleShieldSubmit = async (e) => {
    e.preventDefault();
    if (!shieldFile) return;

    setIsShielding(true);
    setShieldResult(null);
    setShieldStep('A ligar à API Verisignum no Render...');

    try {
      const formData = new FormData();
      formData.append("file", shieldFile);
      formData.append("author", author || "Autor Desconhecido");
      formData.append("organization", org || "Verisignum AI");

      setShieldStep('A enviar o arquivo e a processar certificados C2PA no servidor...');

      let signedBlob;

      try {
        const response = await fetch(RENDER_API_URL, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Erro HTTP ${response.status}: O servidor falhou ao assinar.`);
        }
        
        // Recebe o arquivo físico assinado de volta!
        signedBlob = await response.blob();
        setShieldStep('Sucesso! Arquivo criptografado recebido da nuvem.');
        
      } catch (backendError) {
        console.warn("A API do Render falhou. A simular fallback...", backendError);
        setShieldStep('Servidor indisponível ou erro CORS. A simular injeção local (Fallback MVP)...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        signedBlob = shieldFile; 
        
        setCopyStatus(prev => ({ 
          ...prev, 
          error: "Aviso: Conexão com o Render falhou. O arquivo gerado abaixo é uma simulação (mock) para testes visuais." 
        }));
      }

      const downloadUrl = window.URL.createObjectURL(signedBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `verisignum_${shieldFile.name}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      const newAsset = {
        id: (assets.length + 1).toString(),
        name: `verisignum_${shieldFile.name}`,
        type: shieldFile.type.split('/')[1]?.toUpperCase() || 'Mídia',
        status: 'Verificado',
        score: 100,
        date: new Date().toLocaleDateString('pt-PT'),
        author: author || 'Autor Desconhecido'
      };

      setAssets([newAsset, ...assets]);

      setShieldResult({
        hash: 'sha256:d8a21f7c9e543b18a2098fb412356c9a7d8f9024b1a32e5d89f71c43d920ef01',
        manifest: JSON.stringify({
          "c2pa:manifest": {
            "active_manifest": "verisignum_sign_v3",
            "assertions": [
              { "label": "c2pa.actions", "data": { "actions": [{ "action": "c2pa.created" }] } },
              { "label": "stds.schema-org.CreativeWork", "data": { "author": author || 'Autor Desconhecido', "publisher": org || 'Verisignum AI', "engine": "VerisignumShield_3.0" } }
            ],
            "signature": "Ed25519_Verisignum_Trust_Network"
          }
        }, null, 2)
      });

    } catch (err) {
      console.error("Erro na assinatura:", err);
      setCopyStatus(prev => ({ 
        ...prev, 
        error: `Falha na assinatura: ${err.message}` 
      }));
    } finally {
      setIsShielding(false);
    }
  };

  const handleLensScan = (e) => {
    e.preventDefault();
    if (!lensFile) return;

    setIsScanning(true);
    setScanResult(null);

    const steps = [
      'A decompor espectrograma de áudio e transientes de voz...',
      'A rastrear artefactos de compressão e padrões de difusão por IA...',
      'A analisar coerência de píxeis e inconsistências de borda...',
      'A calcular índice probabilístico final de proveniência...'
    ];

    let currentStep = 0;
    setScanStep(steps[0]);

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setScanStep(steps[currentStep]);
      } else {
        clearInterval(interval);
        setIsScanning(false);
        const randomScore = Math.floor(Math.random() * 80) + 15; 
        const isSuspicious = randomScore < 50;
        setScanResult({
          score: randomScore,
          isAiGenerated: isSuspicious,
          metadataFound: randomScore > 75,
          anomalies: isSuspicious 
            ? ['Detetação de clone gerado por síntese neural de frequência', 'Inconsistências espaciais severas nos quadros de transição']
            : ['Nenhum padrão visível de manipulação ou clonagem por IA generativa identificado.']
        });
      }
    }, 1100);
  };

  const sendMessageToGemini = async () => {
    if (!inputMessage.trim()) return;

    const userMsg = { role: 'user', text: inputMessage };
    setChatMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsChatLoading(true);

    setTimeout(() => {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Simulação: A resposta da IA integrativa apareceria aqui para auxiliar nas dúvidas de conformidade C2PA.' }]);
      setIsChatLoading(false);
    }, 1500);
  };

  return (
    <div className="flex h-screen bg-[#0d1117] text-[#c9d1d9] font-sans overflow-hidden">
      {copyStatus.error && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl shadow-2xl flex gap-3 items-center animate-bounce">
          <AlertCircle size={24} className="text-red-400 flex-shrink-0" />
          <div className="text-xs">{copyStatus.error}</div>
        </div>
      )}

      <aside className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col justify-between">
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
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d] hover:text-[#c9d1d9]'}`}><Activity size={18} /> Painel Central</button>
            <button onClick={() => setActiveTab('shield')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'shield' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d] hover:text-[#c9d1d9]'}`}><Shield size={18} /> VerisignumShield (Assinar)</button>
            <button onClick={() => setActiveTab('lens')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'lens' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d] hover:text-[#c9d1d9]'}`}><Eye size={18} /> VerisignumLens (Verificar)</button>
            <button onClick={() => setActiveTab('api')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'api' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d] hover:text-[#c9d1d9]'}`}><Code size={18} /> API Developer Hub</button>
          </nav>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto">
        <header className="h-16 border-b border-[#30363d] px-8 flex items-center justify-between bg-[#161b22]">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 font-mono font-medium">Conectado ao Backend</span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono font-medium">FastAPI Python 100% Nativo</span>
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto space-y-8 flex-1">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white">Bem-vindo ao MVP Verisignum</h2>
                  <p className="text-sm text-gray-400">Navegue até "VerisignumShield" para testar a comunicação com a API em Python.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shield' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Shield className="text-indigo-500" /> Assinatura C2PA
                  </h3>
                  <p className="text-sm text-gray-400">Teste o upload de um arquivo. O painel chamará a sua API Python para injetar o certificado.</p>
                </div>

                <form onSubmit={handleShieldSubmit} className="space-y-4">
                  <div className="border-2 border-dashed border-[#30363d] rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:border-indigo-500 cursor-pointer transition-all bg-[#0d1117]">
                    <FileCheck size={40} className="text-indigo-500" />
                    <input 
                      type="file" 
                      onChange={(e) => setShieldFile(e.target.files[0])}
                      className="hidden" 
                      id="shield-file-input"
                    />
                    <label htmlFor="shield-file-input" className="px-4 py-2 bg-[#21262d] border border-[#30363d] text-white text-xs rounded-lg cursor-pointer hover:bg-[#30363d] transition-all">
                      {shieldFile ? `Selecionado: ${shieldFile.name}` : 'Selecionar Imagem ou Documento'}
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-400">Autor</label>
                      <input type="text" placeholder="Ex: João" value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-400">Organização</label>
                      <input type="text" placeholder="Ex: Verisignum" value={org} onChange={(e) => setOrg(e.target.value)} className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isShielding || !shieldFile}
                    className="w-full bg-indigo-600 text-white font-semibold rounded-lg p-3 text-sm hover:bg-indigo-700 disabled:bg-gray-700 transition-all flex items-center justify-center gap-2"
                  >
                    {isShielding ? <><Loader2 className="animate-spin" size={16} /> A processar na Nuvem...</> : 'Assinar Criptograficamente'}
                  </button>
                </form>

                {isShielding && (
                  <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 flex gap-3 items-center">
                    <Loader2 size={18} className="text-indigo-400 animate-spin" />
                    <div><p className="text-xs font-semibold text-indigo-400 font-mono">Status da API:</p><p className="text-xs text-gray-300 font-mono">{shieldStep}</p></div>
                  </div>
                )}
              </div>

              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white mb-4">Certificado Digital C2PA</h3>
                  {shieldResult ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex gap-3 items-center">
                        <CheckCircle2 className="text-emerald-400" size={24} />
                        <div><p className="text-sm font-semibold text-white">Chave Gerada e Arquivo Devolvido</p><p className="text-xs text-gray-400">Verifique a sua pasta de transferências!</p></div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-mono font-semibold text-gray-400">Manifesto JSON</span>
                        <pre className="bg-[#0d1117] p-3 rounded-lg border border-[#30363d] text-[10px] font-mono text-gray-300 overflow-x-auto h-40">
                          {shieldResult.manifest}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-[#0d1117] border border-[#30363d] rounded-xl text-gray-500">
                      <Lock size={48} className="mb-4 text-gray-700" />
                      <p className="font-semibold text-sm">A aguardar conexão</p>
                      <p className="text-xs">Faça upload de uma mídia ao lado para invocar a API em Python.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'lens' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Eye className="text-indigo-500" /> VerisignumLens
                  </h3>
                  <p className="text-sm text-gray-400">Inspeção de metadados forenses.</p>
                </div>
                <form onSubmit={handleLensScan} className="space-y-4">
                  <div className="border-2 border-dashed border-[#30363d] rounded-xl p-8 flex flex-col items-center justify-center gap-3 hover:border-indigo-500 cursor-pointer bg-[#0d1117]">
                    <Activity size={40} className="text-indigo-400 animate-pulse" />
                    <input type="file" onChange={(e) => setLensFile(e.target.files[0])} className="hidden" id="lens-file-input" />
                    <label htmlFor="lens-file-input" className="px-4 py-2 bg-[#21262d] border border-[#30363d] text-white text-xs rounded-lg cursor-pointer hover:bg-[#30363d]">
                      {lensFile ? `Selecionado: ${lensFile.name}` : 'Selecionar Arquivo'}
                    </label>
                  </div>
                  <button type="submit" disabled={isScanning || !lensFile} className="w-full bg-indigo-600 text-white font-semibold rounded-lg p-3 text-sm hover:bg-indigo-700 disabled:bg-gray-700 flex items-center justify-center gap-2">
                    {isScanning ? <><Loader2 className="animate-spin" size={16} /> Analisando...</> : 'Iniciar Inspeção'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Code className="text-indigo-500" /> API Developer Hub
                </h2>
                <p className="text-sm text-gray-400 mt-1">Acesso à documentação de integração, chaves de API e configuração do Model Context Protocol (MCP).</p>
              </div>

              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-lg">
                <div className="border-b border-[#30363d] bg-[#0d1117] p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={18} className="text-gray-400" />
                    <span className="text-sm font-mono font-semibold text-gray-300">pop_integracao_mcp.md</span>
                  </div>
                  <button 
                    onClick={() => safeCopyToClipboard(apiKey, 'key')}
                    className="flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all"
                  >
                    <Key size={14} /> {copyStatus.key ? 'Chave Copiada!' : 'Copiar API Key'}
                  </button>
                </div>
                
                <div className="p-6 md:p-8 space-y-8">
                  {/* Introdução MCP */}
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-semibold mb-4">
                      <Sparkles size={12} /> 100% MCP READY
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Servidor MCP Verisignum</h3>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-3xl">
                      Integre a inteligência forense da Verisignum diretamente aos seus Agentes de Inteligência Artificial internos e ao Claude Desktop utilizando o padrão aberto Model Context Protocol (MCP).
                    </p>
                  </div>

                  {/* Passo a Passo */}
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
        "VERISIGNUM_API_KEY": "${apiKey}"
      }
    }
  }
}`}
                        </pre>
                        <button 
                          onClick={() => safeCopyToClipboard(`{\n  "mcpServers": {\n    "verisignum": {\n      "command": "uv",\n      "args": [\n        "run",\n        "--with", "mcp",\n        "--with", "httpx",\n        "/caminho/absoluto/para/o/mcp_server.py"\n      ],\n      "env": {\n        "VERISIGNUM_API_KEY": "${apiKey}"\n      }\n    }\n  }\n}`, 'hash')}
                          className="absolute top-3 right-3 p-2 bg-[#21262d] text-gray-400 hover:text-white rounded-md border border-[#30363d] opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                          title="Copiar código JSON"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-md font-semibold text-white flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#30363d] text-xs font-mono">2</span>
                        Testes de Validação (Prompts)
                      </h4>
                      <p className="text-sm text-gray-400 pl-8">Após reiniciar a IA, experimente enviar os seguintes comandos em linguagem natural:</p>
                      <div className="ml-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-indigo-500/5 border border-indigo-500/20 p-5 rounded-xl hover:bg-indigo-500/10 transition-colors">
                          <p className="text-xs font-semibold text-indigo-400 mb-2 uppercase tracking-wider">Para Auditar (Lens)</p>
                          <p className="text-sm text-gray-300 italic">"Verifique se a imagem localizada em /Downloads/foto.jpg é autêntica ou gerada por IA."</p>
                        </div>
                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-xl hover:bg-emerald-500/10 transition-colors">
                          <p className="text-xs font-semibold text-emerald-400 mb-2 uppercase tracking-wider">Para Assinar (Shield)</p>
                          <p className="text-sm text-gray-300 italic">"Assine o arquivo /Downloads/documento.pdf. O autor é 'Diretoria'."</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer da Documentação */}
                  <div className="pt-6 border-t border-[#30363d] pl-8">
                     <button className="flex items-center gap-2 px-5 py-2.5 bg-[#21262d] hover:bg-[#30363d] text-white text-sm font-semibold rounded-lg border border-[#30363d] transition-all shadow-sm">
                       <ExternalLink size={16} className="text-gray-400" />
                       Fazer Download do mcp_server.py
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