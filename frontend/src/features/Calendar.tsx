import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePublications } from "../lib/api";
import { FORMAT_LABEL, STATUS_LABEL } from "../lib/format";
import { Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/common";
import type { ContentListItem } from "../lib/types";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function Calendar() {
  const { data, isLoading, isError, error } = usePublications();
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const byDay = useMemo(() => {
    const map = new Map<string, ContentListItem[]>();
    for (const p of data ?? []) {
      const iso = p.scheduledAt ?? p.publicationTarget;
      if (!iso) continue;
      const d = new Date(iso);
      const k = dateKey(d);
      const arr = map.get(k) ?? [];
      arr.push(p);
      map.set(k, arr);
    }
    return map;
  }, [data]);

  const cells = useMemo(() => buildMonthGrid(cursor.y, cursor.m), [cursor]);

  const monthLabel = `${MONTHS[cursor.m]} ${cursor.y}`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-7">
      <PageHeader title="Calendário" crumbs={[{ label: "Calendário" }]} />

      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-700">{monthLabel}</div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary text-xs"
            onClick={() => setCursor(prevMonth(cursor))}
          >
            Anterior
          </button>
          <button className="btn-secondary text-xs" onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}>
            Hoje
          </button>
          <button className="btn-secondary text-xs" onClick={() => setCursor(nextMonth(cursor))}>
            Próximo
          </button>
        </div>
      </div>

      {isLoading && <Spinner label="Carregando calendário…" />}
      {isError && <ErrorState message={(error as Error)?.message} />}
      {data && (
        <Card className="p-0">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2">
                {d}
              </div>
            ))}
          </div>
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
                  className={`min-h-[112px] border-b border-r border-slate-100 p-1.5 ${
                    inMonth ? "bg-white" : "bg-slate-50/60"
                  }`}
                >
                  {cell && (
                    <>
                      <div
                        className={`mb-1 text-right text-xs font-medium ${
                          isToday ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white" : "text-slate-400"
                        }`}
                      >
                        {cell.getDate()}
                      </div>
                      <div className="space-y-1">
                        {items.map((p) => (
                          <Link
                            key={p.id}
                            to={`/contents/${p.id}`}
                            className="block truncate rounded px-1.5 py-1 text-[11px] font-medium text-white"
                            style={{ backgroundColor: p.client?.brandColor ?? "#475569" }}
                            title={`${p.client?.name} — ${p.title}`}
                          >
                            {p.client?.name} · {FORMAT_LABEL[p.format]}
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {data && data.length === 0 && (
        <div className="mt-4">
          <EmptyState
            title="Nada agendado"
            description="Conteúdos aprovados podem ser agendados e aparecerão aqui."
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <Legend color="#2563eb" label="Agendado" />
        <Legend color="#0d9488" label="Publicado" />
      </div>
      <div className="mt-1 text-xs text-slate-400">
        {STATUS_LABEL.SCHEDULED} / {STATUS_LABEL.PUBLISHED} e datas previstas aparecem no calendário.
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
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
