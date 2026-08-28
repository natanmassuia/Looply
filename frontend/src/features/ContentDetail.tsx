import { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  useContent,
  useClients,
  useWorkflowAction,
  useCreateVersion,
  useUpdateJob,
  useUngroupContent,
  useCancelDemand,
  useJobFiles,
  useUploadJobAttachment,
  useDownloadJobFile,
  useDeleteJobFile,
  useJobActivity,
  useJobActivityPage,
  ApiError,
} from "../lib/api";
import {
  FORMAT_LABEL,
  ROLE_LABEL,
  formatBytes,
  formatDate,
  formatDateTime,
  relativeTime,
} from "../lib/format";
import { Card, ErrorState, MediaPreview, PageHeader, Spinner } from "../components/common";
import ModalOrSheet from "../components/ModalOrSheet";
import StatusPill from "../components/StatusPill";
import {
  IconCheck,
  IconClock,
  IconLink,
  IconPlus,
  IconSend,
  IconEye,
  IconEdit,
  IconX,
  IconFileText,
  IconTrash,
} from "../components/Icons";
import type { ActivityType, ContentVersion, JobActivity } from "../lib/types";

export default function ContentDetail() {
  const { id = "" } = useParams();
  const { data: content, isLoading, isError, error, refetch } = useContent(id);
  const { data: clients } = useClients();

  const review = useWorkflowAction((cid) => `/api/contents/${cid}/review`);
  const sendApproval = useWorkflowAction((cid) => `/api/contents/${cid}/send-approval`);
  const publish = useWorkflowAction((cid) => `/api/contents/${cid}/publish`);
  const schedule = useWorkflowAction((cid) => `/api/contents/${cid}/schedule`);
  const createVersion = useCreateVersion(id);
  const updateJob = useUpdateJob();
  const ungroupMutation = useUngroupContent();

  const { data: jobFiles, isLoading: filesLoading } = useJobFiles(id);
  const uploadAttachment = useUploadJobAttachment(id);
  const downloadFile = useDownloadJobFile();
  const deleteFile = useDeleteJobFile(id);

  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const cancelDemand = useCancelDemand();

  // Edit metadata modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editSuccessNotice, setEditSuccessNotice] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    clientId: "",
    notes: "",
    publicationTarget: "",
  });

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

  const openEdit = () => {
    if (!content) return;
    setEditErr(null);
    setEditForm({
      title: content.title,
      clientId: content.clientId,
      notes: content.notes ?? "",
      publicationTarget: content.publicationTarget
        ? new Date(content.publicationTarget).toISOString().slice(0, 10)
        : "",
    });
    setShowEditModal(true);
  };

  const saveJobEdit = async () => {
    if (!content) return;
    setEditErr(null);
    if (!editForm.title.trim()) {
      setEditErr("Informe o título da demanda.");
      return;
    }

    try {
      await updateJob.mutateAsync({
        id: content.id,
        body: {
          title: editForm.title.trim(),
          clientId: editForm.clientId || undefined,
          notes: editForm.notes || undefined,
          publicationTarget: editForm.publicationTarget
            ? new Date(`${editForm.publicationTarget}T12:00:00Z`).toISOString()
            : null,
        },
      });
      setShowEditModal(false);
      setEditSuccessNotice("Detalhes da demanda atualizados com sucesso.");
      setTimeout(() => setEditSuccessNotice(null), 4000);
      refetch();
    } catch (e) {
      setEditErr(e instanceof ApiError ? e.message : "Falha ao atualizar detalhes da demanda.");
    }
  };

  const handleUngroup = async () => {
    if (!content) return;
    setErr(null);
    try {
      await ungroupMutation.mutateAsync(content.id);
      setEditSuccessNotice("Demanda desagrupada com sucesso.");
      setTimeout(() => setEditSuccessNotice(null), 4000);
      refetch();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Falha ao desagrupar demanda.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !content) return;
    setUploadError(null);

    if (file.size > 50 * 1024 * 1024) {
      setUploadError("O arquivo excede o limite máximo permitido de 50MB.");
      e.target.value = "";
      return;
    }

    try {
      await uploadAttachment.mutateAsync(file);
      setEditSuccessNotice(`Arquivo "${file.name}" enviado com sucesso.`);
      setTimeout(() => setEditSuccessNotice(null), 4000);
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Falha no upload do arquivo.");
    } finally {
      e.target.value = "";
    }
  };

  if (isLoading) return <Spinner label="Carregando demanda…" />;
  if (isError) return <ErrorState message={(error as Error)?.message} />;
  if (!content || !currentVersion) return <ErrorState message="Demanda não encontrada." />;

  const onSendApproval = async () => {
    const res = (await run(sendApproval)) as { approvalUrl?: string } | null;
    if (res?.approvalUrl) setApprovalUrl(res.approvalUrl);
  };

  const status = content.status;
  const isCancelled = content.lifecycleStatus === "CANCELLED";
  const activeApprovalUrl =
    approvalUrl ??
    (latestApproval?.token ? `${window.location.origin}/approve/${latestApproval.token}` : null);

  return (
    <div>
      <PageHeader
        title={content.title}
        subtitle={`${FORMAT_LABEL[content.format]} · ${content.client?.name} · Versão ${currentVersion.versionNumber}`}
        crumbs={[{ label: "Demandas", to: "/contents" }, { label: content.title }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary btn-sm flex items-center gap-1.5"
              onClick={openEdit}
            >
              <IconEdit className="h-3.5 w-3.5" />
              <span>Editar</span>
            </button>
            <StatusPill status={status} />
          </div>
        }
      />

      {editSuccessNotice && (
        <div className="mb-4 rounded-lg bg-[var(--looply-color-status-success)]/10 px-3 py-2.5 text-sm text-[var(--looply-color-status-success)]">
          {editSuccessNotice}
        </div>
      )}

      {err && (
        <div className="mb-4 rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2.5 text-sm text-[var(--looply-color-status-danger)]">
          {err}
        </div>
      )}

      {/* Cancelled state banner */}
      {isCancelled && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-[var(--looply-color-status-danger)]/20 bg-[var(--looply-color-status-danger)]/10 px-3.5 py-2.5 text-sm font-medium text-[var(--looply-color-status-danger)]">
          <IconX className="h-4 w-4 shrink-0" />
          Esta demanda foi cancelada e não faz mais parte do fluxo ativo. Histórico e arquivos
          permanecem disponíveis.
        </div>
      )}

      {/* Grouped state banner */}
      {content.parentId && (
        <div className="mb-5 flex flex-col gap-2 rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between text-xs text-[var(--looply-color-text-muted)]">
          <span>Este conteúdo faz parte de um agrupamento de demandas.</span>
          <button
            type="button"
            className="btn-ghost btn-sm text-xs font-medium text-[var(--looply-color-action-primary)] hover:bg-[var(--looply-color-action-primary)]/10 w-fit"
            disabled={ungroupMutation.isPending}
            onClick={handleUngroup}
          >
            {ungroupMutation.isPending ? "Desagrupando…" : "Desagrupar demanda"}
          </button>
        </div>
      )}

      {/* Edit Demand Details Modal / Bottom Sheet */}
      <ModalOrSheet
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar detalhes da demanda"
        subtitle="Atualize os dados e notas operacionais desta demanda"
        maxWidth="max-w-lg"
      >
        <div className="space-y-3.5">
          <div>
            <label className="label">Título</label>
            <input
              className="input"
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Cliente</label>
            <select
              className="input"
              value={editForm.clientId}
              onChange={(e) => setEditForm((f) => ({ ...f, clientId: e.target.value }))}
            >
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Publicação prevista</label>
            <input
              className="input"
              type="date"
              value={editForm.publicationTarget}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, publicationTarget: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="label">Notas internas</label>
            <textarea
              className="input min-h-[80px] resize-none"
              value={editForm.notes}
              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Observações e notas sobre esta demanda…"
            />
          </div>
          {editErr && (
            <div className="rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-sm text-[var(--looply-color-status-danger)]">
              {editErr}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-[var(--looply-color-border-default)] pt-4">
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={updateJob.isPending}
              onClick={() => setShowEditModal(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={updateJob.isPending}
              onClick={saveJobEdit}
            >
              {updateJob.isPending ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </div>
      </ModalOrSheet>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: preview + content (~65%) */}
        <div className="space-y-5 lg:col-span-3">
          {/* Content preview */}
          <Card>
            <h3 className="section-title mb-3">Pré-visualização</h3>
            <MediaPreview
              url={currentVersion.mediaUrl}
              alt={content.title}
              className="mb-4 aspect-video w-full rounded-lg"
            />
            <div className="space-y-3">
              <div>
                <div className="section-label mb-1.5">Legenda</div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--looply-color-text-primary)]">
                  {currentVersion.caption}
                </p>
              </div>
              {currentVersion.changeNote && (
                <div className="rounded-lg bg-[var(--looply-color-bg-subtle)] px-3 py-2.5 text-xs text-[var(--looply-color-text-muted)]">
                  <span className="font-medium">Nota da versão:</span> {currentVersion.changeNote}
                </div>
              )}
            </div>
          </Card>

          {/* Metadata card */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="section-title">Detalhes</h3>
              <button
                type="button"
                className="btn-ghost btn-sm flex items-center gap-1 text-xs"
                onClick={openEdit}
              >
                <IconEdit className="h-3.5 w-3.5" />
                <span>Editar</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <Meta label="Cliente">
                <span
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--looply-color-text-primary)]"
                  style={{ color: content.client?.brandColor ?? undefined }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        content.client?.brandColor ?? "var(--looply-color-text-muted)",
                    }}
                  />
                  {content.client?.name}
                </span>
              </Meta>
              <Meta label="Formato">{FORMAT_LABEL[content.format]}</Meta>
              <Meta label="Canal">{content.channel ?? "—"}</Meta>
              <Meta label="Responsável">
                {content.responsible?.name ?? "—"}
                {content.responsible?.role ? ` · ${ROLE_LABEL[content.responsible.role]}` : ""}
              </Meta>
              <Meta label="Versão">v{currentVersion.versionNumber}</Meta>
              <Meta label="Publicação prevista">{formatDate(content.publicationTarget)}</Meta>
            </div>
            {content.notes && (
              <div className="mt-4 border-t border-[var(--looply-color-border-default)] pt-3">
                <div className="section-label mb-1 text-xs text-[var(--looply-color-text-muted)]">
                  Notas
                </div>
                <p className="text-xs text-[var(--looply-color-text-primary)] whitespace-pre-wrap">
                  {content.notes}
                </p>
              </div>
            )}
          </Card>

          {/* Files & Attachments card (B5) */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="section-title">Arquivos e Anexos ({jobFiles?.files?.length ?? 0})</h3>
              <label className="btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer">
                <IconPlus className="h-3.5 w-3.5" />
                <span>{uploadAttachment.isPending ? "Enviando…" : "Enviar arquivo"}</span>
                <input
                  type="file"
                  className="hidden"
                  disabled={uploadAttachment.isPending}
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            {uploadError && (
              <div className="mb-3 rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-xs text-[var(--looply-color-status-danger)]">
                {uploadError}
              </div>
            )}

            {filesLoading ? (
              <div className="py-2 text-xs text-[var(--looply-color-text-muted)]">Carregando arquivos…</div>
            ) : !jobFiles?.files || jobFiles.files.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--looply-color-border-default)] p-4 text-center text-xs text-[var(--looply-color-text-muted)]">
                Nenhum arquivo anexado a esta demanda. Clique em "Enviar arquivo" para fazer upload.
              </div>
            ) : (
              <div className="divide-y divide-[var(--looply-color-border-default)]">
                {jobFiles.files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between py-2.5 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <IconFileText className="h-4 w-4 shrink-0 text-[var(--looply-color-text-muted)]" />
                      <div className="min-w-0 truncate">
                        <div className="font-medium text-[var(--looply-color-text-primary)] truncate">
                          {file.originalName}
                        </div>
                        <div className="text-[11px] text-[var(--looply-color-text-muted)]">
                          {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-[var(--looply-color-action-primary)] hover:underline"
                        onClick={async () => {
                          try {
                            const res = await downloadFile.mutateAsync(file.id);
                            if (res?.url) {
                              window.open(res.url, "_blank", "noopener,noreferrer");
                            }
                          } catch (e) {
                            setErr(e instanceof ApiError ? e.message : "Falha ao gerar link de download.");
                          }
                        }}
                      >
                        Baixar
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm p-1 text-[var(--looply-color-status-danger)] hover:bg-[var(--looply-color-status-danger)]/10"
                        aria-label={`Excluir ${file.originalName}`}
                        onClick={async () => {
                          try {
                            await deleteFile.mutateAsync(file.id);
                          } catch (e) {
                            setErr(e instanceof ApiError ? e.message : "Falha ao excluir anexo.");
                          }
                        }}
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <VersionHistory versions={content.versions} />
        </div>

        {/* Right: actions + activity feed (~35%) */}
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <h3 className="section-title mb-4">Ações</h3>

            {!isCancelled && status === "DRAFT" && (
              <ActionButton
                loading={review.isPending}
                onClick={() => run(review)}
                label="Enviar para revisão"
                icon={<IconSend className="h-4 w-4" />}
              />
            )}

            {!isCancelled && status === "IN_REVIEW" && (
              <ActionButton
                loading={sendApproval.isPending}
                onClick={onSendApproval}
                label="Enviar para aprovação do cliente"
                icon={<IconSend className="h-4 w-4" />}
              />
            )}

            {!isCancelled && activeApprovalUrl && (status === "AWAITING_CLIENT" || status === "IN_REVIEW") && (
              <ApprovalLinkBox url={activeApprovalUrl} />
            )}

            {!isCancelled && status === "AWAITING_CLIENT" && (
              <div className="flex items-start gap-2 rounded-lg bg-[var(--looply-color-status-info)]/10 px-3 py-2.5 text-sm text-[var(--looply-color-status-info)]">
                <IconClock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Aguardando o cliente aprovar ou solicitar alterações pelo link público.</span>
              </div>
            )}

            {!isCancelled && status === "CHANGES_REQUESTED" && latestApproval?.feedback && (
              <div className="rounded-lg border border-[var(--looply-color-status-danger)]/20 bg-[var(--looply-color-status-danger)]/10 p-3">
                <div className="section-label mb-1.5 text-[var(--looply-color-status-danger)]">
                  Alteração solicitada
                </div>
                <p className="text-sm text-[var(--looply-color-status-danger)]/90">
                  {latestApproval.feedback}
                </p>
                {latestApproval.clientName && (
                  <div className="mt-2 text-xs text-[var(--looply-color-status-danger)]/60">
                    — {latestApproval.clientName} · {formatDateTime(latestApproval.clientReviewedAt)}
                  </div>
                )}
              </div>
            )}

            {!isCancelled && status === "CHANGES_REQUESTED" && (
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
                      const ok = await createVersion.mutateAsync({
                        caption,
                        mediaUrl,
                        changeNote,
                      });
                      if (ok) {
                        setShowVersionForm(false);
                        refetch();
                      }
                    }}
                  />
                )}
              </>
            )}

            {!isCancelled && status === "APPROVED" && (
              <ScheduleForm
                loading={schedule.isPending}
                onSubmit={(iso) => run(schedule, { scheduledAt: iso }).then(() => undefined)}
              />
            )}

            {!isCancelled && status === "SCHEDULED" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-[var(--looply-color-action-primary)]/10 px-3 py-2.5 text-sm text-[var(--looply-color-action-primary)]">
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

            {!isCancelled && status === "PUBLISHED" && (
              <div className="flex items-center gap-2 rounded-lg bg-[var(--looply-color-status-success)]/10 px-3 py-2.5 text-sm text-[var(--looply-color-status-success)]">
                <IconCheck className="h-4 w-4" />
                Publicado em {formatDateTime(content.publishedAt)}
              </div>
            )}

            {!isCancelled && (
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(true)}
                disabled={cancelDemand.isPending}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--looply-color-status-danger)]/30 px-3 py-2 text-[12.5px] font-medium text-[var(--looply-color-status-danger)] transition-colors hover:bg-[var(--looply-color-status-danger)]/10 disabled:opacity-50"
              >
                <IconX className="h-3.5 w-3.5" />
                {cancelDemand.isPending ? "Cancelando…" : "Cancelar demanda"}
              </button>
            )}
          </Card>

          {/* Job Activity Feed (B6) */}
          <JobActivityTimeline jobId={content.id} responsibleName={content.responsible?.name} />
        </div>
      </div>

      {/* Cancel demand confirmation */}
      <ModalOrSheet
        isOpen={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        title="Cancelar demanda"
        subtitle="Esta ação não pode ser desfeita."
        maxWidth="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--looply-color-text-muted)]">
            A demanda <strong className="text-[var(--looply-color-text-primary)]">{content.title}</strong> será
            cancelada e removida do fluxo ativo. O histórico, as versões e os arquivos serão preservados.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmCancelOpen(false)}
            >
              Voltar
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={cancelDemand.isPending}
              onClick={async () => {
                try {
                  await cancelDemand.mutateAsync(content.id);
                  setConfirmCancelOpen(false);
                  refetch();
                } catch (e) {
                  setErr(e instanceof ApiError ? e.message : "Falha ao cancelar demanda.");
                  setConfirmCancelOpen(false);
                }
              }}
            >
              {cancelDemand.isPending ? "Cancelando…" : "Cancelar demanda"}
            </button>
          </div>
        </div>
      </ModalOrSheet>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="section-label mb-1 text-xs text-[var(--looply-color-text-muted)]">{label}</div>
      <div className="font-medium text-[var(--looply-color-text-primary)]">{children}</div>
    </div>
  );
}

function ActionButton({
  onClick,
  label,
  icon,
  loading,
}: {
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      className="btn-primary w-full justify-center"
      disabled={loading}
      onClick={onClick}
    >
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
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="rounded-lg border border-[var(--looply-color-action-primary)]/20 bg-[var(--looply-color-action-primary)]/10 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--looply-color-action-primary)]">
          <IconLink className="h-3.5 w-3.5" />
          Link de aprovação
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium text-[var(--looply-color-action-primary)] hover:underline"
        >
          <IconEye className="h-3.5 w-3.5" />
          Abrir
        </a>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          readOnly
          value={url}
          className="input flex-1 bg-[var(--looply-color-bg-surface)] text-xs"
        />
        <button className="btn-secondary btn-sm shrink-0" onClick={copy}>
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
  onSubmit: (caption: string, mediaUrl?: string, changeNote?: string) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}) {
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!caption.trim()) {
      setErr("A legenda é obrigatória.");
      return;
    }
    await onSubmit(caption.trim(), mediaUrl.trim() || undefined, changeNote.trim() || undefined);
  };

  return (
    <div className="space-y-3 rounded-lg border border-[var(--looply-color-border-default)] p-3.5">
      <div className="section-label">Nova versão</div>
      <div>
        <label className="label">Legenda *</label>
        <textarea
          className="input min-h-[90px] resize-none text-sm"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Legenda atualizada…"
        />
      </div>
      <div>
        <label className="label">URL da mídia (opcional)</label>
        <input
          className="input text-sm"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>
      <div>
        <label className="label">O que mudou? (opcional)</label>
        <input
          className="input text-sm"
          value={changeNote}
          onChange={(e) => setChangeNote(e.target.value)}
          placeholder="Ex.: Ajustado contraste e texto da headline"
        />
      </div>
      {err && (
        <div className="rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-xs text-[var(--looply-color-status-danger)]">
          {err}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button className="btn-secondary btn-sm" onClick={onCancel} disabled={loading}>
          Cancelar
        </button>
        <button className="btn-primary btn-sm" onClick={submit} disabled={loading}>
          {loading ? "Criando…" : "Salvar versão"}
        </button>
      </div>
    </div>
  );
}

function ScheduleForm({
  onSubmit,
  loading,
}: {
  onSubmit: (iso: string) => Promise<void>;
  loading: boolean;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("12:00");
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!date) {
      setErr("Escolha uma data.");
      return;
    }
    const iso = new Date(`${date}T${time || "12:00"}:00`).toISOString();
    await onSubmit(iso);
  };

  return (
    <div className="space-y-3">
      <div className="section-label">Agendar publicação</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Data</label>
          <input
            type="date"
            className="input text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Horário</label>
          <input
            type="time"
            className="input text-sm"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>
      {err && (
        <div className="rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-xs text-[var(--looply-color-status-danger)]">
          {err}
        </div>
      )}
      <button className="btn-primary w-full justify-center" disabled={loading} onClick={submit}>
        <IconClock className="h-4 w-4" />
        {loading ? "Agendando…" : "Confirmar agendamento"}
      </button>
    </div>
  );
}

// A1 (auditoria): mídia com URL que não seja http/https (ex.: javascript:
// gravado antes da validação de esquema) não vira link clicável.
function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function VersionHistory({ versions }: { versions?: ContentVersion[] }) {
  if (!versions || versions.length === 0) return null;
  const sorted = [...versions].reverse();

  return (
    <Card>
      <h3 className="section-title mb-4">Histórico de versões ({versions.length})</h3>
      <div className="space-y-3">
        {sorted.map((v) => (
          <div
            key={v.id}
            className="flex items-start justify-between rounded-lg border border-[var(--looply-color-border-default)] p-3 text-xs"
          >
            <div>
              <div className="font-semibold text-[var(--looply-color-text-primary)]">
                Versão {v.versionNumber}
              </div>
              <div className="text-[var(--looply-color-text-muted)]">
                {formatDateTime(v.createdAt)}
                {v.createdBy?.name ? ` · por ${v.createdBy.name}` : ""}
              </div>
              {v.changeNote && (
                <div className="mt-1 text-[var(--looply-color-text-muted)] italic">
                  "{v.changeNote}"
                </div>
              )}
            </div>
            {v.mediaUrl && safeHref(v.mediaUrl) ? (
              <a
                href={safeHref(v.mediaUrl) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost btn-sm text-[var(--looply-color-action-primary)] hover:underline"
              >
                Ver mídia
              </a>
            ) : v.mediaUrl ? (
              <span className="btn-ghost btn-sm text-[var(--looply-color-text-muted)] cursor-default">
                Mídia com URL inválida
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Job Activity Timeline (B6) ──────────────────────────────────────────────
function activityCopy(type: ActivityType): { title: string; defaultActor: string } {
  switch (type) {
    case "JOB_CREATED":
      return { title: "criou esta demanda", defaultActor: "Sistema" };
    case "JOB_UPDATED":
      return { title: "atualizou os detalhes da demanda", defaultActor: "Membro da equipe" };
    case "JOB_STAGE_CHANGED":
      return { title: "alterou a etapa da demanda", defaultActor: "Membro da equipe" };
    case "JOB_COMPLETED":
      return { title: "marcou a demanda como concluída", defaultActor: "Membro da equipe" };
    case "JOB_CANCELLED":
      return { title: "cancelou esta demanda", defaultActor: "Membro da equipe" };
    case "APPROVAL_REQUESTED":
      return { title: "enviou a demanda para aprovação do cliente", defaultActor: "Membro da equipe" };
    case "APPROVAL_APPROVED":
      return { title: "aprovou o conteúdo", defaultActor: "Cliente" };
    case "APPROVAL_CHANGES_REQUESTED":
      return { title: "solicitou alterações no conteúdo", defaultActor: "Cliente" };
    case "APPROVAL_REJECTED":
      return { title: "reprovou o conteúdo", defaultActor: "Cliente" };
    case "APPROVAL_REVOKED":
      return { title: "revogou o link de aprovação", defaultActor: "Membro da equipe" };
    default:
      return { title: "realizou uma ação", defaultActor: "Sistema" };
  }
}

function ActivityIcon({ type }: { type: ActivityType }) {
  if (type === "APPROVAL_APPROVED" || type === "JOB_COMPLETED") {
    return <IconCheck className="h-3.5 w-3.5 text-[var(--looply-color-status-success)]" />;
  }
  if (
    type === "APPROVAL_CHANGES_REQUESTED" ||
    type === "JOB_CANCELLED" ||
    type === "APPROVAL_REJECTED"
  ) {
    return <IconX className="h-3.5 w-3.5 text-[var(--looply-color-status-danger)]" />;
  }
  if (type === "APPROVAL_REQUESTED") {
    return <IconSend className="h-3.5 w-3.5 text-[var(--looply-color-action-primary)]" />;
  }
  if (type === "JOB_UPDATED") {
    return <IconEdit className="h-3.5 w-3.5 text-[var(--looply-color-text-muted)]" />;
  }
  return <IconClock className="h-3.5 w-3.5 text-[var(--looply-color-text-muted)]" />;
}

function JobActivityTimeline({
  jobId,
  responsibleName,
}: {
  jobId: string;
  responsibleName?: string;
}) {
  const { data, isLoading, isError, refetch } = useJobActivity(jobId);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <h3 className="section-title mb-4">Histórico de atividades</h3>
        <div className="py-3 text-xs text-[var(--looply-color-text-muted)]">
          Carregando atividades…
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <h3 className="section-title mb-4">Histórico de atividades</h3>
        <div className="flex items-center justify-between rounded-lg bg-[var(--looply-color-status-danger)]/10 p-3 text-xs text-[var(--looply-color-status-danger)]">
          <span>Falha ao carregar histórico de atividades.</span>
          <button
            type="button"
            className="btn-ghost btn-sm text-xs font-semibold underline"
            onClick={() => refetch()}
          >
            Tentar novamente
          </button>
        </div>
      </Card>
    );
  }

  const activities = data?.activities ?? [];
  const total = data?.total ?? activities.length;

  return (
    <>
      <Card>
        <h3 className="section-title mb-4">Histórico de atividades ({total})</h3>
        {total === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--looply-color-border-default)] p-4 text-center text-xs text-[var(--looply-color-text-muted)]">
            Nenhuma atividade registrada neste job ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((act) => (
              <ActivityRow key={act.id} act={act} responsibleName={responsibleName} />
            ))}
            {total > activities.length && (
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="w-full rounded-lg border border-[var(--looply-color-border-default)] px-3 py-2 text-xs font-semibold text-[var(--looply-color-action-primary)] transition-colors hover:bg-[var(--looply-color-bg-subtle)]"
              >
                Ver todo o histórico
              </button>
            )}
          </div>
        )}
      </Card>

      <FullActivityHistory
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        jobId={jobId}
        responsibleName={responsibleName}
      />
    </>
  );
}

function ActivityRow({ act, responsibleName }: { act: JobActivity; responsibleName?: string }) {
  const { title, defaultActor } = activityCopy(act.type);
  const actor = responsibleName || defaultActor;
  return (
    <div
      className="flex items-start gap-2.5 rounded-lg border border-[var(--looply-color-border-default)] p-3 text-xs"
    >
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--looply-color-bg-subtle)]">
        <ActivityIcon type={act.type} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[var(--looply-color-text-primary)]">
          <span className="font-semibold">{actor}</span> {title}
        </div>
        <div className="mt-1 text-[11px] text-[var(--looply-color-text-muted)]">
          {relativeTime(act.createdAt)} · {formatDateTime(act.createdAt)}
        </div>
      </div>
    </div>
  );
}

// F14.2 — full activity history in a scrollable modal/sheet, paginated.
const ACTIVITY_PAGE_SIZE = 20;

function FullActivityHistory({
  open,
  onClose,
  jobId,
  responsibleName,
}: {
  open: boolean;
  onClose: () => void;
  jobId: string;
  responsibleName?: string;
}) {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError, refetch } = useJobActivityPage(open ? jobId : "", offset, ACTIVITY_PAGE_SIZE);

  // Reset to the first page when the modal opens.
  useEffect(() => {
    if (open) setOffset(0);
  }, [open]);

  const items = data?.activities ?? [];
  const total = data?.total ?? 0;
  const hasMore = items.length < total;
  const loadingMore = isLoading && offset > 0;

  return (
    <ModalOrSheet
      isOpen={open}
      onClose={onClose}
      title={`Histórico de atividades (${total})`}
      subtitle="Todas as atividades registradas nesta demanda"
      maxWidth="max-w-lg"
    >
      <div className="flex max-h-[65vh] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {isError && (
            <div className="rounded-lg bg-[var(--looply-color-status-danger)]/10 p-3 text-xs text-[var(--looply-color-status-danger)]">
              Falha ao carregar o histórico.
              <button type="button" className="ml-2 font-semibold underline" onClick={() => refetch()}>
                Tentar novamente
              </button>
            </div>
          )}
          {!isError && items.length === 0 && !isLoading && (
            <div className="rounded-lg border border-dashed border-[var(--looply-color-border-default)] p-4 text-center text-xs text-[var(--looply-color-text-muted)]">
              Nenhuma atividade registrada.
            </div>
          )}
          {items.map((act) => (
            <ActivityRow key={act.id} act={act} responsibleName={responsibleName} />
          ))}
          {loadingMore && (
            <div className="py-2 text-center text-xs text-[var(--looply-color-text-muted)]">
              Carregando…
            </div>
          )}
        </div>
        {hasMore && (
          <div className="border-t border-[var(--looply-color-border-default)] pt-3">
            <button
              type="button"
              onClick={() => setOffset((o) => o + ACTIVITY_PAGE_SIZE)}
              disabled={loadingMore}
              className="w-full rounded-lg border border-[var(--looply-color-border-default)] px-3 py-2 text-xs font-semibold text-[var(--looply-color-action-primary)] transition-colors hover:bg-[var(--looply-color-bg-subtle)] disabled:opacity-50"
            >
              {loadingMore ? "Carregando…" : "Carregar mais"}
            </button>
          </div>
        )}
      </div>
    </ModalOrSheet>
  );
}
