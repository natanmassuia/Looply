import type { DB } from "../lib/db";
import { badRequest, conflict, notFound } from "../lib/errors";
import type { WorkflowStageSemantic, Prisma } from "@prisma/client";
import { DEFAULT_WORKFLOW_STAGES, defaultWorkflowName } from "../domain/jobWorkflow";

// Semantic helpers may run inside an interactive transaction (approval flow) as
// well as against the top-level client.
type WorkflowDB = DB | Prisma.TransactionClient;

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
            semanticKey: stage.semanticKey ?? null,
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

// ── Canonical protected semantics (R1.2) ─────────────────────────────────
// The stage's semanticKey is the STABLE identity for business behavior
// (scheduling, approval, terminal). Display labels are never business logic.

export const PROTECTED_SEMANTICS: WorkflowStageSemantic[] = ["APPROVED", "SCHEDULED", "COMPLETED"];

export async function resolveStageBySemantic(
  db: WorkflowDB,
  companyId: string,
  semantic: WorkflowStageSemantic,
): Promise<{ id: string; workflowId: string } | null> {
  let stage = await db.workflowStage.findFirst({
    where: { semanticKey: semantic, active: true, workflow: { companyId } },
    select: { id: true, workflowId: true },
  });
  // Legacy workflows predate protected semantics. Upgrade them once so
  // scheduling/approval/publish stay coherent with currentStageId.
  if (!stage) {
    await ensureCompanyWorkflowSemantics(db, companyId);
    stage = await db.workflowStage.findFirst({
      where: { semanticKey: semantic, active: true, workflow: { companyId } },
      select: { id: true, workflowId: true },
    });
  }
  return stage ?? null;
}

// Set a job's currentStageId to the active stage carrying `semantic` for the
// company. Returns the job's new currentStageId, or null when no such stage.
export async function syncJobStageToSemantic(
  db: WorkflowDB,
  companyId: string,
  jobId: string,
  semantic: WorkflowStageSemantic,
): Promise<string | null> {
  const stage = await resolveStageBySemantic(db, companyId, semantic);
  if (!stage) return null;
  await db.job.updateMany({
    where: { id: jobId, companyId },
    data: { currentStageId: stage.id, workflowId: stage.workflowId },
  });
  return stage.id;
}

// Backfill canonical protected semantics for a workflow (idempotent):
// - terminal stage → semanticKey COMPLETED
// - ensure an APPROVED stage exists
// - ensure a SCHEDULED stage exists
export async function ensureWorkflowSemantics(
  db: WorkflowDB,
  workflowId: string,
  companyId: string,
  template: string,
) {
  const workflow = await db.workflowDefinition.findUnique({
    where: { id: workflowId },
    include: { stages: { orderBy: { position: "asc" } } },
  });
  if (!workflow || workflow.companyId !== companyId) throw notFound("Workflow não encontrado");

  const bySemantic = new Map<string, { id: string; terminal: boolean }>();
  for (const s of workflow.stages.filter((st) => st.active)) {
    if (s.semanticKey) bySemantic.set(s.semanticKey, s);
  }
  const changes: { id?: string; name?: string; semanticKey?: string | null; terminal?: boolean; position?: number }[] = [];

  // Terminal stage → COMPLETED (persisted).
  const terminal = workflow.stages.find((s) => s.terminal && s.active);
  if (terminal && !terminal.semanticKey) {
    await db.workflowStage.updateMany({
      where: { id: terminal.id, workflowId },
      data: { semanticKey: "COMPLETED" },
    });
    changes.push({ id: terminal.id, semanticKey: "COMPLETED" });
    bySemantic.set("COMPLETED", { id: terminal.id, terminal: true });
  }

  const defaults = DEFAULT_WORKFLOW_STAGES[template as keyof typeof DEFAULT_WORKFLOW_STAGES] ?? [];
  const maxPos = workflow.stages.reduce((m, s) => Math.max(m, s.position), -1);
  let nextPos = maxPos + 1;

  // Ensure APPROVED and SCHEDULED stages exist. Existing stage positions are
  // preserved — the backfill never reorders user configuration.
  for (const semantic of ["APPROVED", "SCHEDULED"] as WorkflowStageSemantic[]) {
    if (!bySemantic.has(semantic)) {
      const seedName = defaults.find((d) => d.semanticKey === semantic)?.name ?? (semantic === "APPROVED" ? "Aprovado" : "Agendado");
      const created = await db.workflowStage.create({
        data: {
          workflowId,
          name: seedName,
          position: nextPos++,
          terminal: false,
          active: true,
          semanticKey: semantic,
        },
      });
      bySemantic.set(semantic, { id: created.id, terminal: false });
      changes.push({ id: created.id, name: seedName, semanticKey: semantic, position: created.position });
    }
  }

  return { workflow, changes };
}

// Ensure protected semantics exist for every workflow in a company (used by
// bootstrap/provisioning and by the migration backfill path).
export async function ensureCompanyWorkflowSemantics(db: WorkflowDB, companyId: string) {
  const workflows = await db.workflowDefinition.findMany({
    where: { companyId },
    select: { id: true, template: true },
  });
  const results = [];
  for (const w of workflows) {
    results.push(await ensureWorkflowSemantics(db, w.id, companyId, w.template));
  }
  return results;
}

// ── Bounded V1 workflow configuration ────────────────────────────────────
// Simple ordered stage configuration. Stage ids are stable; display name and
// order are configurable. The content pipeline (ContentStatus) and terminal
// stage semantics are NOT driven by these labels — business logic never
// depends on editable names.

const STAGE_NAME_MAX = 80;

export async function addStage(
  db: DB,
  companyId: string,
  workflowId: string,
  input: { name: string },
) {
  const name = input.name.trim();
  if (!name) throw badRequest("Nome da etapa é obrigatório");
  if (name.length > STAGE_NAME_MAX) throw badRequest(`Nome da etapa excede ${STAGE_NAME_MAX} caracteres`);
  const workflow = await db.workflowDefinition.findFirst({
    where: { id: workflowId, companyId },
    include: { stages: { orderBy: { position: "asc" } } },
  });
  if (!workflow) throw notFound("Workflow não encontrado");
  // Custom stages are never terminal — terminal is a protected/system semantic.
  // Only active stages determine the next dense position; archived (soft-
  // removed) stages are excluded so their high tombstone positions do not
  // inflate the count.
  const activePositions = workflow.stages.filter((s) => s.active).map((s) => s.position);
  const nextPosition = activePositions.length > 0 ? Math.max(...activePositions) + 1 : 0;
  const stage = await db.workflowStage.create({
    data: { workflowId, name, position: nextPosition, terminal: false, active: true },
  });
  return stage;
}

export async function renameStage(
  db: DB,
  companyId: string,
  workflowId: string,
  stageId: string,
  input: { name: string },
) {
  const name = input.name.trim();
  if (!name) throw badRequest("Nome da etapa é obrigatório");
  if (name.length > STAGE_NAME_MAX) throw badRequest(`Nome da etapa excede ${STAGE_NAME_MAX} caracteres`);
  const workflow = await db.workflowDefinition.findFirst({
    where: { id: workflowId, companyId },
    select: { id: true },
  });
  if (!workflow) throw notFound("Workflow não encontrado");
  const updated = await db.workflowStage.updateMany({
    where: { id: stageId, workflowId, active: true },
    data: { name },
  });
  if (updated.count === 0) throw notFound("Etapa não encontrada");
  return db.workflowStage.findFirst({ where: { id: stageId, workflowId } });
}

export async function reorderStages(
  db: DB,
  companyId: string,
  workflowId: string,
  orderedStageIds: string[],
) {
  const workflow = await db.workflowDefinition.findFirst({
    where: { id: workflowId, companyId },
    include: { stages: { orderBy: { position: "asc" } } },
  });
  if (!workflow) throw notFound("Workflow não encontrado");
  const activeIds = workflow.stages.filter((s) => s.active).map((s) => s.id);
  if (orderedStageIds.length !== activeIds.length) {
    throw badRequest("A lista de etapas não corresponde ao workflow atual");
  }
  const idSet = new Set(orderedStageIds);
  for (const id of activeIds) {
    if (!idSet.has(id)) throw badRequest("A lista de etapas está incompleta");
  }
  if (idSet.size !== activeIds.length) throw badRequest("A lista de etapas contém duplicatas");

  // Two-phase reorder within one transaction to avoid transient unique
  // collisions on [workflowId, position]: first move every stage to a high
  // temporary position, then to the final positions.
  return db.$transaction([
    ...orderedStageIds.map((id, index) =>
      db.workflowStage.updateMany({
        where: { id, workflowId, active: true },
        data: { position: 10_000 + index },
      }),
    ),
    ...orderedStageIds.map((id, position) =>
      db.workflowStage.updateMany({
        where: { id, workflowId, active: true },
        data: { position },
      }),
    ),
  ]);
}

export async function removeStage(
  db: DB,
  companyId: string,
  workflowId: string,
  stageId: string,
) {
  const workflow = await db.workflowDefinition.findFirst({
    where: { id: workflowId, companyId },
    select: { id: true },
  });
  if (!workflow) throw notFound("Workflow não encontrado");
  const stage = await db.workflowStage.findFirst({
    where: { id: stageId, workflowId, active: true },
    include: { _count: { select: { jobs: true } } },
  });
  if (!stage) throw notFound("Etapa não encontrada");
  if (stage.terminal) throw badRequest("A etapa final não pode ser removida");
  if (stage.semanticKey) throw badRequest("Etapas com semântica protegida não podem ser removidas");
  if (stage._count.jobs > 0) {
    throw conflict("Não é possível remover uma etapa que contém demandas");
  }
  // Soft archive — no destructive row deletion, so history stays intact.
  return db.$transaction(async (tx) => {
    // Park the archived stage on a unique negative position (one slot per
    // archived stage) so repeated removals never collide on
    // [workflowId, position] and never clash with the renumber ranges below.
    const lowest = await tx.workflowStage.findFirst({
      where: { workflowId },
      orderBy: { position: "asc" },
      select: { position: true },
    });
    await tx.workflowStage.updateMany({
      where: { id: stageId, workflowId },
      data: { active: false, position: Math.min(-1, (lowest?.position ?? 0) - 1) },
    });
    const remaining = await tx.workflowStage.findMany({
      where: { workflowId, active: true },
      orderBy: { position: "asc" },
    });
    // Two-phase renumber to avoid transient unique collisions on
    // [workflowId, position].
    for (let i = 0; i < remaining.length; i += 1) {
      await tx.workflowStage.update({ where: { id: remaining[i].id }, data: { position: 10_000 + 1 + i } });
    }
    for (let i = 0; i < remaining.length; i += 1) {
      await tx.workflowStage.update({ where: { id: remaining[i].id }, data: { position: i } });
    }
    return { ok: true, removedStageId: stageId };
  });
}
