// Mirror of backend enums/types (kept as plain TS types — no runtime coupling).
// Capability identifiers match backend registry (src/domain/capabilities.ts).
// Frontend only models what the backend sends; never resolves template→matrix.
export type Capability =
  | "CLIENTS"
  | "JOBS"
  | "WORKFLOW"
  | "KANBAN"
  | "FILES"
  | "APPROVAL"
  | "CALENDAR"
  | "ACTIVITY"
  | "DASHBOARD";

export type WorkspaceTemplate = "LOCAL_BUSINESS" | "HIGH_TICKET" | "MARKETING_AGENCY";

// Mirror of the backend OnboardingStatus contract (onboardingService.ts).
// Server-persisted authority for first-access routing (F4B).
export interface OnboardingCompany {
  name: string;
  website: string | null;
  timezone: string;
  locale: string;
  template: WorkspaceTemplate | null;
  onboardedAt: string | null;
}

export interface OnboardingStatus {
  mustChangePassword: boolean;
  company: OnboardingCompany;
  appearance: WorkspaceAppearance;
  readyToComplete: boolean;
  status: "PASSWORD_CHANGE_REQUIRED" | "ONBOARDING_REQUIRED" | "ACTIVE";
}

// Mirror of the backend WorkspaceAppearance contract (src/domain/appearance.ts).
// Values come from GET /api/auth/me → workspace.appearance; null/missing → AURA/LIGHT.
export type AppearancePreset = "AURA" | "FLUX" | "PULSE" | "CUSTOM";
export type AppearanceMode = "LIGHT" | "DARK";

export interface CustomColors {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  text: string;
  border: string;
}

export interface WorkspaceAppearance {
  preset: AppearancePreset;
  mode: AppearanceMode;
  customColors: CustomColors | null;
}

export interface CompanySettings {
  id: string;
  name: string;
  slug: string | null;
  logoUrl?: string | null;
  timezone: string;
  locale: string;
  legalName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  onboardedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceContext {
  id: string;
  name: string;
  logoUrl?: string | null;
  timezone?: string | null;
  template: WorkspaceTemplate | null;
  capabilities: string[];
  status: "UNCONFIGURED" | "ACTIVE";
  appearance?: WorkspaceAppearance;
}

export type ContentStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "AWAITING_CLIENT"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED";

export type JobLifecycleStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface WorkflowStage {
  id: string;
  workflowId: string;
  name: string;
  position: number;
  terminal: boolean;
  active: boolean;
}

export interface WorkflowDefinition {
  id: string;
  companyId: string;
  name: string;
  template: string;
  active: boolean;
  stages: WorkflowStage[];
}

export type ContentFormat = "POST" | "REELS" | "STORY" | "CAROUSEL" | "VIDEO" | "IMAGE";
export type UserRole = "ADMIN" | "CONTENT_MANAGER" | "EDITOR" | "SOCIAL_MEDIA" | "DESIGNER";
export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";
export type ClientStatus = "ACTIVE" | "INACTIVE" | "PROSPECT";
export type ApprovalStatus = "PENDING" | "APPROVED" | "CHANGES_REQUESTED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  phone?: string | null;
  active: boolean;
  createdAt: string;
}

export interface CompanyMember {
  id: string;
  role: MemberRole;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    active: boolean;
  };
}

export interface Invitation {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateInvitationPayload {
  email: string;
  role: "ADMIN" | "MEMBER";
}

export interface CreateInvitationResponse {
  invitationId: string;
  expiresAt: string;
  token: string;
}

export interface Client {
  id: string;
  name: string;
  logoUrl?: string | null;
  brandColor?: string | null;
  status: ClientStatus;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  channels: string[];
  activeContents?: number;
  createdAt: string;
}

export interface CreateClientPayload {
  name: string;
  brandColor?: string;
  status?: ClientStatus;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  channels?: string[];
}

export type UpdateClientPayload = Partial<CreateClientPayload>;

export interface ContentVersion {
  id: string;
  contentId: string;
  versionNumber: number;
  caption: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  changeNote?: string | null;
  createdById?: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
  approvals?: Approval[];
}

export interface Approval {
  id: string;
  contentId: string;
  contentVersionId: string;
  token: string;
  status: ApprovalStatus;
  feedback?: string | null;
  clientName?: string | null;
  clientReviewedAt?: string | null;
  createdAt: string;
  version?: ContentVersion;
}

export interface ContentListItem {
  id: string;
  title: string;
  clientId: string;
  parentId?: string | null;
  format: ContentFormat;
  channel?: string | null;
  responsibleId?: string | null;
  status: ContentStatus;
  lifecycleStatus?: JobLifecycleStatus;
  publicationTarget?: string | null;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string; brandColor?: string | null };
  responsible?: { id: string; name: string } | null;
  versions?: ContentVersion[];
  children?: { id: string; title: string; status: ContentStatus; format: ContentFormat }[];
}

export interface ContentDetail extends ContentListItem {
  notes?: string | null;
  versions: ContentVersion[];
  approvals?: Approval[];
  client: Client;
  responsible?: { id: string; name: string; role: UserRole } | null;
  createdBy?: { id: string; name: string } | null;
}

export interface UpdateJobPayload {
  title?: string;
  notes?: string;
  clientId?: string;
  publicationTarget?: string | null;
  scheduledAt?: string | null;
}

export interface JobAttachment {
  id: string;
  jobId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  status: "PENDING" | "AVAILABLE";
  etag?: string | null;
  createdAt: string;
}

export interface UploadIntentResponse {
  file: JobAttachment;
  uploadUrl: string;
  expiresAt: string;
  headers: Record<string, string>;
}

export type ActivityType =
  | "JOB_CREATED"
  | "JOB_UPDATED"
  | "JOB_STAGE_CHANGED"
  | "JOB_COMPLETED"
  | "JOB_CANCELLED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_APPROVED"
  | "APPROVAL_CHANGES_REQUESTED"
  | "APPROVAL_REJECTED"
  | "APPROVAL_REVOKED";

export interface JobActivity {
  id: string;
  jobId: string;
  actorUserId?: string | null;
  type: ActivityType;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export type AppointmentStatus = "SCHEDULED" | "CANCELLED";

export interface Appointment {
  id: string;
  companyId: string;
  title: string;
  description?: string | null;
  clientId?: string | null;
  client?: Client | null;
  startsAt: string;
  endsAt?: string | null;
  status: AppointmentStatus;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentPayload {
  title: string;
  description?: string | null;
  clientId?: string | null;
  startsAt: string;
  endsAt?: string | null;
}

export interface UpdateAppointmentPayload {
  title?: string;
  description?: string | null;
  clientId?: string | null;
  startsAt?: string;
  endsAt?: string | null;
}

export interface AppointmentListResponse {
  appointments: Appointment[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DashboardUpcomingEvent {
  id: string;
  jobId?: string;
  appointmentId?: string;
  type: string;
  at: string;
  title: string;
  client?: { id: string; name: string; brandColor?: string | null } | null;
  lifecycleStatus?: string | null;
  currentStage?: { id: string; name: string; position: number } | null;
}

export interface Dashboard {
  counts: {
    totalContents: number;
    totalClients: number;
    totalTeam: number;
    draft: number;
    inReview: number;
    awaitingClient: number;
    changesRequested: number;
    approved: number;
    scheduled: number;
    published: number;
  };
  recentContents: ContentListItem[];
  needingAttention: ContentListItem[];
  workspace?: { timezone?: string | null };
  upcoming?: {
    timezone?: string;
    events: DashboardUpcomingEvent[];
    totalEvents: number;
    truncated: boolean;
  };
}
