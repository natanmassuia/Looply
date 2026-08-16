import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMe, useLogin, ApiError } from "../lib/api";
import { getPostLoginDestination } from "../lib/workspace";
import AuthShell, { Eyebrow } from "../components/AuthShell";
import type { ReactNode } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const login = useLogin();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const session = await login.mutateAsync({ email, password });
      window.location.assign(getPostLoginDestination(session));
    } catch (err) {
      // Backend returns one generic message for every bad-login case (no
      // enumeration). Network failures get a neutral message, never a raw
      // browser/backend leak.
      setError(err instanceof ApiError ? err.message : "Não foi possível conectar. Tente novamente.");
    }
  };

  return (
    <AuthShell>
      <Eyebrow>Acesso ao Looply</Eyebrow>
      <h1 className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-[var(--looply-color-text-primary)] lg:text-[36px] lg:leading-[44px]">
        Bem-vindo de volta.
      </h1>
      <p className="mt-2 text-[14px] leading-5 text-[var(--looply-color-text-muted)]">
        Entre para continuar o trabalho da sua equipe.
      </p>

      <form onSubmit={submit} className="mt-8">
        <label htmlFor="login-email" className="label">E-mail</label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input input-lg mb-4"
          autoComplete="email"
        />
        <label htmlFor="login-password" className="label">Senha</label>
        <input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input input-lg"
          autoComplete="current-password"
        />
        {/* Recovery exists in Figma but the backend is blocked (F4A): the
            entry point stays honest — it explains the real path, never
            pretends to send a reset e-mail. */}
        <div className="mt-2 text-right">
          <button
            type="button"
            onClick={() =>
              setNotice(
                "A recuperação de senha ainda não está disponível. Fale com quem administra o Looply na sua empresa.",
              )
            }
            className="text-[13px] font-medium text-[var(--looply-color-text-brand)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] rounded-sm"
          >
            Esqueci minha senha
          </button>
        </div>
        {notice && (
          <p role="status" className="mt-2 text-[13px] leading-5 text-[var(--looply-color-text-muted)]">{notice}</p>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-[var(--looply-color-status-danger)]">{error}</p>
        )}
        <button type="submit" disabled={login.isPending} className="btn-primary mt-6 h-12 w-full text-[15px] font-semibold">
          {login.isPending ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] p-4">
        <p className="text-[14px] font-semibold text-[var(--looply-color-text-primary)]">Precisa de ajuda para entrar?</p>
        <p className="mt-1 text-[13px] leading-5 text-[var(--looply-color-text-muted)]">
          Se ainda não recebeu seu acesso, fale com quem administra o Looply na sua empresa.
        </p>
      </div>
      <p className="mt-4 text-center text-[12px] leading-4 text-[var(--looply-color-text-muted)]">
        Acesso seguro para sua equipe
      </p>
    </AuthShell>
  );
}

// Route guard: waits for the session query; redirects to /login when 401.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isPending, isError } = useMe();
  const location = useLocation();
  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--looply-color-text-muted)]">
        Carregando...
      </div>
    );
  }
  if (isError) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
