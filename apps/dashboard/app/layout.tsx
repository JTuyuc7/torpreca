import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";

// Tipografía del Design System V2.0 (context/dashboard/assets/TorprecaDesignV2.pdf) —
// pesos 400/500 cubren toda la escala M3 usada ahí (Display/Headline/Title/Body
// en 400, Label Large de los CTA en 500).
const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Torpreca — Panel administrativo",
  description: "Gestión de rutas, conductores y reportes en tiempo real.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${roboto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
