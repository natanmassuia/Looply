import { describe, expect, it } from "vitest";
import { parseProvisionArgs } from "../src/scripts/provision";

describe("parseProvisionArgs", () => {
  it("returns positionals when no flags are given", () => {
    const r = parseProvisionArgs(["Ana", "a@x.com", "Acme"]);
    expect(r.positionals).toEqual(["Ana", "a@x.com", "Acme"]);
    expect(r.phoneNumberId).toBeUndefined();
    expect(r.sourcePhone).toBeUndefined();
  });

  it("extracts --phone-number-id and --source-phone, keeping positionals", () => {
    const r = parseProvisionArgs([
      "Ana", "a@x.com", "Acme",
      "--phone-number-id", "123456",
      "--source-phone", "+5511999998888",
    ]);
    expect(r.positionals).toEqual(["Ana", "a@x.com", "Acme"]);
    expect(r.phoneNumberId).toBe("123456");
    expect(r.sourcePhone).toBe("+5511999998888");
  });
});
