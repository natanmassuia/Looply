import { useState } from "react";
import { Link } from "react-router-dom";
import { useRequestPasswordRecovery, ApiError } from "../lib/api";
import AuthShell, { Eyebrow } from "../components/AuthShell";

export default function Recovery() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recoveryMutation = useRequestPasswordRecovery();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await recoveryMutation.mutateAsync({ email });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível processar a solicitação. Tente novamente.");
    }
  };

  return (
    <AuthShell>
      <Eyebrow>RECUPERAÇÃO DE SENHA</Eyebrow>
      <h1 className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-[var(--looply-color-text-primary)] lg:text-[36px] lg:leading-[44px]">
        Recupere seu acesso.
      </h1>
      <p className="mt-2 text-[14px] leading-5 text-[var(--looply-color-text-muted)]">
        Informe seu e-mail e enviaremos as instruções para redefinir sua senha.
      </p>

      {submitted ? (
        <div className="mt-8 rounded-2xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] p-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-[var(--looply-color-status-success)]" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--looply-color-text-brand)]">
              E-mail enviado
            </span>
          </div>
          <p className="mt-3 text-[14px] leading-6 text-[var(--looply-color-text-secondary)]">
            Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá as instruções em poucos minutos.
          </p>
          <div className="mt-6">
            <Link
              to="/login"
              className="inline-flex items-center text-[13px] font-semibold text-[var(--looply-color-text-brand)] hover:underline"
            >
              ← Voltar para o login
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

          <label htmlFor="recovery-email" className="label">
            E-mail
          </label>
          <input
            id="recovery-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input input-lg mb-6"
            autoComplete="email"
            placeholder="seu@email.com"
          />

          <button
            type="submit"
            disabled={recoveryMutation.isPending}
            className="btn btn-primary btn-lg w-full"
          >
            {recoveryMutation.isPending ? "Enviando..." : "Enviar link de recuperação"}
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
