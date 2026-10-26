import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/lib/db";
import { createAppointment } from "../src/services/appointmentService";
import { AppError } from "../src/lib/errors";

// DB-gated: the overlap guard relies on a Postgres advisory lock + transaction,
// so it only means anything against a real database.
describe.skipIf(!process.env.DATABASE_URL)("Appointment overlap (race-safe)", () => {
  let companyId: string;
  // Unique far-future, hours-agnostic slot so reruns never collide.
  const base = new Date("2031-03-05T13:00:00.000Z"); // a Wednesday
  const slot = { startsAt: base, endsAt: new Date(base.getTime() + 60 * 60000) };

  beforeAll(async () => {
    const company = await prisma.company.create({ data: { name: `Overlap Test ${Date.now()}`, isActive: true } });
    companyId = company.id;
  });

  afterAll(async () => {
    if (companyId) {
      await prisma.appointment.deleteMany({ where: { companyId } });
      await prisma.company.delete({ where: { id: companyId } });
    }
  });

  it("rejects a second overlapping appointment with a conflict", async () => {
    await createAppointment(prisma, companyId, null, { title: "A", ...slot });
    await expect(
      createAppointment(prisma, companyId, null, {
        title: "B",
        startsAt: new Date(base.getTime() + 30 * 60000), // overlaps the first
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("lets only one of two simultaneous requests win the same slot", async () => {
    const t = new Date("2031-03-06T13:00:00.000Z"); // Thursday, fresh slot
    const results = await Promise.allSettled([
      createAppointment(prisma, companyId, null, { title: "X", startsAt: t, endsAt: new Date(t.getTime() + 60 * 60000) }),
      createAppointment(prisma, companyId, null, { title: "Y", startsAt: t, endsAt: new Date(t.getTime() + 60 * 60000) }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});
