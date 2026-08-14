import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMe, useLogin } from "../lib/api";
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
      await login.mutateAsync({ email, password });
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--looply-background)] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-[var(--looply-border)] bg-white p-8 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-semibold text-[var(--looply-foreground)]">Looply</h1>
        <p className="mb-6 text-sm text-neutral-500">Entre para acessar seu workspace</p>
        <label className="mb-1 block text-sm font-medium text-neutral-700">E-mail</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          autoComplete="email"
        />
        <label className="mb-1 block text-sm font-medium text-neutral-700">Senha</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
          autoComplete="current-password"
        />
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-60"
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
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Carregando...
      </div>
    );
  }
  if (isError) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
