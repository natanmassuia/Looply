import type { DB } from "../lib/db";
import { badRequest, conflict, notFound } from "../lib/errors";
import { DEFAULT_WORKFLOW_STAGES, defaultWorkflowName } from "../domain/jobWorkflow";

export async function ensureDefaultWorkflow(db: DB, companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { workspaceTemplate: true, isActive: true },
  });
  if (!company || !company.isActive || !company.workspaceTemplate) {
    throw conflict("Workspace sem template ativo");
  }

  const existing = await db.workflowDefinition.findUnique({
    where: { companyId },
    include: { stages: { orderBy: { position: "asc" } } },
  });
  if (existing) return existing;

  try {
    return await db.workflowDefinition.create({
      data: {
        companyId,
        name: defaultWorkflowName(company.workspaceTemplate),
        template: company.workspaceTemplate,
        stages: {
          create: DEFAULT_WORKFLOW_STAGES[company.workspaceTemplate].map((stage, position) => ({
            name: stage.name,
            position,
            terminal: stage.terminal,
          })),
        },
      },
      include: { stages: { orderBy: { position: "asc" } } },
    });
  } catch (error) {
    // Two first-use requests can race on the company unique constraint.
    const afterRace = await db.workflowDefinition.findUnique({
      where: { companyId },
      include: { stages: { orderBy: { position: "asc" } } },
    });
    if (afterRace) return afterRace;
    throw error;
  }
}

export async function listWorkflows(db: DB, companyId: string) {
  const workflow = await ensureDefaultWorkflow(db, companyId);
  return [workflow];
}

export async function getWorkflow(db: DB, companyId: string, workflowId: string) {
  const workflow = await db.workflowDefinition.findFirst({
    where: { id: workflowId, companyId },
    include: { stages: { orderBy: { position: "asc" } } },
  });
  if (!workflow) throw notFound("Workflow não encontrado");
  return workflow;
}

export async function assertStageInWorkflow(
  db: DB,
  companyId: string,
  workflowId: string,
  stageId: string,
) {
  const stage = await db.workflowStage.findFirst({
    where: { id: stageId, workflowId, workflow: { companyId }, active: true },
  });
  if (!stage) throw badRequest("Stage inválido para este workflow");
  return stage;
}
