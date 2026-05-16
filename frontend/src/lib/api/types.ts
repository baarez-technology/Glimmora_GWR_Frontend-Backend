/** Shared types mirroring the backend Pydantic schemas. */

export type BackendRole = "organizer" | "adjudicator" | "witness" | "admin";

export interface BackendUser {
  id: string;
  email: string;
  role: BackendRole;
  full_name: string | null;
  is_active: boolean;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: BackendRole;
}

export interface MfaPendingResponse {
  temp_token: string;
  requires_mfa: true;
}

export type LoginResult = LoginResponse | MfaPendingResponse;

export interface Attempt {
  id: string;
  application_ref: string;
  record_title: string;
  organizer_id: string;
  event_id: string | null;
  status: string;
  category: string | null;
  description: string | null;
  attempt_date: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionHealth {
  score: number;
  witnesses_ok: boolean;
  evidence_ok: boolean;
  logbook_ok: boolean;
  statements_ok: boolean;
  issues: string[];
}

export interface Witness {
  id: string;
  attempt_id: string;
  role: string;
  status: string;
  full_name: string;
  email: string;
  phone: string | null;
  organisation: string | null;
  expertise: string | null;
  token: string | null;
  invited_at: string | null;
  completed_at: string | null;
  decision: string | null;
  decision_note: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Evidence {
  id: string;
  attempt_id: string;
  type: string;
  status: string;
  file_name: string | null;
  s3_key: string | null;
  file_url: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  duration_seconds: number | null;
  ai_confidence: number | null;
  tags: string[] | null;
  transcript: string | null;
  description: string | null;
  sha256: string | null;
  uploaded_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  detail: string | null;
  tone: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  ts: string;
  hash: string | null;
}

export interface OverviewStats {
  total_attempts: number;
  by_status: Record<string, number>;
  total_witnesses: number;
  total_evidence: number;
  evidence_by_type: Record<string, number>;
}

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  snippet: string | null;
  attempt_id: string | null;
}

export interface Clarification {
  id: string;
  attempt_id: string;
  witness_id: string | null;
  raised_by_id: string | null;
  subject: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  messages: ClarificationMessage[];
}

export interface ClarificationMessage {
  id: string;
  clarification_id: string;
  author_id: string;
  body: string;
  created_at: string;
}
