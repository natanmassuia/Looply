import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { avatarColor } from "../lib/format";
import ContactAvatar from "../features/inbox/components/ContactAvatar";

describe("avatarColor", () => {
  it("is deterministic for the same seed", () => {
    expect(avatarColor("+5511999998888")).toEqual(avatarColor("+5511999998888"));
  });

  it("differs for different seeds and always returns white text on an hsl bg", () => {
    const a = avatarColor("+5511999998888");
    const b = avatarColor("+5511222223333");
    expect(a.bg).not.toEqual(b.bg);
    expect(a.fg).toBe("#ffffff");
    expect(a.bg).toMatch(/^hsl\(\d+ 52% 40%\)$/);
  });

  it("does not throw on an empty seed", () => {
    expect(() => avatarColor("")).not.toThrow();
  });
});

describe("ContactAvatar", () => {
  it("renders the photo when an avatarUrl is set", () => {
    const { container } = render(
      <ContactAvatar name="Maria Silva" seed="+5511999998888" avatarUrl="/api/media/file?key=x" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/api/media/file?key=x");
  });

  it("falls back to coloured initials when there is no photo", () => {
    const { container, getByText } = render(
      <ContactAvatar name="Maria Silva" seed="+5511999998888" avatarUrl={null} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(getByText("MS")).toBeInTheDocument();
  });
});
