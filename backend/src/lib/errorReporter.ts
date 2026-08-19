// Minimal pluggable error-reporting seam (R2.2).
//
// There is NO error-monitoring vendor configured today. This module provides a
// tiny seam so a future Contabo deployment can connect a provider (Sentry,
// Datadog, a webhook, etc.) WITHOUT changing business code: call `reportError`
// at failure points and register the actual transport once at boot via
// `setErrorReporter`. The default reporter is a no-op (falls back to the
// logger, which already emitted the structured error line).
//
// No dependency is introduced. Never include secrets/tokens/credentials in the
// reported entry.

export interface ErrorReportEntry {
  message: string;
  errorName?: string;
  code?: string;
  requestId?: string;
  companyId?: string;
  method?: string;
  path?: string;
  status?: number;
  component?: string;
  error?: unknown;
}

export type ErrorReporter = (entry: ErrorReportEntry) => void;

let active: ErrorReporter | null = null;

export function setErrorReporter(reporter: ErrorReporter | null): void {
  active = reporter;
}

export function reportError(entry: ErrorReportEntry): void {
  if (active) {
    try {
      active(entry);
    } catch {
      // The reporter itself must never take the process down or leak.
    }
  }
}
