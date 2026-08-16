import type { WorkspaceTemplate } from "./capabilities";

export interface DefaultStage {
  name: string;
  terminal: boolean;
}

export const DEFAULT_WORKFLOW_STAGES: Record<WorkspaceTemplate, readonly DefaultStage[]> = {
  LOCAL_BUSINESS: [
    { name: "Novo", terminal: false },
    { name: "Em andamento", terminal: false },
    { name: "Concluído", terminal: true },
  ],
  HIGH_TICKET: [
    { name: "Novo", terminal: false },
    { name: "Em andamento", terminal: false },
    { name: "Revisão", terminal: false },
    { name: "Concluído", terminal: true },
  ],
  MARKETING_AGENCY: [
    { name: "Backlog", terminal: false },
    { name: "Em produção", terminal: false },
    { name: "Revisão", terminal: false },
    { name: "Concluído", terminal: true },
  ],
};

export function defaultWorkflowName(template: WorkspaceTemplate): string {
  if (template === "LOCAL_BUSINESS") return "Operação simples";
  if (template === "HIGH_TICKET") return "Operação de alto ticket";
  return "Operação de agência";
}
