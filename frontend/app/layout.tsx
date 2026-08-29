import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JurisPrime & AtaJur — Plataforma de IA Jurídica",
  description: "Gestão inteligente de atas de reunião e elaboração de petições cíveis de 1º grau.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased font-sans bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}