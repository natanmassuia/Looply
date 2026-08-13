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

  if (isLoading) return <Centered><Spinner label="Carregando…" /></Centered>;
  if (isError)
    return (
      <Centered>
        <ResultBox
          tone="error"
          title="Link inválido"
          description={(error as Error)?.message ?? "O link de aprovação não foi encontrado."}
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
      setErr(e instanceof ApiError ? e.message : "Não foi possível registrar.");
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
      setErr(e instanceof ApiError ? e.message : "Não foi possível registrar.");
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-2xl px-4 py-10">
        {/* Brand bar */}
        <div
          className="mb-6 flex items-center gap-3 rounded-xl px-5 py-4 text-white shadow-sm"
          style={{ backgroundColor: content.client?.brandColor ?? "#0f172a" }}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-lg font-black backdrop-blur">
            {content.client?.name?.slice(0, 1)}
          </div>
          <div>
            <div className="text-base font-bold leading-tight">{content.client?.name}</div>
            <div className="text-xs text-white/80">Revisão de conteúdo · Looply</div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h1 className="text-lg font-bold text-slate-900">{content.title}</h1>
            <div className="mt-1 text-sm text-slate-500">
              {FORMAT_LABEL[content.format]}
              {content.channel ? ` · ${content.channel}` : ""} · Versão {version?.versionNumber ?? 1}
            </div>
          </div>

          <MediaPreview
            url={version?.mediaUrl}
            alt={content.title}
            className="aspect-video w-full"
          />

          <div className="space-y-4 px-5 py-5">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Legenda
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{version?.caption}</p>
            </div>
            {content.publicationTarget && (
              <div className="text-sm text-slate-500">
                <span className="font-medium text-slate-600">Publicação prevista:</span>{" "}
                {formatDate(content.publicationTarget)}
              </div>
            )}

            {decided ? (
              <ResultBox
                tone={status === "APPROVED" ? "success" : "warn"}
                title={status === "APPROVED" ? "Conteúdo aprovado" : "Alteração registrada"}
                description={
                  status === "APPROVED"
                    ? "Obrigado! Já recebemos sua aprovação."
                    : feedback || data.feedback || "Já recebemos sua solicitação de alteração."
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
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button onClick={onApprove} disabled={approve.isPending} className="btn-primary">
                    <IconCheck className="h-4 w-4" />
                    {approve.isPending ? "Enviando…" : "Aprovar"}
                  </button>
                  <button onClick={() => setMode("changes")} className="btn-secondary">
                    <IconX className="h-4 w-4" />
                    Solicitar alteração
                  </button>
                </div>
                {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  className="input min-h-[110px]"
                  placeholder="Descreva a alteração que você gostaria…"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1" onClick={() => setMode("idle")}>
                    Voltar
                  </button>
                  <button className="btn-primary flex-1" disabled={requestChanges.isPending} onClick={onRequest}>
                    {requestChanges.isPending ? "Enviando…" : "Enviar alteração"}
                  </button>
                </div>
                {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Looply · revisão de conteúdo · {formatDateTime(data.createdAt ?? new Date().toISOString())}
        </p>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full items-center justify-center">{children}</div>;
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
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-rose-200 bg-rose-50 text-rose-800",
  } as const;
  return (
    <div className={`rounded-xl border px-4 py-4 ${tones[tone]}`}>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-sm opacity-90">{description}</p>
    </div>
  );
}
