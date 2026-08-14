import { useMemo, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useContents, useClients } from "../lib/api";
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

// Endpoint map for specific transitions (POST)
const ENDPOINT_MAP: Record<string, string> = {
  "DRAFT-IN_REVIEW": "/review",
  "IN_REVIEW-AWAITING_CLIENT": "/send-approval",
  "CHANGES_REQUESTED-IN_REVIEW": "/review",
  "APPROVED-SCHEDULED": "/schedule",
  "SCHEDULED-PUBLISHED": "/publish",
};

export default function ContentsList() {
  const { data, isLoading, isError, error, refetch } = useContents();
  const { data: clients } = useClients();
  const [clientId, setClientId] = useState<string>("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedStatus, setDraggedStatus] = useState<ContentStatus | null>(null);
  const [dropTarget, setDropTarget] = useState<ContentStatus | null>(null);

  const filtered = useMemo(() => {
    if (!clientId) return data ?? [];
    return (data ?? []).filter((c) => c.clientId === clientId);
  }, [data, clientId]);

  const byStatus = useMemo(() => {
    const map = new Map<ContentStatus, ContentListItem[]>();
    for (const c of COLUMNS) map.set(c.status, []);
    for (const item of filtered) {
      const arr = map.get(item.status);
      if (arr) arr.push(item);
    }
    return map;
  }, [filtered]);

  const handleDragStart = useCallback((id: string, status: ContentStatus) => {
    setDraggedId(id);
    setDraggedStatus(status);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDraggedStatus(null);
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(async (targetStatus: ContentStatus) => {
    setDropTarget(null);
    if (!draggedId || !draggedStatus) return;
    const id = draggedId;
    setDraggedId(null);
    setDraggedStatus(null);

    if (draggedStatus === targetStatus) return;

    // Try specific endpoint first, fallback to generic PATCH (free movement)
    const key = `${draggedStatus}-${targetStatus}`;
    const endpoint = ENDPOINT_MAP[key];

    try {
      let res;
      if (endpoint) {
        res = await fetch(`/api/contents/${id}${endpoint}`, { method: "POST" });
      } else {
        res = await fetch(`/api/contents/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });
      }
      if (res.ok) refetch();
    } catch {
      // Silently fail
    }
  }, [draggedId, draggedStatus, refetch]);

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
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
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
                className={`flex flex-col rounded-xl border border-[var(--looply-border)] bg-[var(--looply-surface-muted)]/40 transition-colors ${
                  isTarget ? "border-brand-300 bg-brand-50/60" : ""
                }`}
                style={{ minHeight: "calc(100vh - 200px)" }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTarget(status);
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(status);
                  setDropTarget(null);
                }}
              >
                {/* Column header */}
                <div className={`flex items-center gap-2 border-b border-[var(--looply-border)] px-4 py-3 ${bg}`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                  <span className="text-[0.75rem] font-semibold text-[var(--looply-foreground)]">
                    {STATUS_LABEL[status]}
                  </span>
                  <span className="ml-auto flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-white/80 px-1 text-[0.625rem] font-semibold text-[var(--looply-faint-foreground)]">
                    {items.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 overflow-y-auto px-3 py-3" style={{ maxHeight: "calc(100vh - 220px)" }}>
                  {items.map((c) => (
                    <KanbanCard
                      key={c.id}
                      content={c}
                      isDragging={draggedId === c.id}
                      onDragStart={() => handleDragStart(c.id, c.status)}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                  {items.length === 0 && (
                    <div
                      className={`flex min-h-[60px] items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                        isTarget
                          ? "border-brand-300 bg-brand-50/40"
                          : "border-[var(--looply-border)]/30"
                      }`}
                    >
                      <span className="text-[0.625rem] text-[var(--looply-faint-foreground)]">
                        {isTarget ? "Solte aqui" : "Vazio"}
                      </span>
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

function KanbanCard({
  content,
  onDragStart,
  onDragEnd,
}: {
  content: ContentListItem;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div
      draggable
      onClick={() => navigate(`/contents/${content.id}`)}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", content.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="group relative cursor-grab rounded-lg border border-[var(--looply-border-subtle)] bg-[var(--looply-surface)] p-3 transition-all hover:border-[var(--looply-border)] hover:shadow-looply active:cursor-grabbing"
    >

      {/* Content */}
      <div className="relative z-10">
        {/* Title */}
        <div className="mb-2 text-[0.75rem] font-medium leading-snug text-[var(--looply-foreground)] group-hover:text-brand-600">
          {content.title}
        </div>

        {/* Client + Format */}
        <div className="mb-2 flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: content.client?.brandColor ?? "var(--looply-faint-foreground)" }}
          />
          <span className="truncate text-[0.6875rem] text-[var(--looply-muted-foreground)]">
            {content.client?.name ?? "—"}
          </span>
          <span className="text-[var(--looply-border)]">·</span>
          <span className="text-[0.6875rem] text-[var(--looply-muted-foreground)]">
            {FORMAT_LABEL[content.format]}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-[0.625rem] font-medium text-[var(--looply-faint-foreground)]">
            v{latestVersion(content)}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[0.625rem] text-[var(--looply-faint-foreground)]">
              {relativeTime(content.updatedAt)}
            </span>
            <StatusPill status={content.status} />
          </div>
        </div>
      </div>
    </div>
  );
}

function latestVersion(c: ContentListItem): number {
  if (!c.versions?.length) return 1;
  return Math.max(...c.versions.map((v) => v.versionNumber));
}
