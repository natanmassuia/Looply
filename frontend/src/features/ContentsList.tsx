import { useMemo, useState, useCallback, useRef, useEffect, type DragEvent, type TouchEvent as ReactTouchEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useContents, useClients, useGroupContent, useUngroupContent, useWorkflow, apiFetch, ApiError } from "../lib/api";
import { FORMAT_LABEL, latestVersion, relativeTime } from "../lib/format";
import type { ContentListItem, Client } from "../lib/types";
import { EmptyState, ErrorState, PageHeader, Spinner } from "../components/common";
import StatusPill from "../components/StatusPill";
import ModalOrSheet from "../components/ModalOrSheet";
import ScheduleModal from "../components/ScheduleModal";
import { IconPlus, IconChevronDown, IconCheck, IconX } from "../components/Icons";

// ── R1.3 — the board is WorkflowStage-driven. Columns come from the active
// stages of the workflow (id/order/label), cards are placed by currentStageId,
// and movement goes through the canonical transition endpoint. semanticKey
// (never the editable label) drives protected APPROVED/SCHEDULED behavior.

const GROUP_MS = 500;
const TOUCH_MOVE_THRESHOLD = 8;
const SCROLL_EDGE = 64;
const SCROLL_STEP = 12;

// Presentation-only accent per board position. Semantics never come from here.
const STAGE_COLORS = [
  "bg-slate-400",
  "bg-amber-400",
  "bg-violet-400",
  "bg-rose-400",
  "bg-emerald-400",
  "bg-blue-400",
  "bg-teal-400",
  "bg-fuchsia-400",
  "bg-orange-400",
  "bg-cyan-400",
];

// Horizontal auto-scroll while dragging: finger in the right edge zone scrolls
// right, left edge zone scrolls left, out of the zone stops. Pure for testing.
export function autoScrollDelta(
  x: number,
  rect: { left: number; right: number },
  edge = SCROLL_EDGE,
  step = SCROLL_STEP,
): number {
  if (x > rect.right - edge) return step;
  if (x < rect.left + edge) return -step;
  return 0;
}

export default function ContentsList() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useContents();
  const { data: workflow } = useWorkflow();
  const { data: clients } = useClients();
  const groupMutation = useGroupContent();
  const ungroupMutation = useUngroupContent();
  const navigate = useNavigate();

  const stages = useMemo(
    () => (workflow?.stages ?? []).filter((s) => s.active).sort((a, b) => a.position - b.position),
    [workflow],
  );
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const [clientId, setClientId] = useState<string>("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [scheduleIntent, setScheduleIntent] = useState<{ id: string; title: string; clientId: string } | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [groupTargetId, setGroupTargetId] = useState<string | null>(null);
  const [groupReady, setGroupReady] = useState(false);
  const [touchDrag, setTouchDrag] = useState<{ id: string; clientId: string } | null>(null);
  const [touchMoving, setTouchMoving] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);
  const targetRef = useRef<string | null>(null);
  const enterCount = useRef(0);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const touchRef = useRef<{ id: string; clientId: string; x: number; y: number; moved: boolean; raf: number | null } | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  const filtered = useMemo(() => {
    if (!clientId) return data ?? [];
    return (data ?? []).filter((c) => c.clientId === clientId);
  }, [data, clientId]);

  const selectedClient: Client | undefined = useMemo(
    () => (clients ?? []).find((c) => c.id === clientId),
    [clients, clientId],
  );

  const filteredClientOptions = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    return (clients ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [clients, clientSearch]);

  const topLevel = useMemo(() => filtered.filter((c) => !c.parentId && c.lifecycleStatus !== "CANCELLED"), [filtered]);

  // Card placement authority = currentStageId (operational workflow position).
  const byStage = useMemo(() => {
    const map = new Map<string, ContentListItem[]>();
    for (const s of stages) map.set(s.id, []);
    for (const item of topLevel) {
      const arr = item.currentStageId ? map.get(item.currentStageId) : undefined;
      if (arr) arr.push(item);
    }
    return map;
  }, [topLevel, stages]);

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

  const notifyError = useCallback((msg: string) => {
    setDragError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setDragError(null), 4000);
  }, []);

  // F14.7 — contextual navigation: /contents?focus=<id> scrolls the target
  // demand into view and applies a temporary, non-animated highlight.
  const [searchParams] = useSearchParams();
  const focusParam = searchParams.get("focus");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusParam || !data || data.length === 0) return;
    let clear: ReturnType<typeof setTimeout> | null = null;
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-job-id="${focusParam}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      setFocusedId(focusParam);
      clear = setTimeout(() => setFocusedId(null), 2500);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (clear) clearTimeout(clear);
      setFocusedId(null);
    };
  }, [focusParam, data]);

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
    if (draggedClientId !== targetClientId) return;
    if (draggedId === targetId) return;

    enterCount.current += 1;
    targetRef.current = targetId;
    setGroupTargetId(targetId);

    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        readyRef.current = true;
        setGroupReady(true);
      }, GROUP_MS);
    }
  }, [draggedId, draggedClientId]);

  const handleCardLeave = useCallback(() => {
    enterCount.current = Math.max(0, enterCount.current - 1);
    if (enterCount.current === 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      readyRef.current = false;
      targetRef.current = null;
      setGroupReady(false);
      setGroupTargetId(null);
    }
  }, []);

  // Commit a drop to a WorkflowStage. The backend is the transition authority;
  // the card is never optimistically moved (a failure leaves it in place).
  const performDrop = useCallback(async (stageId: string, id: string) => {
    setDropTarget(null);
    const item = (data ?? []).find((c) => c.id === id);
    if (!item) return;
    if (item.currentStageId === stageId) return;

    const stage = stageById.get(stageId);
    if (stage?.semanticKey === "SCHEDULED") {
      // Appointment stays authoritative: the drop is an intent to schedule.
      // Only schedule-eligible cards open the canonical handoff; SCHEDULED is
      // never committed here.
      if (item.status === "APPROVED") {
        setScheduleIntent({ id: item.id, title: item.title, clientId: item.clientId });
      } else {
        notifyError("Somente demandas aprovadas podem ser agendadas.");
      }
      return;
    }

    try {
      await apiFetch(`/api/jobs/${id}/transition`, { method: "POST", body: { stageId } });
      qc.invalidateQueries({ queryKey: ["content", id] });
      qc.invalidateQueries({ queryKey: ["jobActivity", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      refetch();
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : "Não foi possível mover a demanda.");
    }
  }, [data, stageById, refetch, notifyError, qc]);

  const handleDropOnStage = useCallback(async (stageId: string, event?: DragEvent) => {
    // Prefer the id carried by the drag itself (dataTransfer), which survives
    // dragend-state races. Fall back to the reactive draggedId / touchDrag.
    const transferId = event?.dataTransfer?.getData("text/plain");
    const id = transferId || draggedId || touchDrag?.id;
    if (!id) { setDraggedId(null); setDraggedClientId(null); setDropTarget(null); return; }

    const doGroup = readyRef.current && targetRef.current && targetRef.current !== id;
    const groupParent = targetRef.current;
    resetGroup();
    setDraggedId(null);
    setDraggedClientId(null);

    if (doGroup && groupParent) {
      groupMutation.mutate({ childId: id, parentId: groupParent });
      return;
    }

    await performDrop(stageId, id);
  }, [draggedId, touchDrag, resetGroup, groupMutation, performDrop]);

  // ── Touch drag (mobile): hold a card to drag it across the board. The
  // horizontal container auto-scrolls while the finger sits in an edge zone.
  const stopTouch = useCallback((drop: boolean) => {
    const tr = touchRef.current;
    touchRef.current = null;
    if (tr?.raf) cancelAnimationFrame(tr.raf);
    const pos = lastTouchRef.current;
    lastTouchRef.current = null;
    setTouchDrag(null);
    setTouchMoving(false);
    setDropTarget(null);
    if (tr?.moved) suppressClickRef.current = true;
    if (drop && tr?.moved && pos) {
      const el = document.elementFromPoint(pos.x, pos.y);
      const col = el?.closest?.("[data-stage-id]");
      const stageId = col?.getAttribute("data-stage-id");
      if (stageId) void performDrop(stageId, tr.id);
    }
  }, [performDrop]);

  const onCardTouchStart = useCallback((e: ReactTouchEvent, id: string, clientId: string) => {
    const t = e.touches[0];
    if (!t) return;
    touchRef.current = { id, clientId, x: t.clientX, y: t.clientY, moved: false, raf: null };
    lastTouchRef.current = { x: t.clientX, y: t.clientY };
    setTouchDrag({ id, clientId });
  }, []);

  const onCardTouchMove = useCallback((e: ReactTouchEvent) => {
    const tr = touchRef.current;
    if (!tr) return;
    const t = e.touches[0];
    if (!t) return;
    lastTouchRef.current = { x: t.clientX, y: t.clientY };
    if (!tr.moved && Math.hypot(t.clientX - tr.x, t.clientY - tr.y) < TOUCH_MOVE_THRESHOLD) return;
    if (!tr.moved) {
      tr.moved = true;
      setTouchMoving(true);
    }
    // Destination feedback follows the finger without requiring hover.
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const col = el?.closest?.("[data-stage-id]");
    setDropTarget(col?.getAttribute("data-stage-id") ?? null);
    if (!tr.raf) {
      const tick = () => {
        const ctr = touchRef.current;
        const container = scrollRef.current;
        const pos = lastTouchRef.current;
        if (!ctr?.moved || !container || !pos) return;
        const rect = container.getBoundingClientRect();
        container.scrollLeft += autoScrollDelta(pos.x, rect);
        ctr.raf = requestAnimationFrame(tick);
      };
      tr.raf = requestAnimationFrame(tick);
    }
  }, []);

  const onCardTouchEnd = useCallback(() => stopTouch(true), [stopTouch]);
  const onCardTouchCancel = useCallback(() => stopTouch(false), [stopTouch]);

  // Block page scroll only while a card is being touch-dragged (the intended
  // movement target is the Kanban's horizontal container).
  const boardReady = !!(data && data.length > 0);
  useEffect(() => {
    if (!boardReady) return;
    const el = scrollRef.current;
    if (!el) return;
    const onTouchMove = (ev: globalThis.TouchEvent) => {
      if (touchRef.current?.moved) ev.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, [boardReady]);

  return (
    <div>
      <PageHeader
        title="Demandas"
        subtitle="Acompanhe o fluxo de trabalho por etapa, cliente e responsável."
        actions={
          <Link to="/contents/new" className="btn-primary">
            <IconPlus className="h-4 w-4" />
            Nova demanda
          </Link>
        }
      />

      {isLoading && <Spinner label="Carregando demandas…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}

      {dragError && (
        <div
          role="alert"
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border border-[var(--looply-color-status-danger)]/30 bg-[var(--looply-color-bg-surface)] px-4 py-2.5 text-xs font-medium text-[var(--looply-color-status-danger)] shadow-looply-md"
        >
          {dragError}
        </div>
      )}

      {!isLoading && !isError && data && data.length === 0 && (
        <EmptyState
          title="Nenhuma demanda cadastrada"
          description="Crie sua primeira demanda para começar o fluxo de trabalho."
          action={
            <Link to="/contents/new" className="btn-primary">
              <IconPlus className="h-4 w-4" />
              Nova demanda
            </Link>
          }
        />
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={clientPickerOpen}
              onClick={() => setClientPickerOpen(true)}
              className="inline-flex min-w-[220px] items-center justify-between gap-2 rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-3 py-2 text-left text-[13px] font-medium text-[var(--looply-color-text-primary)] transition-colors hover:border-[var(--looply-color-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
            >
              <span className="flex min-w-0 items-center gap-2">
                {selectedClient?.logoUrl ? (
                  <img src={selectedClient.logoUrl} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
                ) : selectedClient ? (
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
                    style={{ backgroundColor: selectedClient.brandColor || "#94a3b8" }}
                  >
                    {selectedClient.name.slice(0, 2).toUpperCase()}
                  </span>
                ) : null}
                <span className="truncate">{selectedClient ? selectedClient.name : "Todos os clientes"}</span>
              </span>
              <IconChevronDown className="h-4 w-4 shrink-0 text-[var(--looply-color-text-muted)]" />
            </button>
            {/* F14.7 — clear/reset mirrors the canonical Clients/Team filter. */}
            {clientId && (
              <button
                type="button"
                onClick={() => setClientId("")}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-[var(--looply-color-action-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
              >
                <IconX className="h-3.5 w-3.5" />
                Limpar filtros
              </button>
            )}
          </div>

          {/* Rich client filter */}
          <ModalOrSheet
            isOpen={clientPickerOpen}
            onClose={() => setClientPickerOpen(false)}
            title="Filtrar por cliente"
            subtitle="Selecione um cliente para ver suas demandas"
            maxWidth="max-w-sm"
          >
            <div className="space-y-3">
              <input
                autoFocus
                className="input w-full"
                placeholder="Buscar cliente…"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                aria-label="Buscar cliente"
              />
              <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => { setClientId(""); setClientPickerOpen(false); setClientSearch(""); }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                    !clientId ? "bg-[var(--looply-color-bg-subtle)] font-semibold text-[var(--looply-color-text-primary)]" : "text-[var(--looply-color-text-muted)]"
                  }`}
                >
                  <span>Todos os clientes</span>
                  {!clientId && <IconCheck className="h-4 w-4 text-[var(--looply-color-text-brand)]" />}
                </button>
                {filteredClientOptions.length === 0 && clientSearch.trim() && (
                  <div className="py-4 text-center text-xs text-[var(--looply-color-text-muted)]">
                    Nenhum cliente encontrado.
                  </div>
                )}
                {filteredClientOptions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setClientId(c.id); setClientPickerOpen(false); setClientSearch(""); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--looply-color-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                      clientId === c.id ? "bg-[var(--looply-color-bg-subtle)]" : ""
                    }`}
                  >
                    {c.logoUrl ? (
                      <img src={c.logoUrl} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
                    ) : (
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[11px] font-bold text-white"
                        style={{ backgroundColor: c.brandColor || "#94a3b8" }}
                      >
                        {c.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--looply-color-text-primary)]">
                      {c.name}
                    </span>
                    {clientId === c.id && <IconCheck className="h-4 w-4 shrink-0 text-[var(--looply-color-text-brand)]" />}
                  </button>
                ))}
              </div>
            </div>
          </ModalOrSheet>
          {clientId && filtered.length === 0 && (
            <div className="mb-4 rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/50 p-4 text-xs text-[var(--looply-color-text-muted)]">
              Nenhuma demanda encontrada para o cliente selecionado.
            </div>
          )}
          <div ref={scrollRef} className="overflow-x-auto min-w-0 pb-4">
            <div className="flex gap-3 min-w-max">
              {stages.map((stage, index) => {
                const items = byStage.get(stage.id) ?? [];
                const isTarget = dropTarget === stage.id;
                const color = STAGE_COLORS[index % STAGE_COLORS.length];
                return (
                  <div
                    key={stage.id}
                    data-stage-id={stage.id}
                    onDragOver={(e) => { e.preventDefault(); setDropTarget(stage.id); }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={(e) => handleDropOnStage(stage.id, e)}
                    className={`flex w-[248px] shrink-0 flex-col rounded-xl border transition-colors ${
                      isTarget
                        ? "border-brand-400 bg-brand-50/50 shadow-inner"
                        : "border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/30"
                    }`}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between border-b border-[var(--looply-color-border-default)] px-3 py-2.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                        <span className="truncate text-xs font-semibold text-[var(--looply-color-text-primary)]">
                          {stage.name}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--looply-color-bg-surface)] px-1.5 py-0.5 text-[0.6875rem] font-bold text-[var(--looply-color-text-muted)] border border-[var(--looply-color-border-default)]">
                        {items.length}
                      </span>
                    </div>

                    {/* Column Body */}
                    <div className="flex-1 space-y-2 p-2 min-h-[140px]">
                      {items.map((c) => (
                        <CardStack
                          key={c.id}
                          parent={c}
                          children_={childrenMap.get(c.id) ?? []}
                          isDragging={draggedId === c.id || (touchMoving && touchDrag?.id === c.id)}
                          isFocused={focusedId === c.id}
                          isGroupTarget={groupTargetId === c.id}
                          groupReady={groupTargetId === c.id && groupReady}
                          onDragStart={() => handleDragStart(c.id, c.clientId)}
                          onDragEnd={handleDragEnd}
                          onCardEnter={() => handleCardEnter(c.id, c.clientId)}
                          onCardLeave={handleCardLeave}
                          onNavigate={(id) => navigate(`/contents/${id}`)}
                          onUngroupAll={async (childIds) => {
                            await Promise.allSettled(
                              childIds.map((childId) => ungroupMutation.mutateAsync(childId)),
                            );
                          }}
                          onSchedule={(c) =>
                            setScheduleIntent({ id: c.id, title: c.title, clientId: c.clientId })
                          }
                          onTouchStart={onCardTouchStart}
                          onTouchMove={onCardTouchMove}
                          onTouchEnd={onCardTouchEnd}
                          onTouchCancel={onCardTouchCancel}
                          suppressClickRef={suppressClickRef}
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

      {/* F14.4 — drop into Agendado from Aprovado opens the scheduling handoff.
          The card is NOT committed until the Appointment succeeds. */}
      <ScheduleModal
        intent={scheduleIntent}
        onClose={() => setScheduleIntent(null)}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

function CardStack({
  parent,
  children_,
  isDragging,
  isFocused,
  isGroupTarget,
  groupReady,
  onDragStart,
  onDragEnd,
  onCardEnter,
  onCardLeave,
  onNavigate,
  onUngroupAll,
  onSchedule,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  suppressClickRef,
}: {
  parent: ContentListItem;
  children_: ContentListItem[];
  isDragging: boolean;
  isFocused: boolean;
  isGroupTarget: boolean;
  groupReady: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onCardEnter: () => void;
  onCardLeave: () => void;
  onNavigate: (id: string) => void;
  onUngroupAll: (childIds: string[]) => void;
  onSchedule?: (c: ContentListItem) => void;
  onTouchStart: (e: ReactTouchEvent, id: string, clientId: string) => void;
  onTouchMove: (e: ReactTouchEvent) => void;
  onTouchEnd: (e: ReactTouchEvent) => void;
  onTouchCancel: (e: ReactTouchEvent) => void;
  suppressClickRef: React.RefObject<boolean>;
}) {
  const hasChildren = children_.length > 0;
  const clientName = parent.client?.name ?? "—";
  const clientColor = parent.client?.brandColor ?? "var(--looply-color-text-muted)";
  const scheduleEligible = parent.status === "APPROVED";

  return (
    <div
      data-job-id={parent.id}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", parent.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragEnter={(e) => { e.stopPropagation(); e.preventDefault(); onCardEnter(); }}
      onDragLeave={(e) => { e.stopPropagation(); onCardLeave(); }}
      onTouchStart={(e) => onTouchStart(e, parent.id, parent.clientId)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onClick={() => {
        if (suppressClickRef.current) { suppressClickRef.current = false; return; }
        onNavigate(parent.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate(parent.id);
        }
      }}
      className={`group relative cursor-grab rounded-xl border bg-[var(--looply-color-bg-surface)] p-3 transition-all active:cursor-grabbing ${
        isFocused
          ? "border-brand-400 bg-brand-50/60 ring-2 ring-brand-400"
          : isGroupTarget && groupReady
          ? "border-brand-500 bg-brand-50/80 shadow-md ring-2 ring-brand-400"
          : isGroupTarget
          ? "border-brand-400 bg-brand-50/40"
          : "border-[var(--looply-color-border-default)] hover:shadow-looply"
      } ${isDragging ? "opacity-40" : ""} ${hasChildren ? "border-2 border-[var(--looply-color-border-default)]" : ""}`}
    >
      {/* Canonical Group Header: Company displayed ONCE at the group header level */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1 border-b border-[var(--looply-color-border-default)] pb-2 text-xs">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: clientColor }} />
          <span className="min-w-0 truncate font-semibold text-[11px] text-[var(--looply-color-text-primary)]">
            {clientName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {scheduleEligible && onSchedule && (
            <button
              type="button"
              className="btn-ghost shrink-0 px-1.5 py-0.5 text-[10px] font-medium text-[var(--looply-color-text-brand)] hover:bg-[var(--looply-color-bg-subtle)] rounded"
              title="Agendar conteúdo"
              aria-label={`Agendar ${parent.title}`}
              onClick={(e) => {
                e.stopPropagation();
                onSchedule(parent);
              }}
            >
              Agendar
            </button>
          )}
          {hasChildren && (
            <button
              type="button"
              className="btn-ghost shrink-0 px-1.5 py-0.5 text-[10px] font-medium text-[var(--looply-color-text-muted)] hover:bg-[var(--looply-color-bg-subtle)] hover:text-[var(--looply-color-text-primary)] rounded"
              title="Desagrupar demandas"
              aria-label="Desagrupar demandas"
              onClick={(e) => {
                e.stopPropagation();
                onUngroupAll(children_.map((c) => c.id));
              }}
            >
              Desagrupar
            </button>
          )}
        </div>
      </div>

      {/* Main / Parent Demand Card */}
      <div className="space-y-1.5">
        <div className="text-[12px] font-medium leading-snug text-[var(--looply-color-text-primary)] group-hover:text-brand-600">
          {parent.title}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[10.5px] text-[var(--looply-color-text-muted)]">
          <span>{FORMAT_LABEL[parent.format]}</span>
          {parent.versions?.length ? (
            <>
              <span>·</span>
              <span className="font-medium">v{latestVersion(parent)}</span>
            </>
          ) : null}
          <span className="ml-auto text-[10px]">{relativeTime(parent.updatedAt)}</span>
        </div>
      </div>

      {/* Grouped Sub-Demands */}
      {hasChildren && (
        <div className="mt-2.5 space-y-1.5 border-t border-[var(--looply-color-border-default)]/60 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--looply-color-text-muted)]">
            Demandas agrupadas ({children_.length})
          </div>
          <div className="space-y-1">
            {children_.map((child) => (
              <div
                key={child.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(child.id);
                }}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/40 px-2.5 py-1.5 transition-colors hover:border-brand-400 hover:bg-[var(--looply-color-bg-surface)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-[11px] font-medium leading-snug text-[var(--looply-color-text-primary)]">
                    {child.title}
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] text-[var(--looply-color-text-muted)]">
                    <span>{FORMAT_LABEL[child.format]}</span>
                    <span>·</span>
                    <StatusPill status={child.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group feedback: waiting (timer) */}
      {isGroupTarget && !groupReady && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/40 pointer-events-none">
          <div className="flex flex-col items-center gap-1">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
            <span className="text-[0.625rem] font-medium text-brand-500">Segure para agrupar…</span>
          </div>
        </div>
      )}

      {/* Group feedback: ready to drop */}
      {groupReady && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl border-2 border-brand-500 bg-brand-100/70 pointer-events-none">
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
