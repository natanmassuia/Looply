import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  usePublications,
  useAppointments,
  useClients,
  useCreateAppointment,
  useUpdateAppointment,
  useCancelAppointment,
  ApiError,
} from "../lib/api";
import { FORMAT_LABEL } from "../lib/format";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/common";
import ModalOrSheet from "../components/ModalOrSheet";
import type { ContentListItem, Appointment } from "../lib/types";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
} from "../components/Icons";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function localDateInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function localTimeInput(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

type CalendarEntry =
  | { origin: "PUBLICATION"; data: ContentListItem; key: string }
  | { origin: "APPOINTMENT"; data: Appointment; key: string };

type CalView = "month" | "week" | "day" | "list";

export default function Calendar() {
  const { data: publications, isLoading: pubLoading, isError: pubIsError, error: pubError } =
    usePublications();
  const {
    data: appointmentsData,
    isLoading: appLoading,
    isError: appIsError,
    error: appError,
  } = useAppointments();
  const { data: clients } = useClients();

  const createAppointment = useCreateAppointment();
  const updateAppointment = useUpdateAppointment();
  const cancelAppointment = useCancelAppointment();

  const today = new Date();
  const [view, setView] = useState<CalView>("month");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const y = anchor.getFullYear();
  const m = anchor.getMonth();

  // Appointment Modal state
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [form, setForm] = useState({
    title: "",
    clientId: "",
    description: "",
    startDate: "",
    startTime: "09:00",
    endDate: "",
    endTime: "",
  });

  const appointments = appointmentsData?.appointments ?? [];

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();

    // 1. Scheduled Job publications
    for (const p of publications ?? []) {
      const iso = p.scheduledAt ?? p.publicationTarget;
      if (!iso) continue;
      const d = new Date(iso);
      const k = dateKey(d);
      const arr = map.get(k) ?? [];
      arr.push({ origin: "PUBLICATION", data: p, key: `pub-${p.id}` });
      map.set(k, arr);
    }

    // 2. Appointments
    for (const app of appointments) {
      if (!app.startsAt) continue;
      const d = new Date(app.startsAt);
      const k = dateKey(d);
      const arr = map.get(k) ?? [];
      arr.push({ origin: "APPOINTMENT", data: app, key: `app-${app.id}` });
      map.set(k, arr);
    }

    return map;
  }, [publications, appointments]);

  const cells = useMemo(() => buildMonthGrid(y, m), [y, m]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchor]);

  const dayEntries = useMemo(() => byDay.get(dateKey(anchor)) ?? [], [byDay, anchor]);

  // All entries sorted ascending by datetime (for the list view).
  const sortedEntries = useMemo(() => {
    const all: { when: Date; item: CalendarEntry }[] = [];
    for (const arr of byDay.values()) {
      for (const item of arr) {
        const iso =
          item.origin === "PUBLICATION"
            ? item.data.scheduledAt ?? item.data.publicationTarget
            : item.data.startsAt;
        if (iso) all.push({ when: new Date(iso), item });
      }
    }
    all.sort((a, b) => a.when.getTime() - b.when.getTime());
    return all;
  }, [byDay]);

  const periodLabel =
    view === "month"
      ? `${MONTHS[m]} ${y}`
      : view === "week"
        ? weekRangeLabel(weekDays[0], weekDays[6])
        : view === "day"
          ? dayLabel(anchor)
          : "Todos os compromissos";

  const goPrev = () => {
    if (view === "month") setAnchor(new Date(y, m - 1, 1));
    else if (view === "week") setAnchor(addDays(anchor, -7));
    else if (view === "day") setAnchor(addDays(anchor, -1));
  };
  const goNext = () => {
    if (view === "month") setAnchor(new Date(y, m + 1, 1));
    else if (view === "week") setAnchor(addDays(anchor, 7));
    else if (view === "day") setAnchor(addDays(anchor, 1));
  };

  // Collect unique client colors for legend
  const clientColors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of publications ?? []) {
      if (p.client?.brandColor && !seen.has(p.client.name)) {
        seen.set(p.client.name, p.client.brandColor);
      }
    }
    return Array.from(seen.entries()).slice(0, 6);
  }, [publications]);

  const openCreateModal = (defaultDate?: Date) => {
    const d = defaultDate ?? new Date();
    const dStr = localDateInput(d);
    setForm({
      title: "",
      clientId: "",
      description: "",
      startDate: dStr,
      startTime: "09:00",
      endDate: "",
      endTime: "",
    });
    setFormErr(null);
    setSelectedAppointment(null);
    setModalMode("create");
    setConfirmCancel(false);
  };

  const openEditModal = (app: Appointment) => {
    const start = new Date(app.startsAt);
    const startDate = localDateInput(start);
    const startTime = localTimeInput(start);

    let endDate = "";
    let endTime = "";
    if (app.endsAt) {
      const end = new Date(app.endsAt);
      endDate = localDateInput(end);
      endTime = localTimeInput(end);
    }

    setForm({
      title: app.title,
      clientId: app.clientId ?? "",
      description: app.description ?? "",
      startDate,
      startTime,
      endDate,
      endTime,
    });
    setFormErr(null);
    setSelectedAppointment(app);
    setModalMode("edit");
    setConfirmCancel(false);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedAppointment(null);
    setFormErr(null);
    setConfirmCancel(false);
  };

  const handleSubmit = async () => {
    setFormErr(null);
    if (!form.title.trim()) {
      setFormErr("Informe o título do compromisso.");
      return;
    }
    if (!form.startDate) {
      setFormErr("Informe a data de início.");
      return;
    }

    const startIso = new Date(`${form.startDate}T${form.startTime || "00:00"}:00`).toISOString();
    let endIso: string | undefined = undefined;

    if (form.endDate) {
      endIso = new Date(`${form.endDate}T${form.endTime || "00:00"}:00`).toISOString();
      if (new Date(endIso) <= new Date(startIso)) {
        setFormErr("A data/horário de término deve ser posterior ao início.");
        return;
      }
    }

    try {
      if (modalMode === "create") {
        await createAppointment.mutateAsync({
          title: form.title.trim(),
          clientId: form.clientId || undefined,
          description: form.description.trim() || undefined,
          startsAt: startIso,
          endsAt: endIso,
        });
        setFormSuccess("Compromisso criado com sucesso.");
      } else if (modalMode === "edit" && selectedAppointment) {
        await updateAppointment.mutateAsync({
          id: selectedAppointment.id,
          body: {
            title: form.title.trim(),
            clientId: form.clientId || null,
            description: form.description.trim() || null,
            startsAt: startIso,
            endsAt: endIso ?? null,
          },
        });
        setFormSuccess("Compromisso atualizado com sucesso.");
      }
      setTimeout(() => setFormSuccess(null), 4000);
      closeModal();
    } catch (e) {
      setFormErr(e instanceof ApiError ? e.message : "Falha ao salvar compromisso.");
    }
  };

  const handleCancel = async () => {
    if (!selectedAppointment) return;
    setFormErr(null);
    try {
      await cancelAppointment.mutateAsync(selectedAppointment.id);
      setFormSuccess("Compromisso cancelado com sucesso.");
      setTimeout(() => setFormSuccess(null), 4000);
      closeModal();
    } catch (e) {
      setFormErr(e instanceof ApiError ? e.message : "Falha ao cancelar compromisso.");
    }
  };

  const isLoading = pubLoading || appLoading;
  const isError = pubIsError && appIsError;
  const totalItemsCount = (publications?.length ?? 0) + appointments.length;

  return (
    <div>
      <PageHeader
        title="Agenda"
        subtitle="Planejamento, publicações e compromissos"
        actions={
          <button
            type="button"
            className="btn-primary btn-sm flex items-center gap-1.5"
            onClick={() => openCreateModal()}
          >
            <IconPlus className="h-4 w-4" />
            <span>Novo compromisso</span>
          </button>
        }
      />

      {formSuccess && (
        <div className="mb-4 rounded-lg bg-[var(--looply-color-status-success)]/10 px-3 py-2.5 text-sm text-[var(--looply-color-status-success)]">
          {formSuccess}
        </div>
      )}

      {appIsError && !pubIsError && (
        <div className="mb-4 rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-xs text-[var(--looply-color-status-danger)]">
          Não foi possível sincronizar os compromissos da agenda: {(appError as Error)?.message}
        </div>
      )}

      {isLoading && <Spinner label="Carregando agenda…" />}
      {isError && <ErrorState message={(pubError as Error)?.message || (appError as Error)?.message} />}

      {!isError && (
        <Card className="p-0 overflow-hidden">
          {/* Top bar: period navigation + view toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--looply-color-border-default)] px-4 py-3">
            <div className="flex items-center gap-1.5">
              {view !== "list" && (
                <button className="btn-ghost btn-sm" onClick={goPrev} aria-label="Período anterior">
                  <IconChevronLeft className="h-4 w-4" />
                </button>
              )}
              <div className="min-w-[140px] text-center text-[0.95rem] font-bold tracking-tight text-[var(--looply-color-text-primary)]">
                {periodLabel}
              </div>
              {view !== "list" && (
                <button className="btn-ghost btn-sm" onClick={goNext} aria-label="Próximo período">
                  <IconChevronRight className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                className="btn-ghost btn-sm ml-1 text-xs font-semibold"
                onClick={() => setAnchor(new Date())}
              >
                Hoje
              </button>
            </div>

            <div
              role="group"
              aria-label="Modo de visualização"
              className="inline-flex items-center rounded-full border border-[var(--looply-color-border-default)] p-0.5"
            >
              {([
                ["month", "Mês"],
                ["week", "Semana"],
                ["day", "Dia"],
                ["list", "Lista"],
              ] as const).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)] ${
                    view === v
                      ? "bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-primary)]"
                      : "text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* MONTH */}
          {view === "month" && (
            <>
              <div className="grid grid-cols-7 border-b border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--looply-color-text-muted)]">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="px-2 py-2.5">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((cell, i) => {
                  const items = cell ? byDay.get(dateKey(cell)) ?? [] : [];
                  const isToday = Boolean(cell && isSameDay(cell, today));
                  const inMonth = Boolean(cell && cell.getMonth() === m);
                  return (
                    <div
                      key={i}
                      role={inMonth && cell ? "button" : undefined}
                      tabIndex={inMonth && cell ? 0 : undefined}
                      aria-label={inMonth && cell ? `Dia ${cell.getDate()}` : undefined}
                      onClick={() => {
                        if (inMonth && cell) openCreateModal(cell);
                      }}
                      onKeyDown={(e) => {
                        if (inMonth && cell && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          openCreateModal(cell);
                        }
                      }}
                      className={`min-h-[100px] border-b border-r border-[var(--looply-color-border-default)] p-1.5 transition-colors ${
                        inMonth
                          ? "bg-[var(--looply-color-bg-surface)] hover:bg-[var(--looply-color-bg-subtle)]/60 cursor-pointer"
                          : "bg-[var(--looply-color-bg-subtle)]/40"
                      }`}
                    >
                      {cell && (
                        <>
                          <div className="mb-1 flex items-center justify-between">
                            <span
                              className={`text-xs font-medium ${
                                isToday
                                  ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white font-bold"
                                  : inMonth
                                    ? "text-[var(--looply-color-text-muted)]"
                                    : "text-[var(--looply-color-text-muted)]/50"
                              }`}
                            >
                              {cell.getDate()}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {items.slice(0, 3).map((item) => (
                              <EntryChip key={item.key} item={item} onAppointment={openEditModal} />
                            ))}
                            {items.length > 3 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAnchor(cell);
                                  setView("day");
                                }}
                                className="block w-full px-1.5 text-left text-[10px] font-medium text-[var(--looply-color-text-muted)] hover:text-[var(--looply-color-text-primary)]"
                              >
                                +{items.length - 3} mais
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* WEEK */}
          {view === "week" && (
            <div className="grid grid-cols-1 sm:grid-cols-7">
              {weekDays.map((d) => {
                const items = byDay.get(dateKey(d)) ?? [];
                const isToday = isSameDay(d, today);
                return (
                  <div
                    key={d.toISOString()}
                    role="button"
                    tabIndex={0}
                    aria-label={`Dia ${d.getDate()}`}
                    onClick={() => openCreateModal(d)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openCreateModal(d);
                      }
                    }}
                    className="min-h-[220px] cursor-pointer border-b border-r border-[var(--looply-color-border-default)] p-2 transition-colors hover:bg-[var(--looply-color-bg-subtle)]/60"
                  >
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="text-[0.625rem] font-semibold uppercase text-[var(--looply-color-text-muted)]">
                        {WEEKDAYS[d.getDay()]}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          isToday
                            ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white"
                            : "text-[var(--looply-color-text-primary)]"
                        }`}
                      >
                        {d.getDate()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {items.length === 0 ? (
                        <span className="text-[10px] text-[var(--looply-color-text-muted)]/70">—</span>
                      ) : (
                        items.map((item) => (
                          <EntryChip key={item.key} item={item} onAppointment={openEditModal} />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* DAY */}
          {view === "day" && (
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-[var(--looply-color-text-muted)]">
                  {dayEntries.length} {dayEntries.length === 1 ? "item" : "itens"}
                </span>
                <button type="button" className="btn-secondary btn-sm" onClick={() => openCreateModal(anchor)}>
                  <IconPlus className="h-3.5 w-3.5" />
                  Novo
                </button>
              </div>
              {dayEntries.length === 0 ? (
                <div className="rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/50 p-6 text-center text-xs text-[var(--looply-color-text-muted)]">
                  Nada agendado para este dia.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {dayEntries.map((item) => (
                    <div key={item.key} className="flex items-center gap-3">
                      <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-[var(--looply-color-text-muted)]">
                        {entryTime(item)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <EntryChip item={item} onAppointment={openEditModal} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LIST */}
          {view === "list" && (
            <div className="p-4">
              {sortedEntries.length === 0 ? (
                <div className="rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)]/50 p-6 text-center text-xs text-[var(--looply-color-text-muted)]">
                  Nenhum item na agenda.
                </div>
              ) : (
                <div className="space-y-4">
                  {groupByDay(sortedEntries).map(([label, entries]) => (
                    <div key={label}>
                      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--looply-color-text-muted)]">
                        {label}
                      </div>
                      <div className="space-y-1.5">
                        {entries.map(({ item }) => (
                          <div key={item.key} className="flex items-center gap-3">
                            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-[var(--looply-color-text-muted)]">
                              {entryTime(item)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <EntryChip item={item} onAppointment={openEditModal} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {!isLoading && totalItemsCount === 0 && (
        <div className="mt-4">
          <EmptyState
            title="Nada agendado"
            description="Demandas aprovadas e compromissos criados aparecerão aqui na sua agenda."
          />
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--looply-color-text-muted)]">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-600 text-[8px] font-bold text-white">
            {today.getDate()}
          </span>
          <span>Hoje</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-sm border border-brand-300 bg-brand-50" />
          <span>Compromisso da agenda</span>
        </div>
        {clientColors.map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-5 rounded-sm" style={{ backgroundColor: color }} />
            <span>Publicações: {name}</span>
          </div>
        ))}
      </div>

      {/* Appointment Create/Edit Modal / Bottom Sheet */}
      <ModalOrSheet
        isOpen={!!modalMode}
        onClose={closeModal}
        title={modalMode === "create" ? "Novo compromisso" : "Detalhes do compromisso"}
        subtitle={modalMode === "create" ? "Agende um novo compromisso na sua agenda" : "Visualize ou edite este compromisso"}
        maxWidth="max-w-lg"
      >
        <div className="space-y-3.5">
          {selectedAppointment?.status === "CANCELLED" && (
            <div className="rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-xs font-semibold text-[var(--looply-color-status-danger)]">
              Este compromisso está cancelado.
            </div>
          )}

          <div>
            <label className="label">Título *</label>
            <input
              className="input"
              placeholder="Ex.: Reunião de alinhamento com cliente"
              disabled={selectedAppointment?.status === "CANCELLED"}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Cliente (opcional)</label>
            <select
              className="input"
              disabled={selectedAppointment?.status === "CANCELLED"}
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            >
              <option value="">Sem cliente vinculado</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Data de início *</label>
              <input
                type="date"
                className="input"
                disabled={selectedAppointment?.status === "CANCELLED"}
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Horário de início</label>
              <input
                type="time"
                className="input"
                disabled={selectedAppointment?.status === "CANCELLED"}
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Data de término</label>
              <input
                type="date"
                className="input"
                disabled={selectedAppointment?.status === "CANCELLED"}
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Horário de término</label>
              <input
                type="time"
                className="input"
                disabled={selectedAppointment?.status === "CANCELLED"}
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Descrição / Notas</label>
            <textarea
              className="input min-h-[70px] resize-none"
              placeholder="Pauta, link de videochamada ou observações…"
              disabled={selectedAppointment?.status === "CANCELLED"}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {formErr && (
            <div className="rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-sm text-[var(--looply-color-status-danger)]">
              {formErr}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[var(--looply-color-border-default)] pt-4">
            {modalMode === "edit" && selectedAppointment?.status === "SCHEDULED" ? (
              <div>
                {!confirmCancel ? (
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-xs text-[var(--looply-color-status-danger)] hover:bg-[var(--looply-color-status-danger)]/10"
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancelar compromisso
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--looply-color-status-danger)] font-medium">
                      Confirmar cancelamento?
                    </span>
                    <button
                      type="button"
                      className="btn-secondary btn-sm text-xs"
                      onClick={() => setConfirmCancel(false)}
                    >
                      Não
                    </button>
                    <button
                      type="button"
                      className="btn-primary btn-sm text-xs bg-[var(--looply-color-status-danger)] hover:bg-[var(--looply-color-status-danger)]/90"
                      disabled={cancelAppointment.isPending}
                      onClick={handleCancel}
                    >
                      {cancelAppointment.isPending ? "Cancelando…" : "Sim, cancelar"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center justify-end gap-2">
              <button type="button" className="btn-secondary btn-sm" onClick={closeModal}>
                Fechar
              </button>
              {selectedAppointment?.status !== "CANCELLED" && (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={createAppointment.isPending || updateAppointment.isPending}
                  onClick={handleSubmit}
                >
                  {createAppointment.isPending || updateAppointment.isPending
                    ? "Salvando…"
                    : modalMode === "create"
                      ? "Criar compromisso"
                      : "Salvar alterações"}
                </button>
              )}
            </div>
          </div>
        </div>
      </ModalOrSheet>
    </div>
  );
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function monthAbbr(month: number): string {
  return MONTHS[month].slice(0, 3);
}

function weekRangeLabel(a: Date, b: Date): string {
  if (a.getMonth() === b.getMonth()) {
    return `${a.getDate()}–${b.getDate()} ${monthAbbr(a.getMonth())} ${a.getFullYear()}`;
  }
  return `${a.getDate()} ${monthAbbr(a.getMonth())} – ${b.getDate()} ${monthAbbr(b.getMonth())} ${b.getFullYear()}`;
}

function dayLabel(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${monthAbbr(d.getMonth())} ${d.getFullYear()}`;
}

function entryTime(item: CalendarEntry): string {
  const iso =
    item.origin === "PUBLICATION"
      ? item.data.scheduledAt ?? item.data.publicationTarget
      : item.data.startsAt;
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function groupByDay(
  entries: { when: Date; item: CalendarEntry }[],
): [string, { when: Date; item: CalendarEntry }[]][] {
  const groups = new Map<string, { when: Date; item: CalendarEntry }[]>();
  for (const e of entries) {
    const k = dateKey(e.when);
    const arr = groups.get(k) ?? [];
    arr.push(e);
    groups.set(k, arr);
  }
  return Array.from(groups.values()).map(
    (arr): [string, { when: Date; item: CalendarEntry }[]] => [dayLabel(arr[0].when), arr],
  );
}

function EntryChip({
  item,
  onAppointment,
}: {
  item: CalendarEntry;
  onAppointment: (app: Appointment) => void;
}) {
  if (item.origin === "PUBLICATION") {
    const p = item.data;
    return (
      <Link
        to={`/contents/${p.id}`}
        onClick={(e) => e.stopPropagation()}
        className="block truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: p.client?.brandColor ?? "#475569" }}
        title={`${p.client?.name ?? "Demanda"} — ${p.title}`}
      >
        {p.client?.name ?? "Demanda"} · {FORMAT_LABEL[p.format]}
      </Link>
    );
  }
  const app = item.data;
  const isCancelled = app.status === "CANCELLED";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAppointment(app);
      }}
      className={`w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors ${
        isCancelled
          ? "border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] text-[var(--looply-color-text-muted)] line-through opacity-70"
          : "border-brand-300 bg-brand-50/70 text-brand-800 hover:bg-brand-100"
      }`}
      title={`Compromisso: ${app.title}`}
    >
      📅 {app.title}
    </button>
  );
}
