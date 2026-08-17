import { useNavigate } from "react-router-dom";
import { useContents } from "../lib/api";
import type { Client } from "../lib/types";
import { FORMAT_LABEL, relativeTime } from "../lib/format";
import StatusPill from "../components/StatusPill";
import ModalOrSheet from "../components/ModalOrSheet";
import { Spinner } from "../components/common";

export interface ClientDemandsModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ClientDemandsModal({
  client,
  isOpen,
  onClose,
}: ClientDemandsModalProps) {
  const navigate = useNavigate();
  const { data: allContents, isLoading } = useContents();

  if (!client) return null;

  const clientContents = (allContents ?? []).filter(
    (c) => c.clientId === client.id && c.status !== "PUBLISHED"
  );

  const count = clientContents.length;
  const countLabel = count === 1 ? "1 demanda ativa" : `${count} demandas ativas`;

  return (
    <ModalOrSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Demandas — ${client.name}`}
      subtitle={countLabel}
      maxWidth="max-w-xl"
    >
      {isLoading ? (
        <div className="py-8">
          <Spinner label="Carregando demandas…" />
        </div>
      ) : clientContents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-2 text-sm font-semibold text-[var(--looply-color-text-primary)]">
            Nenhuma demanda ativa
          </div>
          <p className="text-xs text-[var(--looply-color-text-muted)] max-w-xs">
            Este cliente não possui demandas em andamento no momento.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {clientContents.map((demand) => (
            <button
              key={demand.id}
              type="button"
              onClick={() => {
                onClose();
                navigate(`/contents/${demand.id}`);
              }}
              className="flex w-full flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-3.5 text-left transition-all hover:border-[var(--looply-color-action-primary)] hover:shadow-looply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--looply-color-focus)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: client.brandColor ?? "#475569" }}
                  />
                  <span className="truncate text-xs font-semibold text-[var(--looply-color-text-primary)]">
                    {demand.title}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--looply-color-text-muted)]">
                  <span>{FORMAT_LABEL[demand.format]}</span>
                  <span>·</span>
                  <span>Atualizado {relativeTime(demand.updatedAt)}</span>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <StatusPill status={demand.status} />
                <span className="text-[12px] font-medium text-[var(--looply-color-action-primary)]">
                  Abrir →
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </ModalOrSheet>
  );
}
