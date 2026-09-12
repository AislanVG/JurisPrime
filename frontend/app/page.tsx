"use client";

import React, { useState, useEffect } from "react";
import { Scale, Loader2, Eye, EyeOff, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Se já estiver logado, vai direto para o painel em /app
        window.location.href = "/app";
      } else {
        setLoadingAuth(false);
      }
    };
    checkSession();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "https://app.avjuris.com.br/app",
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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Login com sucesso: redireciona para a workstation em /app
        window.location.href = "/app";
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

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B132B]">
        <Loader2 className="w-8 h-8 text-[#38BDF8] animate-spin" />
      </div>
    );
  }

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
    </div>
  );
}
