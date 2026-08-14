import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type {
  Dashboard,
  Client,
  ContentListItem,
  ContentDetail,
  ContentStatus,
  ContentVersion,
  User,
  WorkspaceContext,
} from "./types";

// Relative in dev (Vite proxies /api → backend). Override with VITE_API_URL.
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Backend sends Retry-After (seconds) on 429. Parse defensively.
function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (raw === null) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : undefined;
}

export interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  // Shared client for every domain call — no direct fetch bypasses.
  const { method, body, signal, headers } = options;
  const init: RequestInit = {
    method,
    signal,
    credentials: "include",
    headers: {
      // JSON content-type only when a JSON body is sent.
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();

  if (!res.ok) {
    let code: string | undefined;
    let message = `Erro ${res.status}`;
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: { code?: string; message?: string } };
        code = parsed.error?.code;
        message = parsed.error?.message ?? message;
      } catch {
        // Non-JSON error body: keep generic message, never leak raw body.
      }
    }
    throw new ApiError(res.status, message, code, parseRetryAfter(res));
  }

  // 204 / empty body → null as T.
  if (res.status === 204 || text === "") return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Non-JSON success body: return raw text.
    return text as unknown as T;
  }
}

// TanStack Query retry policy: never retry 4xx (client errors are deterministic);
// allow one retry for transient server/network failures.
const NO_RETRY_STATUSES = [400, 401, 403, 404, 409, 413, 429];

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  if (error instanceof ApiError) return !NO_RETRY_STATUSES.includes(error.status);
  return true; // network errors
}

// ── Auth ───────────────────────────────────────────────────────────────────
export interface SessionMembership {
  companyId: string;
  companyName: string;
  role: string;
}

export interface SessionInfo {
  user: { id: string; name: string; email: string };
  activeCompanyId: string;
  mustChangePassword: boolean;
  memberships: SessionMembership[];
  workspace: WorkspaceContext | null;
}

export function useLogin() {
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiFetch<SessionInfo>("/api/auth/login", { method: "POST", body }),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: true }>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => qc.clear(),
  });
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<SessionInfo>("/api/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Queries ────────────────────────────────────────────────────────────────
export const useDashboard = (opts?: Partial<UseQueryOptions<Dashboard>>) =>
  useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<Dashboard>("/api/dashboard"),
    ...opts,
  });

export const useClients = () =>
  useQuery({
    queryKey: ["clients"],
    queryFn: () => apiFetch<{ clients: Client[] }>("/api/clients").then((r) => r.clients),
  });

export const useTeam = () =>
  useQuery({
    queryKey: ["team"],
    queryFn: () => apiFetch<{ team: User[] }>("/api/team").then((r) => r.team),
  });

export const useContents = (status?: ContentStatus) =>
  useQuery({
    queryKey: ["contents", status ?? "all"],
    queryFn: () =>
      apiFetch<{ contents: ContentListItem[] }>(
        `/api/contents${status ? `?status=${status}` : ""}`,
      ).then((r) => r.contents),
  });

export const useContent = (id: string) =>
  useQuery({
    queryKey: ["content", id],
    queryFn: () => apiFetch<ContentDetail>(`/api/contents/${id}`),
    enabled: !!id,
  });

export const usePublications = () =>
  useQuery({
    queryKey: ["publications"],
    queryFn: () =>
      apiFetch<{ publications: ContentListItem[] }>("/api/publications").then(
        (r) => r.publications,
      ),
  });

export const useApproval = (token: string) =>
  useQuery({
    queryKey: ["approval", token],
    queryFn: () =>
      apiFetch<{
        id: string;
        status: string;
        feedback?: string | null;
        createdAt?: string;
        content: ContentDetail;
        version: ContentVersion;
      }>(`/api/public/approvals/${token}`),
    enabled: !!token,
  });

// ── Mutations ──────────────────────────────────────────────────────────────
export function useWorkflowAction(pathBuilder: (id: string) => string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: unknown }) =>
      apiFetch(pathBuilder(id), {
        method: "POST",
        body: body ?? undefined,
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["content", vars.id] });
      qc.invalidateQueries({ queryKey: ["contents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["publications"] });
    },
  });
}

export interface CreateContentPayload {
  title: string;
  clientId: string;
  format: ContentListItem["format"];
  channel?: string;
  responsibleId?: string;
  publicationTarget?: string;
  notes?: string;
  caption: string;
  mediaUrl?: string;
  mediaType?: string;
}

export function useCreateContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateContentPayload) =>
      apiFetch<ContentListItem>("/api/contents", {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name: string;
      brandColor?: string;
      primaryContactName?: string;
      primaryContactEmail?: string;
      primaryContactPhone?: string;
      channels?: string[];
    }) => apiFetch<Client>("/api/clients", { method: "POST", body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateVersion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { caption: string; mediaUrl?: string; mediaType?: string; changeNote?: string }) =>
      apiFetch<ContentVersion>(`/api/contents/${id}/versions`, {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content", id] });
      qc.invalidateQueries({ queryKey: ["contents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useGroupContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ childId, parentId }: { childId: string; parentId: string }) =>
      apiFetch(`/api/contents/${childId}/group`, {
        method: "POST",
        body: { parentId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUngroupContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (childId: string) =>
      apiFetch(`/api/contents/${childId}/ungroup`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export type UserRole = "ADMIN" | "CONTENT_MANAGER" | "EDITOR" | "SOCIAL_MEDIA" | "DESIGNER";

export function useCreateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; email: string; role: UserRole; active?: boolean }) =>
      apiFetch<User>("/api/team", { method: "POST", body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ── Public approval actions ────────────────────────────────────────────────
export function useApprovePublic(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { reviewerName?: string }) =>
      apiFetch(`/api/public/approvals/${token}/approve`, {
        method: "POST",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approval", token] }),
  });
}

export function useRequestChangesPublic(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { feedback: string; reviewerName?: string }) =>
      apiFetch(`/api/public/approvals/${token}/request-changes`, {
        method: "POST",
        body,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approval", token] }),
  });
}
