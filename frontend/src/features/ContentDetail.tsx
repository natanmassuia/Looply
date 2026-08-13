import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  useContent,
  useWorkflowAction,
  useCreateVersion,
  ApiError,
} from "../lib/api";
import {
  FORMAT_LABEL,
  ROLE_LABEL,
  formatDate,
  formatDateTime,
} from "../lib/format";
import { Card, ErrorState, MediaPreview, PageHeader, Spinner } from "../components/common";
import StatusPill from "../components/StatusPill";
import { IconCheck, IconClock, IconLink, IconPlus } from "../components/Icons";
import type { ContentVersion } from "../lib/types";

export default function ContentDetail() {
  const { id = "" } = useParams();
  const { data: content, isLoading, isError, error, refetch } = useContent(id);

  const review = useWorkflowAction((cid) => `/api/contents/${cid}/review`);
  const sendApproval = useWorkflowAction((cid) => `/api/contents/${cid}/send-approval`);
  const publish = useWorkflowAction((cid) => `/api/contents/${cid}/publish`);
  const schedule = useWorkflowAction((cid) => `/api/contents/${cid}/schedule`);
  const createVersion = useCreateVersion(id);

  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showVersionForm, setShowVersionForm] = useState(false);

  const currentVersion: ContentVersion | undefined = useMemo(() => {
    if (!content?.versions?.length) return undefined;
    return content.versions[content.versions.length - 1];
  }, [content]);

  const latestApproval = content?.approvals?.[0];

  const run = async (
    mut: { mutateAsync: (args: { id: string; body?: unknown }) => Promise<unknown> },
    body?: unknown,
  ) => {
    setErr(null);
    try {
      return await mut.mutateAsync({ id, body });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Operação falhou");
      return null;
    }
  };

  if (isLoading) return <Spinner label="Carregando conteúdo…" />;
  if (isError) return <ErrorState message={(error as Error)?.message} />;
  if (!content || !currentVersion) return <ErrorState message="Conteúdo não encontrado." />;

  const onSendApproval = async () => {
    const res = (await run(sendApproval)) as { approvalUrl?: string } | null;
    if (res?.approvalUrl) setApprovalUrl(res.approvalUrl);
  };

  const status = content.status;
  const activeApprovalUrl =
    approvalUrl ??
    (latestApproval?.token ? `${window.location.origin}/approve/${latestApproval.token}` : null);

  return (
    <div className="mx-auto max-w-6xl px-6 py-7">
      <PageHeader
        title={content.title}
        crumbs={[{ label: "Conteúdos", to: "/contents" }, { label: content.title }]}
        actions={<StatusPill status={status} />}
      />

      {err && (
        <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: preview + content */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
              <Meta label="Cliente">
                <span
                  className="inline-flex items-center gap-1.5 font-medium text-slate-800"
                  style={{ color: content.client?.brandColor ?? undefined }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: content.client?.brandColor ?? "#64748b" }}
                  />
                  {content.client?.name}
                </span>
              </Meta>
              <Meta label="Formato">{FORMAT_LABEL[content.format]}</Meta>
              <Meta label="Canal">{content.channel ?? "—"}</Meta>
              <Meta label="Responsável">
                {content.responsible?.name ?? "—"}
                {content.responsible?.role
                  ? ` · ${ROLE_LABEL[content.responsible.role]}`
                  : ""}
              </Meta>
              <Meta label="Versão atual">v{currentVersion.versionNumber}</Meta>
              <Meta label="Publicação prevista">{formatDate(content.publicationTarget)}</Meta>
            </div>
          </Card>

          <Card>
            <MediaPreview
              url={currentVersion.mediaUrl}
              alt={content.title}
              className="mb-4 aspect-video w-full rounded-lg"
            />
            <h3 className="mb-1 text-sm font-semibold text-slate-700">Legenda</h3>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{currentVersion.caption}</p>
            {currentVersion.changeNote && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Nota da versão: {currentVersion.changeNote}
              </p>
            )}
          </Card>

          <VersionHistory versions={content.versions} />
        </div>

        {/* Right: actions */}
        <div className="space-y-6">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Ações</h3>

            {status === "DRAFT" && (
              <ActionButton
                loading={review.isPending}
                onClick={() => run(review)}
                label="Enviar para revisão"
              />
            )}

            {status === "IN_REVIEW" && (
              <ActionButton
                loading={sendApproval.isPending}
                onClick={onSendApproval}
                label="Enviar para aprovação do cliente"
              />
            )}

            {activeApprovalUrl && (status === "AWAITING_CLIENT" || status === "IN_REVIEW") && (
              <ApprovalLinkBox url={activeApprovalUrl} />
            )}

            {status === "AWAITING_CLIENT" && (
              <p className="mt-3 text-xs text-slate-500">
                Aguardando o cliente aprovar ou solicitar alterações pelo link público.
              </p>
            )}

            {status === "CHANGES_REQUESTED" && latestApproval?.feedback && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-rose-600">
                  Alteração solicitada
                </div>
                <p className="text-sm text-rose-800">{latestApproval.feedback}</p>
                {latestApproval.clientName && (
                  <div className="mt-2 text-xs text-rose-500">
                    — {latestApproval.clientName} · {formatDateTime(latestApproval.clientReviewedAt)}
                  </div>
                )}
              </div>
            )}

            {status === "CHANGES_REQUESTED" && (
              <>
                {!showVersionForm ? (
                  <ActionButton
                    onClick={() => setShowVersionForm(true)}
                    label="Criar nova versão"
                    icon={<IconPlus className="h-4 w-4" />}
                  />
                ) : (
                  <NewVersionForm
                    loading={createVersion.isPending}
                    onCancel={() => setShowVersionForm(false)}
                    onSubmit={async (caption, mediaUrl, changeNote) => {
                      const ok = await createVersion.mutateAsync({ caption, mediaUrl, changeNote });
                      if (ok) {
                        setShowVersionForm(false);
                        refetch();
                      }
                    }}
                  />
                )}
              </>
            )}

            {status === "APPROVED" && (
              <ScheduleForm
                loading={schedule.isPending}
                onSubmit={(iso) =>
                  run(schedule, { scheduledAt: iso }).then(() => undefined)
                }
              />
            )}

            {status === "SCHEDULED" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  <IconClock className="h-4 w-4" />
                  Agendado para {formatDateTime(content.scheduledAt)}
                </div>
                <ActionButton
                  loading={publish.isPending}
                  onClick={() => run(publish)}
                  label="Marcar como publicado"
                  icon={<IconCheck className="h-4 w-4" />}
                />
              </div>
            )}

            {status === "PUBLISHED" && (
              <div className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-700">
                <IconCheck className="h-4 w-4" />
                Publicado em {formatDateTime(content.publishedAt)}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  loading,
  icon,
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={loading} className="btn-primary w-full">
      {icon}
      {loading ? "Processando…" : label}
    </button>
  );
}

function ApprovalLinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700">
        <IconLink className="h-3.5 w-3.5" />
        Link de aprovação
      </div>
      <div className="truncate rounded bg-white px-2 py-1.5 font-mono text-xs text-slate-600">
        {url}
      </div>
      <div className="mt-2 flex gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="btn-secondary flex-1 text-xs">
          Abrir
        </a>
        <button onClick={copy} className="btn-secondary flex-1 text-xs">
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

function NewVersionForm({
  onSubmit,
  onCancel,
  loading,
}: {
  onSubmit: (caption: string, mediaUrl: string, changeNote: string) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [changeNote, setChangeNote] = useState("");
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3">
      <textarea
        className="input min-h-[90px]"
        placeholder="Nova legenda…"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />
      <input
        className="input"
        placeholder="URL da mídia (opcional)"
        value={mediaUrl}
        onChange={(e) => setMediaUrl(e.target.value)}
      />
      <input
        className="input"
        placeholder="Nota da versão (opcional)"
        value={changeNote}
        onChange={(e) => setChangeNote(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="btn-secondary flex-1 text-xs" onClick={onCancel}>
          Cancelar
        </button>
        <button
          className="btn-primary flex-1 text-xs"
          disabled={loading || !caption.trim()}
          onClick={() => onSubmit(caption.trim(), mediaUrl.trim(), changeNote.trim())}
        >
          {loading ? "Salvando…" : "Salvar v" + ""}
        </button>
      </div>
    </div>
  );
}

function ScheduleForm({
  onSubmit,
  loading,
}: {
  onSubmit: (iso: string) => void;
  loading?: boolean;
}) {
  const [dt, setDt] = useState("");
  return (
    <div className="space-y-2">
      <input
        type="datetime-local"
        className="input"
        value={dt}
        onChange={(e) => setDt(e.target.value)}
      />
      <button
        className="btn-primary w-full"
        disabled={loading || !dt}
        onClick={() => onSubmit(new Date(dt).toISOString())}
      >
        {loading ? "Agendando…" : "Agendar publicação"}
      </button>
    </div>
  );
}

function VersionHistory({ versions }: { versions: ContentVersion[] }) {
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Histórico de versões</h3>
      <ol className="space-y-3">
        {versions.map((v) => {
          const ap = v.approvals?.[0];
          return (
            <li key={v.id} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                v{v.versionNumber}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-700">
                    Versão {v.versionNumber}
                    {v.createdBy && (
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        · {v.createdBy.name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">{formatDateTime(v.createdAt)}</div>
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{v.caption}</p>
                {ap && (
                  <div
                    className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${
                      ap.status === "APPROVED"
                        ? "bg-emerald-50 text-emerald-700"
                        : ap.status === "CHANGES_REQUESTED"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {ap.status === "APPROVED"
                      ? "Aprovado pelo cliente"
                      : ap.status === "CHANGES_REQUESTED"
                        ? "Alteração solicitada"
                        : "Aguardando cliente"}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
