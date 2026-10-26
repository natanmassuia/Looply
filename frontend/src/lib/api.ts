import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type {
  AppearanceMode,
  AppearancePreset,
  Appointment,
  AppointmentListResponse,
  AppointmentStatus,
  CustomColors,
  Dashboard,
  Client,
  CompanyMember,
  ContentListItem,
  ContentDetail,
  ContentStatus,
  ContentVersion,
  CreateAppointmentPayload,
  CreateClientPayload,
  CreateInvitationPayload,
  CreateInvitationResponse,
  Invitation,
  JobActivity,
  JobAttachment,
  MemberRole,
  OnboardingStatus,
  UpdateAppointmentPayload,
  UpdateClientPayload,
  UpdateJobPayload,
  UploadIntentResponse,
  User,
  WorkflowDefinition,
  WorkflowStage,
  WorkspaceAppearance,
  WorkspaceContext,
  WorkspaceTemplate,
  ConversationAiStatus,
  ConversationSummaryDto,
  ListConversationsParams,
  ListConversationsResponse,
  ListMessagesResponse,
} from "./types";

export type {
  ActivityType,
  Appointment,
  AppointmentListResponse,
  AppointmentStatus,
  ClientStatus,
  ConversationAiStatus,
  ConversationMessageDto,
  ConversationMessageType,
  ConversationSummaryDto,
  CreateAppointmentPayload,
  CreateClientPayload,
  CreateInvitationPayload,
  CreateInvitationResponse,
  CompanyMember,
  Invitation,
  JobActivity,
  JobAttachment,
  ListConversationsParams,
  ListConversationsResponse,
  ListMessagesResponse,
  MemberRole,
  MessageDeliveryStatus,
  MessageDirection,
  MessageSenderType,
  UpdateAppointmentPayload,
  UpdateClientPayload,
  UpdateJobPayload,
  UploadIntentResponse,
  UserRole,
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
  user: { id: string; name: string; email: string; phone?: string | null; avatarUrl?: string | null };
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
    onSuccess: () => {
      // Security boundary: cancel in-flight private queries (so stale
      // responses cannot repopulate the cache after logout) and clear ALL
      // authenticated/private server-state cache.
      qc.cancelQueries();
      qc.clear();
    },
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

// ── First-access flow (F4B) ────────────────────────────────────────────────
export function useOnboardingStatus() {
  return useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => apiFetch<OnboardingStatus>("/api/onboarding/status"),
    retry: false,
  });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { newPassword: string }) =>
      apiFetch<{ ok: true }>("/api/auth/change-password", { method: "POST", body }),
    // Session cookie is rotated server-side; refetch so the gate re-routes.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useUpdateOnboardingCompany() {
  return useMutation({
    mutationFn: (body: { name: string; website?: string; timezone: string; locale: string }) =>
      apiFetch<{ name: string; timezone: string; locale: string }>("/api/onboarding/company", {
        method: "PATCH",
        body,
      }),
  });
}

export function useSelectTemplate() {
  return useMutation({
    mutationFn: (template: WorkspaceTemplate) =>
      apiFetch<{ template: WorkspaceTemplate }>("/api/onboarding/template", {
        method: "POST",
        body: { template },
      }),
  });
}

export function useUpdateOnboardingAppearance() {
  return useMutation({
    mutationFn: (body: { preset: AppearancePreset; mode: AppearanceMode }) =>
      apiFetch<{ appearance: WorkspaceAppearance }>("/api/onboarding/appearance", {
        method: "PATCH",
        body,
      }),
  });
}

export function useUpdateSettingsAppearance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { preset?: AppearancePreset; mode?: AppearanceMode; customColors?: CustomColors | null }) =>
      apiFetch<{ appearance: WorkspaceAppearance }>("/api/settings/appearance", {
        method: "PATCH",
        body,
      }),
    onSuccess: (data) => {
      qc.setQueryData(["me"], (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const session = old as { workspace?: { appearance?: WorkspaceAppearance } };
        return {
          ...session,
          workspace: {
            ...session.workspace,
            appearance: data.appearance,
          },
        };
      });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useRequestPasswordRecovery() {
  return useMutation({
    mutationFn: (body: { email: string }) =>
      apiFetch<{ ok: boolean; message: string }>("/api/auth/password-recovery", {
        method: "POST",
        body,
      }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: { token: string; password: string }) =>
      apiFetch<{ ok: boolean; message: string }>("/api/auth/password-reset", {
        method: "POST",
        body,
      }),
  });
}

export function useCompanySettings(enabled = true) {
  return useQuery({
    queryKey: ["companySettings"],
    queryFn: () =>
      apiFetch<{ company: import("./types").CompanySettings }>("/api/settings/company").then((r) => r.company),
    enabled,
  });
}

export function useUpdateCompanySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name?: string;
      timezone?: string;
      logoUrl?: string | null;
      legalName?: string | null;
      document?: string | null;
      email?: string | null;
      phone?: string | null;
      website?: string | null;
      businessContext?: string | null;
      businessHoursStart?: string | null;
      businessHoursEnd?: string | null;
      businessDays?: number[];
    }) =>
      apiFetch<{ company: import("./types").CompanySettings }>("/api/settings/company", {
        method: "PATCH",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companySettings"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

// ── Workflow configuration (Settings → Workflow) ───────────────────────────

export const useWorkflow = (enabled = true) =>
  useQuery({
    queryKey: ["workflow"],
    queryFn: async () => {
      const res = await apiFetch<{ workflows: WorkflowDefinition[] }>("/api/workflows");
      return res.workflows[0] ?? null;
    },
    enabled,
  });

export function useAddWorkflowStage(workflowId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<WorkflowStage>(`/api/workflows/${workflowId}/stages`, { method: "POST", body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow"] }),
  });
}

export function useRenameWorkflowStage(workflowId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, name }: { stageId: string; name: string }) =>
      apiFetch<WorkflowStage>(`/api/workflows/${workflowId}/stages/${stageId}`, {
        method: "PATCH",
        body: { name },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow"] }),
  });
}

export function useReorderWorkflowStages(workflowId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stageIds: string[]) =>
      apiFetch<WorkflowDefinition>(`/api/workflows/${workflowId}/reorder`, {
        method: "POST",
        body: { stageIds },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow"] }),
  });
}

export function useRemoveWorkflowStage(workflowId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stageId: string) =>
      apiFetch<{ ok: true }>(`/api/workflows/${workflowId}/stages/${stageId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow"] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name?: string;
      email?: string;
      phone?: string | null;
      avatarUrl?: string | null;
    }) =>
      apiFetch<{ user: import("./types").User }>("/api/auth/me", {
        method: "PATCH",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

export function useResetMemberPassword() {
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<{
        ok: boolean;
        temporaryPassword: string;
        user: { id: string; name: string; email: string };
        message: string;
      }>(`/api/members/${memberId}/reset-password`, {
        method: "POST",
      }),
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<OnboardingStatus>("/api/onboarding/complete", { method: "POST" }),
    // onboardedAt is now set: the access gate must see status ACTIVE.
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
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

export const useClient = (id: string) =>
  useQuery({
    queryKey: ["client", id],
    queryFn: () => apiFetch<Client>(`/api/clients/${id}`),
    enabled: !!id,
  });

export const useTeam = () =>
  useQuery({
    queryKey: ["team"],
    queryFn: () => apiFetch<{ team: User[] }>("/api/team").then((r) => r.team),
  });

export const useMembers = (enabled = true) =>
  useQuery({
    queryKey: ["members"],
    queryFn: () => apiFetch<{ members: CompanyMember[] }>("/api/members").then((r) => r.members),
    enabled,
  });

export const useInvitations = (enabled = true) =>
  useQuery({
    queryKey: ["invitations"],
    queryFn: () => apiFetch<{ invitations: Invitation[] }>("/api/invitations").then((r) => r.invitations),
    enabled,
  });

export const useContents = (status?: ContentStatus, enabled = true) =>
  useQuery({
    queryKey: ["contents", status ?? "all"],
    queryFn: () =>
      apiFetch<{ contents: ContentListItem[] }>(
        `/api/contents${status ? `?status=${status}` : ""}`,
      ).then((r) => r.contents),
    enabled,
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
    mutationFn: (payload: CreateClientPayload) =>
      apiFetch<Client>("/api/clients", { method: "POST", body: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateClientPayload }) =>
      apiFetch<Client>(`/api/clients/${id}`, { method: "PATCH", body }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", vars.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<null>(`/api/clients/${id}`, { method: "DELETE" }),
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
      qc.invalidateQueries({ queryKey: ["jobActivity", id] });
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
    onSuccess: (_data, childId) => {
      qc.invalidateQueries({ queryKey: ["content", childId] });
      qc.invalidateQueries({ queryKey: ["contents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["jobActivity", childId] });
    },
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateJobPayload }) =>
      apiFetch(`/api/jobs/${id}`, { method: "PATCH", body }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["content", vars.id] });
      qc.invalidateQueries({ queryKey: ["contents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["jobActivity", vars.id] });
    },
  });
}

export function useCancelDemand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/contents/${id}/cancel`, { method: "POST" }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["content", id] });
      qc.invalidateQueries({ queryKey: ["contents"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["publications"] });
      qc.invalidateQueries({ queryKey: ["jobActivity", id] });
    },
  });
}

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInvitationPayload) =>
      apiFetch<CreateInvitationResponse>("/api/invitations", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useRevokeInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true }>(`/api/invitations/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invitations"] });
    },
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role?: MemberRole; isActive?: boolean } }) =>
      apiFetch<CompanyMember>(`/api/members/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["team"] });
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

// ── Job Files & Object Storage Attachments (B5) ─────────────────────────────
export function useJobFiles(jobId: string, options?: UseQueryOptions<{ files: JobAttachment[] }>) {
  return useQuery<{ files: JobAttachment[] }>({
    queryKey: ["jobFiles", jobId],
    queryFn: () => apiFetch<{ files: JobAttachment[] }>(`/api/jobs/${jobId}/files`),
    enabled: Boolean(jobId),
    ...options,
  });
}

export async function uploadJobAttachment(jobId: string, file: File): Promise<JobAttachment> {
  if (file.size > 50 * 1024 * 1024) {
    throw new ApiError(400, "Arquivo excede o limite máximo permitido de 50MB");
  }

  // Step 1: Request upload intent
  const intent = await apiFetch<UploadIntentResponse>(`/api/jobs/${jobId}/files/upload-intent`, {
    method: "POST",
    body: {
      originalName: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    },
  });

  // Step 2: Direct storage upload (PUT to storage uploadUrl)
  const res = await fetch(intent.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!res.ok) {
    throw new ApiError(res.status, "Falha ao enviar arquivo para o armazenamento");
  }

  // Step 3: Complete upload and persist status
  const completed = await apiFetch<JobAttachment>(`/api/files/${intent.file.id}/complete`, {
    method: "POST",
  });

  return completed;
}

export function useUploadJobAttachment(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadJobAttachment(jobId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobFiles", jobId] });
      qc.invalidateQueries({ queryKey: ["content", jobId] });
      qc.invalidateQueries({ queryKey: ["jobActivity", jobId] });
    },
  });
}

export function useDownloadJobFile() {
  return useMutation({
    mutationFn: (fileId: string) =>
      apiFetch<{ url: string; expiresAt: string }>(`/api/files/${fileId}/download`),
  });
}

export function useDeleteJobFile(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) =>
      apiFetch<null>(`/api/files/${fileId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobFiles", jobId] });
      qc.invalidateQueries({ queryKey: ["content", jobId] });
      qc.invalidateQueries({ queryKey: ["jobActivity", jobId] });
    },
  });
}

// ── Identity Media Uploads (F13) ───────────────────────────────────────────
// Shared 3-step pattern: intent → PUT to storage → complete

const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export function validateImageFile(file: File): void {
  if (!ALLOWED_IMAGE_MIME.includes(file.type as typeof ALLOWED_IMAGE_MIME[number])) {
    throw new ApiError(400, "Use uma imagem JPG, PNG ou WebP.");
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new ApiError(400, "Escolha uma imagem de até 5 MB.");
  }
}

async function uploadIdentityImage(
  intentUrl: string,
  completeUrl: string,
  file: File,
) {
  validateImageFile(file);

  const intent = await apiFetch<{ uploadUrl: string; key: string; expiresAt: string }>(intentUrl, {
    method: "POST",
    body: { contentType: file.type, sizeBytes: file.size, originalName: file.name },
  });

  const res = await fetch(intent.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type, "Content-Length": String(file.size) },
    body: file,
  });
  if (!res.ok) throw new ApiError(res.status, "Falha ao enviar imagem para o armazenamento");

  return apiFetch<any>(completeUrl, { method: "POST", body: { key: intent.key } });
}

// User avatar
export function useUploadUserAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      uploadIdentityImage("/api/me/avatar/upload-intent", "/api/me/avatar/complete", file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteUserAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>("/api/me/avatar", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["team"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// Company logo
export function useUploadCompanyLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      uploadIdentityImage(
        "/api/settings/company/logo/upload-intent",
        "/api/settings/company/logo/complete",
        file,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

export function useDeleteCompanyLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>("/api/settings/company/logo", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["companySettings"] });
    },
  });
}

// Client logo
export function useUploadClientLogo(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      uploadIdentityImage(
        `/api/clients/${clientId}/logo/upload-intent`,
        `/api/clients/${clientId}/logo/complete`,
        file,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", clientId] });
    },
  });
}

export function useDeleteClientLogo(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>(`/api/clients/${clientId}/logo`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", clientId] });
    },
  });
}

// ── Job Activity Feed (B6) ──────────────────────────────────────────────────
export interface JobActivityPage {
  activities: JobActivity[];
  total: number;
  limit: number;
  offset: number;
}

export function useJobActivity(
  jobId: string,
  options?: UseQueryOptions<JobActivityPage>,
) {
  return useQuery<JobActivityPage>({
    queryKey: ["jobActivity", jobId],
    queryFn: () => apiFetch<JobActivityPage>(`/api/jobs/${jobId}/activity?limit=5&offset=0`),
    enabled: Boolean(jobId),
    ...options,
  });
}

// F14.2 — full activity history, paginated, newest first.
export function useJobActivityPage(jobId: string, offset: number, limit = 20) {
  return useQuery<JobActivityPage>({
    queryKey: ["jobActivity", jobId, "page", offset, limit],
    queryFn: () =>
      apiFetch<JobActivityPage>(`/api/jobs/${jobId}/activity?limit=${limit}&offset=${offset}`),
    enabled: Boolean(jobId),
  });
}

// ── Calendar Appointments CRUD (B7) ─────────────────────────────────────────
export function useAppointments(
  query?: { clientId?: string; status?: AppointmentStatus },
  options?: UseQueryOptions<AppointmentListResponse>,
) {
  const params = new URLSearchParams();
  if (query?.clientId) params.set("clientId", query.clientId);
  if (query?.status) params.set("status", query.status);
  const qs = params.toString();

  return useQuery<AppointmentListResponse>({
    queryKey: ["appointments", query?.clientId, query?.status],
    queryFn: () => apiFetch<AppointmentListResponse>(`/api/appointments${qs ? `?${qs}` : ""}`),
    ...options,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAppointmentPayload) =>
      apiFetch<Appointment>("/api/appointments", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAppointmentPayload }) =>
      apiFetch<Appointment>(`/api/appointments/${id}`, { method: "PATCH", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Appointment>(`/api/appointments/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

// ── Conversations (AI Inbox - F15.2 / F15.3) ─────────────────────────────

export function useConversations(params: ListConversationsParams = {}) {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.aiStatus) query.set("aiStatus", params.aiStatus);
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  const path = `/api/conversations${qs ? `?${qs}` : ""}`;

  return useQuery<ListConversationsResponse>({
    queryKey: [
      "conversations",
      params.search?.trim() ?? "",
      params.aiStatus ?? "",
      params.cursor ?? "",
      params.limit ?? null,
    ],
    queryFn: () => apiFetch<ListConversationsResponse>(path),
    refetchInterval: 5000,
  });
}

export function useConversation(id: string | null) {
  return useQuery<ConversationSummaryDto>({
    queryKey: ["conversation", id],
    queryFn: () => apiFetch<ConversationSummaryDto>(`/api/conversations/${id}`),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });
}

export function useConversationMessages(conversationId: string | null, cursor?: string) {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  const qs = query.toString();
  const path = `/api/conversations/${conversationId}/messages${qs ? `?${qs}` : ""}`;

  return useQuery<ListMessagesResponse>({
    queryKey: ["conversation-messages", conversationId, cursor],
    queryFn: () => apiFetch<ListMessagesResponse>(path),
    enabled: Boolean(conversationId),
    refetchInterval: 3000,
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: true; unreadCount: number }>(`/api/conversations/${id}/read`, {
        method: "PATCH",
      }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", id] });
    },
  });
}

export function useSetConversationAiStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, aiStatus }: { id: string; aiStatus: ConversationAiStatus }) =>
      apiFetch<ConversationSummaryDto>(`/api/conversations/${id}/ai-status`, {
        method: "PATCH",
        body: { aiStatus },
      }),
    onSuccess: (updated, { id }) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", id] });
      qc.setQueryData(["conversation", id], updated);
    },
  });
}

export function useSendConversationMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      apiFetch<import("./types").ConversationMessageDto>(
        `/api/conversations/${conversationId}/messages`,
        { method: "POST", body: { body } },
      ),
    onSuccess: (_, { conversationId }) => {
      qc.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
    },
  });
}

export function useBindConversationClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clientId }: { id: string; clientId: string | null }) =>
      apiFetch<ConversationSummaryDto>(`/api/conversations/${id}/client`, {
        method: "PATCH",
        body: { clientId },
      }),
    onSuccess: (updated, { id }) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", id] });
      qc.setQueryData(["conversation", id], updated);
    },
  });
}

// ── WhatsApp Management (whatsapp_business_management) ──────────────────

export interface WhatsAppPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  status: string;
}

export interface WhatsAppMessageTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: unknown[];
}

export function useWhatsAppPhoneNumbers() {
  return useQuery<{ phoneNumbers: WhatsAppPhoneNumber[] }>({
    queryKey: ["whatsapp-phone-numbers"],
    queryFn: () => apiFetch<{ phoneNumbers: WhatsAppPhoneNumber[] }>("/api/whatsapp/phone-numbers"),
  });
}

export function useWhatsAppTemplates() {
  return useQuery<{ templates: WhatsAppMessageTemplate[] }>({
    queryKey: ["whatsapp-templates"],
    queryFn: () => apiFetch<{ templates: WhatsAppMessageTemplate[] }>("/api/whatsapp/templates"),
  });
}

export function useSendWhatsAppTemplate() {
  return useMutation({
    mutationFn: (body: { to: string; templateName: string; languageCode: string; components?: unknown[] }) =>
      apiFetch("/api/whatsapp/templates/send", { method: "POST", body }),
  });
}

