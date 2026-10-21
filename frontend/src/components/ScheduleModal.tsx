import { useState, useEffect } from "react";
import ModalOrSheet from "./ModalOrSheet";
import { useCreateAppointment, useMe, ApiError, apiFetch } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { gmtOffsetLabel } from "../lib/format";

// F14.4 — Kanban → Scheduling handoff. When an eligible card (Aprovado) is
// dropped into Agendado, this modal captures date/time, creates the canonical
// Appointment, and then moves the demand to Agendado. The card is NOT committed
// until the Appointment succeeds; cancel/error leaves the original column.

export interface ScheduleIntent {
  id: string;
  title: string;
  clientId: string;
}

export default function ScheduleModal({
  intent,
  onClose,
  onSuccess,
}: {
  intent: ScheduleIntent | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const createAppointment = useCreateAppointment();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const timeZone = me?.workspace?.timezone;

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Reset when a new intent opens.
  useEffect(() => {
    if (intent) {
      setDate("");
      setTime("");
      setErr(null);
    }
  }, [intent?.id]);

  if (!intent) return null;

  const offset = gmtOffsetLabel(timeZone);

  const submit = async () => {
    if (!date || !time) {
      setErr("Informe data e horário.");
      return;
    }
    // Build the ISO datetime from the local wall-clock inputs.
    const startsAt = new Date(`${date}T${time}:00`).toISOString();

    setPending(true);
    setErr(null);
    try {
      // 1. Create the canonical Appointment first (domain authority).
      await createAppointment.mutateAsync({
        title: intent.title,
        clientId: intent.clientId || undefined,
        startsAt,
      });
      // 2. Move the demand to Agendado (sets status + scheduledAt server-side).
      await apiFetch(`/api/contents/${intent.id}/schedule`, {
        method: "POST",
        body: { scheduledAt: startsAt },
      });
      // 3. Invalidate the affected queries so Kanban + Agenda + Dashboard update live.
      qc.invalidateQueries({ queryKey: ["contents"] });
      qc.invalidateQueries({ queryKey: ["content", intent.id] });
      qc.invalidateQueries({ queryKey: ["jobActivity", intent.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["publications"] });
      onSuccess();
      onClose();
    } catch (e) {
      // Card was never committed → it stays in its original column.
      setErr(e instanceof ApiError ? e.message : "Falha ao agendar conteúdo.");
    } finally {
      setPending(false);
    }
  };

  return (
    <ModalOrSheet
      isOpen={Boolean(intent)}
      onClose={onClose}
      title="Agendar conteúdo"
      subtitle={`${intent.title}${offset ? ` · Horário da empresa ${offset}` : ""}`}
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="schedule-date">Data</label>
          <input
            id="schedule-date"
            type="date"
            className="input w-full"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="schedule-time">Horário</label>
          <input
            id="schedule-time"
            type="time"
            className="input w-full"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        {offset && (
          <p className="text-[11px] text-[var(--looply-color-text-muted)]">
            Horário da empresa · {offset}
          </p>
        )}
        {err && (
          <div className="rounded-lg bg-[var(--looply-color-status-danger)]/10 px-3 py-2 text-xs text-[var(--looply-color-status-danger)]">
            {err}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--looply-color-border-default)] pt-3">
          <button type="button" className="btn-secondary btn-sm" onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button type="button" className="btn-primary btn-sm" onClick={submit} disabled={pending}>
            {pending ? "Agendando…" : "Agendar conteúdo"}
          </button>
        </div>
      </div>
    </ModalOrSheet>
  );
}
