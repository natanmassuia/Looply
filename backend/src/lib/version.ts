import { execSync } from "child_process";

let cachedCommit: string | null = null;

export function getCommitHash(): string {
  if (process.env.GIT_COMMIT) {
    return process.env.GIT_COMMIT;
  }
  if (cachedCommit) {
    return cachedCommit;
  }
  try {
    cachedCommit = execSync("git rev-parse --short HEAD", { timeout: 1000 }).toString().trim();
  } catch {
    cachedCommit = "dev";
  }
  return cachedCommit;
}

export const APP_VERSION = process.env.npm_package_version || "0.1.0";
