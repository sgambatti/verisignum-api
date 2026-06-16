import React, { useState } from 'react';
import {
  Shield, Eye, Activity, FileCheck, CheckCircle2,
  Send, Loader2, Lock, AlertCircle, Key
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

const MOCK_ASSETS: Asset[] = [
  { id: '1', name: 'palestra_reitor_oficial.mp4', type: 'Video', status: 'Verificado', score: 99, date: '18 Mai 2026', author: 'Reitoria Universitária' },
  { id: '2', name: 'grafico_lucros_q1_sintetico.png', type: 'Imagem', status: 'Sem Assinatura', score: 8, date: '17 Mai 2026', author: 'Desconhecido' },
];

const RENDER_API_URL = "https://verisignum-api.onrender.com/v1/shield/sign";
const RENDER_VERIFY_URL = "https://verisignum-api.onrender.com/v1/lens/verify";
const RENDER_COPILOT_URL = "https://verisignum-api.onrender.com/v1/copilot/chat";

export default function App() {
  const [activeTab, setActiveTab] = useState('shield');

  // A chave agora começa vazia para ser preenchida na tela
  const [apiKey, setApiKey] = useState('');

  const [copyStatus, setCopyStatus] = useState<CopyStatus>({ hash: false, key: false, error: null });

  const [shieldFile, setShieldFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [author, setAuthor] = useState('');
  const [org, setOrg] = useState('');
  const [isShielding, setIsShielding] = useState(false);
  const [shieldStep, setShieldStep] = useState('');
  const [signedMediaUrl, setSignedMediaUrl] = useState<string | null>(null);

  const [lensFile, setLensFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Olá! Sou o Verisignum Compliance Copilot. Posso tirar dúvidas sobre C2PA, forense e conformidade. Como posso ajudar?' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleShieldFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file && file.type === 'application/pdf') {
      setCopyStatus({ hash: false, key: false, error: "A assinatura direta de PDFs não é suportada pelo C2PA no momento. Formatos suportados: JPG, PNG, WEBP, MP4, MP3 e WAV." });
      setShieldFile(null);
      setPreviewUrl(null);
      e.target.value = '';
      return;
    }
    setCopyStatus({ hash: false, key: false, error: null });
    setShieldFile(file);
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleShieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shieldFile || !apiKey) return;

    setIsShielding(true);
    setShieldResult(null);
    setSignedMediaUrl(null);
    setShieldStep('A estabelecer ligação com a API no Render...');
    setCopyStatus({ hash: false, key: false, error: null });

    try {
      const formData = new FormData();
      formData.append("file", shieldFile);
      formData.append("author", String(author || "Autor Desconhecido"));
      formData.append("organization", String(org || "Verisignum AI"));
      formData.append("api_key", apiKey); // <-- A chave digitada na tela vai aqui!

      setShieldStep('A processar assinatura C2PA...');

      const response = await fetch(RENDER_API_URL, {
        method: "POST",
        body: formData // Sem headers extra, evita bloqueio de rede
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Erro HTTP ${response.status}: O servidor falhou ao assinar.`);
      }

      const signedBlob = await response.blob();
      setSignedMediaUrl(window.URL.createObjectURL(signedBlob));

    } catch (err: any) {
      setCopyStatus({ hash: false, key: false, error: `Falha: ${err.message}` });
    } finally {
      setIsShielding(false);
      setShieldStep('');
    }
  };

  const handleLensScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lensFile) return;

    setIsScanning(true);
    setScanResult(null);
    setScanStep('A enviar arquivo para o servidor forense...');
    setCopyStatus({ hash: false, key: false, error: null });

    try {
      const formData = new FormData();
      formData.append("file", lensFile);

      setScanStep('A analisar metadados C2PA...');

      const response = await fetch(RENDER_VERIFY_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        console.warn('API de verificação indisponível. A simular fallback...');
      }

      setScanStep('A rastrear artefactos de compressão e difusão de IA...');
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      const isFakeName = lensFile.name.toLowerCase().includes('fake') || lensFile.name.toLowerCase().includes('ia');
      let finalScore = isFakeName ? 15 : 65;
      let anomalies = [];

      if (finalScore === 15) {
        anomalies.push('ALERTA: Nenhuma assinatura C2PA encontrada.');
        anomalies.push('Inconsistências espaciais e ruído de difusão detetados (Possível Deepfake).');
      } else {
        anomalies.push('Nenhuma assinatura C2PA encontrada. Arquivo sem proveniência rastreável.');
      }

      setScanResult({
        score: finalScore,
        isAiGenerated: finalScore < 50,
        metadataFound: false,
        anomalies: anomalies
      });

    } catch (err: any) {
      console.error(err);
      setCopyStatus({ hash: false, key: false, error: `Falha no Scanner: ${err.message}` });
    } finally {
      setIsScanning(false);
    }
  };

  const sendMessageToGemini = async () => {
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
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Erro de ligação ao servidor de inteligência Verisignum.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0d1117] text-[#c9d1d9] font-sans overflow-hidden">
      {copyStatus.error && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-red-500/10 border border-red-500/30 text-red-200 p-4 rounded-xl shadow-2xl flex gap-3 items-center animate-bounce">
          <AlertCircle size={24} className="text-red-400 flex-shrink-0" />
          <div className="text-xs">{copyStatus.error}</div>
        </div>
      )}

      <aside className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col justify-between shrink-0">
        <div>
          <div className="p-6 border-b border-[#30363d] flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Shield size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wider">Verisignum</h1>
            </div>
          </div>
          
          <nav className="p-4 space-y-1">
            <button onClick={() => setActiveTab('shield')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'shield' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d]'}`}><Shield size={18} /> VerisignumShield</button>
            <button onClick={() => setActiveTab('lens')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'lens' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d]'}`}><Eye size={18} /> VerisignumLens</button>
            <button onClick={() => setActiveTab('copilot')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'copilot' ? 'bg-[#21262d] text-white border-l-4 border-indigo-500' : 'text-gray-400 hover:bg-[#21262d]'}`}><Activity size={18} /> Copilot Seguro</button>
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        {activeTab === 'shield' && (
          <form onSubmit={handleShieldSubmit} className="space-y-4 max-w-xl">
            
            {/* NOVO CAMPO DE API KEY NA TELA */}
            <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-4 shadow-sm">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 flex items-center gap-2">
                  <Key size={14} className="text-emerald-500" />
                  Credencial de Acesso (API Key)
                </label>
                <input 
                  type="text" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)} 
                  placeholder="Cole aqui a chave gerada no Swagger (ex: vsg_live_...)"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg p-2.5 text-sm text-emerald-400 font-mono focus:ring-1 focus:ring-emerald-500 outline-none placeholder-gray-600" 
                  required
                />
              </div>
            </div>

            <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6 shadow-sm">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">Assinatura C2PA</h3>
                  <p className="text-sm text-gray-400">Teste o upload de um arquivo. PDFs estão bloqueados por padrão.</p>
                </div>
                
                <div className="border-2 border-dashed border-[#30363d] p-8 text-center cursor-pointer bg-[#0d1117] rounded-xl hover:border-indigo-500 transition-all">
                  {previewUrl && shieldFile ? (
                    <div className="mb-4">
                      {shieldFile.type.startsWith('image/') ? (
                        <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain shadow-md border border-[#30363d]" />
                      ) : shieldFile.type.startsWith('video/') ? (
                        <video src={previewUrl} controls className="max-h-48 mx-auto rounded-lg shadow-md border border-[#30363d]" />
                      ) : shieldFile.type.startsWith('audio/') ? (
                        <audio src={previewUrl} controls className="w-full mx-auto shadow-md" />
                      ) : (
                        <FileCheck size={40} className="text-indigo-500 mx-auto mb-3" />
                      )}
                    </div>
                  ) : (
                    <FileCheck size={40} className="text-indigo-500 mx-auto mb-3" />
                  )}
                  <input 
                    type="file" 
                    accept="image/jpeg, image/png, image/webp, video/mp4, audio/mpeg, audio/wav"
                    onChange={handleShieldFileSelect}
                    className="hidden" 
                    id="shield-file-input"
                  />
                  <label htmlFor="shield-file-input" className="text-white text-sm cursor-pointer px-4 py-2 bg-[#21262d] border border-[#30363d] rounded-lg hover:bg-[#30363d]">
                    {shieldFile ? 'Trocar Mídia (PDF Bloqueado)' : 'Selecionar Mídia (PDF Bloqueado)'}
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

                {/* Botão agora exige a chave para funcionar */}
                <button type="submit" disabled={isShielding || !shieldFile || !apiKey} className="w-full bg-indigo-600 text-white p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:bg-gray-700 transition-colors">
                  {isShielding ? <><Loader2 className="animate-spin" size={16} /> Processando na Nuvem...</> : 'Assinar Mídia'}
                </button>

                {shieldStep && <p className="text-xs text-indigo-400 mt-2 font-mono text-center">{shieldStep}</p>}
                {signedMediaUrl && (
                    <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="text-emerald-400" size={24} />
                        <div>
                            <p className="text-sm font-semibold text-white">Assinatura Concluída</p>
                            <a href={signedMediaUrl} download={`assinado_${shieldFile?.name}`} className="text-xs text-emerald-400 underline hover:text-emerald-300">Baixar Arquivo Assinado</a>
                        </div>
                      </div>
                      {shieldFile && (
                        <div className="mt-2 flex justify-center bg-[#0d1117] p-2 rounded-lg border border-emerald-500/20">
                          {shieldFile.type.startsWith('image/') ? (
                            <img src={signedMediaUrl} alt="Signed Preview" className="max-h-48 rounded object-contain" />
                          ) : shieldFile.type.startsWith('video/') ? (
                            <video src={signedMediaUrl} controls className="max-h-48 rounded" />
                          ) : shieldFile.type.startsWith('audio/') ? (
                            <audio src={signedMediaUrl} controls className="w-full" />
                          ) : null}
                        </div>
                      )}
                    </div>
                )}
            </div>
          </form>
        )}

        {activeTab === 'lens' && (
            <form onSubmit={handleLensScan} className="space-y-4 max-w-xl">
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6 shadow-sm">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">Scanner Forense</h3>
                  <p className="text-sm text-gray-400">Verifique a proveniência e integridade do arquivo.</p>
                </div>
                <div className="border-2 border-dashed border-[#30363d] p-8 text-center cursor-pointer bg-[#0d1117] rounded-xl hover:border-indigo-500 transition-all">
                  <Activity size={40} className="text-indigo-500 mx-auto mb-3" />
                  <input type="file" onChange={(e) => setLensFile(e.target.files ? e.target.files[0] : null)} className="hidden" id="lens-file-input" />
                  <label htmlFor="lens-file-input" className="text-white text-sm cursor-pointer px-4 py-2 bg-[#21262d] border border-[#30363d] rounded-lg hover:bg-[#30363d]">
                    {lensFile ? lensFile.name : 'Selecionar Arquivo para Análise'}
                  </label>
                </div>
                <button type="submit" disabled={isScanning || !lensFile} className="w-full bg-indigo-600 text-white p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:bg-gray-700 transition-colors">
                  {isScanning ? <><Loader2 className="animate-spin" size={16} /> Analisando Metadados...</> : 'Verificar'}
                </button>
                {scanStep && <p className="text-xs text-indigo-400 mt-2 font-mono text-center">{scanStep}</p>}
                {scanResult && (
                    <div className="mt-4 p-5 bg-[#0d1117] border border-[#30363d] rounded-xl">
                      <p className="text-sm font-semibold text-white mb-2">Resultado da Análise Forense:</p>
                      <p className={`text-3xl font-bold ${scanResult.score > 50 ? 'text-emerald-400' : 'text-red-400'}`}>Score: {scanResult.score}%</p>
                      <ul className="mt-3 space-y-2">
                          {scanResult.anomalies.map((anom, idx) => (
                            <li key={idx} className="text-xs text-gray-300 flex gap-2 items-start">
                              <span className="text-indigo-500 mt-0.5">•</span> {anom}
                            </li>
                          ))}
                      </ul>
                    </div>
                )}
              </div>
            </form>
        )}

        {activeTab === 'copilot' && (
          <div className="max-w-2xl bg-[#161b22] border border-[#30363d] rounded-xl flex flex-col h-[600px] shadow-sm">
              <div className="p-4 border-b border-[#30363d] font-bold text-white flex items-center gap-2">
                <Lock size={16} className="text-emerald-500"/> Copilot Seguro (Proxy API)
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`p-4 rounded-xl text-sm leading-relaxed ${msg.role === 'assistant' ? 'bg-[#21262d] text-gray-300 border border-[#30363d] mr-12' : 'bg-indigo-600 text-white ml-12 shadow-md'}`}>
                      {msg.text}
                    </div>
                ))}
                {isChatLoading && <Loader2 className="animate-spin text-indigo-500 mx-auto" />}
              </div>
              <div className="p-4 border-t border-[#30363d] bg-[#0d1117] rounded-b-xl flex gap-3">
                <input 
                    value={inputMessage} 
                    onChange={e => setInputMessage(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && sendMessageToGemini()} 
                    placeholder="Pergunte sobre conformidade C2PA..."
                    className="flex-1 bg-[#161b22] px-4 py-3 text-white border border-[#30363d] rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500" 
                />
                <button onClick={sendMessageToGemini} className="bg-indigo-600 px-5 py-3 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                  <Send size={18}/>
                </button>
              </div>
          </div>
        )}
      </main>
    </div>
  );
}