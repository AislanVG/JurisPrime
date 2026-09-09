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
  ChevronLeft, 
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
  CreditCard, 
  CheckCircle, 
  ShoppingBag, 
  ShieldCheck, 
  QrCode, 
  Barcode, 
  ArrowLeft 
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

interface DetalhesPlanoPricing {
  id: string;
  nome: string;
  tipoUso: string;
  badgeTopo?: string;
  precoMensal: string;
  precoAnual: string;
  precoAnualTotal: string;
  minutas: number;
  casos: number;
  processos: number;
  paginasUpload: number;
  linkAsaas: string;
  destaque?: boolean;
}

const LISTA_PLANOS: DetalhesPlanoPricing[] = [
  {
    id: "basico",
    nome: "Básico",
    tipoUso: "Uso Individual",
    precoMensal: "R$ 59,90",
    precoAnual: "R$ 47,92",
    precoAnualTotal: "R$ 575,04 / ano",
    minutas: 15,
    casos: 30,
    processos: 50,
    paginasUpload: 500,
    linkAsaas: "https://www.asaas.com/c/jak9kzx44se9t69b",
    destaque: false
  },
  {
    id: "crescimento",
    nome: "Crescimento",
    tipoUso: "Uso Individual",
    badgeTopo: "MAIS POPULAR",
    precoMensal: "R$ 119,90",
    precoAnual: "R$ 95,92",
    precoAnualTotal: "R$ 1.151,04 / ano",
    minutas: 40,
    casos: 150,
    processos: 100,
    paginasUpload: 1200,
    linkAsaas: "https://www.asaas.com/c/jak9kzx44se9t69b",
    destaque: true
  },
  {
    id: "escala",
    nome: "Escala",
    tipoUso: "Multiusuários",
    badgeTopo: "TREINAMENTO ONLINE",
    precoMensal: "R$ 229,90",
    precoAnual: "R$ 183,92",
    precoAnualTotal: "R$ 2.207,04 / ano",
    minutas: 150,
    casos: 300,
    processos: 200,
    paginasUpload: 1500,
    linkAsaas: "https://www.asaas.com/c/jak9kzx44se9t69b",
    destaque: false
  }
];

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

  // Modais e Fluxo de Pagamento
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showJurisModal, setShowJurisModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showPopoverConsumo, setShowPopoverConsumo] = useState(false);
  const [helpActiveTab, setHelpActiveTab] = useState<"peticoes" | "datajud" | "atajur" | "timbrado" | "seguranca">("peticoes");
  const [frequenciaPricing, setFrequenciaPricing] = useState<"mensal" | "anual">("mensal");

  const [moduloSelecionado, setModuloSelecionado] = useState<"peticao" | "ata">("peticao");
  const [modoExibicao, setModoExibicao] = useState<"formatado" | "editor">("formatado");
  const [painelEsquerdoAberto, setPainelEsquerdoAberto] = useState(true);

  // Paywall Toast
  const [paywallToast, setPaywallToast] = useState<string | null>(null);

  const [instrucao, setInstrucao] = useState("");
  const [tribunal, setTribunal] = useState("tjms");
  const [tipoReuniao, setTipoReuniao] = useState<"Cliente" | "Interna">("Cliente");
  const [participantes, setParticipantes] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [arquivoTimbrado, setArquivoTimbrado] = useState<File | null>(null);

  // Menu de Atalhos (/)
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashSearch, setSlashSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Áudio
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Geração e Feedback
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

  // Direcionamento direto para o Asaas + Disparo de Carrinho Abandonado em segundo plano
  const handleSelecionarPlanoAsaas = (plano: DetalhesPlanoPricing) => {
    if (user?.email) {
      fetch(`${API_BASE_URL}/api/usuario/recuperacao-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinatario: user.email,
          nome: getUserName(),
          plano_nome: plano.nome
        })
      }).catch((e) => console.log("Log checkout:", e));
    }

    window.open(plano.linkAsaas, "_blank");
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

  // Parser Forense com Recuo ABNT para Ementas
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

      // 1. Ementa e Citações Jurisprudenciais Recuadas (Recuo de 4cm / pl-16 e Itálico)
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

      // 2. Endereçamento e Títulos em Destaque Centralizados
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

      // 3. Tópicos Numerados e Subseções
      if (trimmed.startsWith("## ") || trimmed.startsWith("### ") || /^\d+(\.\d+)*\.\s+[A-ZÁ-Ú]/.test(trimmed)) {
        return (
          <h3 key={idx} className="font-bold font-serif text-[14px] uppercase text-slate-900 mt-6 mb-2.5 text-left tracking-tight">
            {formatarNegrito(trimmed.replace(/^#+\s*/, ""))}
          </h3>
        );
      }

      // 4. Parágrafo Forense Padrão (Recuo de Primeira Linha + Justificado A4)
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

  if (!user) {
    return (
      <div className="min-h-screen bg-[#070D1E] relative flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center relative z-10 py-10">
          <div className="lg:col-span-5 w-full max-w-[430px] mx-auto bg-[#0D152A]/90 backdrop-blur-xl p-8 sm:p-9 rounded-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.4)] text-center">
            <div className="flex items-center justify-center gap-2.5 mb-5">
              <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-xl text-[#38BDF8]">
                <Scale className="w-6 h-6" />
              </div>
              <span className="text-2xl font-black text-white tracking-tight">
                AVJURIS<span className="text-[#38BDF8]">.AI</span>
              </span>
            </div>

            <h1 className="text-white font-extrabold text-2xl tracking-tight mb-1.5">
              Acesso à Plataforma
            </h1>
            <p className="text-slate-400 text-xs mb-7 leading-relaxed">
              Estação de trabalho forense para bancas e advogados.
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

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "register" : "login");
                    setAuthError(null);
                  }}
                  className="text-[11px] text-slate-400 hover:text-[#38BDF8] transition cursor-pointer font-medium"
                >
                  {authMode === "login" ? "Primeiro acesso? Cadastre-se gratuitamente" : "Já possui conta? Fazer login"}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-7 flex flex-col justify-center space-y-7 text-left lg:pl-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/10 border border-blue-500/20 text-[#38BDF8] text-xs font-bold rounded-full shadow-inner">
                <Sparkles className="w-3.5 h-3.5" />
                <span>IA Forense & Automação Processual</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-black text-white leading-[1.15] tracking-tight">
                A infraestrutura definitiva para <span className="bg-gradient-to-r from-blue-400 to-[#38BDF8] bg-clip-text text-transparent">advogados de alta performance</span>
              </h2>

              <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-xl">
                Elabore peças processuais completas, consulte o CNJ/DataJud e transcreva atas de reuniões executivas mantendo o papel timbrado da sua banca.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-1.5 hover:border-blue-500/30 transition">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <FileText className="w-4 h-4 text-[#38BDF8]" />
                  <span>Petições de 1º Grau</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Fatos, fundamentos dogmáticos e pedidos liminares prontos para protocolo.
                </p>
              </div>

              <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-1.5 hover:border-blue-500/30 transition">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Building className="w-4 h-4 text-emerald-400" />
                  <span>Conexão CNJ / DataJud</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Identificação automática de comarca, vara e classe pelo número do processo.
                </p>
              </div>

              <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-1.5 hover:border-blue-500/30 transition">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Mic className="w-4 h-4 text-purple-400" />
                  <span>Módulo AtaJur</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Gravação de reuniões em atas executivas com matriz de prazos e responsáveis.
                </p>
              </div>

              <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl space-y-1.5 hover:border-blue-500/30 transition">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <FileCheck2 className="w-4 h-4 text-amber-400" />
                  <span>Template Timbrado (.docx)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Exportação com a identidade visual, cabeçalho e rodapé do seu escritório.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2 text-[11px] text-slate-500 border-t border-white/5">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> Conforme à LGPD
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> Criptografia AES-256
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" /> Sem retenção pública
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-800">
      
      {/* PAYWALL TOAST FLUTUANTE */}
      {paywallToast && (
        <div className="fixed top-6 right-6 z-50 bg-[#EF4444] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
          <div className="p-1 bg-white/20 rounded-lg">
            <Lock className="w-4 h-4 text-white" />
          </div>
          <div className="text-xs font-semibold">
            {paywallToast}
          </div>
          <button
            onClick={() => setShowPricingModal(true)}
            className="ml-2 text-[11px] bg-white text-red-600 px-2.5 py-1 rounded-lg font-bold hover:bg-slate-100 transition shadow-sm cursor-pointer"
          >
            Assinar ➔
          </button>
        </div>
      )}

      {/* SIDEBAR LATERAL (DARK) */}
      <aside className="w-64 bg-[#0B132B] border-r border-slate-800 flex flex-col justify-between shrink-0 hidden md:flex">
        <div className="p-4 space-y-6">
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

          <button
            onClick={handleNovoAtendimento}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Minuta / Conversa</span>
          </button>

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

        {/* Card de Consumo Interativo com Popover */}
        <div className="p-4 border-t border-slate-800 space-y-4 relative">
          
          {showPopoverConsumo && (
            <div className="absolute bottom-[calc(100%+8px)] left-4 right-4 bg-white rounded-2xl p-4 shadow-2xl border border-slate-200 z-50 text-slate-900 animate-in fade-in slide-in-from-bottom-2 duration-150 text-left">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 mb-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>{statusPlano.usados} utilizada(s) de {statusPlano.maximo} minutas disponíveis</span>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-3">
                <div 
                  className="bg-blue-600 h-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (statusPlano.usados / statusPlano.maximo) * 100)}%` }}
                ></div>
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1 mb-3 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ciclo mensal</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {statusPlano.inicio_ciclo} até {statusPlano.fim_ciclo}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowPopoverConsumo(false);
                  setShowPricingModal(true);
                }}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Ver Planos</span>
              </button>
            </div>
          )}

          <div 
            onClick={() => setShowPopoverConsumo(!showPopoverConsumo)}
            className="bg-[#0F172A] p-3 rounded-xl border border-white/5 space-y-2 cursor-pointer hover:border-white/15 transition"
          >
            <div className="flex justify-between text-[11px] text-slate-300 font-semibold">
              <span>{statusPlano.plano}</span>
              <span className="text-[#38BDF8]">{statusPlano.usados} / {statusPlano.maximo} docs</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, (statusPlano.usados / statusPlano.maximo) * 100)}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Ciclo em andamento</span>
              <span className="text-blue-400 font-semibold hover:underline">Ver detalhes</span>
            </div>
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
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
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
          </div>

          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowHelpModal(true)} 
              className="px-3 py-1.5 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-1.5 transition cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              <span>Manual</span>
            </button>

            <button
              onClick={() => setShowPricingModal(true)}
              className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Assinar Plano</span>
            </button>
          </div>
        </header>

        {/* CORPO DO STUDIO */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col">
          {!resultadoTexto && !gerando ? (
            <div className="max-w-3xl w-full mx-auto my-auto flex flex-col items-center text-center space-y-6">
              
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

              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {getGreeting()}, <span className="uppercase text-blue-600">{getUserName()}</span>.
                </h2>
                <p className="text-base sm:text-lg text-slate-500 font-serif italic mt-1">
                  {moduloSelecionado === "peticao" ? "Qual peça processual vamos redigir hoje?" : "Qual reunião vamos registrar e sintetizar?"}
                </p>
              </div>

              {/* Chips Preditivos */}
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

              {/* Caixa de Entrada com Menu de Atalhos (/) */}
              <div className="w-full relative bg-white border-2 border-slate-200 hover:border-blue-400 focus-within:border-blue-600 rounded-2xl p-4 shadow-lg transition duration-200 text-left">
                {showSlashMenu && (
                  <div className="absolute left-4 bottom-[calc(100%+8px)] w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                      <Command className="w-3.5 h-3.5 text-blue-600" />
                      <span>Modelos e Templates Forenses</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
                      {atalhosFiltrados.length === 0 ? (
                        <p className="text-xs text-slate-400 p-2">Nenhum atalho encontrado</p>
                      ) : (
                        atalhosFiltrados.map((item) => (
                          <button
                            key={item.comando}
                            type="button"
                            onClick={() => handleSelectTemplate(item)}
                            className="w-full text-left p-2 rounded-lg hover:bg-blue-50 transition cursor-pointer group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900 group-hover:text-blue-700">{item.titulo}</span>
                              <span className="font-mono text-[10px] text-blue-600 bg-blue-100/60 px-1.5 py-0.5 rounded">{item.comando}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{item.descricao}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

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

                <textarea
                  ref={textareaRef}
                  rows={4}
                  value={instrucao}
                  onChange={handleInputChange}
                  placeholder={
                    moduloSelecionado === "ata"
                      ? "Informe a pauta ou digite '/' para templates rápidos..."
                      : "Descreva a pretensão, fatos ou digite '/' para templates processuais..."
                  }
                  className="w-full text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none bg-transparent"
                />

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
            <div className={`grid grid-cols-1 ${painelEsquerdoAberto ? "lg:grid-cols-12" : "lg:grid-cols-1"} gap-6 h-full items-stretch transition-all duration-300`}>
              
              {/* PAINEL ESQUERDO: INSTRUÇÕES (COLAPSÁVEL) */}
              {painelEsquerdoAberto && (
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
              )}

              {/* PAINEL DIREITO: FOLHA FORENSE A4 */}
              <div className={`${painelEsquerdoAberto ? "lg:col-span-8" : "lg:col-span-12"} bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-y-auto relative transition-all duration-300`}>
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPainelEsquerdoAberto(!painelEsquerdoAberto)}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                        title={painelEsquerdoAberto ? "Recolher painel de fatos" : "Expandir painel de fatos"}
                      >
                        {painelEsquerdoAberto ? (
                          <>
                            <PanelLeftClose className="w-3.5 h-3.5 text-slate-600" />
                            <span className="hidden sm:inline">Modo Foco</span>
                          </>
                        ) : (
                          <>
                            <PanelLeftOpen className="w-3.5 h-3.5 text-blue-600" />
                            <span className="hidden sm:inline">Ver Fatos</span>
                          </>
                        )}
                      </button>

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
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 mr-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setModoExibicao("formatado")}
                          className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                            modoExibicao === "formatado" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                          }`}
                        >
                          Visualização Forense
                        </button>
                        <button
                          type="button"
                          onClick={() => setModoExibicao("editor")}
                          className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                            modoExibicao === "editor" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
                          }`}
                        >
                          Editar Markdown
                        </button>
                      </div>

                      {resultadoTexto && (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>

                  {/* PAINEL DE REASONING / THINKING */}
                  {gerando && (
                    <div className="mb-4 bg-slate-50 border border-slate-200/90 rounded-2xl p-4.5 space-y-3.5 shadow-sm animate-in fade-in duration-300">
                      <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-600">
                            <Cpu className="w-4 h-4 animate-pulse" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              Pensando ({gerandoTempo}s)
                              <span className="inline-flex space-x-1">
                                <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></span>
                              </span>
                            </span>
                            <p className="text-[10px] text-slate-500">
                              O AvJuris.AI analisa dogmática, teses jurisprudenciais e legislação aplicável.
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                          {moduloSelecionado === "peticao" ? "IA Forense Ativa" : "AtaJur Engine"}
                        </span>
                      </div>

                      <div className="bg-white border border-slate-200/80 rounded-xl p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between text-slate-600 font-semibold text-[11px]">
                          <span className="flex items-center gap-1.5">
                            <Search className="w-3.5 h-3.5 text-blue-600" />
                            Pesquisa e Cruzamento Normativo
                          </span>
                          <span className="text-emerald-600 font-bold flex items-center gap-1 text-[10px]">
                            <Check className="w-3 h-3" /> Em execução
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed">
                          {moduloSelecionado === "peticao"
                            ? "CPC/2015 (Art. 300, 319, 320, 995, 1.015) • Código Civil (Art. 186, 927) • CDC (Art. 6º, VIII, 14) • Tema 988/STJ e Súmulas"
                            : "Síntese deliberativa • Mapeamento de Action Items com responsáveis nominais • Prazos fatais"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 mr-1">
                          <BookMarked className="w-3 h-3 text-slate-400" />
                          Habilidades:
                        </div>
                        <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold rounded-lg shadow-2xs flex items-center gap-1">
                          <span className="text-emerald-500">✓</span> Rigor Dogmático Forense
                        </span>
                        <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold rounded-lg shadow-2xs flex items-center gap-1">
                          <span className="text-emerald-500">✓</span> Conexão Oficial DataJud / CNJ
                        </span>
                        <span className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold rounded-lg shadow-2xs flex items-center gap-1">
                          <span className="text-emerald-500">✓</span> Formatação ABNT & Modelo Timbrado
                        </span>
                      </div>
                    </div>
                  )}

                  {/* VISUALIZADOR DA FOLHA FORENSE A4 */}
                  <div className="relative min-h-[500px]">
                    {modoExibicao === "formatado" ? (
                      <div className="w-full bg-[#FCFCFD] p-8 sm:p-14 border border-slate-200/90 rounded-2xl shadow-inner space-y-4 max-h-[660px] overflow-y-auto">
                        {!resultadoTexto ? (
                          <p className="text-slate-400 text-xs italic font-serif">O documento gerado com formatação e ementas recuadas surgirá aqui...</p>
                        ) : (
                          renderizarTextoForense(resultadoTexto)
                        )}
                      </div>
                    ) : (
                      <textarea
                        rows={18}
                        value={resultadoTexto}
                        onChange={(e) => setResultadoTexto(e.target.value)}
                        placeholder="O conteúdo gerado pela IA surgirá aqui para revisão e edição em tempo real..."
                        className="w-full p-6 bg-[#FAFAFA] border border-slate-200 rounded-xl font-serif text-[15px] leading-relaxed text-slate-900 focus:outline-none focus:border-blue-400 focus:bg-white transition resize-none shadow-inner"
                      />
                    )}

                    {/* BOTÃO FLUTUANTE DE JURISPRUDÊNCIA RECOMENDADA */}
                    {resultadoTexto && (
                      <div className="absolute right-4 bottom-6 flex flex-col items-end z-20">
                        <button
                          type="button"
                          onClick={() => setShowJurisModal(true)}
                          className="flex items-center gap-2.5 bg-white/95 hover:bg-white text-slate-800 border border-slate-200/90 px-3.5 py-2.5 rounded-xl shadow-xl hover:shadow-2xl transition-all cursor-pointer text-xs font-semibold group backdrop-blur-md"
                        >
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                            <Gavel className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <p className="text-[11.5px] font-bold text-slate-900 leading-tight">Ver jurisprudências citadas</p>
                            <p className="text-[10px] text-slate-500 leading-tight">Ementas e acórdãos vinculantes aplicados</p>
                          </div>
                        </button>
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

      {/* MODAL DE ASSINATURA: TABELA DE PREÇOS (DIRECIONAMENTO DIRETO AO ASAAS) */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-8 pt-8 pb-4 text-center relative border-b border-slate-100">
              <button 
                onClick={() => setShowPricingModal(false)} 
                className="absolute right-6 top-6 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-full mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Escolha o plano ideal para a sua banca</span>
              </div>
              
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Planos & Assinaturas AvJuris.AI
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-lg mx-auto">
                Acesso completo à IA forense de alta densidade, conexão CNJ e modelo timbrado.
              </p>

              <div className="flex items-center justify-center gap-3 mt-5">
                <span className={`text-xs font-bold ${frequenciaPricing === "mensal" ? "text-slate-900" : "text-slate-400"}`}>Mensal</span>
                <button
                  type="button"
                  onClick={() => setFrequenciaPricing(frequenciaPricing === "mensal" ? "anual" : "mensal")}
                  className="w-12 h-6 bg-slate-900 rounded-full p-1 flex items-center transition cursor-pointer"
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${frequenciaPricing === "anual" ? "translate-x-6 bg-[#38BDF8]" : ""}`}></div>
                </button>
                <span className={`text-xs font-bold flex items-center gap-1.5 ${frequenciaPricing === "anual" ? "text-slate-900" : "text-slate-400"}`}>
                  Anual <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">20% OFF</span>
                </span>
              </div>
            </div>

            <div className="p-8 overflow-y-auto grid grid-cols-1 md:grid-cols-3 gap-6">
              {LISTA_PLANOS.map((plano) => (
                <div 
                  key={plano.id}
                  className={`rounded-2xl p-6 flex flex-col justify-between transition shadow-sm space-y-6 ${
                    plano.destaque 
                      ? "border-2 border-blue-600 bg-gradient-to-b from-blue-50/40 to-white shadow-xl relative" 
                      : "border border-slate-200 bg-white hover:border-slate-300 relative"
                  }`}
                >
                  {plano.badgeTopo && (
                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-white text-[10px] font-black uppercase tracking-wider px-3.5 py-0.5 rounded-full shadow-md ${
                      plano.destaque ? "bg-blue-600" : "bg-[#2563eb]"
                    }`}>
                      {plano.badgeTopo}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-base ${plano.destaque ? "text-blue-950" : "text-slate-900"}`}>{plano.nome}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${plano.destaque ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}`}>
                        {plano.tipoUso}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-950">
                          {frequenciaPricing === "mensal" ? plano.precoMensal : plano.precoAnual}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">/mês</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Cobrado {frequenciaPricing === "mensal" ? "mensalmente" : `anualmente (${plano.precoAnualTotal})`}
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Crie até <strong>{plano.casos} casos</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Monitore até <strong>{plano.processos} processos</strong> simultâneos</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Gere até <strong>{plano.minutas} documentos</strong> por mês</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Upload de até <strong>{plano.paginasUpload} páginas</strong> ou 150MB</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Exportação em <strong>modelo timbrado (.docx)</strong></span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelecionarPlanoAsaas(plano)}
                    className={`w-full py-2.5 font-bold text-xs rounded-xl transition text-center shadow-sm cursor-pointer ${
                      plano.destaque 
                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30" 
                        : "bg-slate-900 hover:bg-slate-800 text-white"
                    }`}
                  >
                    Assinar {plano.nome} ➔
                  </button>
                </div>
              ))}
            </div>

            {/* Rodapé Seguro */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-8 text-slate-500 text-[11px]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Cancelamento simples a qualquer momento sem fidelidade
              </span>
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Certificado PCI-DSS &amp; SSL Criptografado
              </span>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE JURISPRUDÊNCIA / EMENTAS CITADAS */}
      {showJurisModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-[#0B132B] text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600/30 border border-blue-500/30 rounded-lg text-[#38BDF8]">
                  <Gavel className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Pesquisas de Jurisprudência & Fontes</h3>
                  <p className="text-[11px] text-slate-400">Precedentes e acórdãos aplicados na fundamentação</p>
                </div>
              </div>
              <button 
                onClick={() => setShowJurisModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">SUPERIOR TRIBUNAL DE JUSTIÇA (STJ)</span>
                  <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded">Precedente Vinculante</span>
                </div>
                <p className="font-serif italic text-slate-700 leading-relaxed text-justify">
                  EMENTA: PROCESSUAL CIVIL. TUTELA DE URGÊNCIA. CABIMENTO DO AGRAVO DE INSTRUMENTO. O rol do art. 1.015 do CPC possui taxatividade mitigada quando demonstrada a urgência decorrente da inutilidade do julgamento da questão no recurso de apelação (Tema 988/STJ).
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px] text-slate-500 font-mono">
                  <span>REsp 1.704.520/MT, Rel. Min. Nancy Andrighi</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText("Tema 988/STJ - Taxatividade Mitigada do Art. 1.015 do CPC");
                      alert("Citação copiada!");
                    }}
                    className="text-blue-600 font-semibold hover:underline cursor-pointer"
                  >
                    Copiar citação
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">STJ • TERCEIRA TURMA</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded">Responsabilidade Civil</span>
                </div>
                <p className="font-serif italic text-slate-700 leading-relaxed text-justify">
                  EMENTA: CONSUMIDOR. INSCRIÇÃO INDEVIDA EM CADASTROS DE INADIMPLENTES. DANO MORAL IN RE IPSA. DESNECESSIDADE DE PROVA DO PREJUÍZO FÁTICO. QUANTUM INDENIZATÓRIO RAZOÁVEL E PROPORCIONAL.
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px] text-slate-500 font-mono">
                  <span>AgInt no AREsp 1.827.553/SP, Rel. Min. Marco Aurélio Bellizze</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText("Súmula 385/STJ e precedentes de dano moral in re ipsa");
                      alert("Citação copiada!");
                    }}
                    className="text-blue-600 font-semibold hover:underline cursor-pointer"
                  >
                    Copiar citação
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button 
                onClick={() => setShowJurisModal(false)} 
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AJUDA / MANUAL OPERACIONAL */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
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

            <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2 sm:gap-4 overflow-x-auto text-xs font-semibold text-slate-600 shrink-0">
              <button
                onClick={() => setHelpActiveTab("peticoes")}
                className={`py-3.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  helpActiveTab === "peticoes" ? "border-blue-600 text-blue-600 font-bold" : "border-transparent hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Petições & Peças</span>
              </button>
              <button
                onClick={() => setHelpActiveTab("datajud")}
                className={`py-3.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  helpActiveTab === "datajud" ? "border-blue-600 text-blue-600 font-bold" : "border-transparent hover:text-slate-900"
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Conexão DataJud</span>
              </button>
              <button
                onClick={() => setHelpActiveTab("atajur")}
                className={`py-3.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  helpActiveTab === "atajur" ? "border-blue-600 text-blue-600 font-bold" : "border-transparent hover:text-slate-900"
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Atas & Áudios</span>
              </button>
              <button
                onClick={() => setHelpActiveTab("timbrado")}
                className={`py-3.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  helpActiveTab === "timbrado" ? "border-blue-600 text-blue-600 font-bold" : "border-transparent hover:text-slate-900"
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Modelo Timbrado</span>
              </button>
              <button
                onClick={() => setHelpActiveTab("seguranca")}
                className={`py-3.5 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  helpActiveTab === "seguranca" ? "border-blue-600 text-blue-600 font-bold" : "border-transparent hover:text-slate-900"
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Planos & Cotas</span>
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6 text-slate-700 overflow-y-auto flex-1 text-xs sm:text-sm leading-relaxed">
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
                  </div>
                </div>
              )}

              {helpActiveTab === "atajur" && (
                <div className="space-y-4">
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
                    <h4 className="font-bold text-emerald-950 text-sm mb-1 flex items-center gap-2">
                      <span>🎙️</span> Atas Executivas de Reuniões &amp; Síntese de Áudio
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
                </div>
              )}

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
                  <div className="border border-slate-200 rounded-xl p-4">
                    <h5 className="font-bold text-slate-900 text-xs mb-1">Como usar seu modelo timbrado:</h5>
                    <ol className="list-decimal pl-4 space-y-1.5 text-xs text-slate-600">
                      <li>Clique na opção <strong>Usar Modelo Timbrado (.docx)</strong> na barra inferior da caixa de texto.</li>
                      <li>Selecione um arquivo <strong>.docx</strong> que já possua seu cabeçalho, logo e rodapé pré-formatados.</li>
                      <li>Ao clicar em <strong>Exportar .DOCX</strong>, o backend preservará toda a estrutura visual do seu arquivo e inserirá a minuta formatada no corpo do documento.</li>
                    </ol>
                  </div>
                </div>
              )}

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
                        O limite de documentos é renovado automaticamente a cada 30 dias no primeiro dia de cada mês civil.
                      </p>
                    </div>
                    <div className="border border-slate-200 rounded-xl p-4">
                      <h5 className="font-bold text-slate-900 text-xs mb-1">Sigilo &amp; LGPD:</h5>
                      <p className="text-xs text-slate-600">
                        Seus documentos e clientes são isolados por chave de segurança (RLS). Nenhuma informação processual confidencial é compartilhada com terceiros ou utilizada para treinamento público.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

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
