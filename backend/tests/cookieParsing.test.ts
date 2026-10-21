import { describe, it, expect } from "vitest";
import { parseCookies } from "../src/lib/session";

describe("parseCookies", () => {
  it("does not throw on malformed percent-encoding", () => {
    expect(parseCookies("looply_session=%ZZ; other=a%20b")).toEqual({ looply_session: "%ZZ", other: "a b" });
  });
});
