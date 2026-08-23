import type { ConversationMessageDto } from "../../../../lib/types";

interface Props {
  action: NonNullable<ConversationMessageDto["action"]>;
  fromMe: boolean;
}

export default function ActionCard({ action, fromMe }: Props) {
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
        <div
          className={`mt-2 rounded-xl p-3 border text-left ${
            fromMe
              ? "bg-white/10 border-white/20 text-white"
              : "bg-[var(--looply-color-bg-surface,#ffffff)] border-emerald-500/30 text-[var(--looply-color-text-primary,#18181b)] shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[12px]">
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>Compromisso Agendado pela IA</span>
          </div>
          <p className="text-[13px] font-semibold">{title}</p>
          {formattedDate && (
            <p
              className={`text-[11.5px] mt-0.5 ${
                fromMe
                  ? "text-white/80"
                  : "text-[var(--looply-color-text-muted,#71717a)]"
              }`}
            >
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
      const badgeColor = isAccepted
        ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30"
        : isRejected
        ? "text-rose-600 bg-rose-50 dark:bg-rose-950/30 border-rose-500/30"
        : "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-500/30";

      const label = isAccepted
        ? "Confirmação Aceita"
        : isRejected
        ? "Confirmação Recusada"
        : "Aguardando Confirmação";

      return (
        <div
          className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badgeColor}`}
        >
          <span>{label}</span>
        </div>
      );
    }

    case "JOB_CREATED": {
      const jobTitle = (meta.title as string) || "Demanda Criada";
      return (
        <div
          className={`mt-2 rounded-xl p-3 border text-left ${
            fromMe
              ? "bg-white/10 border-white/20 text-white"
              : "bg-[var(--looply-color-bg-surface,#ffffff)] border-blue-500/30 text-[var(--looply-color-text-primary,#18181b)] shadow-sm"
          }`}
        >
          <div className="flex items-center gap-2 mb-1 text-[var(--looply-color-text-brand,#2563eb)] font-bold text-[12px]">
            <span>Demanda Registrada</span>
          </div>
          <p className="text-[13px] font-semibold">{jobTitle}</p>
        </div>
      );
    }

    case "AI_ERROR": {
      const errorMsg = (meta.summary as string) || (meta.error as string) || "Erro no processamento da IA";
      return (
        <div className="mt-2 rounded-xl p-3 border bg-rose-50 dark:bg-rose-950/20 border-rose-500/30 text-rose-700 dark:text-rose-300 text-left text-xs font-medium">
          <div className="font-bold mb-0.5">Aviso do Assistente:</div>
          <div>{errorMsg}</div>
        </div>
      );
    }

    default:
      return null;
  }
}
