import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMe, useLogin, ApiError } from "../lib/api";
import { getPostLoginDestination } from "../lib/workspace";
import type { ReactNode } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--looply-color-bg-canvas)] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-8 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-semibold text-[var(--looply-color-text-primary)]">Looply</h1>
        <p className="mb-6 text-sm text-[var(--looply-color-text-muted)]">Entre para acessar seu workspace</p>
        <label htmlFor="login-email" className="label">E-mail</label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input mb-4"
          autoComplete="email"
        />
        <label htmlFor="login-password" className="label">Senha</label>
        <input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mb-4"
          autoComplete="current-password"
        />
        {error && (
          <p role="alert" className="mb-4 text-sm text-[var(--looply-color-status-danger)]">{error}</p>
        )}
        <button
          type="submit"
          disabled={login.isPending}
          className="btn-primary w-full"
        >
          {login.isPending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
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
