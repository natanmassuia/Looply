import { describe, it, expect } from "vitest";
import type { DB } from "../src/lib/db";
import {
  createAppointment,
  listAppointments,
  getAppointment,
  updateAppointment,
  cancelAppointment,
} from "../src/services/appointmentService";
import { AppError } from "../src/lib/errors";

function makeFakeDB(): DB {
  const state: {
    clients: any[];
    appointments: any[];
  } = { clients: [], appointments: [] };
  let n = 0;
  const id = () => `id_${++n}`;

  const db: any = {
    client: {
      findFirst: async ({ where }: any) =>
        state.clients.find((c) => c.id === where.id && c.companyId === where.companyId) ?? null,
    },
    appointment: {
      findFirst: async ({ where }: any) =>
        state.appointments.find((c) => c.id === where.id && c.companyId === where.companyId) ?? null,
      findMany: async ({ where, skip, take }: any) => {
        let res = state.appointments.filter((c) => c.companyId === where.companyId);
        if (where.clientId) res = res.filter((c) => c.clientId === where.clientId);
        if (where.status) res = res.filter((c) => c.status === where.status);
        res.sort((a, b) => {
          const d = a.startsAt.getTime() - b.startsAt.getTime();
          if (d !== 0) return d;
          return a.id.localeCompare(b.id);
        });
        if (skip !== undefined && take !== undefined) {
          res = res.slice(skip, skip + take);
        }
        return res;
      },
      count: async ({ where }: any) => {
        let res = state.appointments.filter((c) => c.companyId === where.companyId);
        if (where.clientId) res = res.filter((c) => c.clientId === where.clientId);
        if (where.status) res = res.filter((c) => c.status === where.status);
        return res.length;
      },
      create: async ({ data }: any) => {
        const appointment = { id: id(), createdAt: new Date(), updatedAt: new Date(), ...data };
        state.appointments.push(appointment);
        return appointment;
      },
      update: async ({ where, data }: any) => {
        const c = state.appointments.find((x) => x.id === where.id);
        Object.assign(c, data);
        c.updatedAt = new Date();
        return c;
      },
    },
    async $transaction(arg: any) {
      return typeof arg === "function" ? arg(db) : Promise.all(arg);
    },
    __state: state,
  };
  return db as unknown as DB;
}

describe("appointmentService", () => {
  describe("createAppointment", () => {
    it("creates valid Appointment with server-forced status and tenant", async () => {
      const db = makeFakeDB();
      const input = { title: "Test", startsAt: new Date("2026-09-01T10:00:00Z") };
      const appt = await createAppointment(db, "company_1", "user_1", input);
      expect(appt.title).toBe("Test");
      expect(appt.status).toBe("SCHEDULED");
      expect(appt.companyId).toBe("company_1");
      expect(appt.createdByUserId).toBe("user_1");
    });

    it("accepts null actorUserId", async () => {
      const db = makeFakeDB();
      const input = { title: "Test", startsAt: new Date("2026-09-01T10:00:00Z") };
      const appt = await createAppointment(db, "company_1", null, input);
      expect(appt.createdByUserId).toBeNull();
    });

    it("rejects empty title", async () => {
      const db = makeFakeDB();
      const input = { title: "  ", startsAt: new Date() };
      await expect(createAppointment(db, "company_1", null, input)).rejects.toThrowError(AppError);
    });

    it("rejects invalid startsAt", async () => {
      const db = makeFakeDB();
      const input = { title: "Test", startsAt: new Date("invalid") };
      await expect(createAppointment(db, "company_1", null, input)).rejects.toThrowError(AppError);
    });

    it("rejects endsAt <= startsAt", async () => {
      const db = makeFakeDB();
      const input = { title: "Test", startsAt: new Date("2026-09-01T10:00:00Z"), endsAt: new Date("2026-09-01T09:00:00Z") };
      await expect(createAppointment(db, "company_1", null, input)).rejects.toThrowError(AppError);
    });

    it("accepts same-tenant client and rejects foreign client", async () => {
      const db = makeFakeDB();
      (db as any).__state.clients.push({ id: "client_1", companyId: "company_1" });
      const inputValid = { title: "Test", startsAt: new Date("2026-09-01T10:00:00Z"), clientId: "client_1" };
      await expect(createAppointment(db, "company_1", null, inputValid)).resolves.toBeDefined();

      const inputInvalid = { title: "Test", startsAt: new Date("2026-09-01T10:00:00Z"), clientId: "client_1" };
      await expect(createAppointment(db, "company_2", null, inputInvalid)).rejects.toThrowError(AppError);
    });
  });

  describe("listAppointments and getAppointment", () => {
    it("returns only tenant appointments and respects bounds", async () => {
      const db = makeFakeDB();
      await createAppointment(db, "company_1", null, { title: "C1", startsAt: new Date("2026-09-01T10:00:00Z") });
      await createAppointment(db, "company_1", null, { title: "C2", startsAt: new Date("2026-09-02T10:00:00Z") });
      await createAppointment(db, "company_2", null, { title: "C3", startsAt: new Date("2026-09-03T10:00:00Z") });

      const res1 = await listAppointments(db, "company_1", { limit: 1 });
      expect(res1.appointments).toHaveLength(1);
      expect(res1.appointments[0].title).toBe("C1");
      expect(res1.total).toBe(2);

      const res2 = await listAppointments(db, "company_2");
      expect(res2.appointments).toHaveLength(1);
      expect(res2.appointments[0].title).toBe("C3");
    });

    it("get own appointment succeeds and foreign returns notFound", async () => {
      const db = makeFakeDB();
      const appt = await createAppointment(db, "company_1", null, { title: "C1", startsAt: new Date() });
      const found = await getAppointment(db, "company_1", appt.id);
      expect(found.id).toBe(appt.id);

      await expect(getAppointment(db, "company_2", appt.id)).rejects.toThrowError(AppError);
    });
  });

  describe("updateAppointment", () => {
    it("updates title and allows valid dates", async () => {
      const db = makeFakeDB();
      const appt = await createAppointment(db, "company_1", null, { title: "Original", startsAt: new Date("2026-09-01T10:00:00Z") });
      const updated = await updateAppointment(db, "company_1", appt.id, { title: "New", endsAt: new Date("2026-09-01T11:00:00Z") });
      expect(updated.title).toBe("New");
      expect(updated.endsAt).toEqual(new Date("2026-09-01T11:00:00Z"));
    });

    it("rejects final invalid interval", async () => {
      const db = makeFakeDB();
      const appt = await createAppointment(db, "company_1", null, { title: "Original", startsAt: new Date("2026-09-01T10:00:00Z") });
      await expect(updateAppointment(db, "company_1", appt.id, { endsAt: new Date("2026-09-01T09:00:00Z") })).rejects.toThrowError(AppError);
    });

    it("allows client reassignment, clearing, and rejects foreign client", async () => {
      const db = makeFakeDB();
      (db as any).__state.clients.push({ id: "client_1", companyId: "company_1" });
      const appt = await createAppointment(db, "company_1", null, { title: "T", startsAt: new Date("2026-09-01T10:00:00Z") });
      
      const u1 = await updateAppointment(db, "company_1", appt.id, { clientId: "client_1" });
      expect(u1.clientId).toBe("client_1");

      const u2 = await updateAppointment(db, "company_1", appt.id, { clientId: null });
      expect(u2.clientId).toBeNull();

      await expect(updateAppointment(db, "company_1", appt.id, { clientId: "client_2" })).rejects.toThrowError(AppError);
    });

    it("rejects foreign appointment update", async () => {
      const db = makeFakeDB();
      const appt = await createAppointment(db, "company_1", null, { title: "T", startsAt: new Date() });
      await expect(updateAppointment(db, "company_2", appt.id, { title: "New" })).rejects.toThrowError(AppError);
    });

    it("rejects update on cancelled appointment", async () => {
      const db = makeFakeDB();
      const appt = await createAppointment(db, "company_1", null, { title: "T", startsAt: new Date() });
      await cancelAppointment(db, "company_1", appt.id);
      await expect(updateAppointment(db, "company_1", appt.id, { title: "New" })).rejects.toThrowError(AppError);
    });
    
    it("clears end date with null", async () => {
      const db = makeFakeDB();
      const appt = await createAppointment(db, "company_1", null, { title: "T", startsAt: new Date("2026-09-01T10:00:00Z"), endsAt: new Date("2026-09-01T11:00:00Z") });
      const u1 = await updateAppointment(db, "company_1", appt.id, { endsAt: null });
      expect(u1.endsAt).toBeNull();
    });
  });

  describe("cancelAppointment", () => {
    it("cancels SCHEDULED appointment idempotently and record remains", async () => {
      const db = makeFakeDB();
      const appt = await createAppointment(db, "company_1", null, { title: "T", startsAt: new Date() });
      
      const c1 = await cancelAppointment(db, "company_1", appt.id);
      expect(c1.status).toBe("CANCELLED");
      
      const c2 = await cancelAppointment(db, "company_1", appt.id);
      expect(c2.status).toBe("CANCELLED");

      const found = await getAppointment(db, "company_1", appt.id);
      expect(found.status).toBe("CANCELLED");
    });

    it("rejects foreign appointment cancel", async () => {
      const db = makeFakeDB();
      const appt = await createAppointment(db, "company_1", null, { title: "T", startsAt: new Date() });
      await expect(cancelAppointment(db, "company_2", appt.id)).rejects.toThrowError(AppError);
    });
  });
});
