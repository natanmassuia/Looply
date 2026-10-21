import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useResetPassword, ApiError } from "../lib/api";
import AuthShell, { Eyebrow } from "../components/AuthShell";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetMutation = useResetPassword();

  if (!token) {
    return (
      <AuthShell>
        <Eyebrow>RECUPERAÇÃO DE SENHA</Eyebrow>
        <h1 className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-[var(--looply-color-text-primary)] lg:text-[36px] lg:leading-[44px]">
          Link inválido.
        </h1>
        <p className="mt-2 text-[14px] leading-5 text-[var(--looply-color-text-muted)]">
          O link de recuperação não possui um token válido ou já expirou.
        </p>
        <div className="mt-8">
          <Link to="/forgot-password" className="btn btn-primary btn-lg inline-flex">
            Solicitar novo link
          </Link>
        </div>
      </AuthShell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError("A senha deve ter no mínimo 10 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    try {
      await resetMutation.mutateAsync({ token, password });
      setSuccess(true);
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao redefinir senha. Tente solicitar um novo link.");
    }
  };

  return (
    <AuthShell>
      <Eyebrow>NOVO ACESSO SEGURO</Eyebrow>
      <h1 className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-[var(--looply-color-text-primary)] lg:text-[36px] lg:leading-[44px]">
        Defina uma nova senha.
      </h1>
      <p className="mt-2 text-[14px] leading-5 text-[var(--looply-color-text-muted)]">
        Crie uma nova senha para voltar ao Looply.
      </p>

      {success ? (
        <div className="mt-8 rounded-2xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] p-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-[var(--looply-color-status-success)]" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--looply-color-text-brand)]">
              Senha atualizada
            </span>
          </div>
          <p className="mt-3 text-[14px] leading-6 text-[var(--looply-color-text-secondary)]">
            Sua senha foi redefinida com sucesso. Redirecionando para o login...
          </p>
          <div className="mt-6">
            <Link
              to="/login"
              className="inline-flex items-center text-[13px] font-semibold text-[var(--looply-color-text-brand)] hover:underline"
            >
              ← Ir para o login agora
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8">
          {error && (
            <div className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--looply-color-status-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--looply-color-status-danger)_10%,transparent)] p-3 text-[13px] text-[var(--looply-color-status-danger)]">
              {error}
            </div>
          )}

          <label htmlFor="new-password" className="label">
            Nova senha
          </label>
          <input
            id="new-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input input-lg mb-4"
            autoComplete="new-password"
            placeholder="No mínimo 10 caracteres"
          />

          <label htmlFor="confirm-password" className="label">
            Confirmar nova senha
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input input-lg mb-6"
            autoComplete="new-password"
            placeholder="Repita a nova senha"
          />

          <button
            type="submit"
            disabled={resetMutation.isPending}
            className="btn btn-primary btn-lg w-full"
          >
            {resetMutation.isPending ? "Redefinindo..." : "Redefinir senha"}
          </button>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-[13px] font-medium text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)] transition-colors"
            >
              ← Voltar para o login
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
