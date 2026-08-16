import { useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useContents, useClients, useGroupContent, useUngroupContent, apiFetch } from "../lib/api";
import { STATUS_LABEL, FORMAT_LABEL, relativeTime } from "../lib/format";
import type { ContentStatus, ContentListItem } from "../lib/types";
import { EmptyState, ErrorState, PageHeader, Spinner } from "../components/common";
import StatusPill from "../components/StatusPill";
import { IconPlus } from "../components/Icons";

const COLUMNS: { status: ContentStatus; color: string; bg: string }[] = [
  { status: "DRAFT", color: "bg-slate-400", bg: "bg-slate-50/70" },
  { status: "IN_REVIEW", color: "bg-amber-400", bg: "bg-amber-50/50" },
  { status: "AWAITING_CLIENT", color: "bg-violet-400", bg: "bg-violet-50/50" },
  { status: "CHANGES_REQUESTED", color: "bg-rose-400", bg: "bg-rose-50/50" },
  { status: "APPROVED", color: "bg-emerald-400", bg: "bg-emerald-50/50" },
  { status: "SCHEDULED", color: "bg-blue-400", bg: "bg-blue-50/50" },
  { status: "PUBLISHED", color: "bg-teal-400", bg: "bg-teal-50/50" },
];

const ENDPOINT_MAP: Record<string, string> = {
  "DRAFT-IN_REVIEW": "/review",
  "IN_REVIEW-AWAITING_CLIENT": "/send-approval",
  "CHANGES_REQUESTED-IN_REVIEW": "/review",
  "APPROVED-SCHEDULED": "/schedule",
  "SCHEDULED-PUBLISHED": "/publish",
};

const GROUP_MS = 500;

export default function ContentsList() {
  const { data, isLoading, isError, error, refetch } = useContents();
  const { data: clients } = useClients();
  const groupMutation = useGroupContent();
  const ungroupMutation = useUngroupContent();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState<string>("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ContentStatus | null>(null);
  const [groupTargetId, setGroupTargetId] = useState<string | null>(null);
  const [groupReady, setGroupReady] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);
  const targetRef = useRef<string | null>(null);
  const enterCount = useRef(0);

  const filtered = useMemo(() => {
    if (!clientId) return data ?? [];
    return (data ?? []).filter((c) => c.clientId === clientId);
  }, [data, clientId]);

  const topLevel = useMemo(() => filtered.filter((c) => !c.parentId), [filtered]);

  const byStatus = useMemo(() => {
    const map = new Map<ContentStatus, ContentListItem[]>();
    for (const c of COLUMNS) map.set(c.status, []);
    for (const item of topLevel) {
      const arr = map.get(item.status);
      if (arr) arr.push(item);
    }
    return map;
  }, [topLevel]);

  const childrenMap = useMemo(() => {
    const map = new Map<string, ContentListItem[]>();
    for (const c of filtered) {
      if (c.parentId) {
        const arr = map.get(c.parentId);
        if (arr) arr.push(c);
        else map.set(c.parentId, [c]);
      }
    }
    return map;
  }, [filtered]);

  const resetGroup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    readyRef.current = false;
    targetRef.current = null;
    enterCount.current = 0;
    setGroupReady(false);
    setGroupTargetId(null);
  }, []);

  const handleDragStart = useCallback((id: string, cid: string) => {
    setDraggedId(id);
    setDraggedClientId(cid);
  }, []);

  const handleDragEnd = useCallback(() => {
    resetGroup();
    setDraggedId(null);
    setDraggedClientId(null);
    setDropTarget(null);
  }, [resetGroup]);

  const handleCardEnter = useCallback((targetId: string, targetClientId: string) => {
    if (!draggedId || !draggedClientId) return;
    if (draggedId === targetId) return;
    if (draggedClientId !== targetClientId) return;

    enterCount.current++;
    if (enterCount.current > 1) return;

    if (targetRef.current === targetId) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    targetRef.current = targetId;
    readyRef.current = false;
    setGroupTargetId(targetId);
    setGroupReady(false);

    timerRef.current = setTimeout(() => {
      readyRef.current = true;
      setGroupReady(true);
    }, GROUP_MS);
  }, [draggedId, draggedClientId]);

  const handleCardLeave = useCallback(() => {
    enterCount.current--;
    if (enterCount.current <= 0) {
      enterCount.current = 0;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      readyRef.current = false;
      targetRef.current = null;
      setGroupReady(false);
      setGroupTargetId(null);
    }
  }, []);

  const handleDropOnColumn = useCallback(async (targetStatus: ContentStatus) => {
    setDropTarget(null);
    const id = draggedId;
    if (!id) { setDraggedId(null); setDraggedClientId(null); return; }

    const doGroup = readyRef.current && targetRef.current && targetRef.current !== id;
    const groupParent = targetRef.current;
    resetGroup();
    setDraggedId(null);
    setDraggedClientId(null);

    if (doGroup && groupParent) {
      groupMutation.mutate({ childId: id, parentId: groupParent });
      return;
    }

    const fromStatus = findStatusById(data ?? [], id);
    if (fromStatus === targetStatus) return;

    const key = `${fromStatus}-${targetStatus}`;
    const endpoint = ENDPOINT_MAP[key];
    try {
      if (endpoint) {
        await apiFetch(`/api/contents/${id}${endpoint}`, { method: "POST" });
      } else {
        await apiFetch(`/api/contents/${id}/status`, {
          method: "PATCH",
          body: { status: targetStatus },
        });
      }
      refetch();
    } catch { /* */ }
  }, [draggedId, data, refetch, resetGroup, groupMutation]);

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle="Fluxo operacional de jobs e aprovações"
        actions={
          <Link to="/contents/new" className="btn-primary">
            <IconPlus className="h-4 w-4" />
            Novo job
          </Link>
        }
      />

      {isLoading && <Spinner label="Carregando jobs…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}

      {!isLoading && !isError && data && data.length === 0 && (
        <EmptyState
          title="Nenhum job cadastrado"
          description="Crie seu primeiro job para começar."
          action={
            <Link to="/contents/new" className="btn-primary">
              <IconPlus className="h-4 w-4" />
              Novo job
            </Link>
          }
        />
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <>
          <div className="mb-4">
            <select
              className="input w-auto min-w-[200px]"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              aria-label="Filtrar por cliente"
            >
              <option value="">Todos os clientes</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {clientId && filtered.length === 0 && (
            <div className="mb-4 rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/50 p-4 text-xs text-[var(--looply-color-text-muted)]">
              Nenhum job encontrado para o cliente selecionado.
            </div>
          )}
          <div className="overflow-x-auto min-w-0 pb-4">
            <div className="grid grid-cols-7 gap-3 min-w-[980px] xl:min-w-0">
              {COLUMNS.map(({ status, color, bg }) => {
                const items = byStatus.get(status) ?? [];
                const isTarget = dropTarget === status;
                return (
                  <div
                    key={status}
                    className={`flex flex-col rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/40 transition-colors ${isTarget ? "border-brand-300 bg-brand-50/60" : ""}`}
                    style={{ minHeight: "calc(100vh - 200px)" }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDropTarget(status);
                    }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropOnColumn(status);
                    }}
                  >
                    <div className={`flex items-center gap-2 border-b border-[var(--looply-color-border-default)] px-4 py-3 ${bg}`}>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                      <span className="text-[0.75rem] font-semibold text-[var(--looply-color-text-primary)]">{STATUS_LABEL[status]}</span>
                      <span className="ml-auto flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-white/80 px-1 text-[0.625rem] font-semibold text-[var(--looply-color-text-muted)]">{items.length}</span>
                    </div>
                    <div className="flex flex-col gap-2 overflow-y-auto px-3 py-3" style={{ maxHeight: "calc(100vh - 220px)" }}>
                      {items.map((c) => (
                        <CardStack
                          key={c.id}
                          parent={c}
                          children_={childrenMap.get(c.id) ?? []}
                          isDragging={draggedId === c.id}
                          isGroupTarget={groupTargetId === c.id}
                          groupReady={groupTargetId === c.id && groupReady}
                          onDragStart={() => handleDragStart(c.id, c.clientId)}
                          onDragEnd={handleDragEnd}
                          onCardEnter={() => handleCardEnter(c.id, c.clientId)}
                          onCardLeave={handleCardLeave}
                          onNavigate={(id) => navigate(`/contents/${id}`)}
                          onUngroup={async (childId) => {
                            try {
                              await ungroupMutation.mutateAsync(childId);
                            } catch {
                              // error handled by query error boundaries
                            }
                          }}
                        />
                      ))}
                      {items.length === 0 && (
                        <div className={`flex min-h-[60px] items-center justify-center rounded-lg border-2 border-dashed transition-colors ${isTarget ? "border-brand-300 bg-brand-50/40" : "border-[var(--looply-color-border-default)]/30"}`}>
                          <span className="text-[0.625rem] text-[var(--looply-color-text-muted)]">{isTarget ? "Solte aqui" : "Vazio"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function CardStack({
  parent,
  children_,
  isDragging,
  isGroupTarget,
  groupReady,
  onDragStart,
  onDragEnd,
  onCardEnter,
  onCardLeave,
  onNavigate,
  onUngroup,
}: {
  parent: ContentListItem;
  children_: ContentListItem[];
  isDragging: boolean;
  isGroupTarget: boolean;
  groupReady: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onCardEnter: () => void;
  onCardLeave: () => void;
  onNavigate: (id: string) => void;
  onUngroup: (id: string) => void;
}) {
  const hasChildren = children_.length > 0;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", parent.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragEnter={(e) => { e.stopPropagation(); e.preventDefault(); onCardEnter(); }}
      onDragLeave={(e) => { e.stopPropagation(); onCardLeave(); }}
      onClick={() => onNavigate(parent.id)}
      className={`group relative cursor-grab rounded-lg border bg-[var(--looply-color-bg-surface)] p-3 transition-all active:cursor-grabbing ${
        isGroupTarget && groupReady
          ? "border-brand-500 bg-brand-50/80 shadow-md ring-2 ring-brand-400"
          : isGroupTarget
          ? "border-brand-400 bg-brand-50/40"
          : "border-[var(--looply-color-border-default)] hover:shadow-looply"
      } ${isDragging ? "opacity-40" : ""} ${hasChildren ? "border-2 border-[var(--looply-color-border-default)]" : ""}`}
    >
      {/* Parent content */}
      <div>
        <div className="mb-2 text-[0.75rem] font-medium leading-snug text-[var(--looply-color-text-primary)] group-hover:text-brand-600">
          {parent.title}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: parent.client?.brandColor ?? "var(--looply-color-text-muted)" }} />
          <span className="truncate text-[0.6875rem] text-[var(--looply-color-text-muted)]">{parent.client?.name ?? "—"}</span>
          <span className="text-[var(--looply-color-border-default)]">·</span>
          <span className="text-[0.6875rem] text-[var(--looply-color-text-muted)]">{FORMAT_LABEL[parent.format]}</span>
          {parent.versions?.length ? (
            <>
              <span className="text-[var(--looply-color-border-default)]">·</span>
              <span className="text-[0.625rem] font-medium text-[var(--looply-color-text-muted)]">v{latestVersion(parent)}</span>
            </>
          ) : null}
          <span className="ml-auto shrink-0 text-[0.625rem] text-[var(--looply-color-text-muted)]">{relativeTime(parent.updatedAt)}</span>
        </div>
      </div>

      {/* Grouped children */}
      {hasChildren && (
        <div className="mt-2 ml-2 rounded-md border-l-2 border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/30 p-2">
          <div className="mb-1.5 flex items-center gap-1 text-[0.5625rem] font-semibold uppercase tracking-wider text-[var(--looply-color-text-muted)]">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 6h16M4 12h10M4 18h6" />
            </svg>
            Agrupados ({children_.length})
          </div>
          <div className="space-y-1.5">
            {children_.map((child) => (
              <div
                key={child.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(child.id);
                }}
                className="flex items-center justify-between gap-2 rounded border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-2.5 py-2 transition-colors hover:border-brand-300"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 truncate text-[0.6875rem] font-medium leading-snug text-[var(--looply-color-text-primary)]">
                    {child.title}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[0.625rem] text-[var(--looply-color-text-muted)]">
                      {FORMAT_LABEL[child.format]}
                    </span>
                    <span className="text-[var(--looply-color-border-default)]">·</span>
                    <StatusPill status={child.status} />
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-ghost shrink-0 p-1 text-[10px] text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)]"
                  title="Desagrupar job"
                  aria-label={`Desagrupar ${child.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUngroup(child.id);
                  }}
                >
                  Desagrupar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group feedback: waiting (timer) */}
      {isGroupTarget && !groupReady && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-brand-300 bg-brand-50/40 pointer-events-none">
          <div className="flex flex-col items-center gap-1">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
            <span className="text-[0.625rem] font-medium text-brand-500">Segure para agrupar…</span>
          </div>
        </div>
      )}

      {/* Group feedback: ready to drop */}
      {groupReady && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-brand-500 bg-brand-100/70 pointer-events-none">
          <div className="flex flex-col items-center gap-1">
            <svg className="h-5 w-5 text-brand-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            <span className="text-[0.6875rem] font-bold text-brand-700">Solte para agrupar</span>
          </div>
        </div>
      )}
    </div>
  );
}

function latestVersion(c: ContentListItem): number {
  if (!c.versions?.length) return 1;
  return Math.max(...c.versions.map((v) => v.versionNumber));
}

function findStatusById(items: ContentListItem[], id: string): ContentStatus | undefined {
  return items.find((i) => i.id === id)?.status;
}