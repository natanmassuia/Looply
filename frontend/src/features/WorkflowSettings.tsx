import { useState } from "react";
import {
  useWorkflow,
  useAddWorkflowStage,
  useRenameWorkflowStage,
  useReorderWorkflowStages,
  useRemoveWorkflowStage,
  ApiError,
} from "../lib/api";
import { Card, Spinner } from "../components/common";
import { IconCheck, IconAlertCircle, IconChevronUp, IconChevronDown, IconPlus, IconTrash, IconEdit } from "../components/Icons";
import type { WorkflowStage } from "../lib/types";

// Bounded V1 workflow editor: ordered stage configuration. Terminal stages and
// the content pipeline are protected; only display names + order + custom
// stages are editable. No blank-canvas / branching.

export default function WorkflowSettings() {
  const { data: workflow, isLoading, isError } = useWorkflow(true);
  const addStage = useAddWorkflowStage(workflow?.id);
  const renameStage = useRenameWorkflowStage(workflow?.id);
  const reorder = useReorderWorkflowStages(workflow?.id);
  const removeStage = useRemoveWorkflowStage(workflow?.id);

  const [newName, setNewName] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const stages = (workflow?.stages ?? [])
    .filter((s) => s.active)
    .sort((a, b) => a.position - b.position);

  const notify = (msg: string) => {
    setFeedback(msg);
    setErr(null);
    setTimeout(() => setFeedback(null), 4000);
  };
  const fail = (e: unknown, fallback: string) => {
    setErr(e instanceof ApiError ? e.message : fallback);
    setFeedback(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await addStage.mutateAsync(newName.trim());
      setNewName("");
      notify("Etapa adicionada com sucesso.");
    } catch (e) {
      fail(e, "Falha ao adicionar etapa.");
    }
  };

  const handleRename = async (stageId: string) => {
    if (!editName.trim() || !editingId) return;
    try {
      await renameStage.mutateAsync({ stageId, name: editName.trim() });
      setEditingId(null);
      setEditName("");
      notify("Etapa renomeada com sucesso.");
    } catch (e) {
      fail(e, "Falha ao renomear etapa.");
    }
  };

  const handleMove = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= stages.length) return;
    const next = stages.slice();
    const [moving] = next.splice(index, 1);
    next.splice(target, 0, moving);
    try {
      await reorder.mutateAsync(next.map((s) => s.id));
      notify("Ordem atualizada.");
    } catch (e) {
      fail(e, "Falha ao reordenar etapas.");
    }
  };

  const handleRemove = async (stage: WorkflowStage) => {
    if (stage.terminal) return;
    try {
      await removeStage.mutateAsync(stage.id);
      notify("Etapa removida.");
    } catch (e) {
      fail(e, "Falha ao remover etapa. Ela pode conter demandas.");
    }
  };

  if (isLoading) return <Spinner label="Carregando workflow…" />;
  if (isError || !workflow) {
    return (
      <Card>
        <div className="flex items-start gap-2 rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2.5 text-sm text-[var(--looply-color-status-danger)]">
          <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Não foi possível carregar o workflow.</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4">
          <h3 className="section-title">{workflow.name}</h3>
          <p className="mt-1 text-xs text-[var(--looply-color-text-muted)]">
            Configure as etapas operacionais na ordem do seu fluxo. A etapa final e os estados do
            pipeline (aprovação, agendamento, publicação) são protegidos.
          </p>
        </div>

        {feedback && (
          <div className="mb-4 rounded-lg bg-[var(--looply-color-status-success)]/10 px-3 py-2.5 text-sm text-[var(--looply-color-status-success)]">
            {feedback}
          </div>
        )}
        {err && (
          <div className="mb-4 rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2.5 text-sm text-[var(--looply-color-status-danger)]">
            {err}
          </div>
        )}

        <ol className="space-y-2">
          {stages.map((stage, index) => (
            <li
              key={stage.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${
                stage.terminal
                  ? "border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/40"
                  : "border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)]"
              }`}
            >
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  aria-label={`Mover para cima ${stage.name}`}
                  disabled={index === 0 || stage.terminal}
                  onClick={() => handleMove(index, -1)}
                  className="flex h-4 w-4 items-center justify-center text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)] disabled:opacity-30"
                >
                  <IconChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label={`Mover para baixo ${stage.name}`}
                  disabled={index === stages.length - 1 || stage.terminal}
                  onClick={() => handleMove(index, 1)}
                  className="flex h-4 w-4 items-center justify-center text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)] disabled:opacity-30"
                >
                  <IconChevronDown className="h-3 w-3" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                {editingId === stage.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRename(stage.id);
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      autoFocus
                      className="input w-full"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label="Nome da etapa"
                    />
                    <button type="submit" className="btn-primary btn-sm">Salvar</button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => { setEditingId(null); setEditName(""); }}
                    >
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-[13px] font-medium text-[var(--looply-color-text-primary)]">
                      {stage.name}
                    </span>
                    {stage.terminal && (
                      <span className="shrink-0 rounded-full bg-[var(--looply-color-bg-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--looply-color-text-muted)]">
                        Final
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={`Renomear ${stage.name}`}
                  disabled={stage.terminal}
                  onClick={() => {
                    setEditingId(stage.id);
                    setEditName(stage.name);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)] disabled:opacity-30"
                >
                  <IconEdit className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Remover ${stage.name}`}
                  disabled={stage.terminal}
                  title={stage.terminal ? "A etapa final é protegida" : "Remover etapa"}
                  onClick={() => handleRemove(stage)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--looply-color-status-danger)] hover:bg-[var(--looply-color-bg-subtle)] disabled:opacity-30"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>

        <form onSubmit={handleAdd} className="mt-4 flex items-center gap-2">
          <input
            className="input flex-1"
            placeholder="Nova etapa personalizada…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="Nova etapa"
          />
          <button
            type="submit"
            disabled={addStage.isPending || !newName.trim()}
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            <IconPlus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </form>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--looply-color-text-muted)]">
          <IconCheck className="h-3.5 w-3.5" />
          Alterações são salvas imediatamente no servidor.
        </p>
      </Card>
    </div>
  );
}
