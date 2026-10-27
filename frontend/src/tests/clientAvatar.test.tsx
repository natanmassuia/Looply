import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import ClientAvatar from "../components/ClientAvatar";

describe("ClientAvatar", () => {
  it("renders the logo with the client name as alt when logoUrl is set", () => {
    const { container } = render(
      <ClientAvatar name="Restaurante Aurora" logoUrl="/api/media/file?key=x" brandColor="#e11d48" />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("Restaurante Aurora");
  });

  it("falls back to two-letter initials, never a one-letter avatar", () => {
    const { container, getByText } = render(<ClientAvatar name="Restaurante Aurora" />);
    expect(container.querySelector("img")).toBeNull();
    expect(getByText("RA")).toBeInTheDocument();
  });

  it("uses the brand colour when present, else the brand token (no stray greys)", () => {
    const { getByText } = render(<ClientAvatar name="Cafe Solar" brandColor="#f59e0b" />);
    expect((getByText("CS") as HTMLElement).style.backgroundColor).toBe("rgb(245, 158, 11)");
    const { getByText: get2 } = render(<ClientAvatar name="Sem Cor" />);
    expect((get2("SC") as HTMLElement).style.backgroundColor).toContain("looply-color-action-primary");
  });
});
