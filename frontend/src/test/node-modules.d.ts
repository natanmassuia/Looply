// Minimal ambient types for node built-ins used by src/tests/theme.test.tsx.
// Keeps the frontend free of a full @types/node dependency.
declare module "node:fs" {
  export function readFileSync(path: string, encoding?: string): string;
}
declare const process: { cwd(): string };