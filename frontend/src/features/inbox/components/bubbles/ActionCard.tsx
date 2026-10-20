import type { ConversationMessageDto } from "../../../../lib/types";

interface Props {
  action: NonNullable<ConversationMessageDto["action"]>;
  fromMe: boolean;
}

export default function ActionCard({ action }: Props) {
  const type = action.type;
  const meta = action.metadata || {};

  switch (type) {
    case "APPOINTMENT_CREATED": {
      const title = (meta.title as string) || "Agendamento Criado";
      const startsAt = meta.startsAt as string | undefined;
      const formattedDate = startsAt
        ? new Date(startsAt).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null;

      return (
        <div className="mt-2 rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-3 text-left text-[var(--looply-color-text-primary)]">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-[var(--looply-color-status-success)]">
            <span className="h-2 w-2 rounded-full bg-[var(--looply-color-status-success)]" />
            <span>Compromisso Agendado pela IA</span>
          </div>
          <p className="text-xs font-bold text-[var(--looply-color-text-primary)]">{title}</p>
          {formattedDate && (
            <p className="mt-0.5 text-[11px] text-[var(--looply-color-text-secondary)]">
              Horário: {formattedDate}
            </p>
          )}
        </div>
      );
    }

    case "CONFIRMATION_PENDING":
    case "CONFIRMATION_ACCEPTED":
    case "CONFIRMATION_REJECTED": {
      const isAccepted = type === "CONFIRMATION_ACCEPTED";
      const isRejected = type === "CONFIRMATION_REJECTED";
      const dotColor = isAccepted
        ? "bg-[var(--looply-color-status-success)]"
        : isRejected
        ? "bg-[var(--looply-color-status-danger)]"
        : "bg-[var(--looply-color-action-primary)]";

      const label = isAccepted
        ? "Confirmação Aceita"
        : isRejected
        ? "Confirmação Recusada"
        : "Aguardando Confirmação";

      return (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--looply-color-text-primary)]">
          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          <span>{label}</span>
        </div>
      );
    }

    case "JOB_CREATED": {
      const jobTitle = (meta.title as string) || "Demanda Criada";
      return (
        <div className="mt-2 rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-bg-surface)] p-3 text-left text-[var(--looply-color-text-primary)]">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-[var(--looply-color-text-brand)]">
            <span className="h-2 w-2 rounded-full bg-[var(--looply-color-action-primary)]" />
            <span>Demanda Registrada</span>
          </div>
          <p className="text-xs font-bold text-[var(--looply-color-text-primary)]">{jobTitle}</p>
        </div>
      );
    }

    case "AI_ERROR": {
      const errorMsg =
        (meta.summary as string) ||
        (meta.error as string) ||
        "Erro no processamento da IA";
      return (
        <div className="mt-2 rounded-[10px] border border-[var(--looply-color-border-default)] bg-[var(--looply-color-coral-100)] p-3 text-left text-xs font-medium text-[var(--looply-color-text-primary)]">
          <div className="mb-0.5 font-bold text-[var(--looply-color-status-danger)]">
            Aviso do Assistente:
          </div>
          <div>{errorMsg}</div>
        </div>
      );
    }

    default:
      return null;
  }
}
