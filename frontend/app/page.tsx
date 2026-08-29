"use client";

import React, { useState, useRef } from "react";
import { 
  Scale, 
  Mic, 
  FileText, 
  Upload, 
  Download, 
  Mail, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Play,
  Square
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://jurisprime-api.onrender.com";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"atajur" | "peticao">("atajur");

  // Estados do AtaJur
  const [tipoReuniao, setTipoReuniao] = useState<"Cliente" | "Interna">("Cliente");
  const [participantes, setParticipantes] = useState("");
  const [tituloReuniao, setTituloReuniao] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAta, setLoadingAta] = useState(false);
  const [ataGerada, setAtaGerada] = useState("");
  const [emailDestino, setEmailDestino] = useState("");
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [statusEmail, setStatusEmail] = useState<string | null>(null);

  // Estados de Gravação de Áudio no Navegador
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Estados do JurisPrime (Petição)
  const [instrucaoPeticao, setInstrucaoPeticao] = useState("");
  const [arquivosPeticao, setArquivosPeticao] = useState<FileList | null>(null);
  const [peticaoGerada, setPeticaoGerada] = useState("");
  const [gerandoPeticao, setGerandoPeticao] = useState(false);

  // --- LÓGICA DE GRAVAÇÃO DO MICROFONE ---
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Permissão para usar o microfone foi negada ou não suportada.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  // --- SUBMISSÃO DO ATAJUR ---
  const handleProcessarAta = async () => {
    if (!participantes || !tituloReuniao) {
      alert("Por favor, preencha os participantes e o título/pauta.");
      return;
    }

    const fileToSend = audioFile || (audioBlob ? new File([audioBlob], "gravacao.webm", { type: "audio/webm" }) : null);

    if (!fileToSend) {
      alert("Por favor, grave um áudio ou faça o upload de um ficheiro de áudio.");
      return;
    }

    setLoadingAta(true);
    setAtaGerada("");
    setStatusEmail(null);

    const formData = new FormData();
    formData.append("audio", fileToSend);
    formData.append("tipo_reuniao", tipoReuniao);
    formData.append("participantes", participantes);
    formData.append("titulo", tituloReuniao);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ata/processar-audio`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro na resposta da API.");
      }

      const data = await response.json();
      setAtaGerada(data.ata_markdown);
    } catch (error) {
      alert(`Falha ao processar o áudio: ${error}`);
    } finally {
      setLoadingAta(false);
    }
  };

  // --- DOWNLOAD DOCX ---
  const handleDownloadDocx = async (titulo: string, conteudo: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/exportar-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: titulo || "Documento",
          conteudo_markdown: conteudo,
        }),
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${titulo || "Documento"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      alert("Erro ao descarregar ficheiro .docx");
    }
  };

  // --- ENVIAR EMAIL ---
  const handleEnviarEmail = async () => {
    if (!emailDestino) {
      alert("Preencha o e-mail de destino.");
      return;
    }

    setEnviandoEmail(true);
    setStatusEmail(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ata/enviar-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinatario: emailDestino,
          titulo: tituloReuniao || "Ata de Reunião",
          conteudo_markdown: ataGerada,
        }),
      });

      if (!response.ok) throw new Error("Erro ao disparar e-mail");
      setStatusEmail("E-mail enviado com sucesso com o anexo .docx!");
    } catch (error) {
      setStatusEmail("Falha ao enviar e-mail. Verifique as credenciais SMTP no Render.");
    } finally {
      setEnviandoEmail(false);
    }
  };

  // --- GERAR PETIÇÃO COM STREAMING ---
  const handleGerarPeticao = async () => {
    if (!instrucaoPeticao) {
      alert("Insira os fatos ou instruções da petição.");
      return;
    }

    setGerandoPeticao(true);
    setPeticaoGerada("");

    const formData = new FormData();
    formData.append("instrucao_usuario", instrucaoPeticao);

    if (arquivosPeticao) {
      Array.from(arquivosPeticao).forEach((file) => {
        formData.append("arquivos", file);
      });
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/peticao/gerar-stream`, {
        method: "POST",
        body: formData,
      });

      if (!response.body) throw new Error("Sem resposta legível.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                setPeticaoGerada((prev) => prev + parsed.text);
              }
            } catch (e) {
              // Ignorar linhas sem formato JSON completo
            }
          }
        }
      }
    } catch (error) {
      alert(`Falha ao gerar petição: ${error}`);
    } finally {
      setGerandoPeticao(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">JurisPrime & AtaJur</h1>
              <p className="text-xs text-slate-400">Inteligência Artificial de Alta Performance Jurídica</p>
            </div>
          </div>

          {/* SELETOR DE MÓDULOS */}
          <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setActiveTab("atajur")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "atajur"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>AtaJur (Atas de Reunião)</span>
            </button>
            <button
              onClick={() => setActiveTab("peticao")}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === "peticao"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>JurisPrime (Petições de 1º Grau)</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ===================== ABA 1: ATAJUR ===================== */}
        {activeTab === "atajur" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* PAINEL ESQUERDO: FORMULÁRIO & GRAVAÇÃO */}
            <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Registro de Reunião</h2>
                <p className="text-xs text-slate-500">
                  Gere a ata executiva formal e a matriz de prazos para colher assinaturas.
                </p>
              </div>

              {/* Tipo de Reunião */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Tipo de Reunião
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoReuniao("Cliente")}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all ${
                      tipoReuniao === "Cliente"
                        ? "bg-blue-50 border-blue-600 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    👤 Reunião com Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoReuniao("Interna")}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all ${
                      tipoReuniao === "Interna"
                        ? "bg-blue-50 border-blue-600 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    ⚖️ Reunião Interna
                  </button>
                </div>
              </div>

              {/* Participantes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Participantes Presentes
                </label>
                <input
                  type="text"
                  placeholder={tipoReuniao === "Cliente" ? "Ex: João da Silva e Dra. Marina" : "Ex: Dr. Roberto e Dra. Clara"}
                  value={participantes}
                  onChange={(e) => setParticipantes(e.target.value)}
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Título / Pauta */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Pauta / Objeto Principal
                </label>
                <input
                  type="text"
                  placeholder="Ex: Alinhamento Inicial - Indenizatória Bancária"
                  value={tituloReuniao}
                  onChange={(e) => setTituloReuniao(e.target.value)}
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Entrada de Áudio */}
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Áudio da Reunião
                </label>

                {/* Microfone */}
                <div className="flex items-center space-x-3">
                  {!isRecording ? (
                    <button
                      type="button"
                      onClick={handleStartRecording}
                      className="flex-1 flex items-center justify-center space-x-2 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      <span>Gravar no Microfone</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="flex-1 flex items-center justify-center space-x-2 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 animate-pulse transition-colors"
                    >
                      <Square className="w-4 h-4" />
                      <span>Parar Gravação</span>
                    </button>
                  )}
                </div>

                {audioUrl && (
                  <div className="p-2 bg-slate-50 border rounded-lg">
                    <audio src={audioUrl} controls className="w-full h-8" />
                  </div>
                )}

                {/* Upload */}
                <div className="relative">
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setAudioFile(e.target.files[0]);
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                </div>
              </div>

              {/* Botão de Processamento */}
              <button
                type="button"
                onClick={handleProcessarAta}
                disabled={loadingAta}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {loadingAta ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sintetizando Ata com Gemini...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    <span>Gerar Ata Executiva</span>
                  </>
                )}
              </button>
            </div>

            {/* PAINEL DIREITO: ATA GERADA & EXPORTAÇÕES */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[500px] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                    <h3 className="font-semibold text-slate-900 flex items-center space-x-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span>Ata Executiva Formal</span>
                    </h3>
                    {ataGerada && (
                      <button
                        onClick={() => handleDownloadDocx(`Ata_${tituloReuniao || "Reuniao"}`, ataGerada)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Descarregar .DOCX</span>
                      </button>
                    )}
                  </div>

                  {ataGerada ? (
                    <textarea
                      value={ataGerada}
                      onChange={(e) => setAtaGerada(e.target.value)}
                      rows={16}
                      className="w-full p-4 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
                      <Mic className="w-10 h-10 stroke-1" />
                      <p className="text-sm">Grave ou carregue um áudio para gerar a ata executiva.</p>
                    </div>
                  )}
                </div>

                {/* DISPARO POR E-MAIL */}
                {ataGerada && (
                  <div className="border-t border-slate-100 pt-4 mt-6">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2 flex items-center space-x-1.5">
                      <Mail className="w-4 h-4 text-slate-500" />
                      <span>Enviar Ata para o Cliente / Colega</span>
                    </h4>
                    <div className="flex space-x-2">
                      <input
                        type="email"
                        placeholder="exemplo@escritorio.com.br"
                        value={emailDestino}
                        onChange={(e) => setEmailDestino(e.target.value)}
                        className="flex-1 p-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleEnviarEmail}
                        disabled={enviandoEmail}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
                      >
                        {enviandoEmail ? "A enviar..." : "Enviar Anexo"}
                      </button>
                    </div>
                    {statusEmail && (
                      <p className="text-xs mt-2 text-blue-600 font-medium">{statusEmail}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== ABA 2: JURISPRIME PETIÇÕES ===================== */}
        {activeTab === "peticao" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Petição de 1º Grau</h2>
                <p className="text-xs text-slate-500">
                  Redação técnica, fundamentação exaustiva e pedidos de tutela provisória (Art. 300 CPC).
                </p>
              </div>

              {/* Upload de PDFs */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Documentos / Processos em PDF (Opcional)
                </label>
                <input
                  type="file"
                  multiple
                  accept="application/pdf"
                  onChange={(e) => setArquivosPeticao(e.target.files)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              {/* Instruções / Fatos */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Fatos, Pretensão do Cliente & Teses
                </label>
                <textarea
                  rows={8}
                  placeholder="Descreva a pretensão do cliente, conduta ilícita da parte contrária, valores envolvidos e necessidade de tutela de urgência..."
                  value={instrucaoPeticao}
                  onChange={(e) => setInstrucaoPeticao(e.target.value)}
                  className="w-full p-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Botão Gerar */}
              <button
                type="button"
                onClick={handleGerarPeticao}
                disabled={gerandoPeticao}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {gerandoPeticao ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>A redigir petição com streaming...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5" />
                    <span>Redigir Minuta de 1º Grau</span>
                  </>
                )}
              </button>
            </div>

            {/* PAINEL DIREITO: PETIÇÃO GERADA COM STREAMING */}
            <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[500px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <h3 className="font-semibold text-slate-900 flex items-center space-x-2">
                    <Scale className="w-5 h-5 text-blue-600" />
                    <span>Minuta Processual</span>
                  </h3>
                  {peticaoGerada && (
                    <button
                      onClick={() => handleDownloadDocx("Peticao_Inicial_1Grau", peticaoGerada)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descarregar .DOCX</span>
                    </button>
                  )}
                </div>

                {peticaoGerada ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs whitespace-pre-wrap max-h-[550px] overflow-y-auto">
                    {peticaoGerada}
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <FileText className="w-10 h-10 stroke-1" />
                    <p className="text-sm">Os argumentos e a petição serão exibidos em tempo real aqui.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}