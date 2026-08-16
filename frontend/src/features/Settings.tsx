import { useState, useMemo, useEffect, useRef } from "react";
import { useMe, useUpdateSettingsAppearance, ApiError } from "../lib/api";
import type { AppearanceMode, AppearancePreset, CustomColors } from "../lib/types";
import { useWorkspaceAppearance } from "../theme/react";
import { applyTheme } from "../theme/applyTheme";
import { resolveTheme } from "../theme/resolveTheme";
import { Card, PageHeader } from "../components/common";
import { IconCheck, IconAlertCircle } from "../components/Icons";

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

  const [activeTab, setActiveTab] = useState<"appearance" | "integrations" | "company">("appearance");

  // Local appearance form state initialized from workspace session
  const [preset, setPreset] = useState<AppearancePreset>(currentAppearance.preset);
  const [mode, setMode] = useState<AppearanceMode>(currentAppearance.mode);
  const [customColors, setCustomColors] = useState<CustomColors>(
    currentAppearance.customColors ?? DEFAULT_CUSTOM,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const savedRef = useRef(false);

  // Synchronize initial state when server session loads
  useEffect(() => {
    setPreset(currentAppearance.preset);
    setMode(currentAppearance.mode);
    if (currentAppearance.customColors) {
      setCustomColors(currentAppearance.customColors);
    }
  }, [currentAppearance.preset, currentAppearance.mode, currentAppearance.customColors]);

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
        applyTheme(document.documentElement, resolveTheme(currentAppearance));
      }
    };
  }, [currentAppearance]);

  const isOwnerOrAdmin = useMemo(() => {
    const activeRole = session?.memberships?.find(
      (m) => m.companyId === session.activeCompanyId,
    )?.role;
    return activeRole === "OWNER" || activeRole === "ADMIN" || !activeRole;
  }, [session]);

  const handleSaveAppearance = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setFeedback(null);
    try {
      await updateAppearance.mutateAsync({
        preset,
        mode,
        customColors: preset === "CUSTOM" ? customColors : null,
      });
      savedRef.current = true;
      setFeedback("Aparência atualizada com sucesso.");
      setTimeout(() => setFeedback(null), 3000);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Falha ao salvar aparência.");
    }
  };

  return (
    <div>
      <PageHeader
        title="Configurações"
        subtitle="Aparência, integrações e dados da empresa"
      />

      {/* Navigation tabs */}
      <div className="mb-6 flex gap-2 border-b border-[var(--looply-color-border-default)] pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("appearance")}
          className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "appearance"
              ? "border-[var(--looply-color-action-primary)] text-[var(--looply-color-text-primary)]"
              : "border-transparent text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
          }`}
        >
          Aparência
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("integrations")}
          className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "integrations"
              ? "border-[var(--looply-color-action-primary)] text-[var(--looply-color-text-primary)]"
              : "border-transparent text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
          }`}
        >
          Integrações
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("company")}
          className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "company"
              ? "border-[var(--looply-color-action-primary)] text-[var(--looply-color-text-primary)]"
              : "border-transparent text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
          }`}
        >
          Empresa
        </button>
      </div>

      {/* Tab: Aparência */}
      {activeTab === "appearance" && (
        <form onSubmit={handleSaveAppearance} className="space-y-6">
          <Card>
            <h3 className="section-title mb-1">Tema e Modo de Exibição</h3>
            <p className="mb-4 text-xs text-[var(--looply-color-text-muted)]">
              Personalize o esquema de cores e o modo claro ou escuro da sua interface.
            </p>

            {/* Mode selection */}
            <div className="mb-6">
              <label className="label mb-2">Modo</label>
              <div className="flex max-w-xs gap-3">
                <button
                  type="button"
                  onClick={() => setMode("LIGHT")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    mode === "LIGHT"
                      ? "border-[var(--looply-color-border-brand)] bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-primary)]"
                      : "border-[var(--looply-color-border-default)] text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)]"
                  }`}
                >
                  Modo Claro
                </button>
                <button
                  type="button"
                  onClick={() => setMode("DARK")}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                    mode === "DARK"
                      ? "border-[var(--looply-color-border-brand)] bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-primary)]"
                      : "border-[var(--looply-color-border-default)] text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)]"
                  }`}
                >
                  Modo Escuro
                </button>
              </div>
            </div>

            {/* Presets grid */}
            <div>
              <label className="label mb-2">Predefinições de Tema</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {PRESETS.map((p) => {
                  const isSelected = preset === p.value;
                  return (
                    <div
                      key={p.value}
                      onClick={() => setPreset(p.value)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all ${
                        isSelected
                          ? "border-[var(--looply-color-border-brand)] bg-[var(--looply-color-bg-subtle)] ring-1 ring-[var(--looply-color-border-brand)]"
                          : "border-[var(--looply-color-border-default)] hover:border-[var(--looply-color-border-default)] hover:bg-[var(--looply-color-bg-subtle)]/50"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex gap-1.5">
                          {p.colors.map((c, idx) => (
                            <span
                              key={idx}
                              className="h-4 w-4 rounded-full border border-black/10"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        {isSelected && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--looply-color-action-primary)] text-white">
                            <IconCheck className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-[var(--looply-color-text-primary)]">{p.title}</div>
                      <div className="mt-1 text-xs text-[var(--looply-color-text-muted)]">{p.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom colors editor if CUSTOM selected */}
            {preset === "CUSTOM" && (
              <div className="mt-6 rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/30 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--looply-color-text-muted)] mb-3">
                  Cores Customizadas
                </h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {(["primary", "secondary", "accent", "surface", "text", "border"] as (keyof CustomColors)[]).map(
                    (key) => (
                      <div key={key}>
                        <label className="label text-[11px] capitalize">{key}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={customColors[key]}
                            onChange={(e) =>
                              setCustomColors((c) => ({ ...c, [key]: e.target.value }))
                            }
                            className="h-8 w-8 cursor-pointer rounded border border-[var(--looply-color-border-default)] p-0"
                          />
                          <input
                            type="text"
                            value={customColors[key]}
                            onChange={(e) =>
                              setCustomColors((c) => ({ ...c, [key]: e.target.value }))
                            }
                            className="input font-mono text-xs py-1"
                          />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Feedback / Error */}
            {feedback && (
              <div className="mt-4 rounded-lg bg-[var(--looply-color-status-success)]/10 px-3 py-2 text-sm text-[var(--looply-color-status-success)]">
                {feedback}
              </div>
            )}
            {err && (
              <div className="mt-4 rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-sm text-[var(--looply-color-status-danger)]">
                {err}
              </div>
            )}

            <div className="mt-6 flex justify-end">
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
                  Envio e aprovação automatizada de jobs via WhatsApp oficial (Meta Cloud API).
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

      {/* Tab: Empresa */}
      {activeTab === "company" && (
        <div className="space-y-6">
          <Card>
            <h3 className="section-title mb-4">Dados da Empresa</h3>
            <div className="space-y-4 max-w-lg">
              <div>
                <label className="label">Nome da empresa</label>
                <input
                  className="input"
                  disabled
                  value={session?.workspace?.name ?? "Looply"}
                />
              </div>
              <div>
                <label className="label">Fuso horário</label>
                <input
                  className="input"
                  disabled
                  value="America/Sao_Paulo (Horário de Brasília)"
                />
              </div>
              <div>
                <label className="label">Idioma da interface</label>
                <input
                  className="input"
                  disabled
                  value="Português (Brasil)"
                />
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
