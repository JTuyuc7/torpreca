"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { setPassword as setPasswordRequest } from "@/lib/api/auth-client";
import { type SetPasswordFormValues, SetPasswordSchema } from "@/lib/auth/set-password-schema";
import { writeCachedAuthUser } from "@/lib/auth/session-cache";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useTranslation } from "@/lib/i18n/use-translation";

// Reached only from GET /auth/confirm?type=invite, which already verified the
// email link and left a valid (passwordless) session in the httpOnly cookie
// — inviteUserByEmail never asks the invitee for one. Same shell as /login
// (mockup has no dedicated screen for this), minus the email field.
export default function SetPasswordPage() {
  const { t } = useTranslation();
  usePageTitle(t.setPassword.title);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<SetPasswordFormValues>({
    resolver: zodResolver(SetPasswordSchema),
    mode: "onChange",
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit({ password, confirmPassword }: SetPasswordFormValues) {
    setError(null);
    setLoading(true);

    const result = await setPasswordRequest(password, confirmPassword);

    if (!result.ok) {
      setError(t.setPassword.errorGeneric);
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
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full max-w-sm">
          <h2 className="text-2xl text-text">{t.setPassword.title}</h2>
          <p className="mt-1 text-sm text-outline">{t.setPassword.subtitle}</p>

          <div className="mt-8">
            <label className="mb-1 block text-xs text-outline" htmlFor="password">
              {t.setPassword.passwordLabel}
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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
                aria-label={showPassword ? t.setPassword.hidePassword : t.setPassword.showPassword}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-outline transition-colors hover:text-text cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <FieldError id="password-error">{errors.password.message}</FieldError>}
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs text-outline" htmlFor="confirmPassword">
              {t.setPassword.confirmPasswordLabel}
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
              {...register("confirmPassword")}
              className={`w-full rounded-md border bg-transparent py-2 px-3 text-text outline-none transition-colors focus:ring-1 focus:ring-primary ${
                errors.confirmPassword ? "border-error" : "border-outline"
              }`}
            />
            {errors.confirmPassword && (
              <FieldError id="confirm-password-error">{errors.confirmPassword.message}</FieldError>
            )}
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
            {loading ? t.setPassword.submitting : t.setPassword.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
