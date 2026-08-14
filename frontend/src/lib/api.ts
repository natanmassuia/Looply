import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type {
  Dashboard,
  Client,
  User,
  ContentListItem,
  ContentDetail,
  ContentStatus,
  ContentVersion,
} from "./types";

// Relative in dev (Vite proxies /api → backend). Override with VITE_API_URL.
const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.error?.message ?? `Erro ${res.status}`;
    throw new ApiError(res.status, msg, data?.error?.code);
  }
  return data as T;
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
  memberships: SessionMembership[];
}

export function useLogin() {
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiFetch<SessionInfo>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
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
        body: body ? JSON.stringify(body) : undefined,
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
        body: JSON.stringify(payload),
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
    }) => apiFetch<Client>("/api/clients", { method: "POST", body: JSON.stringify(payload) }),
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
        body: JSON.stringify(body),
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
        body: JSON.stringify({ parentId }),
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
      apiFetch<User>("/api/team", { method: "POST", body: JSON.stringify(payload) }),
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
        body: JSON.stringify(body),
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
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["approval", token] }),
  });
}
