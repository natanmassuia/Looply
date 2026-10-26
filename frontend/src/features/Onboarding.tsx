import { useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ApiError,
  useChangePassword,
  useCompleteOnboarding,
  useMe,
  useOnboardingStatus,
  useSelectTemplate,
  useUpdateOnboardingAppearance,
  useUpdateOnboardingCompany,
} from "../lib/api";
import type { AppearancePreset, WorkspaceTemplate } from "../lib/types";
import AuthShell, { Eyebrow } from "../components/AuthShell";
import {
  CHANGE_PASSWORD_PATH,
  DEFAULT_HOME_PATH,
  ONBOARDING_PATH,
  isWorkspaceActive,
} from "../lib/workspace";
import { MVP } from "../config/mvp";

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
  // Onboarding stays first-access-only, but /change-password is also reachable
  // voluntarily (Minha Conta → Alterar minha senha) for active workspaces.
  if (pathname === ONBOARDING_PATH) {
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
  const navigate = useNavigate();
  const { data: session } = useMe();
  // Forced = temporary credential from provisioning; voluntary = the user asked
  // for it from Minha Conta. Both use the same canonical screen + endpoint.
  const forced = !!session?.mustChangePassword;

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
      // Hook invalidates ["me"]; the session refetches. After a successful
      // change an ACTIVE workspace returns to the app home — voluntary and
      // forced alike. Non-active workspaces keep the existing onboarding
      // contract (AccessGate routes them to /onboarding on the invalidation).
      if (isWorkspaceActive(session)) navigate(DEFAULT_HOME_PATH);
    } catch (err) {
      setError(neutralError(err));
    }
  };

  return (
    <AuthShell>
      <Eyebrow>{forced ? "Primeiro acesso" : "Segurança"}</Eyebrow>
      <h1 className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-[var(--looply-color-text-primary)] lg:text-[36px] lg:leading-[44px]">
        {forced ? "Defina sua nova senha" : "Alterar minha senha"}
      </h1>
      <p className="mt-2 text-[14px] leading-5 text-[var(--looply-color-text-muted)]">
        {forced
          ? "Proteja seu acesso antes de continuar."
          : "Atualize a senha usada para entrar no Looply."}
      </p>

      <form onSubmit={submit} className="mt-8">
        <label htmlFor="new-password" className="label">Nova senha</label>
        <input
          id="new-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input input-lg mb-4"
          autoComplete="new-password"
        />
        <label htmlFor="confirm-password" className="label">Confirmar nova senha</label>
        <input
          id="confirm-password"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="input input-lg"
          autoComplete="new-password"
        />
        <ul className="mt-4 space-y-1.5 rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] p-4 text-[13px] leading-5 text-[var(--looply-color-text-secondary)]">
          <li>Entre 10 e 200 caracteres</li>
          <li>As duas senhas devem coincidir</li>
          <li>As outras sessões com a senha antiga serão encerradas</li>
        </ul>
        {error && (
          <p role="alert" className="mt-4 text-sm text-[var(--looply-color-status-danger)]">{error}</p>
        )}
        <button type="submit" disabled={change.isPending} className="btn-primary mt-6 h-12 w-full text-[15px] font-semibold">
          {change.isPending ? "Salvando..." : "Salvar nova senha"}
        </button>
        {!forced && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary mt-3 h-11 w-full text-[13px] font-semibold"
          >
            Voltar
          </button>
        )}
      </form>
    </AuthShell>
  );
}

// ── Guided onboarding (F4C · Figma 05) ────────────────────────────────────
// Seven Figma steps mapped onto real backend contracts:
//   1 Welcome        — presentational only
//   2 Company        — PATCH /api/onboarding/company (name/site/timezone/locale)
//   3 Profile        — POST /api/onboarding/template (operational profile)
//   4 Confirmation   — presentational (capabilities stay server-resolved)
//   5 Meta           — BLOCKED: deferred status card, no fake connection
//   6 Appearance     — PATCH /api/onboarding/appearance (AURA default)
//   7 Ready          — POST /api/onboarding/complete → the app

const TOTAL_STEPS = 7;

const PROFILES: { value: WorkspaceTemplate; title: string; description: string }[] = [
  {
    value: "LOCAL_BUSINESS",
    title: "Negócio Local",
    description: "Operação low-tech, clientes recorrentes e publicações frequentes",
  },
  {
    value: "HIGH_TICKET",
    title: "High-Ticket",
    description: "Ciclo longo de aprovação e conteúdo mais elaborado",
  },
  {
    value: "MARKETING_AGENCY",
    title: "Agência de Marketing",
    description: "Vários clientes com fluxo editorial próprio",
  },
];

const PROFILE_PREP: Record<WorkspaceTemplate, string[]> = {
  LOCAL_BUSINESS: ["Clientes e demandas organizados", "Aprovação pública por link", "Agenda e lembretes", "Painel de acompanhamento"],
  HIGH_TICKET: ["Clientes e demandas organizados", "Aprovação pública por link", "Agenda e lembretes", "Painel de acompanhamento"],
  MARKETING_AGENCY: ["Clientes e demandas organizados", "Aprovação pública por link", "Agenda e lembretes", "Painel de acompanhamento"],
};

const APPEARANCES: { value: AppearancePreset; title: string; description: string; deferred?: boolean }[] = [
  { value: "AURA", title: "Aura", description: "Calma e claridade — o padrão do Looply" },
  { value: "FLUX", title: "Flux", description: "Foco e movimento" },
  { value: "PULSE", title: "Pulse", description: "Energia e presença" },
  { value: "CUSTOM", title: "Customizado", description: "Suas próprias cores base", deferred: true },
];

const TIMEZONES = ["America/Sao_Paulo", "America/New_York", "America/Los_Angeles", "Europe/Lisbon"];
const LOCALES: { value: "pt-BR" | "en-US"; label: string }[] = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
];

const MVP_TOTAL_STEPS = 3;

function StepDots({ step, total = TOTAL_STEPS }: { step: number; total?: number }) {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i + 1 === step
              ? "w-6 bg-[var(--looply-color-action-primary)]"
              : i + 1 < step
                ? "w-1.5 bg-[var(--looply-color-action-primary)]/50"
                : "w-1.5 bg-[var(--looply-color-border-default)]"
          }`}
        />
      ))}
    </div>
  );
}

export default function Onboarding() {
  const statusQuery = useOnboardingStatus();
  const saveCompany = useUpdateOnboardingCompany();
  const selectTemplate = useSelectTemplate();
  const saveAppearance = useUpdateOnboardingAppearance();
  const complete = useCompleteOnboarding();
  const me = useMe();
  const [step, setStep] = useState(1);
  // null = untouched, falls back to the server value (prefill without effects)
  const [name, setName] = useState<string | null>(null);
  const [website, setWebsite] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [locale, setLocale] = useState<"pt-BR" | "en-US" | null>(null);
  const [template, setTemplate] = useState<WorkspaceTemplate | null>(null);
  const [preset, setPreset] = useState<AppearancePreset | null>(null);
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
  const websiteValue = website ?? company.website ?? "";
  const timezoneValue = timezone ?? company.timezone;
  const localeValue = locale ?? (company.locale as "pt-BR" | "en-US");
  const templateValue = template ?? company.template;
  const presetValue = preset ?? statusQuery.data.appearance.preset;
  const busy =
    saveCompany.isPending || selectTemplate.isPending || saveAppearance.isPending || complete.isPending;

  const submitCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameValue.trim().length === 0) {
      setError("Informe o nome da empresa");
      return;
    }
    setError(null);
    try {
      await saveCompany.mutateAsync({
        name: nameValue.trim(),
        website: websiteValue.trim() || undefined,
        timezone: timezoneValue,
        locale: localeValue,
      });
      if (MVP.forceLocalBusinessOnboarding) {
        await selectTemplate.mutateAsync("LOCAL_BUSINESS");
        setTemplate("LOCAL_BUSINESS");
        await saveAppearance.mutateAsync({ preset: "AURA", mode: "LIGHT" });
        setPreset("AURA");
        setStep(7);
        return;
      }
      setStep(3);
    } catch (err) {
      setError(neutralError(err));
    }
  };

  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateValue) {
      setError("Escolha um perfil de operação");
      return;
    }
    setError(null);
    try {
      await selectTemplate.mutateAsync(templateValue);
      setStep(4);
    } catch (err) {
      setError(neutralError(err));
    }
  };

  const submitAppearance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetValue) {
      setError("Escolha uma aparência");
      return;
    }
    setError(null);
    try {
      await saveAppearance.mutateAsync({ preset: presetValue, mode: "LIGHT" });
      setStep(7);
    } catch (err) {
      setError(neutralError(err));
    }
  };

  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await complete.mutateAsync();
      // Hook invalidates ["me"]; AccessGate sees ACTIVE and routes to the app.
    } catch (err) {
      setError(neutralError(err));
    }
  };

  const templateTitle = templateValue ? PROFILES.find((p) => p.value === templateValue)?.title : null;

  return (
    <AuthShell>
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-[12px] font-semibold leading-4 text-[var(--looply-color-text-muted)]">
          Etapa {MVP.forceLocalBusinessOnboarding ? (step === 7 ? 3 : step) : step} de{" "}
          {MVP.forceLocalBusinessOnboarding ? MVP_TOTAL_STEPS : TOTAL_STEPS}
        </p>
        <StepDots
          step={MVP.forceLocalBusinessOnboarding ? (step === 7 ? 3 : step) : step}
          total={MVP.forceLocalBusinessOnboarding ? MVP_TOTAL_STEPS : TOTAL_STEPS}
        />
      </div>

      {step === 1 && (
        <div>
          <h1 className="text-[28px] font-bold leading-9 tracking-tight text-[var(--looply-color-text-primary)] lg:text-[36px] lg:leading-[44px]">
            {me.data?.user.name ? `Bem-vindo, ${me.data.user.name.split(" ")[0]}.` : "Bem-vindo ao Looply."}
          </h1>
          <p className="mt-3 text-[16px] leading-6 text-[var(--looply-color-text-secondary)]">
            Em poucos passos sua empresa fica no ar: dados, perfil de operação e
            aparência.
          </p>
          <div className="mt-6 rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] p-4 text-[13px] leading-5 text-[var(--looply-color-text-secondary)]">
            O Looply já vem com fluxo de clientes, jobs e aprovações organizado para o perfil da sua empresa.
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="btn-primary mt-8 h-12 w-full text-[15px] font-semibold"
          >
            Começar configuração
          </button>
        </div>
      )}

      {step === 2 && (
        <form onSubmit={submitCompany}>
          <Eyebrow>Onboarding</Eyebrow>
          <h1 className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-[var(--looply-color-text-primary)] lg:text-[36px] lg:leading-[44px]">
            Sobre a empresa
          </h1>
          <p className="mt-2 text-[14px] leading-5 text-[var(--looply-color-text-muted)]">
            Esses dados identificam a sua empresa no Looply.
          </p>
          <div className="mt-6">
            <label htmlFor="company-name" className="label">Nome da empresa</label>
            <input
              id="company-name"
              type="text"
              value={nameValue}
              onChange={(e) => setName(e.target.value)}
              className="input input-lg mb-4"
            />
            <label htmlFor="company-website" className="label">Site</label>
            <input
              id="company-website"
              type="text"
              inputMode="url"
              placeholder="https://"
              value={websiteValue}
              onChange={(e) => setWebsite(e.target.value)}
              className="input input-lg mb-4"
            />
            <label htmlFor="company-timezone" className="label">Fuso horário</label>
            <select
              id="company-timezone"
              value={timezoneValue}
              onChange={(e) => setTimezone(e.target.value)}
              className="input input-lg mb-4"
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
              className="input input-lg"
            >
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          {error && (
            <p role="alert" className="mt-4 text-sm text-[var(--looply-color-status-danger)]">{error}</p>
          )}
          <button type="submit" disabled={busy} className="btn-primary mt-6 h-12 w-full text-[15px] font-semibold">
            {busy ? "Salvando..." : "Continuar"}
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={submitProfile}>
          <Eyebrow>Onboarding</Eyebrow>
          <h1 className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-[var(--looply-color-text-primary)] lg:text-[36px] lg:leading-[44px]">
            Escolha seu perfil
          </h1>
          <p className="mt-2 text-[14px] leading-5 text-[var(--looply-color-text-muted)]">
            O perfil organiza o fluxo de trabalho da sua empresa.
          </p>
          <fieldset className="mt-6">
            <legend className="sr-only">Perfil de operação</legend>
            <div className="flex flex-col gap-3">
              {PROFILES.map((p) => (
                <label
                  key={p.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    templateValue === p.value
                      ? "border-[var(--looply-color-border-brand)] bg-[var(--looply-color-bg-brand-soft)]"
                      : "border-[var(--looply-color-border-default)] hover:bg-[var(--looply-color-bg-subtle)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="workspace-profile"
                    value={p.value}
                    checked={templateValue === p.value}
                    onChange={() => setTemplate(p.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-[15px] font-semibold text-[var(--looply-color-text-primary)]">{p.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-5 text-[var(--looply-color-text-muted)]">{p.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="mt-4 text-sm text-[var(--looply-color-status-danger)]">{error}</p>
          )}
          <button type="submit" disabled={busy} className="btn-primary mt-6 h-12 w-full text-[15px] font-semibold">
            {busy ? "Salvando..." : "Continuar"}
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={busy}
            className="btn-secondary mt-3 h-10 w-full"
          >
            Voltar
          </button>
        </form>
      )}

      {step === 4 && templateValue && (
        <div>
          <Eyebrow>Confirmação</Eyebrow>
          <h1 className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-[var(--looply-color-text-primary)] lg:text-[36px] lg:leading-[44px]">
            Tudo pronto para {templateTitle}
          </h1>
          <p className="mt-2 text-[14px] leading-5 text-[var(--looply-color-text-muted)]">
            O perfil <strong>{templateTitle}</strong> organiza o seu Looply assim:
          </p>
          <ul className="mt-5 space-y-2.5">
            {PROFILE_PREP[templateValue].map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-xl border border-[var(--looply-color-border-default)] px-4 py-3 text-[14px] font-medium text-[var(--looply-color-text-primary)]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--looply-color-status-success)_14%,var(--looply-color-bg-surface))] text-[var(--looply-color-status-success)]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] leading-4 text-[var(--looply-color-text-muted)]">
            As áreas certas do seu fluxo já vêm organizadas para o perfil escolhido.
          </p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-[var(--looply-color-status-danger)]">{error}</p>
          )}
          <button type="button" onClick={() => setStep(5)} className="btn-primary mt-6 h-12 w-full text-[15px] font-semibold">
            Continuar
          </button>
          <button type="button" onClick={() => setStep(3)} className="btn-secondary mt-3 h-10 w-full">
            Voltar
          </button>
        </div>
      )}

      {step === 5 && (
        <div>
          <Eyebrow>Integrações</Eyebrow>
          <h1 className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-[var(--looply-color-text-primary)] lg:text-[36px] lg:leading-[44px]">
            Conexão Meta
          </h1>
          {/* Status card — the integration is not part of the current runtime;
              this card never claims a connection or performs external calls. */}
          <div className="mt-6 rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--looply-color-bg-surface)] text-[var(--looply-color-text-muted)]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M20 10H4" />
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[var(--looply-color-text-primary)]">WhatsApp / Instagram</p>
                  <p className="text-[12px] text-[var(--looply-color-text-muted)]">Meta Business</p>
                </div>
              </div>
              <span className="rounded-full bg-[var(--looply-color-bg-surface)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--looply-color-text-muted)]">
                Em breve
              </span>
            </div>
            <p className="mt-4 text-[13px] leading-5 text-[var(--looply-color-text-secondary)]">
              A conexão com a Meta (WhatsApp e Instagram) estará disponível em breve. Você pode
              continuar a configuração normalmente sem conectar.
            </p>
          </div>
          {error && (
            <p role="alert" className="mt-4 text-sm text-[var(--looply-color-status-danger)]">{error}</p>
          )}
          <button type="button" onClick={() => setStep(6)} className="btn-primary mt-6 h-12 w-full text-[15px] font-semibold">
            Continuar sem conectar
          </button>
          <button type="button" onClick={() => setStep(4)} className="btn-secondary mt-3 h-10 w-full">
            Voltar
          </button>
        </div>
      )}

      {step === 6 && (
        <form onSubmit={submitAppearance}>
          <Eyebrow>Onboarding</Eyebrow>
          <h1 className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-[var(--looply-color-text-primary)] lg:text-[36px] lg:leading-[44px]">
            Aparência do Looply
          </h1>
          <p className="mt-2 text-[14px] leading-5 text-[var(--looply-color-text-muted)]">
            Escolha o tema inicial — poderá ser alterado depois nas configurações.
          </p>
          <fieldset className="mt-6">
            <legend className="sr-only">Aparência</legend>
            <div className="grid grid-cols-2 gap-3">
              {APPEARANCES.map((a) => {
                const selected = presetValue === a.value;
                return (
                  <label
                    key={a.value}
                    className={`flex min-h-[120px] flex-col rounded-xl border p-4 transition-colors ${
                      a.deferred
                        ? "cursor-not-allowed border-[var(--looply-color-border-default)] opacity-60"
                        : selected
                          ? "cursor-pointer border-[var(--looply-color-border-brand)] bg-[var(--looply-color-bg-brand-soft)]"
                          : "cursor-pointer border-[var(--looply-color-border-default)] hover:bg-[var(--looply-color-bg-subtle)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="workspace-appearance"
                      value={a.value}
                      checked={selected}
                      disabled={a.deferred}
                      onChange={() => setPreset(a.value)}
                      className="self-start"
                    />
                    <span className="mt-2 text-[15px] font-semibold text-[var(--looply-color-text-primary)]">{a.title}</span>
                    <span className="mt-0.5 text-[12px] leading-4 text-[var(--looply-color-text-muted)]">
                      {a.deferred ? "Disponível depois da configuração inicial" : a.description}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="mt-4 text-sm text-[var(--looply-color-status-danger)]">{error}</p>
          )}
          <button type="submit" disabled={busy} className="btn-primary mt-6 h-12 w-full text-[15px] font-semibold">
            {busy ? "Salvando..." : "Continuar"}
          </button>
          <button type="button" onClick={() => setStep(5)} disabled={busy} className="btn-secondary mt-3 h-10 w-full">
            Voltar
          </button>
        </form>
      )}

      {step === 7 && (
        <form onSubmit={finish}>
          <Eyebrow>Tudo pronto</Eyebrow>
          <h1 className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-[var(--looply-color-text-primary)] lg:text-[36px] lg:leading-[44px]">
            Seu Looply está pronto para começar.
          </h1>
          {/* Summary uses the actual values chosen in this flow */}
          <dl className="mt-6 space-y-3 rounded-xl border border-[var(--looply-color-border-default)] p-5">
            <div className="flex items-center justify-between gap-4 text-[14px]">
              <dt className="text-[var(--looply-color-text-muted)]">Empresa</dt>
              <dd className="truncate font-semibold text-[var(--looply-color-text-primary)]">{nameValue}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 text-[14px]">
              <dt className="text-[var(--looply-color-text-muted)]">Perfil</dt>
              <dd className="font-semibold text-[var(--looply-color-text-primary)]">{templateTitle}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 text-[14px]">
              <dt className="text-[var(--looply-color-text-muted)]">Aparência</dt>
              <dd className="font-semibold text-[var(--looply-color-text-primary)]">
                {APPEARANCES.find((a) => a.value === presetValue)?.title}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 text-[14px]">
              <dt className="text-[var(--looply-color-text-muted)]">Fuso</dt>
              <dd className="font-semibold text-[var(--looply-color-text-primary)]">{timezoneValue}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 text-[14px]">
              <dt className="text-[var(--looply-color-text-muted)]">Meta</dt>
              <dd className="font-semibold text-[var(--looply-color-text-muted)]">conexão futura</dd>
            </div>
          </dl>
          {error && (
            <p role="alert" className="mt-4 text-sm text-[var(--looply-color-status-danger)]">{error}</p>
          )}
          <button type="submit" disabled={busy} className="btn-primary mt-6 h-12 w-full text-[15px] font-semibold">
            {busy ? "Entrando..." : "Entrar no Looply"}
          </button>
          <button
            type="button"
            onClick={() => setStep(MVP.forceLocalBusinessOnboarding ? 2 : 6)}
            disabled={busy}
            className="btn-secondary mt-3 h-10 w-full"
          >
            Voltar
          </button>
        </form>
      )}
    </AuthShell>
  );
}
