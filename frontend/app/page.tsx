"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Scale, 
  Mic, 
  FileText, 
  Download, 
  Mail, 
  Loader2, 
  Play, 
  Square,
  Eye,
  EyeOff,
  LogOut
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://jurisprime-api.onrender.com";

export default function Home() {
  // --- ESTADO DE AUTENTICAÇÃO ---
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // --- ESTADOS DO DASHBOARD ---
  const [activeTab, setActiveTab] = useState<"atajur" | "peticao">("atajur");

  // AtaJur
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // JurisPrime (Petição)
  const [instrucaoPeticao, setInstrucaoPeticao] = useState("");
  const [arquivosPeticao, setArquivosPeticao] = useState<FileList | null>(null);
  const [peticaoGerada, setPeticaoGerada] = useState("");
  const [gerandoPeticao, setGerandoPeticao] = useState(false);

  // Checar Sessão no Supabase ao Carregar
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoadingAuth(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- AÇÕES DE AUTENTICAÇÃO ---
  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || "Erro ao conectar com Google");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (authMode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setUser(data.user);
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert("Cadastro realizado com sucesso! Você já pode acessar a plataforma.");
        setAuthMode("login");
      }
    } catch (err: any) {
      setAuthError(err.message || "Erro de autenticação.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

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
    if (user?.id) formData.append("user_id", user.id);

    try {
      const response = await fetch(`${API_BASE_URL}/api/ata/processar-audio`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Erro na resposta da API.");

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
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      alert(`Falha ao gerar petição: ${error}`);
    } finally {
      setGerandoPeticao(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfdfd]">
        <Loader2 className="w-9 h-9 text-blue-600 animate-spin" />
      </div>
    );
  }

  // =========================================================================
  // 1. TELA DE LOGIN ESPAÇOSA E PROPORCIONAL
  // =========================================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-[#fdfdfd] flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* LADO ESQUERDO: FORMULÁRIO (COLUNA 6) */}
          <div className="lg:col-span-6 flex flex-col items-center text-center max-w-lg mx-auto w-full">
            <h1 className="text-4xl sm:text-[42px] font-extrabold text-[#0B132B] tracking-tight mb-2.5 leading-[1.15]">
              Sua rotina jurídica <br /> mais eficiente
            </h1>
            <p className="text-sm text-slate-500 mb-8 font-medium">
              Faça login ou experimente grátis agora mesmo!
            </p>

            {/* BOTÃO GOOGLE OAUTH */}
            <button
              onClick={handleGoogleLogin}
              type="button"
              className="w-full flex items-center justify-center space-x-3 py-3.5 px-4 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-[15px] font-semibold text-slate-700 shadow-sm hover:shadow transition-all mb-6"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Acessar com o Google</span>
            </button>

            {/* DIVISOR OU */}
            <div className="flex items-center w-full mb-6">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-xs text-slate-400 font-medium">ou</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* FORMULÁRIO EMAIL & SENHA */}
            <form onSubmit={handleEmailAuth} className="w-full space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  E-mail *
                </label>
                <input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Senha *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] focus:border-transparent pr-12 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {authError && (
                <p className="text-xs text-red-500 font-medium mt-1">{authError}</p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 bg-[#17387e] hover:bg-[#122c64] text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 mt-2 cursor-pointer"
              >
                {authLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <span>{authMode === "login" ? "Continuar com e-mail →" : "Cadastrar Conta →"}</span>
                )}
              </button>

              <div className="text-center pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "register" : "login");
                    setAuthError(null);
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-blue-700 transition"
                >
                  {authMode === "login"
                    ? "Não tem uma conta? Crie uma agora"
                    : "Já tem uma conta? Fazer login"}
                </button>
              </div>
            </form>

            <p className="text-[11px] text-slate-400 mt-8 leading-relaxed">
              Ao fazer login você concorda com os <br />
              <span className="underline cursor-pointer hover:text-slate-600">Termos de Uso</span> e a{" "}
              <span className="underline cursor-pointer hover:text-slate-600">Política de Privacidade</span>.
            </p>
          </div>

          {/* LADO DIREITO: CARD INSTITUCIONAL AZUL ESCURO (COLUNA 6) */}
          <div className="lg:col-span-6 bg-[#0B132B] text-white p-10 sm:p-14 rounded-[32px] shadow-2xl flex flex-col justify-between min-h-[580px] relative overflow-hidden">
            
            {/* Topo do Card */}
            <div>
              <div className="flex items-center space-x-2.5 text-xs font-bold tracking-widest text-[#38bdf8] uppercase mb-10">
                <svg className="w-5 h-5 text-[#38bdf8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>AVJURIS<span className="text-white">.AI</span></span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold leading-[1.15] mb-8">
                A infraestrutura <br /> definitiva para <br />
                <span className="text-[#38bdf8]">advogados de elite</span>
              </h2>
            </div>

            {/* DEPOIMENTO CARD INTERNO */}
            <div className="bg-[#0F172A]/90 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
              <span className="text-3xl text-[#38bdf8] leading-none block mb-3 font-serif font-black">“</span>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed italic mb-6">
                A AvJuris IA revolucionou a forma como conduzimos nosso trabalho no escritório. Com a capacidade de pesquisar jurisprudência real e emitir atas e pareceres detalhados, conseguimos otimizar nosso tempo e blindar nosso faturamento.
              </p>
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-full bg-[#38bdf8] text-[#0B132B] font-bold text-xs flex items-center justify-center shadow-md">
                  MC
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">Mariana Costa</h4>
                  <p className="text-[11px] text-slate-400">Advogada Sênior</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. DASHBOARD DE TRABALHO (APÓS LOGIN)
  // =========================================================================
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

          <div className="flex items-center space-x-4">
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

            {/* BOTÃO LOGOUT */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition cursor-pointer"
              title="Encerrar Sessão"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL DO DASHBOARD */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ABA 1: ATAJUR */}
        {activeTab === "atajur" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Registro de Reunião</h2>
                <p className="text-xs text-slate-500">
                  Gere a ata executiva formal e a matriz de prazos para colher assinaturas.
                </p>
              </div>

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

              <div className="border-t border-slate-100 pt-4 space-y-4">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Áudio da Reunião
                </label>

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

              <button
                type="button"
                onClick={handleProcessarAta}
                disabled={loadingAta}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
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
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
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
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
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

        {/* ABA 2: JURISPRIME PETIÇÕES */}
        {activeTab === "peticao" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Petição de 1º Grau</h2>
                <p className="text-xs text-slate-500">
                  Redação técnica, fundamentação exaustiva e pedidos de tutela provisória (Art. 300 CPC).
                </p>
              </div>

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

              <button
                type="button"
                onClick={handleGerarPeticao}
                disabled={gerandoPeticao}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
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
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
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
