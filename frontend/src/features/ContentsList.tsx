import { useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useContents, useClients, useGroupContent, apiFetch } from "../lib/api";
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
        title="Conteúdos"
        subtitle="Gerencie todo o ciclo de vida dos conteúdos"
        actions={
          <Link to="/contents/new" className="btn-primary">
            <IconPlus className="h-4 w-4" />
            Novo conteúdo
          </Link>
        }
      />

      {isLoading && <Spinner label="Carregando conteúdos…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}

      {!isLoading && !isError && data && data.length === 0 && (
        <EmptyState
          title="Nenhum conteúdo"
          description="Crie seu primeiro conteúdo para começar."
          action={
            <Link to="/contents/new" className="btn-primary">
              <IconPlus className="h-4 w-4" />
              Novo conteúdo
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
              aria-label="Filtrar por empresa"
            >
              <option value="">Todas as empresas</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-7 gap-3">
            {COLUMNS.map(({ status, color, bg }) => {
              const items = byStatus.get(status) ?? [];
              const isTarget = dropTarget === status;
              return (
                <div
                  key={status}
                  className={`flex flex-col rounded-xl border border-[var(--looply-border)] bg-[var(--looply-surface-muted)]/40 transition-colors ${isTarget ? "border-brand-300 bg-brand-50/60" : ""}`}
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
                  <div className={`flex items-center gap-2 border-b border-[var(--looply-border)] px-4 py-3 ${bg}`}>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                    <span className="text-[0.75rem] font-semibold text-[var(--looply-foreground)]">{STATUS_LABEL[status]}</span>
                    <span className="ml-auto flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-white/80 px-1 text-[0.625rem] font-semibold text-[var(--looply-faint-foreground)]">{items.length}</span>
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
                      />
                    ))}
                    {items.length === 0 && (
                      <div className={`flex min-h-[60px] items-center justify-center rounded-lg border-2 border-dashed transition-colors ${isTarget ? "border-brand-300 bg-brand-50/40" : "border-[var(--looply-border)]/30"}`}>
                        <span className="text-[0.625rem] text-[var(--looply-faint-foreground)]">{isTarget ? "Solte aqui" : "Vazio"}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
      className={`group relative cursor-grab rounded-lg border bg-[var(--looply-surface)] p-3 transition-all active:cursor-grabbing ${
        groupReady ? "border-brand-500 ring-2 ring-brand-300 bg-brand-50/50 scale-[1.02]" :
        isGroupTarget ? "border-brand-300 ring-1 ring-brand-100" :
        "border-[var(--looply-border-subtle)] hover:border-[var(--looply-border)] hover:shadow-looply"
      } ${isDragging ? "opacity-40" : ""} ${hasChildren ? "border-2 border-[var(--looply-border)]" : ""}`}
    >
      {/* Parent card content */}
      <div className="relative z-10">
        <div className="mb-2 text-[0.75rem] font-medium leading-snug text-[var(--looply-foreground)] group-hover:text-brand-600">
          {parent.title}
        </div>
        <div className="mb-2 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: parent.client?.brandColor ?? "var(--looply-faint-foreground)" }} />
          <span className="truncate text-[0.6875rem] text-[var(--looply-muted-foreground)]">{parent.client?.name ?? "—"}</span>
          <span className="text-[var(--looply-border)]">·</span>
          <span className="text-[0.6875rem] text-[var(--looply-muted-foreground)]">{FORMAT_LABEL[parent.format]}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[0.625rem] font-medium text-[var(--looply-faint-foreground)]">v{latestVersion(parent)}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[0.625rem] text-[var(--looply-faint-foreground)]">{relativeTime(parent.updatedAt)}</span>
            <StatusPill status={parent.status} />
          </div>
        </div>
      </div>

      {/* Children stacked underneath — visual "caixa dentro da caixa" */}
      {hasChildren && (
        <div className="mt-2 ml-2 rounded-md border-l-2 border-[var(--looply-border)] bg-[var(--looply-surface-muted)]/30 p-2">
          <div className="mb-1.5 flex items-center gap-1 text-[0.5625rem] font-semibold uppercase tracking-wider text-[var(--looply-faint-foreground)]">
            <svg className="h-2.5 w-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6v6m4-4v4m4-6v6" />
            </svg>
            Agrupado ({children_.length})
          </div>
          <div className="flex flex-col gap-1.5">
            {children_.map((child) => (
              <div
                key={child.id}
                onClick={(e) => { e.stopPropagation(); onNavigate(child.id); }}
                className="rounded border border-[var(--looply-border-subtle)] bg-[var(--looply-surface)] px-2.5 py-2 transition-colors hover:border-[var(--looply-border)]"
              >
                <div className="mb-1 text-[0.6875rem] font-medium leading-snug text-[var(--looply-foreground)]">{child.title}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[0.625rem] text-[var(--looply-muted-foreground)]">{FORMAT_LABEL[child.format]}</span>
                  <StatusPill status={child.status} />
                </div>
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