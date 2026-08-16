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
  timezone: string;
  locale: string;
  template: WorkspaceTemplate | null;
  onboardedAt: string | null;
}

export interface OnboardingStatus {
  mustChangePassword: boolean;
  company: OnboardingCompany;
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

export interface WorkspaceContext {
  id: string;
  name: string;
  template: WorkspaceTemplate | null;
  capabilities: Capability[];
  status: "ACTIVE" | "UNCONFIGURED";
  appearance?: WorkspaceAppearance | null;
}

export type ContentStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "AWAITING_CLIENT"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHED";

export type ContentFormat = "POST" | "REELS" | "STORY" | "CAROUSEL" | "VIDEO" | "IMAGE";
export type UserRole = "ADMIN" | "CONTENT_MANAGER" | "EDITOR" | "SOCIAL_MEDIA" | "DESIGNER";
export type ClientStatus = "ACTIVE" | "INACTIVE" | "PROSPECT";
export type ApprovalStatus = "PENDING" | "APPROVED" | "CHANGES_REQUESTED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
  active: boolean;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  brandColor?: string | null;
  status: ClientStatus;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  channels: string[];
  activeContents?: number;
  createdAt: string;
}

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
}
