// Security containment: the seed creates demo accounts and must never run
// against production. Own module so tests import it without triggering main().
export function assertSeedAllowed(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Seed refused: NODE_ENV=production — o seed cria contas demo e só é ferramenta de dev/test (CI roda com NODE_ENV=test).",
    );
  }
}
