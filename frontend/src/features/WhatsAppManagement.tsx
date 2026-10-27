import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useWhatsAppPhoneNumbers,
  useWhatsAppTemplates,
  useSendWhatsAppTemplate,
  type WhatsAppMessageTemplate,
} from "../lib/api";
import ModalOrSheet from "../components/ModalOrSheet";
import { MVP } from "../config/mvp";

function StatusBadge({ status }: { status: string }) {
  const normalized = status?.toUpperCase() || "";
  const isApproved =
    normalized === "APPROVED" ||
    normalized === "CONNECTED" ||
    normalized === "VERIFIED";
  const isRejected =
    normalized === "REJECTED" ||
    normalized === "DISCONNECTED" ||
    normalized === "FLAGGED";

  const dotClass = isApproved
    ? "bg-[var(--looply-color-status-success)]"
    : isRejected
    ? "bg-[var(--looply-color-status-danger)]"
    : "bg-[var(--looply-color-status-warning)]";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--looply-color-text-primary)]">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {status}
    </span>
  );
}

function QualityBadge({ quality }: { quality: string }) {
  const normalized = quality?.toUpperCase() || "";
  const dotClass =
    normalized === "GREEN" || normalized === "HIGH"
      ? "bg-[var(--looply-color-status-success)]"
      : normalized === "RED" || normalized === "LOW"
      ? "bg-[var(--looply-color-status-danger)]"
      : "bg-[var(--looply-color-status-warning)]";

  return (
    <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--looply-color-bg-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--looply-color-text-secondary)]">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {quality || "—"}
    </span>
  );
}

// ── Meta template helpers: narrow the opaque `components` into the parts we
// render, turn the technical slug into a readable name, and extract the text so
// operators see what they're about to send instead of a bare template id.
type TemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  buttons?: { type?: string; text?: string }[];
};

function parseComponents(components: unknown[]): TemplateComponent[] {
  return (components ?? []).filter(
    (c): c is TemplateComponent => typeof c === "object" && c !== null,
  );
}

function componentByType(components: unknown[], type: string): TemplateComponent | undefined {
  return parseComponents(components).find((c) => (c.type ?? "").toUpperCase() === type);
}

function prettyTemplateName(name: string): string {
  const base = name.replace(/_v\d+$/i, "").replace(/[_-]+/g, " ").trim();
  return base.replace(/\b\w/g, (m) => m.toUpperCase()) || name;
}

function templateBodyText(components: unknown[]): string {
  return componentByType(components, "BODY")?.text ?? "";
}

function TemplatePreview({ template }: { template: WhatsAppMessageTemplate }) {
  const header = componentByType(template.components, "HEADER");
  const body = componentByType(template.components, "BODY");
  const footer = componentByType(template.components, "FOOTER");
  const buttons = componentByType(template.components, "BUTTONS")?.buttons ?? [];
  const headerText = header?.format && header.format !== "TEXT" ? null : header?.text;

  return (
    <div className="rounded-[12px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] p-3">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--looply-color-text-muted)]">
        Prévia da mensagem
      </div>
      <div className="rounded-[10px] rounded-tl-[2px] bg-[var(--looply-color-bg-surface)] p-2.5 text-[13px] leading-snug text-[var(--looply-color-text-primary)] shadow-sm">
        {header?.format && header.format !== "TEXT" && (
          <div className="mb-1.5 rounded-[6px] bg-[var(--looply-color-bg-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--looply-color-text-muted)]">
            [{header.format}]
          </div>
        )}
        {headerText && <div className="mb-1 font-bold">{headerText}</div>}
        {body?.text ? (
          <div className="whitespace-pre-wrap">{body.text}</div>
        ) : (
          <div className="italic text-[var(--looply-color-text-muted)]">Sem corpo de texto</div>
        )}
        {footer?.text && (
          <div className="mt-1.5 text-[11px] text-[var(--looply-color-text-muted)]">{footer.text}</div>
        )}
      </div>
      {buttons.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {buttons.map((b, i) => (
            <div
              key={i}
              className="rounded-[8px] bg-[var(--looply-color-bg-surface)] px-2 py-1.5 text-center text-xs font-semibold text-[var(--looply-color-text-brand)] shadow-sm"
            >
              {b.text || "Botão"}
            </div>
          ))}
        </div>
      )}
      {(body?.text ?? "").includes("{{") && (
        <p className="mt-1.5 text-[10.5px] text-[var(--looply-color-text-muted)]">
          {"{{n}}"} são variáveis preenchidas no envio.
        </p>
      )}
    </div>
  );
}

function SendTemplateDialog({
  template,
  companyNumber,
  onClose,
}: {
  template: WhatsAppMessageTemplate;
  companyNumber: string | null;
  onClose: () => void;
}) {
  // MVP (pre-P0-A): sending is locked to the company's own number.
  const lockedTo = MVP.lockTemplateToSelf ? (companyNumber ?? "") : null;
  const [to, setTo] = useState(lockedTo ?? "");
  const sendMutation = useSendWhatsAppTemplate();

  const handleSend = () => {
    if (!to.trim()) return;
    sendMutation.mutate(
      {
        to: to.trim(),
        templateName: template.name,
        languageCode: template.language,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <ModalOrSheet
      isOpen={true}
      onClose={onClose}
      title="Enviar template"
      subtitle="Disparo ativo pelo WhatsApp oficial"
      maxWidth="max-w-md"
    >
      <div>
        {/* Selected Template Pill */}
        <div className="mb-3 flex items-center justify-between gap-3 rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] px-3.5 py-2.5">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--looply-color-text-muted)]">
              Modelo selecionado
            </div>
            <div className="mt-0.5 truncate text-sm font-bold text-[var(--looply-color-text-primary)]">
              {prettyTemplateName(template.name)}
            </div>
            <div className="truncate font-mono text-[10.5px] text-[var(--looply-color-text-muted)]">
              {template.name} · {template.language}
            </div>
          </div>
          <span className="shrink-0 rounded-[8px] bg-[color-mix(in_srgb,var(--looply-color-action-primary)_14%,transparent)] px-2 py-0.5 text-[10px] font-bold text-[var(--looply-color-text-primary)]">
            {template.category}
          </span>
        </div>

        {/* Message preview so the operator never sends blind */}
        <div className="mb-4">
          <TemplatePreview template={template} />
        </div>

        <label className="mb-1.5 block text-xs font-bold text-[var(--looply-color-text-primary)]">
          Número de destino (com código do país)
        </label>
        <input
          type="text"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          readOnly={lockedTo !== null}
          onKeyDown={(e) => {
            if (e.key === "Enter" && to.trim() && !sendMutation.isPending) {
              handleSend();
            }
          }}
          placeholder="5511999998888"
          autoFocus={lockedTo === null}
          className="mb-2 w-full rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] px-3.5 py-2.5 font-mono text-sm text-[var(--looply-color-text-primary)] placeholder:text-[var(--looply-color-text-muted)] focus:border-[var(--looply-color-action-primary)] focus:bg-[var(--looply-color-bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--looply-color-focus)] read-only:cursor-not-allowed read-only:opacity-70"
        />
        <p className="mb-4 text-[11px] text-[var(--looply-color-text-muted)]">
          {lockedTo !== null
            ? "Até o P0-A, o envio é restrito ao número da própria empresa."
            : "Informe apenas dígitos no padrão E.164 (ex.: 5511999998888)."}
        </p>

        <div className="mb-4 rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-coral-100)] p-3 text-xs text-[var(--looply-color-text-primary)]">
          <p className="font-semibold text-[var(--looply-color-text-primary)]">
            Aviso de tarifação Meta:
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--looply-color-text-secondary)]">
            O envio de modelos para contatos fora da janela de 24 horas inicia uma nova conversa tarifada de acordo com as regras da Meta.
          </p>
        </div>

        {sendMutation.isError && (
          <div className="mb-4 rounded-[10px] border border-[color-mix(in_srgb,var(--looply-color-status-danger)_25%,transparent)] bg-[color-mix(in_srgb,var(--looply-color-status-danger)_10%,transparent)] px-3 py-2 text-xs font-medium text-[var(--looply-color-status-danger)]">
            Falha ao enviar template. Verifique o número e tente novamente.
          </div>
        )}
        {sendMutation.isSuccess && (
          <div className="mb-4 rounded-[10px] border border-[color-mix(in_srgb,var(--looply-color-status-success)_25%,transparent)] bg-[color-mix(in_srgb,var(--looply-color-status-success)_10%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--looply-color-status-success)]">
            Template enviado com sucesso!
          </div>
        )}

        <div className="flex justify-end gap-2.5 border-t border-[var(--looply-color-border-default)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--looply-color-text-primary)] transition-colors hover:bg-[var(--looply-color-bg-subtle)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!to.trim() || sendMutation.isPending}
            className="cursor-pointer rounded-[10px] bg-[var(--looply-color-action-primary)] px-4 py-2 text-xs font-semibold text-[var(--looply-color-text-on-brand)] transition-colors hover:bg-[var(--looply-color-action-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sendMutation.isPending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </ModalOrSheet>
  );
}

export default function WhatsAppManagement() {
  const {
    data: phoneData,
    isLoading: loadingPhones,
    isError: phoneError,
  } = useWhatsAppPhoneNumbers();
  const {
    data: templateData,
    isLoading: loadingTemplates,
    isError: templateError,
  } = useWhatsAppTemplates();
  const [sendingTemplate, setSendingTemplate] =
    useState<WhatsAppMessageTemplate | null>(null);

  const phoneNumbers = phoneData?.phoneNumbers ?? [];
  const templates = templateData?.templates ?? [];
  const approvedCount = templates.filter((t) => t.status === "APPROVED").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 md:py-8">
      {/* Page Header (Figma 12.2 — Integrations & WhatsApp) */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="typo-eyebrow mb-1 text-[10.5px] tracking-[0.08em] text-[var(--looply-color-text-muted)]">
            INTEGRAÇÃO WHATSAPP OFICIAL
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--looply-color-text-primary)] sm:text-2xl">
            WhatsApp Business
          </h1>
          <p className="mt-1 text-xs text-[var(--looply-color-text-secondary)] sm:text-sm">
            Números de telefone e modelos de mensagem da conta WhatsApp Business.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--looply-color-text-primary)]">
            <span className="h-2 w-2 rounded-full bg-[var(--looply-color-status-success)]" />
            WhatsApp oficial · Conectado
          </span>
          <Link
            to="/inbox"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--looply-color-text-primary)] transition-colors hover:bg-[var(--looply-color-bg-subtle)]"
          >
            Abrir Conversas →
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[12px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--looply-color-text-muted)]">
            Números conectados
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[var(--looply-color-text-primary)]">
              {loadingPhones ? "—" : phoneNumbers.length}
            </span>
            <span className="rounded-full bg-[color-mix(in_srgb,var(--looply-color-action-primary)_14%,transparent)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--looply-color-text-primary)]">
              WABA Ativa
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--looply-color-text-secondary)]">
            Números registrados na Graph API
          </p>
        </div>

        <div className="rounded-[12px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--looply-color-text-muted)]">
            Modelos aprovados
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[var(--looply-color-text-primary)]">
              {loadingTemplates ? "—" : approvedCount}
            </span>
            <span className="rounded-full bg-[var(--looply-color-bg-subtle)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--looply-color-text-secondary)]">
              {templates.length} total
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--looply-color-text-secondary)]">
            Prontos para envio ativo de mensagens
          </p>
        </div>

        <div className="rounded-[12px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-[var(--looply-color-text-muted)]">
            Webhook & Inbox IA
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-base font-bold text-[var(--looply-color-text-primary)]">
              Tempo real
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--looply-color-bg-subtle)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--looply-color-status-success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--looply-color-status-success)]" />
              Ativo
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--looply-color-text-secondary)]">
            Recebimento e resposta automática via Looply AI
          </p>
        </div>
      </div>

      {/* Phone Numbers Section (Figma 03.12 — Table & Data Row) */}
      <section className="overflow-hidden rounded-[14px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)]">
        <div className="flex flex-col justify-between gap-2 border-b border-[var(--looply-color-border-default)] px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-bold text-[var(--looply-color-text-primary)] sm:text-base">
              Números de telefone
            </h2>
            <p className="mt-0.5 text-xs text-[var(--looply-color-text-secondary)]">
              Números vinculados à conta WhatsApp Business (WABA) na Meta.
            </p>
          </div>
          <span className="self-start rounded-[8px] bg-[var(--looply-color-bg-subtle)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--looply-color-text-secondary)] sm:self-center">
            whatsapp_business_management
          </span>
        </div>

        {loadingPhones ? (
          <div className="flex items-center justify-center p-8 text-xs text-[var(--looply-color-text-muted)]">
            <svg
              className="mr-2 h-4 w-4 animate-spin text-[var(--looply-color-action-primary)]"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth={4}
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Carregando...
          </div>
        ) : phoneError ? (
          <div className="p-6 text-sm text-[var(--looply-color-status-danger)]">
            Erro ao carregar números. Verifique as credenciais da API.
          </div>
        ) : phoneNumbers.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--looply-color-text-muted)]">
            Nenhum número encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--looply-color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 text-left">Número</th>
                  <th className="px-5 py-3 text-left">Nome verificado</th>
                  <th className="px-5 py-3 text-left">Qualidade</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--looply-color-border-default)]">
                {phoneNumbers.map((pn) => (
                  <tr
                    key={pn.id}
                    className="text-[var(--looply-color-text-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--looply-color-bg-subtle)_60%,transparent)]"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-bold">
                      {pn.display_phone_number}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-semibold">
                      {pn.verified_name}
                    </td>
                    <td className="px-5 py-3.5">
                      <QualityBadge quality={pn.quality_rating} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={pn.status} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-[var(--looply-color-text-muted)]">
                      {pn.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Message Templates Section (Figma 03.12 — Table & Data Row) */}
      <section className="overflow-hidden rounded-[14px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)]">
        <div className="flex flex-col justify-between gap-2 border-b border-[var(--looply-color-border-default)] px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-bold text-[var(--looply-color-text-primary)] sm:text-base">
              Modelos de mensagem
            </h2>
            <p className="mt-0.5 text-xs text-[var(--looply-color-text-secondary)]">
              Templates HSM aprovados na conta Meta para início de conversa e notificações.
            </p>
          </div>
          <span className="self-start rounded-[8px] bg-[var(--looply-color-bg-subtle)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--looply-color-text-secondary)] sm:self-center">
            whatsapp_business_messaging
          </span>
        </div>

        {loadingTemplates ? (
          <div className="flex items-center justify-center p-8 text-xs text-[var(--looply-color-text-muted)]">
            <svg
              className="mr-2 h-4 w-4 animate-spin text-[var(--looply-color-action-primary)]"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth={4}
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Carregando...
          </div>
        ) : templateError ? (
          <div className="p-6 text-sm text-[var(--looply-color-status-danger)]">
            Erro ao carregar templates. Verifique as credenciais da API.
          </div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--looply-color-text-muted)]">
            Nenhum template encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--looply-color-text-muted)]">
                <tr>
                  <th className="px-5 py-3 text-left">Nome</th>
                  <th className="px-5 py-3 text-left">Mensagem</th>
                  <th className="px-5 py-3 text-left">Idioma</th>
                  <th className="px-5 py-3 text-left">Categoria</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--looply-color-border-default)]">
                {templates.map((t) => (
                  <tr
                    key={`${t.name}-${t.language}`}
                    className="text-[var(--looply-color-text-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--looply-color-bg-subtle)_60%,transparent)]"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-[var(--looply-color-text-primary)]">
                        {prettyTemplateName(t.name)}
                      </div>
                      <div className="font-mono text-[10.5px] text-[var(--looply-color-text-muted)]">
                        {t.name}
                      </div>
                    </td>
                    <td className="max-w-[280px] px-5 py-3.5">
                      <span className="block truncate text-xs text-[var(--looply-color-text-secondary)]">
                        {templateBodyText(t.components) || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[var(--looply-color-text-secondary)]">
                      {t.language}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="rounded-[8px] bg-[color-mix(in_srgb,var(--looply-color-action-primary)_14%,transparent)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--looply-color-text-primary)]">
                        {t.category}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {t.status === "APPROVED" && (
                        <button
                          type="button"
                          onClick={() => setSendingTemplate(t)}
                          className="cursor-pointer rounded-[10px] bg-[var(--looply-color-action-primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--looply-color-text-on-brand)] transition-colors hover:bg-[var(--looply-color-action-primary-hover)]"
                        >
                          Enviar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {sendingTemplate && (
        <SendTemplateDialog
          template={sendingTemplate}
          companyNumber={phoneNumbers[0]?.display_phone_number ?? null}
          onClose={() => setSendingTemplate(null)}
        />
      )}
    </div>
  );
}
