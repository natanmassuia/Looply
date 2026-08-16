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
import type { ContentListItem, Appointment } from "../lib/types";
import {
  IconChevronLeft,
  IconChevronRight,
  IconPlus,
  IconX,
} from "../components/Icons";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

type CalendarEntry =
  | { origin: "PUBLICATION"; data: ContentListItem; key: string }
  | { origin: "APPOINTMENT"; data: Appointment; key: string };

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
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });

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

  const cells = useMemo(() => buildMonthGrid(cursor.y, cursor.m), [cursor]);
  const monthLabel = `${MONTHS[cursor.m]} ${cursor.y}`;

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
    const dStr = d.toISOString().slice(0, 10);
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
    const startDate = start.toISOString().slice(0, 10);
    const startTime = start.toISOString().slice(11, 16);

    let endDate = "";
    let endTime = "";
    if (app.endsAt) {
      const end = new Date(app.endsAt);
      endDate = end.toISOString().slice(0, 10);
      endTime = end.toISOString().slice(11, 16);
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

    const startIso = new Date(`${form.startDate}T${form.startTime || "00:00"}:00Z`).toISOString();
    let endIso: string | undefined = undefined;

    if (form.endDate) {
      endIso = new Date(`${form.endDate}T${form.endTime || "00:00"}:00Z`).toISOString();
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
          {/* Month navigation */}
          <div className="flex items-center justify-between border-b border-[var(--looply-color-border-default)] px-5 py-3">
            <button
              className="btn-ghost btn-sm"
              onClick={() => setCursor(prevMonth(cursor))}
              aria-label="Mês anterior"
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-[0.95rem] font-bold tracking-tight text-[var(--looply-color-text-primary)]">
              {monthLabel}
            </div>
            <button
              className="btn-ghost btn-sm"
              onClick={() => setCursor(nextMonth(cursor))}
              aria-label="Próximo mês"
            >
              <IconChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-subtle)] text-center text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--looply-color-text-muted)]">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2.5">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const items = cell ? byDay.get(dateKey(cell)) ?? [] : [];
              const isToday =
                cell &&
                cell.getFullYear() === today.getFullYear() &&
                cell.getMonth() === today.getMonth() &&
                cell.getDate() === today.getDate();
              const inMonth = cell && cell.getMonth() === cursor.m;
              return (
                <div
                  key={i}
                  className={`min-h-[100px] border-b border-r border-[var(--looply-color-border-default)] p-1.5 transition-colors ${
                    inMonth ? "bg-[var(--looply-color-bg-surface)]" : "bg-[var(--looply-color-bg-subtle)]/40"
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
                        {inMonth && (
                          <button
                            type="button"
                            className="btn-ghost p-0.5 text-[10px] text-[var(--looply-color-text-muted)] opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
                            title="Adicionar compromisso neste dia"
                            onClick={() => openCreateModal(cell)}
                          >
                            <IconPlus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {items.slice(0, 3).map((item) => {
                          if (item.origin === "PUBLICATION") {
                            const p = item.data;
                            return (
                              <Link
                                key={item.key}
                                to={`/contents/${p.id}`}
                                className="block truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
                                style={{ backgroundColor: p.client?.brandColor ?? "#475569" }}
                                title={`${p.client?.name ?? "Job"} — ${p.title}`}
                              >
                                {p.client?.name ?? "Job"} · {FORMAT_LABEL[p.format]}
                              </Link>
                            );
                          } else {
                            const app = item.data;
                            const isCancelled = app.status === "CANCELLED";
                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => openEditModal(app)}
                                className={`w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors border ${
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
                        })}
                        {items.length > 3 && (
                          <div className="text-[10px] font-medium text-[var(--looply-color-text-muted)] px-1.5">
                            +{items.length - 3} mais
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!isLoading && totalItemsCount === 0 && (
        <div className="mt-4">
          <EmptyState
            title="Nada agendado"
            description="Jobs aprovados e compromissos criados aparecerão aqui na sua agenda."
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

      {/* Appointment Create/Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg shadow-looply-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="section-title">
                {modalMode === "create" ? "Novo compromisso" : "Detalhes do compromisso"}
              </h3>
              <button className="btn-ghost btn-sm" onClick={closeModal} aria-label="Fechar">
                <IconX className="h-3.5 w-3.5" />
              </button>
            </div>

            {selectedAppointment?.status === "CANCELLED" && (
              <div className="mb-4 rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-xs font-semibold text-[var(--looply-color-status-danger)]">
                Este compromisso está cancelado.
              </div>
            )}

            <div className="space-y-3 text-sm">
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

              <div className="grid grid-cols-2 gap-3">
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

              <div className="grid grid-cols-2 gap-3">
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
            </div>

            {formErr && (
              <div className="mt-3 rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-sm text-[var(--looply-color-status-danger)]">
                {formErr}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-[var(--looply-color-border-default)] pt-4">
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

              <div className="flex items-center gap-2">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Fechar
                </button>
                {selectedAppointment?.status !== "CANCELLED" && (
                  <button
                    type="button"
                    className="btn-primary"
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
          </Card>
        </div>
      )}
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

function prevMonth(c: { y: number; m: number }) {
  return c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 };
}

function nextMonth(c: { y: number; m: number }) {
  return c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 };
}
