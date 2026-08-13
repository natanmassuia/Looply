import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusPill from "../components/StatusPill";
import { STATUS_LABEL, FORMAT_LABEL, formatDate, relativeTime } from "../lib/format";

describe("format helpers", () => {
  it("exposes Portuguese labels for every content status", () => {
    expect(STATUS_LABEL.DRAFT).toBe("Rascunho");
    expect(STATUS_LABEL.AWAITING_CLIENT).toBe("Aguardando cliente");
    expect(STATUS_LABEL.CHANGES_REQUESTED).toBe("Alterações solicitadas");
    expect(STATUS_LABEL.PUBLISHED).toBe("Publicado");
  });

  it("exposes Portuguese labels for formats", () => {
    expect(FORMAT_LABEL.REELS).toBe("Reels");
    expect(FORMAT_LABEL.CAROUSEL).toBe("Carrossel");
  });

  it("formats ISO dates in pt-BR", () => {
    expect(formatDate("2026-08-13T12:00:00Z")).toMatch(/2026/);
    expect(formatDate(null)).toBe("—");
  });

  it("returns relative time buckets", () => {
    const recent = new Date(Date.now() - 3_600_000).toISOString();
    expect(relativeTime(recent)).toMatch(/há 1h/);
    expect(relativeTime(null)).toBe("—");
  });
});

describe("StatusPill", () => {
  it("renders the Portuguese status label", () => {
    render(<StatusPill status="APPROVED" />);
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
  });
});
