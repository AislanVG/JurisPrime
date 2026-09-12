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
  FileCheck2, 
  Search, 
  BookMarked, 
  Cpu, 
  Command, 
  Gavel, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Lock, 
  Calendar, 
  CheckCircle, 
  ShoppingBag 
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const API_BASE_URL = "https://jurisprime.onrender.com";

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
  inicio_ciclo?: string;
  fim_ciclo?: string;
}

interface TemplateAtalho {
  comando: string;
  titulo: string;
  descricao: string;
  prompt: string;
}

const TEMPLATES_ATALHOS: TemplateAtalho[] = [
  {
    comando: "/inicial",
    titulo: "Petição Inicial Cível",
    descricao: "Estrutura completa com qualificação, fatos, fundamentos e rol de pedidos.",
    prompt: "Elabore uma Petição Inicial Cível de 1º Grau completa com tutela de urgência inaudita altera parte, qualificação, dos fatos, fundamentos com base no Código Civil e CPC, e rol minucioso de pedidos."
  },
  {
    comando: "/agravo",
    titulo: "Agravo de Instrumento",
    descricao: "Recurso com folha de rosto, cabimento (art. 1.015 CPC) e efeito suspensivo.",
    prompt: "Elabore Agravo de Instrumento com razões recursais, preparo, demonstração de cabimento no art. 1.015 do CPC / Tema 988 STJ, impugnação dialética e pedido de efeito suspensivo ativo."
  },
  {
    comando: "/contestacao",
    titulo: "Contestação c/ Preliminares",
    descricao: "Defesa com impugnações preliminares (art. 337 CPC) e mérito exaustivo.",
    prompt: "Elabore Contestação cível estruturada com preliminares de mérito (inépcia, ilegitimidade, falta de interesse de agir), impugnação específica aos fatos e teses de improcedência total."
  },
  {
    comando: "/embargos",
    titulo: "Embargos de Declaração",
    descricao: "Peça voltada a suprir omissão, obscuridade, contradição ou erro material.",
    prompt: "Elabore Embargos de Declaração com fundamento no art. 1.022 do CPC, apontando expressamente o ponto omisso e contraditório da decisão agravada/embargada com efeitos infringentes."
  },
  {
    comando: "/ata",
    titulo: "Ata Executiva Estruturada",
    descricao: "Síntese de reunião com matriz de responsabilidades e prazos fatais.",
    prompt: "Gere uma Ata Executiva Formal estruturada contendo participantes, cabeçalho, deliberações em tópicos, tabela de action items (tarefas, prazos fatais, responsáveis) e campo de assinaturas."
  }
];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showJurisModal, setShowJurisModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showPopoverConsumo, setShowPopoverConsumo] = useState(false);
  const [helpActiveTab, setHelpActiveTab] = useState<"peticoes" | "datajud" | "atajur" | "timbrado" | "seguranca">("peticoes");
  const [frequenciaPricing, setFrequenciaPricing] = useState<"mensal" | "anual">("mensal");

  const [moduloSelecionado, setModuloSelecionado] = useState<"peticao" | "ata">("peticao");
  const [modoExibicao, setModoExibicao] = useState<"formatado" | "editor">("formatado");
  const [painelEsquerdoAberto, setPainelEsquerdoAberto] = useState(true);

  const [paywallToast, setPaywallToast] = useState<string | null>(null);

  const [instrucao, setInstrucao] = useState("");
  const [tribunal, setTribunal] = useState("tjms");
  const [tipoReuniao, setTipoReuniao] = useState<"Cliente" | "Interna">("Cliente");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [arquivoTimbrado, setArquivoTimbrado] = useState<File | null>(null);

  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashSearch, setSlashSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [gerando, setGerando] = useState(false);
  const [gerandoTempo, setGerandoTempo] = useState(0);
  const [resultadoTexto, setResultadoTexto] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [emailDestino, setEmailDestino] = useState("");
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [statusEmail, setStatusEmail] = useState<string | null>(null);

  const [historicoCasos, setHistoricoCasos] = useState<DocumentoHistorico[]>([]);
  const [statusPlano, setStatusPlano] = useState<StatusPlano>({ 
    plano: "Gratuito", 
    usados: 0, 
    maximo: 5,
    inicio_ciclo: "8 de setembro de 2026",
    fim_ciclo: "7 de outubro de 2026"
  });

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (gerando) {
      setGerandoTempo(0);
      interval = setInterval(() => {
        setGerandoTempo((prev) => prev + 1);
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gerando]);

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
          plano: dataStatus.plano || "Gratuito",
          usados: dataStatus.usados || 0,
          maximo: dataStatus.maximo || 5,
          inicio_ciclo: dataStatus.inicio_ciclo || "8 de setembro de 2026",
          fim_ciclo: dataStatus.fim_ciclo || "7 de outubro de 2026"
        });
      }
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInstrucao(val);

    const match = val.match(/\/([a-zA-Z0-9]*)$/);
    if (match) {
      setShowSlashMenu(true);
      setSlashSearch(match[1].toLowerCase());
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSelectTemplate = (template: TemplateAtalho) => {
    const novoTexto = instrucao.replace(/\/([a-zA-Z0-9]*)$/, template.prompt);
    setInstrucao(novoTexto);
    setShowSlashMenu(false);
    if (template.comando === "/ata") {
      setModuloSelecionado("ata");
    } else {
      setModuloSelecionado("peticao");
    }
    textareaRef.current?.focus();
  };

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
          // Força o retorno estrito para o seu domínio principal
          redirectTo: "https://app.avjuris.com.br",
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
    setShowSlashMenu(false);
  };

  const handleAbrirDocumentoSalvo = (doc: DocumentoHistorico) => {
    setModuloSelecionado(doc.tipo === "Ata de Reunião" ? "ata" : "peticao");
    setInstrucao(doc.instrucao_original || doc.titulo);
    setResultadoTexto(doc.conteudo_markdown);
  };

  const handleCopiarTexto = () => {
    if (!resultadoTexto) return;
    if (statusPlano.plano.toLowerCase() === "gratuito" || statusPlano.plano.toLowerCase() === "básico" || statusPlano.plano.toLowerCase() === "basico") {
      setPaywallToast("Recurso exclusivo do plano pago. Faça upgrade para usar.");
      setTimeout(() => setPaywallToast(null), 4000);
      return;
    }
    navigator.clipboard.writeText(resultadoTexto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleSelecionarPlanoAsaas = (plano: any) => {
    if (user?.email) {
      fetch(`${API_BASE_URL}/api/usuario/recuperacao-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinatario: user.email,
          nome: getUserName(),
          plano_nome: `${plano.nome} (${frequenciaPricing})`
        })
      }).catch((e) => console.log("Log checkout:", e));
    }

    const linkDestino = frequenciaPricing === "anual" ? plano.linkAnual : plano.linkMensal;
    window.open(linkDestino, "_blank");
    setShowPricingModal(false);
  };

  const handleExecutarIA = async () => {
    setShowSlashMenu(false);
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

    const tituloDocumento = moduloSelecionado === "ata" 
      ? (instrucao.split("\n")[0] || "Ata Executiva de Reunião") 
      : (instrucao.split("\n")[0] || "Petição Inicial");

    try {
      const response = await fetch(`${API_BASE_URL}/api/ata/enviar-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinatario: emailDestino,
          titulo: tituloDocumento,
          conteudo_markdown: resultadoTexto,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Falha no servidor ao processar envio.");
      }

      const data = await response.json();
      setStatusEmail(data.mensagem || "E-mail enviado com sucesso com anexo .docx!");
    } catch (error: any) {
      setStatusEmail(error.message || "Falha ao enviar e-mail. Verifique o servidor SMTP.");
    } finally {
      setEnviandoEmail(false);
    }
  };

  const atalhosFiltrados = TEMPLATES_ATALHOS.filter(
    t => t.comando.includes(slashSearch) || t.titulo.toLowerCase().includes(slashSearch)
  );

  const renderizarTextoForense = (texto: string) => {
    const linhas = texto.split("\n");
    return linhas.map((linha, idx) => {
      const trimmed = linha.trim();
      if (!trimmed) {
        return <div key={idx} className="h-4"></div>;
      }

      const formatarNegrito = (str: string) => {
        const partes = str.split(/(\*\*.*?\*\*)/g);
        return partes.map((p, i) => {
          if (p.startsWith("**") && p.endsWith("**")) {
            return <strong key={i} className="font-bold text-slate-950">{p.slice(2, -2)}</strong>;
          }
          return p;
        });
      };

      if (trimmed.startsWith("> ") || trimmed.startsWith("EMENTA:") || trimmed.startsWith('"[')) {
        const textoEmenta = trimmed.replace(/^>\s*/, "");
        return (
          <div 
            key={idx} 
            className="ml-12 sm:ml-16 mr-4 my-4 pl-4 py-1 text-[13px] italic font-serif text-slate-800 border-l-2 border-slate-300 leading-relaxed text-justify bg-slate-50/40 rounded-r-lg"
          >
            {formatarNegrito(textoEmenta)}
          </div>
        );
      }

      if (
        trimmed.startsWith("# ") ||
        /^(EXCELENTÍSSIMO|AO DOUTO|AO EGRÉGIO|AGRAVO DE INSTRUMENTO|AÇÃO DECLARATÓRIA|AÇÃO DE COBRANÇA|PETIÇÃO INICIAL|CONTESTAÇÃO)/i.test(trimmed)
      ) {
        return (
          <div key={idx} className="text-center font-bold font-serif text-[14.5px] uppercase text-slate-950 my-4 tracking-wide leading-relaxed">
            {formatarNegrito(trimmed.replace(/^#+\s*/, ""))}
          </div>
        );
      }

      if (trimmed.startsWith("## ") || trimmed.startsWith("### ") || /^\d+(\.\d+)*\.\s+[A-ZÁ-Ú]/.test(trimmed)) {
        return (
          <h3 key={idx} className="font-bold font-serif text-[14px] uppercase text-slate-900 mt-6 mb-2.5 text-left tracking-tight">
            {formatarNegrito(trimmed.replace(/^#+\s*/, ""))}
          </h3>
        );
      }

      return (
        <p key={idx} className="font-serif text-[14.5px] text-slate-900 leading-[1.85] text-justify indent-8 my-2">
          {formatarNegrito(trimmed)}
        </p>
      );
    });
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B132B]">
        <Loader2 className="w-8 h-8 text-[#38BDF8] animate-spin" />
      </div>
    );
  }

  // TELA DE LOGIN (SE NÃO ESTIVER LOGADO)
  if (!user) {
    return (
      <div className="min-h-screen bg-[#070D1E] relative flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md bg-[#0D152A]/90 backdrop-blur-xl p-8 sm:p-9 rounded-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] text-center relative z-10">
          <div className="flex items-center justify-center gap-2.5 mb-5">
            <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-[#38BDF8]">
              <Scale className="w-6 h-6" />
            </div>
            <span className="text-2xl font-black text-white tracking-tight">
              AVJURIS<span className="text-[#38BDF8]">.AI</span>
            </span>
          </div>

          <h1 className="text-white font-extrabold text-2xl tracking-tight mb-1.5">
            Acesso à Workstation
          </h1>
          <p className="text-slate-400 text-xs mb-7 leading-relaxed">
            Entre com sua conta para acessar o painel de minutas.
          </p>

          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-white/15 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-white transition-all shadow-sm mb-5 cursor-pointer hover:border-white/25"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Continuar com o Google</span>
          </button>

          <div className="flex items-center w-full my-5 text-slate-500 text-[11px]">
            <div className="flex-1 border-b border-white/10"></div>
            <span className="px-3 uppercase font-semibold tracking-wider text-[10px] text-slate-400">ou e-mail profissional</span>
            <div className="flex-1 border-b border-white/10"></div>
          </div>

          <form onSubmit={handleEmailAuth} className="w-full space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">E-mail</label>
              <input
                type="email"
                required
                placeholder="advogado@escritorio.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#38BDF8] focus:bg-white/[0.06] transition placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#38BDF8] focus:bg-white/[0.06] pr-10 transition placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400 text-center font-medium">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white rounded-xl font-bold text-xs transition flex items-center justify-center space-x-2 mt-2 cursor-pointer shadow-lg shadow-blue-600/30 active:scale-[0.99]"
            >
              {authLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>{authMode === "login" ? "Entrar na Workstation ➔" : "Criar Minha Conta ➔"}</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // WORKSTATION COMPLETA (EXIBIDA QUANDO LOGADO NA RAIZ)
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-800">
      {/* Todo o layout da sua workstation que estava no app/app/page.tsx pode residir aqui de forma unificada, garantindo 100% de funcionamento sem erros 404 */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Bem-vindo à Workstation, {getUserName()}!</h2>
          <p className="text-slate-600 text-sm">Seu ambiente de trabalho está ativo em `app.avjuris.com.br`.</p>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}
