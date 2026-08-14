// Development seed for Looply Demo V1.
// Run: npm --prefix backend run seed   (needs DATABASE_URL)
// Creates team, clients, and contents spanning every workflow status so the
// dashboard, contents overview, calendar, clients and team are meaningful.
import { PrismaClient, ContentStatus, ApprovalStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { hashPassword } from "./lib/password";

const db = new PrismaClient();

const token = () => randomBytes(32).toString("hex");

function daysFromNow(days: number, hour = 12): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  // ── Company (tenant) ────────────────────────────────────────────────
  const company = await db.company.upsert({
    where: { slug: "looply-studio" },
    update: { workspaceTemplate: "MARKETING_AGENCY" },
      create: {
        name: "Looply Studio",
        slug: "looply-studio",
        isActive: true,
        // Demo data models an agency workspace (kanban, approvals, calendar).
        workspaceTemplate: "MARKETING_AGENCY",
      },
  });

  // Demo login password for ALL seeded users (dev only): looply123
  const demoHash = await hashPassword("looply123");

  // ── Team ────────────────────────────────────────────────────────────
  const users = {
    natan: await db.user.upsert({
      where: { email: "natan@looply.dev" },
      update: { passwordHash: demoHash },
      create: { name: "Natan Massuia", email: "natan@looply.dev", role: "ADMIN", active: true, passwordHash: demoHash },
    }),
    marina: await db.user.upsert({
      where: { email: "marina@looply.dev" },
      update: { passwordHash: demoHash },
      create: { name: "Marina Lopes", email: "marina@looply.dev", role: "CONTENT_MANAGER", active: true, passwordHash: demoHash },
    }),
    joao: await db.user.upsert({
      where: { email: "joao@looply.dev" },
      update: { passwordHash: demoHash },
      create: { name: "João Silva", email: "joao@looply.dev", role: "EDITOR", active: true, passwordHash: demoHash },
    }),
    ana: await db.user.upsert({
      where: { email: "ana@looply.dev" },
      update: { passwordHash: demoHash },
      create: { name: "Ana Costa", email: "ana@looply.dev", role: "SOCIAL_MEDIA", active: true, passwordHash: demoHash },
    }),
    lucas: await db.user.upsert({
      where: { email: "lucas@looply.dev" },
      update: { passwordHash: demoHash },
      create: { name: "Lucas Prado", email: "lucas@looply.dev", role: "DESIGNER", active: true, passwordHash: demoHash },
    }),
  };

  // ── Memberships (all demo users belong to the demo company) ─────────
  for (const [key, u] of Object.entries(users)) {
    const role = key === "natan" ? "OWNER" : "MEMBER";
    await db.companyMember.upsert({
      where: { userId_companyId: { userId: u.id, companyId: company.id } },
      update: { role },
      create: { userId: u.id, companyId: company.id, role, isActive: true },
    });
  }

  // ── Clients ─────────────────────────────────────────────────────────
  const clients = {
    aurora: await db.client.upsert({
      where: { name: "Restaurante Aurora" },
      update: {},
      create: {
        name: "Restaurante Aurora",
        brandColor: "#c2410c",
        status: "ACTIVE",
        primaryContactName: "Eduardo Faria",
        primaryContactEmail: "eduardo@aurora.com",
        primaryContactPhone: "(11) 99999-1001",
        channels: ["Instagram", "Facebook"],
      },
    }),
    move: await db.client.upsert({
      where: { name: "Academia Move" },
      update: {},
      create: {
        name: "Academia Move",
        brandColor: "#2563eb",
        status: "ACTIVE",
        primaryContactName: "Patrícia Souza",
        primaryContactEmail: "patricia@move.com",
        primaryContactPhone: "(11) 99999-1002",
        channels: ["Instagram", "TikTok"],
      },
    }),
    vitta: await db.client.upsert({
      where: { name: "Clínica Vitta" },
      update: {},
      create: {
        name: "Clínica Vitta",
        brandColor: "#0d9488",
        status: "ACTIVE",
        primaryContactName: "Dra. Helena Martins",
        primaryContactEmail: "helena@vitta.com",
        primaryContactPhone: "(11) 99999-1003",
        channels: ["Instagram"],
      },
    }),
    norte: await db.client.upsert({
      where: { name: "Studio Norte" },
      update: {},
      create: {
        name: "Studio Norte",
        brandColor: "#7c3aed",
        status: "ACTIVE",
        primaryContactName: "Rafael Lima",
        primaryContactEmail: "rafael@norte.com",
        primaryContactPhone: "(11) 99999-1004",
        channels: ["Instagram", "TikTok", "YouTube"],
      },
    }),
    onze: await db.client.upsert({
      where: { name: "Bistrô Onze" },
      update: {},
      create: {
        name: "Bistrô Onze",
        brandColor: "#db2777",
        status: "ACTIVE",
        primaryContactName: "Camila Duarte",
        primaryContactEmail: "camila@onze.com",
        primaryContactPhone: "(11) 99999-1005",
        channels: ["Instagram"],
      },
    }),
  };

  // Helper to create a content with its initial version + status + responsible.
  type Cfg = {
    title: string;
    client: { id: string };
    format: "POST" | "REELS" | "STORY" | "CAROUSEL" | "VIDEO" | "IMAGE";
    channel: string;
    responsibleId: string;
    status: ContentStatus;
    caption: string;
    mediaSeed: string;
    publicationTarget?: Date;
    scheduledAt?: Date;
    publishedAt?: Date;
  };

  async function makeContent(cfg: Cfg) {
    const existing = await db.content.findFirst({ where: { title: cfg.title } });
    if (existing) return existing;
    return db.content.create({
      data: {
        title: cfg.title,
        clientId: cfg.client.id,
        format: cfg.format,
        channel: cfg.channel,
        responsibleId: cfg.responsibleId,
        createdById: cfg.responsibleId,
        status: cfg.status,
        publicationTarget: cfg.publicationTarget ?? null,
        scheduledAt: cfg.scheduledAt ?? null,
        publishedAt: cfg.publishedAt ?? null,
        versions: {
          create: {
            versionNumber: 1,
            caption: cfg.caption,
            mediaUrl: `https://picsum.photos/seed/${cfg.mediaSeed}/900/900`,
            mediaType: "image/jpeg",
            createdById: cfg.responsibleId,
          },
        },
      },
      include: { versions: true },
    });
  }

  // ── Contents spanning all statuses ──────────────────────────────────
  const diaDosPais = await makeContent({
    title: "Campanha Dia dos Pais",
    client: clients.aurora,
    format: "REELS",
    channel: "Instagram",
    responsibleId: users.lucas.id,
    status: "AWAITING_CLIENT",
    caption:
      "Neste Dia dos Pais, traga quem você ama para o Restaurante Aurora. Reserve já a mesa especial. 💛",
    mediaSeed: "diadospais",
    publicationTarget: daysFromNow(10, 19),
  });

  const tourUnidade = await makeContent({
    title: "Tour da nova unidade",
    client: clients.move,
    format: "VIDEO",
    channel: "Instagram",
    responsibleId: users.ana.id,
    status: "CHANGES_REQUESTED",
    caption: "Conheça cada detalhe da nossa nova unidade! Tour completo em vídeo.",
    mediaSeed: "tourunidade",
    publicationTarget: daysFromNow(6, 9),
  });

  await makeContent({
    title: "Dicas de prevenção",
    client: clients.vitta,
    format: "CAROUSEL",
    channel: "Instagram",
    responsibleId: users.marina.id,
    status: "APPROVED",
    caption: "5 dicas simples de prevenção para o dia a dia. Salve e compartilhe com quem você cuida.",
    mediaSeed: "dicasprev",
    publicationTarget: daysFromNow(4, 8),
  });

  await makeContent({
    title: "Menu executivo",
    client: clients.onze,
    format: "POST",
    channel: "Instagram",
    responsibleId: users.joao.id,
    status: "SCHEDULED",
    caption: "O novo menu executivo do Bistrô Onze está pronto. De segunda a sexta, ao meio-dia.",
    mediaSeed: "menuexec",
    publicationTarget: daysFromNow(3, 12),
    scheduledAt: daysFromNow(3, 12),
  });

  await makeContent({
    title: "Bastidores da equipe",
    client: clients.norte,
    format: "REELS",
    channel: "Instagram",
    responsibleId: users.lucas.id,
    status: "PUBLISHED",
    caption: "Bastidores de mais um dia incrível no Studio Norte. A equipe que ama o que faz!",
    mediaSeed: "bastidores",
    publicationTarget: daysFromNow(-5, 15),
    publishedAt: daysFromNow(-5, 15),
  });

  await makeContent({
    title: "Depoimento aluno",
    client: clients.move,
    format: "REELS",
    channel: "TikTok",
    responsibleId: users.ana.id,
    status: "IN_REVIEW",
    caption: "Veja o depoimento do Pedro sobre a transformação dele na Academia Move.",
    mediaSeed: "depoimento",
    publicationTarget: daysFromNow(8, 10),
  });

  await makeContent({
    title: "Novo cardápio",
    client: clients.aurora,
    format: "CAROUSEL",
    channel: "Instagram",
    responsibleId: users.joao.id,
    status: "DRAFT",
    caption: "Confira os pratos do nosso novo cardápio de inverno.",
    mediaSeed: "novocardapio",
  });

  // ── Approvals (public links) ────────────────────────────────────────
  const publicBase = (process.env.PUBLIC_APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const diaVersion = await db.contentVersion.findFirstOrThrow({
    where: { contentId: diaDosPais.id },
    orderBy: { versionNumber: "desc" },
  });

  // PENDING approval → reviewer can approve OR request changes on this one.
  const diaToken = token();
  await db.approval.upsert({
    where: { token: diaToken },
    update: {},
    create: {
      contentId: diaDosPais.id,
      contentVersionId: diaVersion.id,
      token: diaToken,
      status: "PENDING" as ApprovalStatus,
    },
  });

  // CHANGES_REQUESTED already decided on the tour content (history example).
  const tourVersion = await db.contentVersion.findFirstOrThrow({
    where: { contentId: tourUnidade.id },
    orderBy: { versionNumber: "desc" },
  });
  const tourToken = token();
  await db.approval.upsert({
    where: { token: tourToken },
    update: {},
    create: {
      contentId: tourUnidade.id,
      contentVersionId: tourVersion.id,
      token: tourToken,
      status: "CHANGES_REQUESTED" as ApprovalStatus,
      feedback: "Prefiro que a entrada comece mostrando a fachada da unidade e o endereço. O resto está ótimo!",
      clientName: "Patrícia Souza",
      clientReviewedAt: new Date(),
    },
  });

  console.log("\n── Looply demo seed concluído ──");
  console.log(`Aprovação (Pendente) — Campanha Dia dos Pais:\n  ${publicBase}/approve/${diaToken}`);
  console.log(`Aprovação (Alterações) — Tour da nova unidade:\n  ${publicBase}/approve/${tourToken}\n`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
