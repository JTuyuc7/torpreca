"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Info, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { login } from "@/lib/api/auth-client";
import { type LoginFormValues, LoginSchema } from "@/lib/auth/login-schema";
import { decodeReturnTo } from "@/lib/auth/return-to";
import { writeCachedAuthUser } from "@/lib/auth/session-cache";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useTranslation } from "@/lib/i18n/use-translation";

// useSearchParams() opts the component reading it into fully dynamic
// rendering unless isolated behind a Suspense boundary — kept as its own
// leaf component so the rest of the (otherwise static) login page isn't
// affected by that.
function SessionNotice() {
  const { t } = useTranslation();
  const params = useSearchParams();
  // One notice per `?reason=` value redirects to /login carry — TOR-123
  // added "inactivity" alongside the pre-existing cross-tab sign-out case.
  const reasonMessages: Record<string, string> = {
    "signed-out-elsewhere": t.login.reasonSignedOutElsewhere,
    inactivity: t.login.reasonInactivity,
  };
  const message = reasonMessages[params.get("reason") ?? ""];
  if (!message) return null;

  return (
    <div className="mt-4 flex items-center gap-2 rounded-md border border-outline/30 bg-surface px-3 py-2 text-sm text-text">
      <Info size={16} className="shrink-0 text-outline" />
      <span>{message}</span>
    </div>
  );
}

// Layout fiel al mockup W01 — Login Admin (Design System V2.0, ver
// context/dashboard/assets/TorprecaDesignV2.pdf): panel de marca fijo a la
// izquierda + formulario a la derecha. El link "¿Olvidaste tu contraseña?"
// del mockup se omite a propósito: no hay ticket de recuperación de
// contraseña todavía, y un link muerto es peor que no tenerlo. La lista de
// bullets con números del mockup ("12 conductores activos", etc.) también se
// omitió — son datos reales, no copy estático, y no hay fuente de esos
// números todavía.

export default function LoginPage() {
  const { t } = useTranslation();
  usePageTitle(t.login.title);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    mode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit({ email, password }: LoginFormValues) {
    setError(null);
    setLoading(true);

    // TOR-124: signInWithPassword + the role check both happen server-side
    // now, inside POST /api/auth/login — this only ever gets back the
    // resolved AuthUser (or a status to explain the failure), never a token.
    const result = await login(email, password);

    if (!result.ok) {
      setError(result.status === 403 ? t.login.errorForbidden : t.login.errorInvalidCredentials);
      setLoading(false);
      return;
    }

    writeCachedAuthUser(result.user);
    // Read straight from window.location (not useSearchParams()) so this
    // component itself doesn't opt into fully dynamic rendering — see the
    // comment on SessionNotice above for why that's isolated behind Suspense.
    const returnTo = decodeReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
    router.push(returnTo ?? "/");
  }

  return (
    <div className="flex flex-1 bg-background">
      <div className="hidden w-2/5 flex-col justify-center bg-brand px-12 py-16 text-white md:flex lg:w-1/3">
        <h1 className="text-4xl font-normal tracking-tight">TORPRECA</h1>
        <p className="mt-2 text-xs font-medium tracking-widest text-white/80 uppercase">
          {t.login.panelSubtitle}
        </p>

        <p className="mt-8 max-w-xs text-base text-white/90">{t.login.heroText}</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full max-w-sm">
          <h2 className="text-2xl text-text">{t.login.title}</h2>
          <p className="mt-1 text-sm text-outline">{t.login.subtitle}</p>

          <Suspense fallback={null}>
            <SessionNotice />
          </Suspense>

          <div className="mt-8">
            <label className="mb-1 block text-xs text-outline" htmlFor="email">
              {t.login.emailLabel}
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
                className={`w-full rounded-md border bg-transparent py-2 pr-9 pl-3 text-text outline-none transition-colors focus:ring-1 focus:ring-primary ${
                  errors.email ? "border-error" : "border-outline"
                }`}
              />
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-outline"
              />
            </div>
            {errors.email && <FieldError id="email-error">{errors.email.message}</FieldError>}
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs text-outline" htmlFor="password">
              {t.login.passwordLabel}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
                className={`w-full rounded-md border bg-transparent py-2 pr-9 pl-3 text-text outline-none transition-colors focus:ring-1 focus:ring-primary ${
                  errors.password ? "border-error" : "border-outline"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t.login.hidePassword : t.login.showPassword}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-outline transition-colors hover:text-text cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <FieldError id="password-error">{errors.password.message}</FieldError>}
          </div>

          {error && (
            <div className="mt-4">
              <ErrorBanner message={error} />
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid || loading}
            className="mt-6 w-full rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {loading ? t.login.submitting : t.login.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
