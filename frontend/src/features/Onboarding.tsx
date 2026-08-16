import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ApiError, useChangePassword, useCompleteOnboarding, useMe, useOnboardingStatus, useSelectTemplate, useUpdateOnboardingCompany } from "../lib/api";
import type { WorkspaceTemplate } from "../lib/types";
import {
  CHANGE_PASSWORD_PATH,
  DEFAULT_HOME_PATH,
  ONBOARDING_PATH,
  isWorkspaceActive,
} from "../lib/workspace";

function neutralError(err: unknown): string {
  return err instanceof ApiError ? err.message : "Não foi possível conectar. Tente novamente.";
}

// ── Canonical first-access guard (F4B) ─────────────────────────────────────
// One gate for every authenticated route. Server state decides; the user
// cannot bypass onboarding by typing an app URL, and a finished workspace
// never sees the onboarding screens again.
//   mustChangePassword      → /change-password
//   workspace UNCONFIGURED  → /onboarding
//   otherwise               → the app
export function AccessGate() {
  const { data: session } = useMe();
  const { pathname } = useLocation();

  if (!session) return <Outlet />; // ProtectedRoute already gates pending/error

  if (session.mustChangePassword) {
    return pathname === CHANGE_PASSWORD_PATH ? (
      <Outlet />
    ) : (
      <Navigate to={CHANGE_PASSWORD_PATH} replace />
    );
  }
  if (!isWorkspaceActive(session)) {
    return pathname === ONBOARDING_PATH ? <Outlet /> : <Navigate to={ONBOARDING_PATH} replace />;
  }
  if (pathname === ONBOARDING_PATH || pathname === CHANGE_PASSWORD_PATH) {
    return <Navigate to={DEFAULT_HOME_PATH} replace />;
  }
  return <Outlet />;
}

// ── Forced password change (temporary credential from provisioning) ───────
const MIN_PASSWORD_LENGTH = 10; // mirrors backend assertNewPasswordOk

export function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const change = useChangePassword();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha deve ter entre ${MIN_PASSWORD_LENGTH} e 200 caracteres`);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem");
      return;
    }
    setError(null);
    try {
      await change.mutateAsync({ newPassword: password });
      // Hook invalidates ["me"]; AccessGate routes to /onboarding.
    } catch (err) {
      setError(neutralError(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--looply-color-bg-canvas)] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-8 shadow-sm"
      >
        <h1 className="mb-1 text-xl font-semibold text-[var(--looply-color-text-primary)]">Looply</h1>
        <p className="mb-6 text-sm text-[var(--looply-color-text-muted)]">
          Você recebeu uma senha temporária. Defina sua senha definitiva para continuar.
        </p>
        <label htmlFor="new-password" className="label">Nova senha</label>
        <input
          id="new-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mb-4"
          autoComplete="new-password"
        />
        <label htmlFor="confirm-password" className="label">Confirmar nova senha</label>
        <input
          id="confirm-password"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input mb-4"
          autoComplete="new-password"
        />
        {error && (
          <p role="alert" className="mb-4 text-sm text-[var(--looply-color-status-danger)]">{error}</p>
        )}
        <button type="submit" disabled={change.isPending} className="btn-primary w-full">
          {change.isPending ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </div>
  );
}

// ── Guided onboarding (2 steps, outside the app shell) ────────────────────
const TEMPLATES: { value: WorkspaceTemplate; title: string; description: string }[] = [
  {
    value: "LOCAL_BUSINESS",
    title: "Negócio local",
    description: "Clientes recorrentes e publicações frequentes",
  },
  {
    value: "HIGH_TICKET",
    title: "Alto ticket",
    description: "Ciclo longo de aprovação e conteúdo mais elaborado",
  },
  {
    value: "MARKETING_AGENCY",
    title: "Agência",
    description: "Vários clientes com fluxo editorial próprio",
  },
];

const TIMEZONES = ["America/Sao_Paulo", "America/New_York", "America/Los_Angeles", "Europe/Lisbon"];
const LOCALES: { value: "pt-BR" | "en-US"; label: string }[] = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
];

export default function Onboarding() {
  const statusQuery = useOnboardingStatus();
  const saveCompany = useUpdateOnboardingCompany();
  const selectTemplate = useSelectTemplate();
  const complete = useCompleteOnboarding();
  const [step, setStep] = useState(1);
  // null = untouched, falls back to the server value (prefill without effects)
  const [name, setName] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [locale, setLocale] = useState<"pt-BR" | "en-US" | null>(null);
  const [template, setTemplate] = useState<WorkspaceTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (statusQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[var(--looply-color-text-muted)]">
        Carregando...
      </div>
    );
  }
  if (statusQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <p role="alert" className="text-sm text-[var(--looply-color-status-danger)]">
          Não foi possível carregar o onboarding. Tente novamente.
        </p>
      </div>
    );
  }

  const company = statusQuery.data.company;
  const nameValue = name ?? company.name;
  const timezoneValue = timezone ?? company.timezone;
  const localeValue = locale ?? (company.locale as "pt-BR" | "en-US");
  const templateValue = template ?? company.template;
  const busy = saveCompany.isPending || selectTemplate.isPending || complete.isPending;

  const submitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameValue.trim().length === 0) {
      setError("Informe o nome do workspace");
      return;
    }
    setError(null);
    try {
      await saveCompany.mutateAsync({ name: nameValue.trim(), timezone: timezoneValue, locale: localeValue });
      setStep(2);
    } catch (err) {
      setError(neutralError(err));
    }
  };

  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateValue) {
      setError("Escolha um modelo de trabalho");
      return;
    }
    setError(null);
    try {
      await selectTemplate.mutateAsync(templateValue);
      await complete.mutateAsync();
      // Hook invalidates ["me"]; AccessGate sees ACTIVE and routes to the app.
    } catch (err) {
      setError(neutralError(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--looply-color-bg-canvas)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-[var(--looply-color-text-primary)]">Looply</h1>
        <p className="mb-6 text-sm text-[var(--looply-color-text-muted)]">
          Vamos configurar seu workspace — etapa {step} de 2
        </p>

        {step === 1 ? (
          <form onSubmit={submitCompany}>
            <label htmlFor="company-name" className="label">Nome do workspace</label>
            <input
              id="company-name"
              type="text"
              value={nameValue}
              onChange={(e) => setName(e.target.value)}
              className="input mb-4"
            />
            <label htmlFor="company-timezone" className="label">Fuso horário</label>
            <select
              id="company-timezone"
              value={timezoneValue}
              onChange={(e) => setTimezone(e.target.value)}
              className="input mb-4"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            <label htmlFor="company-locale" className="label">Idioma</label>
            <select
              id="company-locale"
              value={localeValue}
              onChange={(e) => setLocale(e.target.value as "pt-BR" | "en-US")}
              className="input mb-4"
            >
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
            {error && (
              <p role="alert" className="mb-4 text-sm text-[var(--looply-color-status-danger)]">{error}</p>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Salvando..." : "Continuar"}
            </button>
          </form>
        ) : (
          <form onSubmit={finish}>
            <fieldset>
              <legend className="label">Modelo de trabalho</legend>
              <div className="mb-4 flex flex-col gap-2">
                {TEMPLATES.map((t) => (
                  <label
                    key={t.value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--looply-color-border-default)] p-3"
                  >
                    <input
                      type="radio"
                      name="workspace-template"
                      value={t.value}
                      checked={templateValue === t.value}
                      onChange={() => setTemplate(t.value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-[var(--looply-color-text-primary)]">{t.title}</span>
                      <span className="block text-sm text-[var(--looply-color-text-muted)]">{t.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {error && (
              <p role="alert" className="mb-4 text-sm text-[var(--looply-color-status-danger)]">{error}</p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} disabled={busy} className="btn-secondary w-full">
                Voltar
              </button>
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? "Concluindo..." : "Concluir"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
