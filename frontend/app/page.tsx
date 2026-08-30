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
  LogOut,
  Trash2,
  HelpCircle,
  X,
  BookOpen,
  Search,
  ShieldCheck,
  Zap,
  Building,
  CheckCircle2
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

  // --- ESTADOS DO MODAL DE AJUDA ---
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpActiveTab, setHelpActiveTab] = useState<"peticoes" | "atajur" | "datajud" | "seguranca">("peticoes");

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
  const [recordingTime, setRecordingTime] = useState(0);
  const [loadingAta, setLoadingAta] = useState(false);
  const [ataGerada, setAtaGerada] = useState("");
  const [emailDestino, setEmailDestino] = useState("");
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [statusEmail, setStatusEmail] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // JurisPrime (Petição)
  const [instrucaoPeticao, setInstrucaoPeticao] = useState("");
  const [tribunalSelecionado, setTribunalSelecionado] = useState("tjms");
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
        alert("Cadastro realizado! Você já pode acessar a plataforma.");
        setAuthMode("login");
      }
    } catch (err: any) {
      setAuthError(err.message || "E-mail ou senha incorretos.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

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
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Permissão para usar o microfone foi negada ou não suportada.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const handleClearAudio = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioFile(null);
    setRecordingTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

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

  const handleGerarPeticao = async () => {
    if (!instrucaoPeticao) {
      alert("Insira os fatos ou instruções da petição.");
      return;
    }

    setGerandoPeticao(true);
    setPeticaoGerada("");

    const formData = new FormData();
    formData.append("instrucao_usuario", instrucaoPeticao);
    formData.append("tribunal", tribunalSelecionado);

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-[#1e3a8a] animate-spin" />
      </div>
    );
  }

  // =========================================================================
  // 1. TELA DE LOGIN
  // =========================================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-[1.1fr_0.15fr_1.2fr] gap-6 items-center">
          <div className="w-full max-w-[420px] mx-auto flex flex-col items-center text-center">
            <h1 className="text-[#0f172a] font-extrabold text-[30px] leading-[1.15] mt-2 mb-2 tracking-tight">
              Sua rotina jurídica<br />mais eficiente
            </h1>
            <p className="text-[#475569] text-[13.5px] mb-4">
              Faça login ou experimente grátis agora mesmo!
            </p>

            <button
              onClick={handleGoogleLogin}
              type="button"
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3 border border-[#e2e8f0] rounded-lg bg-white hover:bg-[#f8fafc] hover:border-[#cbd5e1] text-[14px] font-semibold text-[#1e293b] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all mb-3 cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Acessar com o Google</span>
            </button>

            <div className="flex items-center w-full my-3 text-[#94a3b8] text-[11px] lowercase">
              <div className="flex-1 border-b border-[#e2e8f0]"></div>
              <span className="px-3">ou</span>
              <div className="flex-1 border-b border-[#e2e8f0]"></div>
            </div>

            <form onSubmit={handleEmailAuth} className="w-full space-y-3 text-left">
              <div>
                <label className="block text-[14px] font-semibold text-[#1e293b] mb-1">
                  E-mail *
                </label>
                <input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-[14px] text-[#1e293b] focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] focus:border-[#1e3a8a] transition"
                />
              </div>

              <div>
                <label className="block text-[14px] font-semibold text-[#1e293b] mb-1">
                  Senha *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-lg text-[14px] text-[#1e293b] focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] focus:border-[#1e3a8a] pr-10 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && (
                <p className="text-[12px] text-red-500 font-medium">{authError}</p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-[44px] bg-[#1e3a8a] hover:bg-[#2563eb] border border-[#1e3a8a] hover:border-[#2563eb] text-white rounded-lg font-semibold text-[15px] transition-all flex items-center justify-center space-x-2 mt-2 cursor-pointer shadow-sm"
              >
                {authLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>{authMode === "login" ? "Continuar com e-mail ➔" : "Cadastrar Conta ➔"}</span>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "register" : "login");
                    setAuthError(null);
                  }}
                  className="text-[12px] font-medium text-slate-500 hover:text-blue-700 transition cursor-pointer"
                >
                  {authMode === "login"
                    ? "Não tem uma conta? Crie uma agora"
                    : "Já tem uma conta? Fazer login"}
                </button>
              </div>
            </form>

            <p className="text-[11px] text-[#64748b] mt-3.5 leading-tight">
              Ao fazer login você concorda com os<br />
              <strong>Termos de Uso</strong> e a <strong>Política de Privacidade</strong>.
            </p>
          </div>

          <div className="hidden lg:block"></div>

          <div className="w-full relative overflow-hidden rounded-[20px] p-8 sm:p-10 text-white min-h-[460px] flex flex-col justify-center shadow-[0_20px_40px_-10px_rgba(0,0,0,0.25)] bg-gradient-to-br from-[#0B132B] to-[#0F172A]">
            <div className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(56,189,248,0.1)_0%,transparent_60%)] pointer-events-none"></div>

            <div className="flex items-center justify-center gap-2 mb-6 relative z-10">
              <svg className="w-7 h-7 text-[#38BDF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-[24px] font-extrabold text-white tracking-[-0.5px]">
                AVJURIS<span className="text-[#38BDF8]">.AI</span>
              </span>
            </div>

            <h2 className="text-center text-[28px] sm:text-[32px] font-extrabold leading-[1.2] mb-6 relative z-10 text-white">
              A infraestrutura<br />definitiva para<br />
              <span className="text-[#38BDF8]">advogados de elite</span>
            </h2>

            <div className="bg-white/[0.03] border border-white/10 rounded-[14px] p-6 relative z-10 backdrop-blur-[10px] text-left">
              <div className="text-[#38BDF8] text-[32px] font-serif leading-none mb-2.5 opacity-80 select-none">
                "
              </div>
              <p className="text-[13.5px] leading-[1.55] text-[#cbd5e1] mb-4 text-justify">
                A AvJuris IA revolucionou a forma como conduzimos nosso trabalho no escritório. Com a capacidade de pesquisar jurisprudência real e emitir pareceres detalhados, conseguimos otimizar nosso tempo e blindar nosso faturamento.
              </p>
              <div className="flex items-center gap-3">
                <div className="w-[38px] h-[38px] rounded-full bg-[#38BDF8] text-[#0B132B] font-extrabold text-[14px] flex items-center justify-center shrink-0">
                  MC
                </div>
                <div>
                  <div className="font-bold text-[13px] text-white">Mariana Costa</div>
                  <div className="text-[11px] text-[#94a3b8]">Advogada Sênior</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. DASHBOARD DE TRABALHO
  // =========================================================================
  return (
    <div className="min-h-screen bg-slate-50 relative">
      {/* MODAL DE AJUDA & MANUAL OPERACIONAL */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
            
            {/* Header do Modal */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600 rounded-lg text-white">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Central de Ajuda & Manual Operacional</h3>
                  <p className="text-xs text-slate-300">Guia prático para extrair o máximo de precisão do JurisPrime & AtaJur</p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas de Navegação da Ajuda */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 space-x-4">
              <button
                onClick={() => setHelpActiveTab("peticoes")}
                className={`pb-3 text-xs font-semibold flex items-center space-x-2 border-b-2 transition ${
                  helpActiveTab === "peticoes"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Petições de 1º Grau</span>
              </button>
              <button
                onClick={() => setHelpActiveTab("atajur")}
                className={`pb-3 text-xs font-semibold flex items-center space-x-2 border-b-2 transition ${
                  helpActiveTab === "atajur"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>AtaJur (Atas de Áudio)</span>
              </button>
              <button
                onClick={() => setHelpActiveTab("datajud")}
                className={`pb-3 text-xs font-semibold flex items-center space-x-2 border-b-2 transition ${
                  helpActiveTab === "datajud"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Building className="w-4 h-4" />
                <span>Integração DataJud / CNJ</span>
              </button>
              <button
                onClick={() => setHelpActiveTab("seguranca")}
                className={`pb-3 text-xs font-semibold flex items-center space-x-2 border-b-2 transition ${
                  helpActiveTab === "seguranca"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Travas Anti-Alucinação</span>
              </button>
            </div>

            {/* Conteúdo da Ajuda */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
              {helpActiveTab === "peticoes" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <Scale className="w-5 h-5 text-blue-600" />
                    Como gerar Petições Iniciais e Incidentais com Alta Densidade
                  </h4>
                  <p>
                    O módulo **JurisPrime Petições** foi calibrado para redigir peças completas de 2.000 a 3.500 palavras com rigor forense, pedidos pormenorizados e requerimento de tutela provisória (Art. 300 e 311 do CPC).
                  </p>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <p className="font-semibold text-slate-900">Passo a passo recomendado:</p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-600">
                      <li><strong>Selecione o Tribunal</strong> de destino no menu dropdown para direcionar o estilo da corte.</li>
                      <li><strong>Anexe contratos ou comprovantes em PDF</strong> (o Gemini analisará as cláusulas e valores diretamente).</li>
                      <li><strong>Descreva os fatos essenciais</strong> e os pedidos desejados (ex: dano moral, repetição de indébito, inversão do ônus da prova).</li>
                      <li>Clique em <strong>Redigir Petição Inicial</strong> e visualize o texto sendo redigido em tempo real (streaming).</li>
                      <li>Exporte em <strong>.DOCX formatado</strong> com recuos e margens padrão da advocacia.</li>
                    </ol>
                  </div>
                </div>
              )}

              {helpActiveTab === "atajur" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <Mic className="w-5 h-5 text-blue-600" />
                    Fluxo Executivo do AtaJur
                  </h4>
                  <p>
                    O **AtaJur** sintetiza reuniões jurídicas complexas com clientes ou equipes internas, transformando áudios extensos em atas formais com matriz de prazos, pendências e responsabilidades claras.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <p className="font-semibold text-blue-900 mb-1">👤 Reunião com Cliente</p>
                      <p className="text-xs text-blue-700">
                        Estrutura os fatos narrados pelo cliente, documentos faltantes que ele precisa providenciar e prazos para a propositura da ação.
                      </p>
                    </div>
                    <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl">
                      <p className="font-semibold text-slate-900 mb-1">⚖️ Reunião Interna</p>
                      <p className="text-xs text-slate-600">
                        Foca na estratégia processual do escritório, distribuição de teses entre sócios/associados e prazos fatais de protocolo.
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    💡 <strong>Dica:</strong> Após gerar a ata, você pode dispará-la diretamente para o e-mail do cliente ou colega com o anexo .docx gerado.
                  </p>
                </div>
              )}

              {helpActiveTab === "datajud" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <Building className="w-5 h-5 text-blue-600" />
                    Varredura Direta no DataJud / CNJ
                  </h4>
                  <p>
                    A plataforma integra a API Pública oficial do Conselho Nacional de Justiça (DataJud). Ao redigir réplicas, contestações ou incidentes, basta digitar ou colar o número do processo no formato CNJ (<code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">0000000-00.0000.0.00.0000</code>).
                  </p>
                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-amber-900 text-xs space-y-1">
                    <p className="font-semibold">O que o sistema busca automaticamente:</p>
                    <p>• Órgão julgador e vara competente do tribunal selecionado;</p>
                    <p>• Classe processual e códigos de assuntos catalogados pelo CNJ;</p>
                    <p>• Resumo cronológico das últimas movimentações processuais.</p>
                  </div>
                </div>
              )}

              {helpActiveTab === "seguranca" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                    Travas Anti-Alucinação e Consulta ao Google Search
                  </h4>
                  <p>
                    Para evitar a citação de precedentes fantasmas, números de REsp inexistentes ou súmulas revogadas, a infraestrutura opera com:
                  </p>
                  <ul className="space-y-2 text-slate-600">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Verificação em Tempo Real:</strong> A IA valida precedentes do STJ/STF via ferramenta de busca conectada antes de emitir a fundamentação.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span><strong>Temperatura Zero (0.1):</strong> Reduz a criatividade solta da IA ao mínimo indispensável, garantindo rigor dogmático e terminologia processual exata.</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Entendido, Fechar Guia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">JurisPrime & AtaJur</h1>
              <p className="text-[11px] text-slate-400">Inteligência Artificial de Alta Performance Jurídica</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* SELETOR DE MÓDULOS */}
            <div className="flex space-x-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setActiveTab("atajur")}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === "atajur"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>AtaJur</span>
              </button>
              <button
                onClick={() => setActiveTab("peticao")}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === "peticao"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Petições (1º Grau)</span>
              </button>
            </div>

            {/* BOTÃO CENTRAL DE AJUDA */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition cursor-pointer"
              title="Manual e Guia de Uso"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline">Ajuda & Manual</span>
            </button>

            {/* BOTÃO LOGOUT */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition cursor-pointer"
              title="Encerrar Sessão"
            >
              <LogOut className="w-3.5 h-3.5" />
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
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer ${
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
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all cursor-pointer ${
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
                      className="flex-1 flex items-center justify-center space-x-2 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors cursor-pointer"
                    >
                      <Play className="w-4 h-4" />
                      <span>Gravar no Microfone</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="flex-1 flex items-center justify-between px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 animate-pulse transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-2">
                        <Square className="w-4 h-4" />
                        <span>Parar Gravação</span>
                      </div>
                      <span className="font-mono bg-red-700 px-2 py-0.5 rounded text-xs tracking-wider">
                        {formatTime(recordingTime)}
                      </span>
                    </button>
                  )}
                </div>

                {audioUrl && (
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center space-x-2">
                    <audio src={audioUrl} controls className="w-full h-8" />
                    <button
                      type="button"
                      onClick={handleClearAudio}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Excluir áudio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <input
                      type="file"
                      accept="audio/*,video/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setAudioFile(e.target.files[0]);
                          setAudioUrl(null);
                        }
                      }}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                    />
                  </div>

                  {audioFile && (
                    <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                      <span className="truncate max-w-[280px]">📁 {audioFile.name}</span>
                      <button
                        type="button"
                        onClick={handleClearAudio}
                        className="text-red-500 hover:text-red-700 font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  )}
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

        {/* ABA 2: JURISPRIME PETIÇÕES DE 1º GRAU */}
        {activeTab === "peticao" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">Petição Inicial de 1º Grau</h2>
                <p className="text-xs text-slate-500">
                  Redação técnica com análise documental, consulta DataJud e tutela de urgência (Art. 300 CPC).
                </p>
              </div>

              {/* SELETOR DE TRIBUNAL DATAJUD */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Tribunal de Origem (DataJud / CNJ)
                </label>
                <select
                  value={tribunalSelecionado}
                  onChange={(e) => setTribunalSelecionado(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                >
                  <option value="tjms">TJMS — Tribunal de Justiça de Mato Grosso do Sul</option>
                  <option value="tjsp">TJSP — Tribunal de Justiça de São Paulo</option>
                  <option value="tjmt">TJMT — Tribunal de Justiça de Mato Grosso</option>
                  <option value="tjdft">TJDFT — Tribunal de Justiça do Distrito Federal</option>
                  <option value="trf3">TRF3 — Tribunal Regional Federal da 3ª Região</option>
                  <option value="trf1">TRF1 — Tribunal Regional Federal da 1ª Região</option>
                </select>
              </div>

              {/* UPLOAD DE PROVAS */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Documentos Probatórios / Contratos em PDF
                </label>
                <input
                  type="file"
                  multiple
                  accept="application/pdf"
                  onChange={(e) => setArquivosPeticao(e.target.files)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              {/* INSTRUÇÃO E FATOS */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Fatos, Pretensão do Autor & Número CNJ
                </label>
                <textarea
                  rows={7}
                  placeholder="Ex: Ação Declaratória c/c Indenizatória. Autor sofreu negativação indevida pelo Banco X no valor de R$ 5.000,00 sem contrato firmado. Requer tutela de urgência inaudita altera parte para exclusão no Serasa e indenização de R$ 15.000,00..."
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
                    <span>Redigindo Minuta com Fundamentação Exaustiva...</span>
                  </>
                ) : (
                  <>
                    <Scale className="w-5 h-5" />
                    <span>Redigir Petição Inicial</span>
                  </>
                )}
              </button>
            </div>

            {/* PREVIEW DA PEÇA PROCESSUAL */}
            <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200 shadow-sm min-h-[500px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <h3 className="font-semibold text-slate-900 flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span>Peça Processual (Padrão Forense)</span>
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
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-lg font-serif text-[15px] leading-relaxed text-slate-900 whitespace-pre-wrap max-h-[580px] overflow-y-auto select-text shadow-inner">
                    {peticaoGerada}
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <FileText className="w-10 h-10 stroke-1" />
                    <p className="text-sm">A petição completa formatada para protocolo surgirá aqui em tempo real.</p>
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
