import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PhoneInput, { normalizePhoneInput, serializePhoneForApi, hydratePhone } from "../components/PhoneInput";

describe("F14.5 PhoneInput adaptive formatting", () => {
  it("renders raw digits as formatted display", () => {
    render(<PhoneInput value="16994050998" onChange={() => {}} aria-label="Telefone" />);
    expect(screen.getByLabelText("Telefone")).toHaveValue("(16) 99405-0998");
  });

  it("formats landline", () => {
    render(<PhoneInput value="1633224455" onChange={() => {}} aria-label="Telefone" />);
    expect(screen.getByLabelText("Telefone")).toHaveValue("(16) 3322-4455");
  });

  it("input strips non-digits and caps at 11", () => {
    expect(normalizePhoneInput("(16) 99405-0998 abc")).toBe("16994050998");
    expect(normalizePhoneInput("123456789012345")).toBe("12345678901");
  });

  it("serialize returns raw digits", () => {
    expect(serializePhoneForApi("(16) 99405-0998")).toBe("16994050998");
  });

  it("hydrate normalizes existing server values (formatted or raw)", () => {
    expect(hydratePhone("(16) 99405-0998")).toBe("16994050998");
    expect(hydratePhone("16994050998")).toBe("16994050998");
    expect(hydratePhone(null)).toBe("");
  });

  it("typed input updates canonical raw digits", () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} aria-label="Telefone" />);
    fireEvent.change(screen.getByLabelText("Telefone"), { target: { value: "(16) 99405" } });
    expect(onChange).toHaveBeenCalledWith("1699405");
  });
});
