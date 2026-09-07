import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AvJuris.AI — Workstation Jurídica com IA Forense",
  description: "Plataforma de inteligência jurídica para peticionamento de 1º grau, atas executivas e automação processual.",
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
