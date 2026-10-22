import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://hub.bezhas.com"),
  title: "BeZhas Hub — centro de operaciones B2B",
  description:
    "Organización, sedes, claves de API y consumo de tu plan en un solo sitio. Punto de entrada a las apps nativas de BeZhas.",
};

// Evita el parpadeo de tema: pone data-bz-theme antes de pintar (mismo mecanismo que bezhas.com).
const themeScript = `try{var t=localStorage.getItem('bz-theme');if(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)t='dark';if(t)document.documentElement.setAttribute('data-bz-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${archivo.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
