"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Scale, 
  Mic, 
  FileText, 
  Download, 
  Copy,
  Check,
  Loader2, 
  Square, 
  Eye, 
  EyeOff, 
  LogOut, 
  Trash2, 
  HelpCircle, 
  X, 
  BookOpen, 
  Building, 
  CheckCircle2, 
  Plus, 
  Paperclip, 
  Send, 
  Sparkles, 
  ChevronRight, 
  Briefcase,
  FileCheck2
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://jurisprime.onrender.com";

interface DocumentoHistorico {
  id: string;
  titulo: string;
  tipo: string;
  conteudo_markdown: string;
  instrucao_original?: string;
  created_at: string;
}

interface StatusPlano {
  plano: string;
  usados: number;
  maximo: number;
}

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

  // --- MODAL DE AJUDA & ABAS ---
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpActiveTab, setHelpActiveTab] = useState<"peticoes" | "datajud" | "atajur" | "timbrado" | "seguranca">("peticoes");

  // --- SELETOR DE MÓDULO (PETIÇÃO OU ATA) ---
  const [moduloSelecionado, setModuloSelecionado] = useState<"peticao" | "ata">("peticao");

  // --- ESTADOS DE ENTRADA / FORMULÁRIO ---
  const [instrucao, setInstrucao] = useState("");
  const [tribunal, setTribunal] = useState("tjms");
  const [tipoReuniao, setTipoReuniao] = useState<"Cliente" | "Interna">("Cliente");
  const [participantes, setParticipantes] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [arquivoTimbrado, setArquivoTimbrado] = useState<File | null>(null);

  // Áudio
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Geração, Edição e Feedback
  const [gerando, setGerando] = useState(false);
  const [resultadoTexto, setResultadoTexto] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [emailDestino, setEmailDestino] = useState("");
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [statusEmail, setStatusEmail] = useState<string | null>(null);

  // --- DADOS REAIS DO SUPABASE ---
  const [historicoCasos, setHistoricoCasos] = useState<DocumentoHistorico[]>([]);
  const [statusPlano, setStatusPlano] = useState<StatusPlano>({ plano: "Básico", usados: 0, maximo: 15 });

  // Carregar histórico e status da cota
  const carregarDadosUsuario = async (userId: string) => {
    try {
      const [resDocs, resStatus] = await Promise.all([
        fetch(`${API_BASE_URL}/api/documentos/${userId}`),
        fetch(`${API_BASE_URL}/api/usuario/${userId}/status`)
      ]);

      if (resDocs.ok) {
        const dataDocs = await resDocs.json();
        setHistoricoCasos(dataDocs);
      }

      if (resStatus.ok) {
        const dataStatus = await resStatus.json();
        setStatusPlano({
          plano: dataStatus.plano || "Básico",
          usados: dataStatus.usados || 0,
          maximo: dataStatus.maximo || 15
        });
      }
    } catch (e) {
      console.error("Erro ao carregar dados do usuário:", e);
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        carregarDadosUsuario(currentUser.id);
      }
      setLoadingAuth(false);
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        carregarDadosUsuario(currentUser.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const getUserName = () => {
    if (!user) return "Doutor(a)";
    if (user.user_metadata?.full_name) return user.user_metadata.full_name.split(" ")[0];
    if (user.email) return user.email.split("@")[0];
    return "Doutor(a)";
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const totalPalavras = resultadoTexto.trim() ? resultadoTexto.trim().split(/\s+/).length : 0;
  const estimativaPaginas = Math.max(1, Math.ceil(totalPalavras / 380));

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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setUser(data.user);
        if (data.user) carregarDadosUsuario(data.user.id);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Cadastro realizado com sucesso! Você já pode entrar.");
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
    setHistoricoCasos([]);
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Permissão para usar o microfone não concedida.");
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
    setRecordingTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setArquivos((prev) => [...prev, ...newFiles]);
    }
  };

  const handleTimbradoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith(".docx")) {
        setArquivoTimbrado(file);
      } else {
        alert("Por favor, selecione um arquivo modelo no formato .docx");
      }
    }
  };

  const handleRemoveFile = (index: number) => {
    setArquivos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNovoAtendimento = () => {
    setInstrucao("");
    setArquivos([]);
    handleClearAudio();
    setResultadoTexto("");
    setStatusEmail(null);
  };

  const handleAbrirDocumentoSalvo = (doc: DocumentoHistorico) => {
    setModuloSelecionado(doc.tipo === "Ata de Reunião" ? "ata" : "peticao");
    setInstrucao(doc.instrucao_original || doc.titulo);
    setResultadoTexto(doc.conteudo_markdown);
  };

  const handleCopiarTexto = () => {
    if (!resultadoTexto) return;
    navigator.clipboard.writeText(resultadoTexto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleExecutarIA = async () => {
    if (moduloSelecionado === "ata") {
      if (!audioBlob && arquivos.length === 0) {
        alert("Grave um áudio no microfone ou anexe um arquivo de áudio.");
        return;
      }
      setGerando(true);
      setResultadoTexto("");

      const formData = new FormData();
      const fileToSend = arquivos.find(f => f.type.startsWith("audio/")) || 
        (audioBlob ? new File([audioBlob], "gravacao.webm", { type: "audio/webm" }) : null);

      if (!fileToSend) {
        alert("Nenhum áudio válido selecionado.");
        setGerando(false);
        return;
      }

      formData.append("audio", fileToSend);
      formData.append("tipo_reuniao", tipoReuniao);
      formData.append("participantes", participantes || "Participantes da Reunião");
      formData.append("titulo", instrucao || "Ata Executiva de Reunião");
      if (user?.id) formData.append("user_id", user.id);

      try {
        const response = await fetch(`${API_BASE_URL}/api/ata/processar-audio`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error("Erro na resposta da API.");
        const data = await response.json();
        setResultadoTexto(data.ata_markdown);
        if (user) carregarDadosUsuario(user.id);
      } catch (err: any) {
        alert(`Falha ao gerar ata: ${err.message}`);
      } finally {
        setGerando(false);
      }
    } else {
      if (!instrucao) {
        alert("Descreva os fatos, pretensão ou número CNJ para iniciar.");
        return;
      }
      setGerando(true);
      setResultadoTexto("");

      const formData = new FormData();
      formData.append("instrucao_usuario", instrucao);
      formData.append("tribunal", tribunal);
      if (user?.id) formData.append("user_id", user.id);

      arquivos.forEach((file) => {
        formData.append("arquivos", file);
      });

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
              if (dataStr === "[DONE]") {
                if (user) carregarDadosUsuario(user.id);
                break;
              }
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  setResultadoTexto((prev) => prev + parsed.text);
                }
              } catch (e) {}
            }
          }
        }
      } catch (error: any) {
        alert(`Falha ao redigir petição: ${error.message}`);
      } finally {
        setGerando(false);
      }
    }
  };

  const handleDownloadDocx = async (titulo: string, conteudo: string) => {
    try {
      const formData = new FormData();
      formData.append("titulo", titulo || "Documento_AvJuris");
      formData.append("conteudo_markdown", conteudo);
      if (arquivoTimbrado) {
        formData.append("template_timbrado", arquivoTimbrado);
      }

      const response = await fetch(`${API_BASE_URL}/api/exportar-docx`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Erro ao exportar docx");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${titulo || "Documento_AvJuris"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      alert("Erro ao descarregar documento .docx");
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
          titulo: "Documento Gerado - AvJuris",
          conteudo_markdown: resultadoTexto,
        }),
      });

      if (!response.ok) throw new Error("Erro no envio");
      setStatusEmail("E-mail enviado com sucesso com anexo .docx!");
    } catch (error) {
      setStatusEmail("Falha ao enviar e-mail. Verifique o servidor SMTP.");
    } finally {
      setEnviandoEmail(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B132B]">
        <Loader2 className="w-8 h-8 text-[#38BDF8] animate-spin" />
      </div>
    );
  }

  // =========================================================================
  // 1. TELA DE LOGIN
  // =========================================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B132B] flex items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-[1050px] grid grid-cols-1 lg:grid-cols-[1.1fr_0.1fr_1.2fr] gap-6 items-center">
          
          <div className="w-full max-w-[400px] mx-auto bg-[#0F172A] p-8 rounded-2xl border border-white/10 shadow-2xl text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Scale className="w-7 h-7 text-[#38BDF8]" />
              <span className="text-2xl font-extrabold text-white tracking-tight">
                AVJURIS<span className="text-[#38BDF8]">.AI</span>
              </span>
            </div>

            <h1 className="text-white font-extrabold text-2xl leading-tight mb-2">
              Acesso à Plataforma
            </h1>
            <p className="text-slate-400 text-xs mb-6">
              Automação jurídica de alta performance com IA Forense.
            </p>

            <button
              onClick={handleGoogleLogin}
              type="button"
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3 border border-white/15 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition shadow-sm mb-4 cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Acessar com Google</span>
            </button>

            <div className="flex items-center w-full my-4 text-slate-500 text-[11px] lowercase">
              <div className="flex-1 border-b border-white/10"></div>
              <span className="px-3">ou credenciais</span>
              <div className="flex-1 border-b border-white/10"></div>
            </div>

            <form onSubmit={handleEmailAuth} className="w-full space-y-3.5 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="advogado@escritorio.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#38BDF8] transition placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#38BDF8] pr-10 transition placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {authError && <p className="text-[11px] text-red-400">{authError}</p>}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition flex items-center justify-center space-x-2 mt-2 cursor-pointer shadow-lg shadow-blue-600/30"
              >
                {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{authMode === "login" ? "Entrar na Plataforma ➔" : "Cadastrar Conta ➔"}</span>}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "register" : "login");
                    setAuthError(null);
                  }}
                  className="text-[11px] text-slate-400 hover:text-[#38BDF8] transition cursor-pointer"
                >
                  {authMode === "login" ? "Novo por aqui? Crie sua conta" : "Já possui conta? Fazer login"}
                </button>
              </div>
            </form>
          </div>

          <div className="hidden lg:block"></div>

          <div className="p-8 text-left space-y-6">
            <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-[#38BDF8] text-xs font-bold rounded-full">
              SaaS Jurídico de 2ª Geração
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
              A infraestrutura definitiva para <span className="text-[#38BDF8]">advogados de elite</span>
            </h2>
            <div className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Petições Iniciais completas com densidade forense</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Atas executivas com matriz de prazos e tarefas</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Exportação com template timbrado (.docx) do seu escritório</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. WORKSTATION AVJURIS (DASHBOARD PRINCIPAL)
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-800">
      
      {/* SIDEBAR LATERAL (DARK) */}
      <aside className="w-64 bg-[#0B132B] border-r border-slate-800 flex flex-col justify-between shrink-0 hidden md:flex">
        <div className="p-4 space-y-6">
          
          {/* Marca Única AvJuris */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-extrabold text-white tracking-tight">
                AVJURIS<span className="text-[#38BDF8]">.AI</span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium">Workstation Jurídica</p>
            </div>
          </div>

          {/* Botão + Novo Atendimento */}
          <button
            onClick={handleNovoAtendimento}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Minuta / Conversa</span>
          </button>

          {/* Seção Meus Casos (Carregados do Supabase) */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">
              Meus Casos ({historicoCasos.length})
            </span>
            <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1">
              {historicoCasos.length === 0 ? (
                <p className="text-[11px] text-slate-500 px-2 py-1">Nenhum caso salvo ainda</p>
              ) : (
                historicoCasos.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleAbrirDocumentoSalvo(item)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-xs text-slate-300 transition flex items-center justify-between group cursor-pointer"
                  >
                    <div className="truncate pr-2">
                      <p className="font-medium text-white truncate">{item.titulo}</p>
                      <p className="text-[10px] text-slate-500">{item.tipo}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Rodapé da Sidebar (Cota Real Sincronizada) */}
        <div className="p-4 border-t border-slate-800 space-y-4">
          <div className="bg-[#0F172A] p-3 rounded-xl border border-white/5 space-y-2">
            <div className="flex justify-between text-[11px] text-slate-300 font-semibold">
              <span>Consumo do Mês</span>
              <span className="text-[#38BDF8]">{statusPlano.usados} / {statusPlano.maximo} docs</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, (statusPlano.usados / statusPlano.maximo) * 100)}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-400">Plano {statusPlano.plano}</p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 truncate">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {getUserName().charAt(0).toUpperCase()}
              </div>
              <div className="truncate text-left">
                <p className="text-xs font-bold text-white truncate">{getUserName()}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition cursor-pointer"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* CANVAS CENTRAL */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* HEADER SUPERIOR */}
        <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => {
                setModuloSelecionado("peticao");
                setResultadoTexto("");
              }}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                moduloSelecionado === "peticao"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Petição de 1º Grau</span>
            </button>
            <button
              onClick={() => {
                setModuloSelecionado("ata");
                setResultadoTexto("");
              }}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                moduloSelecionado === "ata"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Ata de Reunião</span>
            </button>
          </div>

          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowHelpModal(true)}
              className="px-3 py-1.5 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-1.5 transition cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>Manual</span>
            </button>

            <a
              href="https://www.asaas.com/c/jak9kzx44se9t69b"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-lg transition shadow-sm flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Assinar Plano</span>
            </a>
          </div>
        </header>

        {/* CORPO DO STUDIO */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col">
          {!resultadoTexto && !gerando ? (
            
            <div className="max-w-3xl w-full mx-auto my-auto flex flex-col items-center text-center space-y-6">
              
              {/* Banner CNJ se for Petição */}
              {moduloSelecionado === "peticao" && (
                <div className="w-full bg-blue-50/80 border border-blue-200/70 p-4 rounded-2xl flex items-center justify-between text-left">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600 text-white rounded-xl">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-blue-950">Conexão Oficial DataJud / CNJ</h4>
                      <p className="text-[11px] text-blue-700">Informe o número do processo (20 dígitos) para buscar comarca, vara e classe processual.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInstrucao("0000000-00.2026.8.12.0001")}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shrink-0 transition cursor-pointer"
                  >
                    Buscar processo
                  </button>
                </div>
              )}

              {/* Saudação */}
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {getGreeting()}, <span className="uppercase text-blue-600">{getUserName()}</span>.
                </h2>
                <p className="text-base sm:text-lg text-slate-500 font-serif italic mt-1">
                  {moduloSelecionado === "peticao" ? "Qual peça processual vamos redigir hoje?" : "Qual reunião vamos registrar e sintetizar?"}
                </p>
              </div>

              {/* Sugestões Rápidas */}
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
                {moduloSelecionado === "peticao" ? (
                  <>
                    <button
                      onClick={() => setInstrucao("Ação de Cobrança c/c Indenização por Danos Morais em face do Banco X decorrente de inclusão indevida no SPC/Serasa.")}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 rounded-full text-xs font-medium text-slate-600 shadow-sm transition cursor-pointer"
                    >
                      Petição Inicial Cível
                    </button>
                    <button
                      onClick={() => setInstrucao("Requerimento de Tutela Provisória de Urgência Inaudita Altera Parte (Art. 300 CPC) para cancelamento imediato de desconto em benefício.")}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 rounded-full text-xs font-medium text-slate-600 shadow-sm transition cursor-pointer"
                    >
                      Tutela de Urgência (Art. 300)
                    </button>
                    <button
                      onClick={() => setInstrucao("Contestação com preliminares de ilegitimidade passiva ad causam e inépcia da petição inicial.")}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 rounded-full text-xs font-medium text-slate-600 shadow-sm transition cursor-pointer"
                    >
                      Contestação & Preliminares
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setTipoReuniao("Cliente");
                        setInstrucao("Alinhamento estratégico inicial com o cliente para ajuizamento de ação rescisória e coleta de provas documentais.");
                      }}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 rounded-full text-xs font-medium text-slate-600 shadow-sm transition cursor-pointer"
                    >
                      👤 Reunião com Cliente
                    </button>
                    <button
                      onClick={() => {
                        setTipoReuniao("Interna");
                        setInstrucao("Reunião interna de sócios para divisão de teses de recursos e prazos fatais da semana.");
                      }}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 rounded-full text-xs font-medium text-slate-600 shadow-sm transition cursor-pointer"
                    >
                      ⚖️ Reunião Interna do Escritório
                    </button>
                  </>
                )}
              </div>

              {/* PROMPT BOX UNIFICADA */}
              <div className="w-full bg-white border-2 border-slate-200 hover:border-blue-400 focus-within:border-blue-600 rounded-2xl p-4 shadow-lg transition duration-200 text-left">
                
                {/* Opções Superiores da Caixa */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 text-xs">
                  {moduloSelecionado === "ata" ? (
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-600">Tipo:</span>
                      <button
                        type="button"
                        onClick={() => setTipoReuniao("Cliente")}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${tipoReuniao === "Cliente" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}`}
                      >
                        Reunião Cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipoReuniao("Interna")}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${tipoReuniao === "Interna" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}`}
                      >
                        Reunião Interna
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-600">Tribunal / DataJud:</span>
                      <select
                        value={tribunal}
                        onChange={(e) => setTribunal(e.target.value)}
                        className="p-1 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-700 text-xs focus:outline-none cursor-pointer"
                      >
                        <option value="tjms">TJMS (Mato Grosso do Sul)</option>
                        <option value="tjsp">TJSP (São Paulo)</option>
                        <option value="tjmt">TJMT (Mato Grosso)</option>
                        <option value="tjdft">TJDFT (Distrito Federal)</option>
                        <option value="trf3">TRF3 (Federal 3ª Região)</option>
                        <option value="trf1">TRF1 (Federal 1ª Região)</option>
                      </select>
                    </div>
                  )}

                  {/* Microfone */}
                  <div className="flex items-center space-x-2">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        className="flex items-center space-x-1.5 px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold hover:bg-red-100 transition cursor-pointer"
                      >
                        <Mic className="w-3.5 h-3.5" />
                        <span>Gravar Áudio</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStopRecording}
                        className="flex items-center space-x-2 px-3 py-1 bg-red-600 text-white rounded-lg font-mono animate-pulse cursor-pointer"
                      >
                        <Square className="w-3 h-3" />
                        <span>Parar ({formatTime(recordingTime)})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Player de Áudio */}
                {audioUrl && (
                  <div className="p-2 mb-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <audio src={audioUrl} controls className="h-7 w-full max-w-[320px]" />
                    <button
                      type="button"
                      onClick={handleClearAudio}
                      className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Campo de Texto */}
                <textarea
                  rows={4}
                  value={instrucao}
                  onChange={(e) => setInstrucao(e.target.value)}
                  placeholder={
                    moduloSelecionado === "ata"
                      ? "Informe a pauta da reunião ou os participantes..."
                      : "Descreva a pretensão do cliente, conduta ilícita, valores e pedidos liminares..."
                  }
                  className="w-full text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none bg-transparent"
                />

                {/* Badges de Arquivos & Modelo Timbrado */}
                <div className="flex flex-wrap gap-2 pt-2 pb-1 border-t border-slate-100">
                  {arquivoTimbrado && (
                    <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg text-[11px] text-blue-700 font-semibold">
                      <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
                      <span className="truncate max-w-[170px]">Timbrado: {arquivoTimbrado.name}</span>
                      <button type="button" onClick={() => setArquivoTimbrado(null)} className="text-blue-400 hover:text-red-500 ml-1 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {arquivos.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg text-[11px] text-slate-700 font-medium">
                      <Paperclip className="w-3 h-3 text-slate-500" />
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <button type="button" onClick={() => handleRemoveFile(idx)} className="text-slate-400 hover:text-red-500 ml-1 cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Barra Inferior */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-2">
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <label className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 transition">
                      <Paperclip className="w-4 h-4" />
                      <span>Anexar autos / PDFs</span>
                      <input
                        type="file"
                        multiple
                        accept="application/pdf,audio/*"
                        onChange={handleFilesUpload}
                        className="hidden"
                      />
                    </label>

                    <label className="flex items-center space-x-1.5 text-xs text-blue-600 hover:text-blue-800 cursor-pointer p-1.5 rounded-lg hover:bg-blue-50 transition font-medium">
                      <FileCheck2 className="w-4 h-4" />
                      <span>Usar Modelo Timbrado (.docx)</span>
                      <input
                        type="file"
                        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleTimbradoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecutarIA}
                    disabled={gerando}
                    className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-md shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

              </div>

              <p className="text-[11px] text-slate-400">
                A IA pode cometer erros. Sempre revise as minutas antes do protocolo judicial.
              </p>
            </div>

          ) : (

            /* WORKSTATION FORENSE / SPLIT VIEW COM EDITOR DIRETO */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-stretch">
              
              {/* Painel Esquerdo */}
              <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-blue-600" />
                      <span>Instruções & Fatos</span>
                    </h3>
                    <button
                      onClick={handleNovoAtendimento}
                      className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                    >
                      + Novo
                    </button>
                  </div>

                  <textarea
                    rows={8}
                    value={instrucao}
                    onChange={(e) => setInstrucao(e.target.value)}
                    className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />

                  {/* Modelo Timbrado Ativo */}
                  {arquivoTimbrado && (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-800">
                      <div className="flex items-center gap-2 truncate">
                        <FileCheck2 className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-semibold truncate">Timbrado: {arquivoTimbrado.name}</span>
                      </div>
                      <button onClick={() => setArquivoTimbrado(null)} className="text-blue-500 hover:text-red-500 cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {arquivos.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-slate-700 mb-1.5 block">Documentos Anexados:</span>
                      <div className="space-y-1">
                        {arquivos.map((f, i) => (
                          <div key={i} className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 truncate">
                            📄 {f.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleExecutarIA}
                  disabled={gerando}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{gerando ? "Processando..." : "Regenerar / Atualizar"}</span>
                </button>
              </div>

              {/* Painel Direito (Editor Estilo Folha Forense A4) */}
              <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span className="font-bold text-slate-900 text-sm">
                          {moduloSelecionado === "peticao" ? "Peça Processual (Padrão Forense)" : "Ata Executiva de Reunião"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{totalPalavras.toLocaleString()} palavras</span>
                        <span>•</span>
                        <span>~{estimativaPaginas} {estimativaPaginas === 1 ? "página" : "páginas"} A4</span>
                        {arquivoTimbrado && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600 font-medium">Timbrado ativo</span>
                          </>
                        )}
                      </p>
                    </div>

                    {resultadoTexto && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={handleCopiarTexto}
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiado ? "Copiado!" : "Copiar"}</span>
                        </button>

                        <button
                          onClick={() => handleDownloadDocx("Documento_AvJuris", resultadoTexto)}
                          className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Exportar .DOCX</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Editor / Visualizador da Folha Forense */}
                  <div className="relative">
                    <textarea
                      rows={18}
                      value={resultadoTexto}
                      onChange={(e) => setResultadoTexto(e.target.value)}
                      placeholder="O conteúdo gerado pela IA surgirá aqui para revisão e edição em tempo real..."
                      className="w-full p-6 bg-[#FAFAFA] border border-slate-200 rounded-xl font-serif text-[15px] leading-relaxed text-slate-900 focus:outline-none focus:border-blue-400 focus:bg-white transition resize-none shadow-inner"
                    />

                    {gerando && (
                      <div className="absolute bottom-4 left-6 flex items-center space-x-2 text-blue-600 font-sans text-xs bg-white/90 px-3 py-1.5 rounded-lg border border-blue-200 shadow-sm animate-pulse font-semibold">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sintetizando minuta com rigor dogmático...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Disparo por E-mail */}
                {resultadoTexto && (
                  <div className="border-t border-slate-100 pt-4 mt-4 flex items-center justify-between gap-4">
                    <div className="flex-1 flex space-x-2">
                      <input
                        type="email"
                        placeholder="Enviar documento por e-mail (ex: cliente@email.com)"
                        value={emailDestino}
                        onChange={(e) => setEmailDestino(e.target.value)}
                        className="flex-1 p-2 text-xs border border-slate-300 rounded-lg focus:outline-none"
                      />
                      <button
                        onClick={handleEnviarEmail}
                        disabled={enviandoEmail}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer"
                      >
                        {enviandoEmail ? "Enviando..." : "Enviar Anexo"}
                      </button>
                    </div>
                    {statusEmail && <p className="text-xs text-blue-600 font-semibold">{statusEmail}</p>}
                  </div>
                )}
              </div>

            </div>
          )}
        </main>
      </div>

      {/* =====================================================================
          MODAL DE AJUDA & MANUAL OPERACIONAL AVANÇADO (COM ABAS)
      ====================================================================== */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Cabeçalho do Modal */}
            <div className="px-6 py-4 bg-[#0B132B] text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600/30 border border-blue-500/30 rounded-lg text-[#38BDF8]">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Central de Ajuda & Manual Operacional</h3>
                  <p className="text-[11px] text-slate-400">Guia técnico e prático de recursos do AvJuris.AI</p>
                </div>
              </div>
              <button 
                onClick={() => setShowHelpModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu de Abas / Categorias */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2 sm:gap-4 overflow-x-auto text-xs font-semibold text-slate-600 shrink-0">
              <button
                onClick={() => setHelpActiveTab("peticoes")}
                className={`py-3.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  helpActiveTab === "peticoes" 
                    ? "border-blue-600 text-blue-600 font-bold" 
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Petições & Peças</span>
              </button>

              <button
                onClick={() => setHelpActiveTab("datajud")}
                className={`py-3.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  helpActiveTab === "datajud" 
                    ? "border-blue-600 text-blue-600 font-bold" 
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Conexão DataJud</span>
              </button>

              <button
                onClick={() => setHelpActiveTab("atajur")}
                className={`py-3.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  helpActiveTab === "atajur" 
                    ? "border-blue-600 text-blue-600 font-bold" 
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Atas & Áudios</span>
              </button>

              <button
                onClick={() => setHelpActiveTab("timbrado")}
                className={`py-3.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  helpActiveTab === "timbrado" 
                    ? "border-blue-600 text-blue-600 font-bold" 
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Modelo Timbrado</span>
              </button>

              <button
                onClick={() => setHelpActiveTab("seguranca")}
                className={`py-3.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  helpActiveTab === "seguranca" 
                    ? "border-blue-600 text-blue-600 font-bold" 
                    : "border-transparent hover:text-slate-900"
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Planos & Cotas</span>
              </button>
            </div>

            {/* Conteúdo Dinâmico da Aba Selecionada */}
            <div className="p-6 sm:p-8 space-y-6 text-slate-700 overflow-y-auto flex-1 text-xs sm:text-sm leading-relaxed">
              
              {/* 1. ABA: PETIÇÕES & PEÇAS */}
              {helpActiveTab === "peticoes" && (
                <div className="space-y-4">
                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4">
                    <h4 className="font-bold text-blue-950 text-sm mb-1 flex items-center gap-2">
                      <span>⚖️</span> Elaboração de Peças com Inteligência Forense
                    </h4>
                    <p className="text-xs text-blue-900 leading-relaxed">
                      O motor jurídico do AvJuris é treinado no Direito brasileiro e analisa a legislação (CPC, Código Civil, CDC, etc.) com teses estruturadas prontas para protocolo.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                      <h5 className="font-bold text-slate-900 mb-1">Como fornecer boas instruções:</h5>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                        <li>Indique a <strong>qualificação básica</strong> e os fatos em ordem cronológica.</li>
                        <li>Descreva os pedidos claros: condenação, restituição em dobro ou reparação moral.</li>
                        <li>Se houver urgência, solicite expressamente a <strong>Tutela de Urgência (Art. 300 CPC)</strong>.</li>
                      </ul>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                      <h5 className="font-bold text-slate-900 mb-1">Anexo de Autos em PDF:</h5>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                        <li>Você pode anexar até <strong>10 arquivos por vez</strong> (contratos, extratos, notificações).</li>
                        <li>A IA extrai automaticamente cláusulas contratuais e valores para citar no mérito.</li>
                        <li>Limite de até 150MB por arquivo e até 1.500 páginas conforme seu plano.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. ABA: CONEXÃO DATAJUD */}
              {helpActiveTab === "datajud" && (
                <div className="space-y-4">
                  <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4">
                    <h4 className="font-bold text-purple-950 text-sm mb-1 flex items-center gap-2">
                      <span>🏛️</span> Integração em Tempo Real com o CNJ / DataJud
                    </h4>
                    <p className="text-xs text-purple-900 leading-relaxed">
                      O AvJuris conecta-se à API Pública do Conselho Nacional de Justiça para buscar dados processuais oficiais sem necessidade de preenchimento manual.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="border border-slate-200 rounded-xl p-4">
                      <h5 className="font-bold text-slate-900 text-xs mb-1">Formato do Número CNJ:</h5>
                      <p className="text-xs text-slate-600 mb-2">
                        Digite ou cole o número único do processo com 20 dígitos no campo de instruções (ex: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-blue-600">0001234-56.2026.8.12.0001</code>).
                      </p>
                      <p className="text-xs text-slate-600">
                        O sistema identifica a comarca, classe processual, vara competente e assuntos cadastrados, aplicando o endereçamento correto na petição.
                      </p>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-4">
                      <h5 className="font-bold text-slate-900 text-xs mb-1">Tribunais Habilitados:</h5>
                      <p className="text-xs text-slate-600">
                        TJMS, TJSP, TJMT, TJDFT, TRF3 e TRF1 (com expansão contínua para outros tribunais estaduais e federais).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. ABA: ATAS & ÁUDIOS */}
              {helpActiveTab === "atajur" && (
                <div className="space-y-4">
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
                    <h4 className="font-bold text-emerald-950 text-sm mb-1 flex items-center gap-2">
                      <span>🎙️</span> Atas Executivas de Reuniões & Síntese de Áudio
                    </h4>
                    <p className="text-xs text-emerald-900 leading-relaxed">
                      Transforme conversas com clientes, audiências ou reuniões internas em atas formais com divisão executiva de tarefas e prazos fatais.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-xl p-4">
                      <h5 className="font-bold text-slate-900 text-xs mb-1">1. Gravação Direta pelo Navegador:</h5>
                      <p className="text-xs text-slate-600">
                        Clique no botão <strong>Gravar Áudio</strong>, autorize o microfone e inicie a reunião. Ao finalizar, clique em <strong>Parar</strong> e a gravação ficará pronta para envio imediato.
                      </p>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-4">
                      <h5 className="font-bold text-slate-900 text-xs mb-1">2. Upload de Arquivos de Áudio:</h5>
                      <p className="text-xs text-slate-600">
                        Aceita gravações externas em formatos <strong>.mp3, .m4a, .wav e .webm</strong> de até 150MB através do botão de anexo.
                      </p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <h5 className="font-bold text-slate-900 text-xs mb-1">Estrutura Entregue pela Ata:</h5>
                    <p className="text-xs text-slate-600">
                      Cabeçalho com presentes, resumo circunstanciado das deliberações, tabela de tarefas (*Action Items* com responsáveis nominais) e campo formal de assinaturas.
                    </p>
                  </div>
                </div>
              )}

              {/* 4. ABA: MODELO TIMBRADO */}
              {helpActiveTab === "timbrado" && (
                <div className="space-y-4">
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                    <h4 className="font-bold text-amber-950 text-sm mb-1 flex items-center gap-2">
                      <span>📄</span> Exportação com Identidade Visual do seu Escritório
                    </h4>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Mantenha o cabeçalho, logotipo, rodapé e formatação gráfica oficiais da sua banca em todas as minutas baixadas.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="border border-slate-200 rounded-xl p-4">
                      <h5 className="font-bold text-slate-900 text-xs mb-1">Como usar seu modelo timbrado:</h5>
                      <ol className="list-decimal pl-4 space-y-1.5 text-xs text-slate-600">
                        <li>Clique na opção <strong>Usar Modelo Timbrado (.docx)</strong> na barra inferior da caixa de texto.</li>
                        <li>Selecione um arquivo <strong>.docx</strong> que já possua seu cabeçalho, logo e rodapé pré-formatados.</li>
                        <li>Ao clicar em <strong>Exportar .DOCX</strong>, o backend preservará toda a estrutura visual do seu arquivo e inserirá a minuta formatada no corpo do documento.</li>
                      </ol>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                      <h5 className="font-bold text-slate-900 text-xs mb-1">Exportação Padrão (Sem Timbrado):</h5>
                      <p className="text-xs text-slate-600">
                        Caso não envie um arquivo timbrado, o sistema exporta o documento no <strong>Padrão Forense ABNT</strong> (margem superior/esquerda de 3cm, inferior/direita de 2cm, espaçamento 1.5 e fonte Times New Roman).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. ABA: PLANOS & COTAS */}
              {helpActiveTab === "seguranca" && (
                <div className="space-y-4">
                  <div className="bg-slate-100 border border-slate-200 rounded-xl p-4">
                    <h4 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-2">
                      <span>💳</span> Gestão de Assinatura, Cotas e Privacidade
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Acompanhe o consumo mensal do seu plano e mantenha seus dados em conformidade com a LGPD.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded-xl p-4">
                      <h5 className="font-bold text-slate-900 text-xs mb-1">Renovação de Cota:</h5>
                      <p className="text-xs text-slate-600">
                        O limite de documentos é renovado automaticamente a cada 30 dias no primeiro dia de cada mês civil. O consumo em tempo real pode ser visualizado na barra inferior esquerda da barra lateral.
                      </p>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-4">
                      <h5 className="font-bold text-slate-900 text-xs mb-1">Sigilo & LGPD:</h5>
                      <p className="text-xs text-slate-600">
                        Seus documentos e clientes são isolados por chave de segurança (RLS). Nenhuma informação processual confidencial é compartilhada com terceiros ou utilizada para treinamento público.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Dúvidas técnicas adicionais? Contate o suporte do seu plano.
              </span>
              <button 
                onClick={() => setShowHelpModal(false)} 
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow cursor-pointer ml-auto"
              >
                Entendi, fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
