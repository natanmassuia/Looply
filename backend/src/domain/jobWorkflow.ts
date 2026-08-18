import type { WorkspaceTemplate } from "./capabilities";

export interface DefaultStage {
  name: string;
  terminal: boolean;
  semanticKey?: "APPROVED" | "SCHEDULED" | "COMPLETED" | null;
}

// Canonical V1 default workflow stages. Display labels are editable; the
// semanticKey is the STABLE protected identity used by business logic
// (scheduling, approval, terminal). Never derive behavior from the label.
export const DEFAULT_WORKFLOW_STAGES: Record<WorkspaceTemplate, readonly DefaultStage[]> = {
  LOCAL_BUSINESS: [
    { name: "Novo", terminal: false, semanticKey: null },
    { name: "Em andamento", terminal: false, semanticKey: null },
    { name: "Aprovado", terminal: false, semanticKey: "APPROVED" },
    { name: "Agendado", terminal: false, semanticKey: "SCHEDULED" },
    { name: "Concluído", terminal: true, semanticKey: "COMPLETED" },
  ],
  HIGH_TICKET: [
    { name: "Novo", terminal: false, semanticKey: null },
    { name: "Em andamento", terminal: false, semanticKey: null },
    { name: "Revisão", terminal: false, semanticKey: null },
    { name: "Aprovado", terminal: false, semanticKey: "APPROVED" },
    { name: "Agendado", terminal: false, semanticKey: "SCHEDULED" },
    { name: "Concluído", terminal: true, semanticKey: "COMPLETED" },
  ],
  MARKETING_AGENCY: [
    { name: "Backlog", terminal: false, semanticKey: null },
    { name: "Em produção", terminal: false, semanticKey: null },
    { name: "Revisão", terminal: false, semanticKey: null },
    { name: "Aprovado", terminal: false, semanticKey: "APPROVED" },
    { name: "Agendado", terminal: false, semanticKey: "SCHEDULED" },
    { name: "Concluído", terminal: true, semanticKey: "COMPLETED" },
  ],
};

export function defaultWorkflowName(template: WorkspaceTemplate): string {
  if (template === "LOCAL_BUSINESS") return "Operação simples";
  if (template === "HIGH_TICKET") return "Operação de alto ticket";
  return "Operação de agência";
}
