import { useState, useEffect, useRef } from "react";
import {
  useMe,
  useUpdateSettingsAppearance,
  useCompanySettings,
  useUpdateCompanySettings,
  useUploadCompanyLogo,
  useDeleteCompanyLogo,
  ApiError,
} from "../lib/api";
import type { AppearanceMode, AppearancePreset, CustomColors } from "../lib/types";
import { useWorkspaceAppearance } from "../theme/react";
import { applyTheme } from "../theme/applyTheme";
import { resolveTheme } from "../theme/resolveTheme";
import { Card, PageHeader, Spinner } from "../components/common";
import { IconCheck, IconAlertCircle, IconSun, IconMoon } from "../components/Icons";
import MyAccountModal from "./MyAccountModal";
import ImageUpload from "../components/ImageUpload";
import PhoneInput, { hydratePhone } from "../components/PhoneInput";

const PRESETS: { value: AppearancePreset; title: string; description: string; colors: string[] }[] = [
  {
    value: "AURA",
    title: "Aura",
    description: "Calma e claridade — o padrão do Looply",
    colors: ["#F06D55", "#F3B84B", "#FFF7F1", "#2A171F"],
  },
  {
    value: "FLUX",
    title: "Flux",
    description: "Foco e movimento com tonalidades quentes",
    colors: ["#F06D55", "#F3B84B", "#FCF5EC", "#3A2418"],
  },
  {
    value: "PULSE",
    title: "Pulse",
    description: "Energia, contraste e presença marcante",
    colors: ["#E11D48", "#FB7185", "#FFF1F2", "#1E1B4B"],
  },
  {
    value: "CUSTOM",
    title: "Customizado",
    description: "Paleta personalizada com suas próprias cores",
    colors: ["#6366F1", "#A855F7", "#F8FAFC", "#0F172A"],
  },
];

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília · GMT-3" },
  { value: "America/Manaus", label: "Manaus · GMT-4" },
  { value: "America/Rio_Branco", label: "Rio Branco · GMT-5" },
  { value: "America/Noronha", label: "Fernando de Noronha · GMT-2" },
  { value: "America/Fortaleza", label: "Fortaleza · GMT-3" },
  { value: "America/Cuiaba", label: "Cuiabá · GMT-4" },
  { value: "UTC", label: "UTC · GMT+0" },
];

const DEFAULT_CUSTOM: CustomColors = {
  primary: "#F06D55",
  secondary: "#F3B84B",
  accent: "#FFE3D7",
  surface: "#FFFFFF",
  text: "#2A171F",
  border: "#E8D8D1",
};

export default function Settings() {
  const { data: session } = useMe();
  const currentAppearance = useWorkspaceAppearance();
  const updateAppearance = useUpdateSettingsAppearance();

  const [activeTab, setActiveTab] = useState<"account" | "company" | "appearance" | "integrations">("account");
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  // Local appearance form state initialized from workspace session
  const [preset, setPreset] = useState<AppearancePreset>(currentAppearance.preset);
  const [mode, setMode] = useState<AppearanceMode>(currentAppearance.mode);
  const [customColors, setCustomColors] = useState<CustomColors>(
    currentAppearance.customColors ?? DEFAULT_CUSTOM,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const savedRef = useRef(false);

  // Company Settings
  const { data: companyData, isLoading: companyLoading } = useCompanySettings(activeTab === "company");
  const updateCompany = useUpdateCompanySettings();
  const uploadCompanyLogoMutation = useUploadCompanyLogo();
  const deleteCompanyLogoMutation = useDeleteCompanyLogo();
  const [companyName, setCompanyName] = useState("");
  const [companyTimezone, setCompanyTimezone] = useState("America/Sao_Paulo");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyFeedback, setCompanyFeedback] = useState<string | null>(null);
  const [companyErr, setCompanyErr] = useState<string | null>(null);

  // Synchronize initial state when server session loads
  useEffect(() => {
    setPreset(currentAppearance.preset);
    setMode(currentAppearance.mode);
    if (currentAppearance.customColors) {
      setCustomColors(currentAppearance.customColors);
    }
  }, [currentAppearance.preset, currentAppearance.mode, currentAppearance.customColors]);

  useEffect(() => {
    if (companyData) {
      setCompanyName(companyData.name || "");
      setCompanyTimezone(companyData.timezone || "America/Sao_Paulo");
      setCompanyPhone(hydratePhone(companyData.phone));
    } else if (session?.workspace?.name) {
      setCompanyName(session.workspace.name);
    }
  }, [companyData, session]);

  // Live theme preview on user interaction
  useEffect(() => {
    applyTheme(
      document.documentElement,
      resolveTheme({
        preset,
        mode,
        customColors: preset === "CUSTOM" ? customColors : null,
      }),
    );
  }, [preset, mode, customColors]);

  // Revert preview on unmount if not saved
  useEffect(() => {
    return () => {
      if (!savedRef.current) {
        applyTheme(
          document.documentElement,
          resolveTheme({
            preset: currentAppearance.preset,
            mode: currentAppearance.mode,
            customColors: currentAppearance.customColors,
          }),
        );
      }
    };
  }, [currentAppearance]);

  const activeRole = session?.memberships?.find(
    (m) => m.companyId === session.activeCompanyId,
  )?.role;
  const isOwnerOrAdmin = activeRole === "OWNER" || activeRole === "ADMIN" || !activeRole;

  const handleSaveAppearance = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setErr(null);
    try {
      await updateAppearance.mutateAsync({
        preset,
        mode,
        // Custom colors belong ONLY to the CUSTOM preset. When a preset is in
        // effect the backend discards any leftover custom palette anyway, so
        // we omit the field to avoid a 400 from the strict validator.
        ...(preset === "CUSTOM" ? { customColors } : {}),
      });
      savedRef.current = true;
      setFeedback("Aparência do workspace atualizada com sucesso.");
      setTimeout(() => setFeedback(null), 4000);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Falha ao salvar aparência.");
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyFeedback(null);
    setCompanyErr(null);
    if (!companyName.trim()) {
      setCompanyErr("Nome da empresa não pode ser vazio.");
      return;
    }
    try {
      await updateCompany.mutateAsync({
        name: companyName.trim(),
        timezone: companyTimezone,
        phone: companyPhone.trim() || null,
      });
      setCompanyFeedback("Dados da empresa atualizados com sucesso.");
      setTimeout(() => setCompanyFeedback(null), 4000);
    } catch (e) {
      setCompanyErr(e instanceof ApiError ? e.message : "Falha ao salvar dados da empresa.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle="Gerencie suas preferências de usuário, dados da empresa, aparência e integrações."
      />

      {/* Tabs */}
      <div className="border-b border-[var(--looply-color-border-default)]">
        <div className="flex gap-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("account")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === "account"
                ? "border-[var(--looply-color-action-primary)] text-[var(--looply-color-text-primary)] font-semibold"
                : "border-transparent text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
            }`}
          >
            Minha conta
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("company")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === "company"
                ? "border-[var(--looply-color-action-primary)] text-[var(--looply-color-text-primary)] font-semibold"
                : "border-transparent text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
            }`}
          >
            Empresa
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("appearance")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === "appearance"
                ? "border-[var(--looply-color-action-primary)] text-[var(--looply-color-text-primary)] font-semibold"
                : "border-transparent text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
            }`}
          >
            Aparência
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("integrations")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === "integrations"
                ? "border-[var(--looply-color-action-primary)] text-[var(--looply-color-text-primary)] font-semibold"
                : "border-transparent text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
            }`}
          >
            Integrações
          </button>
        </div>
      </div>

        {/* Tab: Minha Conta */}
      {activeTab === "account" && (
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {session?.user?.avatarUrl ? (
                  <img
                    src={session.user.avatarUrl}
                    alt={session.user.name}
                    className="h-16 w-16 rounded-full object-cover border border-[var(--looply-color-border-default)]"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--looply-color-action-primary)]/10 text-xl font-bold text-[var(--looply-color-action-primary)]">
                    {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                )}
                <div>
                  <h3 className="section-title text-base">{session?.user?.name ?? "Usuário"}</h3>
                  <p className="text-xs text-[var(--looply-color-text-muted)]">{session?.user?.email}</p>
                  <div className="mt-1.5 inline-flex items-center rounded-md bg-[var(--looply-color-bg-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--looply-color-text-brand)]">
                    {activeRole === "OWNER" ? "Proprietário" : activeRole === "ADMIN" ? "Administrador" : "Membro"}
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(true)}
                  className="btn-primary text-xs"
                >
                  Editar perfil
                </button>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="section-title mb-1">Dados Pessoais</h3>
            <p className="text-xs text-[var(--looply-color-text-muted)] mb-4">
              Informações do seu perfil de acesso ao Looply.
            </p>

            <div className="space-y-4 max-w-lg">
              <div>
                <label className="label">Nome completo</label>
                <div className="rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/30 px-3 py-2 text-sm text-[var(--looply-color-text-primary)]">
                  {session?.user?.name ?? "—"}
                </div>
              </div>

              <div>
                <label className="label">E-mail de acesso</label>
                <div className="rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/30 px-3 py-2 text-sm text-[var(--looply-color-text-primary)]">
                  {session?.user?.email ?? "—"}
                </div>
              </div>

              <div>
                <label className="label">Telefone pessoal</label>
                <div className="rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/30 px-3 py-2 text-sm text-[var(--looply-color-text-primary)]">
                  {session?.user?.phone || <span className="text-[var(--looply-color-text-muted)]">Não informado</span>}
                </div>
                <p className="mt-1 text-[11px] text-[var(--looply-color-text-muted)]">
                  Telefone pessoal para contato direto e notificações.
                </p>
              </div>
            </div>
          </Card>

          <Card className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-[var(--looply-color-text-primary)]">Segurança e Senha</h4>
              <p className="text-xs text-[var(--looply-color-text-muted)]">
                Altere sua senha de acesso a qualquer momento.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(true)}
              className="btn-secondary text-xs"
            >
              Gerenciar conta
            </button>
          </Card>
        </div>
      )}

      {/* Tab: Aparência */}
      {activeTab === "appearance" && (
        <form onSubmit={handleSaveAppearance} className="space-y-6">
          {feedback && (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--looply-color-status-success)]/10 border border-[var(--looply-color-status-success)]/20 px-4 py-3 text-sm text-[var(--looply-color-status-success)]">
              <IconCheck className="h-4 w-4" />
              <span>{feedback}</span>
            </div>
          )}

          {err && (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--looply-color-status-danger)]/10 border border-[var(--looply-color-status-danger)]/20 px-4 py-3 text-sm text-[var(--looply-color-status-danger)]">
              <IconAlertCircle className="h-4 w-4" />
              <span>{err}</span>
            </div>
          )}

          {/* Presets Grid */}
          <Card>
            <h3 className="section-title mb-1">Paleta de Cores</h3>
            <p className="text-xs text-[var(--looply-color-text-muted)] mb-4">
              Selecione uma identidade visual para todos os usuários deste workspace.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PRESETS.map((p) => {
                const isSelected = preset === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPreset(p.value)}
                    className={`flex flex-col text-left rounded-xl p-4 border transition-all ${
                      isSelected
                        ? "border-[var(--looply-color-action-primary)] bg-[var(--looply-color-bg-subtle)] shadow-looply-sm ring-1 ring-[var(--looply-color-action-primary)]"
                        : "border-[var(--looply-color-border-default)] hover:border-[var(--looply-color-border-strong)] bg-[var(--looply-color-bg-surface)]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-[var(--looply-color-text-primary)]">
                        {p.title}
                      </span>
                      {isSelected && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--looply-color-action-primary)] text-white">
                          <IconCheck className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--looply-color-text-muted)] mb-3">
                      {p.description}
                    </span>
                    <div className="mt-auto flex gap-1">
                      {p.colors.map((c, i) => (
                        <span
                          key={i}
                          className="h-4 w-4 rounded-full border border-black/10 shadow-xs"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Mode toggle */}
          <Card>
            <h3 className="section-title mb-1">Modo de Exibição</h3>
            <p className="text-xs text-[var(--looply-color-text-muted)] mb-4">
              Escolha entre o tema claro padrão ou o modo escuro.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode("LIGHT")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold border transition-all ${
                  mode === "LIGHT"
                    ? "border-[var(--looply-color-action-primary)] bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-primary)] ring-1 ring-[var(--looply-color-action-primary)]"
                    : "border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] text-[var(--looply-color-text-muted)]"
                }`}
              >
                <IconSun className="h-4 w-4" />
                Modo Claro
              </button>
              <button
                type="button"
                onClick={() => setMode("DARK")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold border transition-all ${
                  mode === "DARK"
                    ? "border-[var(--looply-color-action-primary)] bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-primary)] ring-1 ring-[var(--looply-color-action-primary)]"
                    : "border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] text-[var(--looply-color-text-muted)]"
                }`}
              >
                <IconMoon className="h-4 w-4" />
                Modo Escuro
              </button>
            </div>
          </Card>

          {/* Custom theme editor */}
          {preset === "CUSTOM" && (
            <Card>
              <h3 className="section-title mb-1">Cores Personalizadas</h3>
              <p className="text-xs text-[var(--looply-color-text-muted)] mb-4">
                Defina os códigos hexadecimais das cores do seu workspace.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["primary", "Cor primária (ações e botões)"],
                    ["secondary", "Cor secundária"],
                    ["accent", "Destaque e fundos suaves"],
                    ["surface", "Fundo de cartões"],
                    ["text", "Texto principal"],
                    ["border", "Bordas"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customColors[key]}
                        onChange={(e) =>
                          setCustomColors((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="h-9 w-9 rounded-lg border border-[var(--looply-color-border-default)] cursor-pointer p-0.5"
                      />
                      <input
                        type="text"
                        value={customColors[key]}
                        onChange={(e) =>
                          setCustomColors((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="input font-mono text-xs uppercase"
                        maxLength={7}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="flex items-center justify-between">
            <span className="text-xs text-[var(--looply-color-text-muted)]">
              {isOwnerOrAdmin
                ? "Alterações serão salvas para todos os membros do workspace."
                : "Apenas proprietários e administradores podem salvar alterações."}
            </span>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={updateAppearance.isPending || !isOwnerOrAdmin}
                className="btn-primary"
              >
                {updateAppearance.isPending ? "Salvando…" : "Salvar aparência"}
              </button>
            </div>
          </Card>
        </form>
      )}

      {/* Tab: Empresa (Figma 12 — Settings / 04 — Company Edit) */}
      {activeTab === "company" && (
        <form onSubmit={handleSaveCompany} className="space-y-6">
          {companyFeedback && (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--looply-color-status-success)]/10 border border-[var(--looply-color-status-success)]/20 px-4 py-3 text-sm text-[var(--looply-color-status-success)]">
              <IconCheck className="h-4 w-4" />
              <span>{companyFeedback}</span>
            </div>
          )}

          {companyErr && (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--looply-color-status-danger)]/10 border border-[var(--looply-color-status-danger)]/20 px-4 py-3 text-sm text-[var(--looply-color-status-danger)]">
              <IconAlertCircle className="h-4 w-4" />
              <span>{companyErr}</span>
            </div>
          )}

          <Card>
            <h3 className="section-title mb-1">Dados da Empresa</h3>
            <p className="text-xs text-[var(--looply-color-text-muted)] mb-4">
              Informações do workspace, dados institucionais e configurações de fuso horário.
            </p>

            {companyLoading ? (
              <Spinner label="Carregando dados da empresa..." />
            ) : (
              <div className="space-y-4 max-w-lg">
                <div>
                  <label htmlFor="company-name" className="label">
                    Nome da empresa *
                  </label>
                  <input
                    id="company-name"
                    type="text"
                    required
                    disabled={!isOwnerOrAdmin}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="input"
                    placeholder="Nome da empresa"
                  />
                </div>

                <div>
                  <label htmlFor="company-phone" className="label">
                    Telefone empresarial
                  </label>
                  <PhoneInput
                    id="company-phone"
                    disabled={!isOwnerOrAdmin}
                    value={companyPhone}
                    onChange={setCompanyPhone}
                    className="input"
                    placeholder="(16) 3000-0000"
                  />
                  <p className="mt-1 text-[11px] text-[var(--looply-color-text-muted)]">
                    Usado nos dados institucionais e documentos da empresa.
                  </p>
                </div>

                <div>
                  <p className="label mb-2">Logo da empresa</p>
                  <ImageUpload
                    currentUrl={companyData?.logoUrl}
                    initials={(companyData?.name || companyName || "?")
                      .trim()
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0] ?? "")
                      .join("")
                      .toUpperCase() || "?"}
                    shape="square"
                    size="w-16 h-16"
                    onUpload={(file) => uploadCompanyLogoMutation.mutateAsync(file)}
                    onDelete={() => deleteCompanyLogoMutation.mutateAsync()}
                    disabled={!isOwnerOrAdmin || uploadCompanyLogoMutation.isPending || deleteCompanyLogoMutation.isPending}
                  />
                </div>

                <div>
                  <label htmlFor="company-timezone" className="label">
                    Fuso horário *
                  </label>
                  <select
                    id="company-timezone"
                    disabled={!isOwnerOrAdmin}
                    value={companyTimezone}
                    onChange={(e) => setCompanyTimezone(e.target.value)}
                    className="input"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label} ({tz.value})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Idioma da interface</label>
                  <input
                    type="text"
                    className="input opacity-80 cursor-not-allowed"
                    disabled
                    value="Português (Brasil)"
                  />
                </div>
              </div>
            )}
          </Card>

          <Card className="flex items-center justify-between">
            <span className="text-xs text-[var(--looply-color-text-muted)]">
              {isOwnerOrAdmin
                ? "Alterações serão refletidas em todos os agendamentos e visualizações."
                : "Apenas proprietários e administradores podem salvar alterações."}
            </span>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={updateCompany.isPending || !isOwnerOrAdmin}
                className="btn-primary"
              >
                {updateCompany.isPending ? "Salvando…" : "Salvar dados da empresa"}
              </button>
            </div>
          </Card>
        </form>
      )}

      {/* Tab: Integrações */}
      {activeTab === "integrations" && (
        <div className="space-y-6">
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="section-title">WhatsApp Oficial</h3>
                  <span className="rounded-full bg-[var(--looply-color-status-info)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--looply-color-status-info)]">
                    Não configurado
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--looply-color-text-muted)]">
                  Envio e aprovação automatizada de demandas via WhatsApp oficial (Meta Cloud API).
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/40 p-4 text-xs text-[var(--looply-color-text-muted)]">
              <div className="flex items-center gap-2 font-medium text-[var(--looply-color-text-primary)] mb-1">
                <IconAlertCircle className="h-4 w-4 text-[var(--looply-color-status-info)]" />
                Status da integração
              </div>
              A conexão com a API oficial do WhatsApp está temporariamente indisponível nesta versão de demonstração. Os links públicos de aprovação funcionam normalmente.
            </div>

            <div className="mt-4 flex justify-end">
              <button type="button" disabled className="btn-secondary text-xs opacity-60 cursor-not-allowed">
                Conectar WhatsApp
              </button>
            </div>
          </Card>
        </div>
      )}

      <MyAccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
      />
    </div>
  );
}
