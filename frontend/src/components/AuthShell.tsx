import { useState, type ReactNode } from "react";
import { Logo } from "./Logo";

// ── Auth shell (Final Figma 05.1 · Auth Experience) ────────────────────────
// Desktop (1440 × 960): 50/50 split — left dark aubergine Product Story
// (650×398 interactive preview + floating signals), right light Auth Panel
// (440px form). Mobile (390 × 844): compact hero card (358×184) above form.

type PreviewTab = "overview" | "clients" | "jobs" | "calendar";

const PREVIEW_TABS: { id: PreviewTab; label: string }[] = [
  { id: "overview", label: "Visão geral" },
  { id: "clients", label: "Clientes" },
  { id: "jobs", label: "Jobs" },
  { id: "calendar", label: "Agenda" },
];

const STATUS_PILL: Record<PreviewTab, string> = {
  overview: "HOJE",
  clients: "HOJE",
  jobs: "OPERAÇÃO EM DIA",
  calendar: "HOJE",
};

function Eyebrow({ children, inverse = false }: { children: ReactNode; inverse?: boolean }) {
  return (
    <p
      className={`text-[11px] font-bold uppercase leading-4 tracking-[0.88px] ${
        inverse ? "text-inverse-secondary" : "text-[var(--looply-color-text-brand)]"
      }`}
    >
      {children}
    </p>
  );
}

export function AuthProductPreview() {
  const [activeTab, setActiveTab] = useState<PreviewTab>("overview");

  return (
    <div className="relative w-full max-w-[650px]">
      {/* Floating Signal: Top Approval Card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-4 -right-2 z-10 hidden items-center gap-2 rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-3 py-2 shadow-looply-md xl:flex"
      >
        <span className="rounded-full bg-[color-mix(in_srgb,var(--looply-color-status-success)_14%,var(--looply-color-bg-surface))] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--looply-color-status-success)]">
          Aprovação
        </span>
        <span className="text-[11.5px] font-semibold text-[var(--looply-color-text-primary)]">
          Kit de anúncios aprovado
        </span>
      </div>

      {/* Main Preview Container (650 × 398 approx) */}
      <div className="rounded-[22px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-5 shadow-looply-lg">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-[var(--looply-color-border-default)] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-[var(--looply-color-text-primary)]">
              {PREVIEW_TABS.find((t) => t.id === activeTab)?.label}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--looply-color-status-success)_12%,var(--looply-color-bg-surface))] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--looply-color-status-success)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--looply-color-status-success)]" />
            {STATUS_PILL[activeTab]}
          </span>
        </div>

        {/* Mini sidebar + Mini main view */}
        <div className="mt-4 flex gap-4 min-h-[260px]">
          <nav aria-label="Demonstração do produto" className="w-32 shrink-0 space-y-1">
            <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--looply-color-text-muted)]">
              Agência Aurora
            </p>
            {PREVIEW_TABS.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  aria-pressed={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors ${
                    selected
                      ? "bg-[var(--looply-color-bg-subtle)] font-bold text-[var(--looply-color-text-primary)]"
                      : "text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)]/50 hover:text-[var(--looply-color-text-primary)]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 border-l border-[var(--looply-color-border-default)] pl-4">
            {activeTab === "overview" && (
              <div>
                <Eyebrow>Visão geral</Eyebrow>
                <p className="mt-0.5 text-[15px] font-bold text-[var(--looply-color-text-primary)]">
                  O que precisa da sua atenção hoje.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] p-2 text-center">
                    <span className="block text-base font-extrabold text-[var(--looply-color-text-primary)]">18</span>
                    <span className="text-[10px] text-[var(--looply-color-text-muted)]">Jobs ativos</span>
                  </div>
                  <div className="rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] p-2 text-center">
                    <span className="block text-base font-extrabold text-[var(--looply-color-action-primary)]">4</span>
                    <span className="text-[10px] text-[var(--looply-color-text-muted)]">Em aprovação</span>
                  </div>
                  <div className="rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] p-2 text-center">
                    <span className="block text-base font-extrabold text-[var(--looply-color-status-warning)]">3</span>
                    <span className="text-[10px] text-[var(--looply-color-text-muted)]">Vencem hoje</span>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="rounded-lg border border-[var(--looply-color-border-default)] p-2.5">
                    <p className="text-[12px] font-semibold text-[var(--looply-color-text-primary)]">
                      Campanha de lançamento · Aurora
                    </p>
                    <p className="text-[10.5px] text-[var(--looply-color-text-muted)]">
                      Entrega final · revisão pendente
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[var(--looply-color-border-default)] px-2.5 py-1.5 text-[11px] text-[var(--looply-color-text-secondary)]">
                    <span>14:00 · Revisão · Aurora</span>
                    <span className="rounded-full bg-[var(--looply-color-bg-subtle)] px-1.5 py-0.5 text-[9.5px] font-semibold text-[var(--looply-color-text-muted)]">
                      hoje
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "clients" && (
              <div>
                <Eyebrow>Clientes</Eyebrow>
                <p className="mt-0.5 text-[15px] font-bold text-[var(--looply-color-text-primary)]">
                  Quem precisa de atenção agora.
                </p>
                <div className="mt-3 space-y-1.5">
                  {[
                    { name: "Aurora Clínica", detail: "Ana Martins · 3 jobs", status: "Ativo" },
                    { name: "Mova Studio", detail: "Lucas Costa · 2 jobs", status: "Revisão" },
                    { name: "Nexo Educação", detail: "Natan Massuia · 1 job", status: "Hoje" },
                  ].map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center justify-between rounded-lg border border-[var(--looply-color-border-default)] px-3 py-1.5 text-[11.5px]"
                    >
                      <div>
                        <span className="block font-semibold text-[var(--looply-color-text-primary)]">{c.name}</span>
                        <span className="text-[10px] text-[var(--looply-color-text-muted)]">{c.detail}</span>
                      </div>
                      <span className="rounded-full bg-[var(--looply-color-bg-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--looply-color-text-secondary)]">
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-center text-[10.5px] text-[var(--looply-color-text-muted)]">
                  12 clientes ativos · 3 precisam de atenção
                </p>
              </div>
            )}

            {activeTab === "jobs" && (
              <div>
                <Eyebrow>Jobs</Eyebrow>
                <p className="mt-0.5 text-[15px] font-bold text-[var(--looply-color-text-primary)]">
                  Hoje, sem perder o contexto.
                </p>
                <div className="mt-3 space-y-1.5">
                  {[
                    { title: "Peças de agosto", meta: "Mova Studio · Lucas", status: "Produção" },
                    { title: "Landing institucional", meta: "Atlas · Natan", status: "Revisão" },
                    { title: "Kit de anúncios", meta: "Lume · Ana", status: "Aprovação" },
                  ].map((j) => (
                    <div
                      key={j.title}
                      className="flex items-center justify-between rounded-lg border border-[var(--looply-color-border-default)] px-3 py-1.5 text-[11.5px]"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="block truncate font-semibold text-[var(--looply-color-text-primary)]">{j.title}</span>
                        <span className="text-[10px] text-[var(--looply-color-text-muted)]">{j.meta}</span>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--looply-color-bg-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--looply-color-text-secondary)]">
                        {j.status}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-center text-[10.5px] text-[var(--looply-color-text-muted)]">
                  12 clientes · 8 jobs ativos · 3 aprovações
                </p>
              </div>
            )}

            {activeTab === "calendar" && (
              <div>
                <Eyebrow>Agenda</Eyebrow>
                <p className="mt-0.5 text-[15px] font-bold text-[var(--looply-color-text-primary)]">
                  Compromissos ligados ao trabalho.
                </p>
                <div className="mt-3 space-y-1.5">
                  {[
                    { time: "09:30", event: "Kickoff · Nexo", resp: "Ana Martins" },
                    { time: "14:00", event: "Revisão · Aurora", resp: "Lucas Costa" },
                    { time: "17:30", event: "Planejamento interno", resp: "Natan Massuia" },
                  ].map((item) => (
                    <div
                      key={item.time}
                      className="flex items-center justify-between rounded-lg border border-[var(--looply-color-border-default)] px-3 py-1.5 text-[11.5px]"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-[var(--looply-color-text-brand)]">{item.time}</span>
                        <span className="font-semibold text-[var(--looply-color-text-primary)]">{item.event}</span>
                      </div>
                      <span className="text-[10px] text-[var(--looply-color-text-muted)]">{item.resp}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-center text-[10.5px] text-[var(--looply-color-text-muted)]">
                  Próximo compromisso em 1 h 20 min
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Signal: Bottom Schedule Card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-3 -left-2 z-10 hidden items-center gap-2 rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-3 py-2 shadow-looply-md xl:flex"
      >
        <span className="font-bold text-[var(--looply-color-text-brand)] text-[11.5px]">14:30</span>
        <span className="text-[11.5px] font-semibold text-[var(--looply-color-text-primary)]">
          Reunião · Mova Studio
        </span>
      </div>
    </div>
  );
}

export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--looply-color-bg-canvas)]">
      {/* ── Desktop: Product Story (760 col / ~50% split) ── */}
      <aside className="hidden w-[52%] max-w-[760px] flex-col justify-between bg-[var(--looply-color-bg-inverse)] px-12 py-10 lg:flex">
        <Logo size={48} inverse />
        <div className="my-auto max-w-[650px]">
          <span className="inline-flex items-center rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase leading-4 tracking-[0.88px] text-inverse-secondary">
            Tudo em um só fluxo
          </span>
          <h1 className="mt-4 text-[38px] font-extrabold leading-[46px] tracking-[-0.66px] text-inverse">
            Seu trabalho continua sem perder o contexto.
          </h1>
          <p className="mt-3 max-w-[540px] text-[15px] leading-6 text-inverse-secondary">
            Clientes, jobs, agenda e aprovações conectados no mesmo fluxo.
          </p>
          <div className="mt-6">
            <AuthProductPreview />
          </div>
        </div>
        <div aria-hidden="true" className="h-4" />
      </aside>

      {/* ── Auth panel (680 col desktop / full mobile 390) ── */}
      <main className="flex min-h-screen flex-1 flex-col bg-[var(--looply-color-bg-surface)]">
        {/* Mobile: Compact Product Story Card (358 × 184 composition) */}
        <div className="px-4 pt-4 lg:hidden">
          <div className="mx-auto w-full max-w-[358px] rounded-[20px] bg-[var(--looply-color-bg-inverse)] p-4 shadow-looply-md">
            <div className="flex items-center justify-between">
              <Logo size={32} inverse />
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-inverse">
                Looply
              </span>
            </div>
            <p className="mt-4 text-[18px] font-extrabold leading-6 text-inverse">
              Trabalho em contexto.
            </p>
            <div aria-hidden="true" className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-inverse">
                Jobs
              </span>
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-inverse">
                Aprovar
              </span>
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-inverse">
                Agenda
              </span>
            </div>
          </div>
        </div>

        {/* Form column — 440px desktop / 358px mobile */}
        <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-12">
          <div className="w-full max-w-[440px]">{children}</div>
        </div>
      </main>
    </div>
  );
}

export { Eyebrow };

