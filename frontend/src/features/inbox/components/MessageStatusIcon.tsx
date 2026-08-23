import type { MessageDeliveryStatus } from "../../../lib/types";

interface Props {
  status: MessageDeliveryStatus;
  className?: string;
}

export default function MessageStatusIcon({ status, className = "w-3.5 h-3.5" }: Props) {
  switch (status) {
    case "PENDING":
      return (
        <svg
          className={`${className} opacity-60`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-label="Pendente"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "SENT":
      return (
        <svg
          className={`${className} opacity-75`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          aria-label="Enviada"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      );

    case "DELIVERED":
      return (
        <svg
          className={`${className} opacity-80`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-label="Entregue"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l3.5 3.5L14 8" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13l3.5 3.5L20 8" />
        </svg>
      );

    case "READ":
      return (
        <svg
          className={`${className} text-cyan-300 dark:text-cyan-400`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.2}
          aria-label="Lida"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l3.5 3.5L14 8" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 13l3.5 3.5L20 8" />
        </svg>
      );

    case "FAILED":
      return (
        <svg
          className={`${className} text-rose-400`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-label="Falha no envio"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      );

    default:
      return null;
  }
}
