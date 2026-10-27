import { useState } from "react";
import { useParams } from "react-router-dom";
import { useApproval, useApprovePublic, useRequestChangesPublic, ApiError } from "../lib/api";
import { FORMAT_LABEL, formatDate, formatDateTime } from "../lib/format";
import { MediaPreview, Spinner } from "../components/common";
import { IconCheck, IconX } from "../components/Icons";

export default function PublicApproval() {
  const { token = "" } = useParams();
  const { data, isLoading, isError, error } = useApproval(token);
  const approve = useApprovePublic(token);
  const requestChanges = useRequestChangesPublic(token);

  const [mode, setMode] = useState<"idle" | "changes">("idle");
  const [feedback, setFeedback] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (isLoading) return <Centered><Spinner label="Carregando demanda…" /></Centered>;
  if (isError)
    return (
      <Centered>
        <ResultBox
          tone="error"
          title="Link inválido"
          description={(error as Error)?.message ?? "O link de aprovação não foi encontrado ou expirou."}
        />
      </Centered>
    );
  if (!data) return null;

  const { content, version, status } = data;
  const decided = status === "APPROVED" || status === "CHANGES_REQUESTED";

  const onApprove = async () => {
    setErr(null);
    try {
      await approve.mutateAsync({ reviewerName: reviewerName || undefined });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Não foi possível registrar a aprovação.");
    }
  };
  const onRequest = async () => {
    setErr(null);
    if (!feedback.trim()) {
      setErr("Descreva a alteração solicitada.");
      return;
    }
    try {
      await requestChanges.mutateAsync({ feedback: feedback.trim(), reviewerName: reviewerName || undefined });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Não foi possível registrar a solicitação.");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--looply-color-bg-canvas)]">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {/* Brand header */}
        <div
          className="mb-8 flex items-center gap-3 rounded-xl px-5 py-4 text-white shadow-looply-md"
          style={{ backgroundColor: content.client?.brandColor ?? "#2a171f" }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-base font-black backdrop-blur-sm">
            {content.client?.name?.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="text-base font-bold leading-tight">{content.client?.name}</div>
            <div className="text-xs text-white/75">Revisão da demanda · Looply</div>
          </div>
        </div>

        {/* Content card */}
        <div className="card overflow-hidden">
          {/* Header */}
          <div className="border-b border-[var(--looply-color-border-default)] px-5 py-4 sm:px-6 sm:py-5">
            <h1 className="text-lg font-bold tracking-tight text-[var(--looply-color-text-primary)] sm:text-xl">{content.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--looply-color-text-muted)]">
              <span>{FORMAT_LABEL[content.format]}</span>
              {content.channel && (
                <>
                  <span className="text-[var(--looply-color-border-default)]">·</span>
                  <span>{content.channel}</span>
                </>
              )}
              <span className="text-[var(--looply-color-border-default)]">·</span>
              <span className="rounded-full bg-[var(--looply-color-bg-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--looply-color-text-primary)]">
                v{version?.versionNumber ?? 1}
              </span>
            </div>
          </div>

          {/* Media */}
          <MediaPreview
            url={version?.mediaUrl}
            alt={content.title}
            className="aspect-video w-full"
          />

          {/* Body */}
          <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
            {/* Caption */}
            <div>
              <div className="section-label mb-1.5">Descrição</div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--looply-color-text-primary)]">
                {version?.caption}
              </p>
            </div>

            {/* Publication date */}
            {content.publicationTarget && (
              <div className="flex items-center gap-2 text-sm text-[var(--looply-color-text-muted)]">
                <svg className="h-4 w-4 text-[var(--looply-color-text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="17" rx="2" />
                  <path d="M3 9h18M8 2v4M16 2v4" />
                </svg>
                <span className="font-medium text-[var(--looply-color-text-primary)]">Prazo:</span>{" "}
                {formatDate(content.publicationTarget)}
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-[var(--looply-color-border-default)]" />

            {/* Actions */}
            {decided ? (
              <ResultBox
                tone={status === "APPROVED" ? "success" : "warn"}
                title={status === "APPROVED" ? "Demanda aprovada" : "Alteração registrada"}
                description={
                  status === "APPROVED"
                    ? "Obrigado! Já recebemos sua aprovação e a equipe foi notificada."
                    : feedback || data.feedback || "Já recebemos sua solicitação de alteração. A equipe irá revisar."
                }
              />
            ) : mode === "idle" ? (
              <div className="space-y-3">
                <input
                  className="input"
                  placeholder="Seu nome (opcional)"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                />
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <button
                    onClick={onApprove}
                    disabled={approve.isPending}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--looply-color-status-success)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <IconCheck className="h-4 w-4" />
                    {approve.isPending ? "Enviando…" : "Aprovar"}
                  </button>
                  <button
                    onClick={() => setMode("changes")}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--looply-color-text-primary)] transition-all hover:bg-[var(--looply-color-bg-subtle)] active:scale-[0.98]"
                  >
                    <IconX className="h-4 w-4" />
                    Solicitar alteração
                  </button>
                </div>
                {err && (
                  <div className="rounded-lg border border-[var(--looply-color-status-danger)]/30 bg-[var(--looply-color-status-danger)]/10 px-3 py-2.5 text-sm text-[var(--looply-color-status-danger)]">{err}</div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  className="input min-h-[120px]"
                  placeholder="Descreva a alteração que você gostaria…"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1" onClick={() => setMode("idle")}>
                    Voltar
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--looply-color-action-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--looply-color-action-primary-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={requestChanges.isPending}
                    onClick={onRequest}
                  >
                    {requestChanges.isPending ? "Enviando…" : "Enviar alteração"}
                  </button>
                </div>
                {err && (
                  <div className="rounded-lg border border-[var(--looply-color-status-danger)]/30 bg-[var(--looply-color-status-danger)]/10 px-3 py-2.5 text-sm text-[var(--looply-color-status-danger)]">{err}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-[var(--looply-color-text-muted)]">
          Looply · revisão da demanda · {formatDateTime(data.createdAt ?? new Date().toISOString())}
        </p>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center px-4">{children}</div>;
}

function ResultBox({
  tone,
  title,
  description,
}: {
  tone: "success" | "warn" | "error";
  title: string;
  description: string;
}) {
  const tones = {
    success: "border-[var(--looply-color-status-success)]/30 bg-[var(--looply-color-status-success)]/10 text-[var(--looply-color-status-success)]",
    warn: "border-[var(--looply-color-status-warning)]/30 bg-[var(--looply-color-status-warning)]/10 text-[var(--looply-color-status-warning)]",
    error: "border-[var(--looply-color-status-danger)]/30 bg-[var(--looply-color-status-danger)]/10 text-[var(--looply-color-status-danger)]",
  } as const;
  return (
    <div className={`rounded-xl border px-4 py-4 ${tones[tone]}`}>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-sm opacity-90">{description}</p>
    </div>
  );
}
