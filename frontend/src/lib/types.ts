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

export interface WorkspaceContext {
  id: string;
  name: string;
  template: WorkspaceTemplate | null;
  capabilities: Capability[];
  status: "ACTIVE" | "UNCONFIGURED";
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
