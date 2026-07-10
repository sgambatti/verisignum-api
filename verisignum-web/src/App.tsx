// ... existing code ...
import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye, Code, FileCheck, Activity, AlertTriangle, CheckCircle2, 
  Terminal, Key, ExternalLink, Loader2, Lock, AlertCircle, 
  FileText, LogOut, CreditCard, Check, Menu, X, Copy, Sparkles
} from 'lucide-react';

interface CopyStatus {
// ... existing code ...
          {activeTab === 'lens' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#161b22] border border-[#30363d] p-6 rounded-xl space-y-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Eye className="text-indigo-500" /> VerisignumLens</h3>
// ... existing code ...
                  {scanResult && (
                    <button onClick={handleDownloadPDF} className="w-full mt-6 bg-[#21262d] text-white rounded-lg p-3 text-sm flex items-center justify-center gap-2 hover:bg-[#30363d] transition-colors border border-[#30363d]">
                      <FileText size={16} /> Exportar Laudo PDF
                    </button>
                  )}
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
                    onClick={() => safeCopyToClipboard(clientData?.api_key || 'SUA_API_KEY_AQUI', 'key')}
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
        "VERISIGNUM_API_KEY": "${clientData?.api_key || 'SUA_API_KEY_AQUI'}"
      }
    }
  }
}`}
                        </pre>
                        <button 
                          onClick={() => safeCopyToClipboard(`{\n  "mcpServers": {\n    "verisignum": {\n      "command": "uv",\n      "args": [\n        "run",\n        "--with", "mcp",\n        "--with", "httpx",\n        "/caminho/absoluto/para/o/mcp_server.py"\n      ],\n      "env": {\n        "VERISIGNUM_API_KEY": "${clientData?.api_key || 'SUA_API_KEY_AQUI'}"\n      }\n    }\n  }\n}`, 'hash')}
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
                  <div className="pt-6 border-t border-[#30363d] pl-8 flex flex-col sm:flex-row gap-3">
                     <button className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#21262d] hover:bg-[#30363d] text-white text-sm font-semibold rounded-lg border border-[#30363d] transition-all shadow-sm">
                       <ExternalLink size={16} className="text-gray-400" />
                       Download mcp_server.py
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
// ... existing code ...