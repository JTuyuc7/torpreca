"use client";

import { Eye, EyeOff, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { reportLoginFailed, verifySession } from "@/lib/api/auth-client";
import { writeCachedAuthUser } from "@/lib/auth/session-cache";
import { supabase } from "@/lib/supabase/client";

// Layout fiel al mockup W01 — Login Admin (Design System V2.0, ver
// context/dashboard/assets/TorprecaDesignV2.pdf): panel de marca fijo a la
// izquierda + formulario a la derecha. El link "¿Olvidaste tu contraseña?"
// del mockup se omite a propósito: no hay ticket de recuperación de
// contraseña todavía, y un link muerto es peor que no tenerlo. La lista de
// bullets con números del mockup ("12 conductores activos", etc.) también se
// omitió — son datos reales, no copy estático, y no hay fuente de esos
// números todavía.

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.session) {
      reportLoginFailed(email);
      setError("Credenciales inválidas.");
      setLoading(false);
      return;
    }

    const result = await verifySession(data.session.access_token);

    if (!result.ok) {
      await supabase.auth.signOut();
      setError(
        result.status === 403
          ? "Esta cuenta no tiene acceso al panel administrativo."
          : "No se pudo iniciar sesión. Intenta de nuevo.",
      );
      setLoading(false);
      return;
    }

    writeCachedAuthUser(result.user);
    router.push("/");
  }

  return (
    <div className="flex flex-1 bg-background">
      <div className="hidden w-2/5 flex-col justify-center bg-brand px-12 py-16 text-white md:flex lg:w-1/3">
        <h1 className="text-4xl font-normal tracking-tight">TORPRECA</h1>
        <p className="mt-2 text-xs font-medium tracking-widest text-white/80 uppercase">
          Panel de administración
        </p>

        <p className="mt-8 max-w-xs text-base text-white/90">
          Gestión de rutas, conductores y reportes en tiempo real para toda la flota.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <h2 className="text-2xl text-text">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-outline">Accede al panel de administración</p>

          <div className="mt-8">
            <label className="mb-1 block text-xs text-outline" htmlFor="email">
              Correo electrónico
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-outline bg-transparent py-2 pr-9 pl-3 text-text outline-none transition-colors focus:ring-1 focus:ring-primary"
              />
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-outline"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs text-outline" htmlFor="password">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-outline bg-transparent py-2 pr-9 pl-3 text-text outline-none transition-colors focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-outline transition-colors hover:text-text cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm text-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>
      </div>
    </div>
  );
}
