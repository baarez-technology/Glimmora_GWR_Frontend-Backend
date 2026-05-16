import { api } from "@/lib/api";
import type {
  Attempt, AuditLogEntry, Clarification, Evidence, Notification,
  OverviewStats, SearchResult, SubmissionHealth, Witness,
} from "./types";
import type { AdminEvent } from "./admin";

/** /attempts */
export const attemptsApi = {
  list: () => api.get<Attempt[]>("/attempts"),
  get: (id: string) => api.get<Attempt>(`/attempts/${id}`),
  create: (body: { record_title: string; category?: string; description?: string; attempt_date?: string; location?: string; event_id?: string }) =>
    api.post<Attempt>("/attempts", body),
  update: (id: string, body: Partial<{ record_title: string; category: string; description: string; attempt_date: string; location: string; status: string; event_id: string }>) =>
    api.patch<Attempt>(`/attempts/${id}`, body),
  health: (id: string) => api.get<SubmissionHealth>(`/attempts/${id}/health`),
  /** Events the logged-in organizer can file an attempt against. */
  availableEvents: () => api.get<AdminEvent[]>("/attempts/events/available"),
  /** Events the logged-in adjudicator has been assigned to. */
  myAssignedEvents: () => api.get<AdminEvent[]>("/attempts/my-events"),
  /** Adjudicators assigned to a given admin event. */
  eventAdjudicators: (eventId: string) =>
    api.get<Array<{ adjudicator_id: string; name: string; email: string; role: string; status: string }>>(
      `/attempts/events/${eventId}/adjudicators`
    ),
};

/** /attempts/{id}/witnesses */
export const witnessesApi = {
  list: (attemptId: string) => api.get<Witness[]>(`/attempts/${attemptId}/witnesses`),
  create: (attemptId: string, body: { role: string; full_name: string; email: string; phone?: string; organisation?: string; expertise?: string; send_email?: boolean }) =>
    api.post<Witness>(`/attempts/${attemptId}/witnesses`, body),
  bulkCreate: (attemptId: string, witnesses: Array<{ role: string; full_name: string; email: string; phone?: string; organisation?: string; expertise?: string }>) =>
    api.post<Witness[]>(`/attempts/${attemptId}/witnesses/bulk`, { witnesses }),
  update: (attemptId: string, witnessId: string, body: Partial<Witness>) =>
    api.patch<Witness>(`/attempts/${attemptId}/witnesses/${witnessId}`, body),
  invite: (attemptId: string, witnessId: string) =>
    api.post<Witness>(`/attempts/${attemptId}/witnesses/${witnessId}/invite`),
  review: (attemptId: string, witnessId: string, body: { decision: "approved" | "rejected" | "clarification_requested"; note?: string }) =>
    api.post<Witness>(`/attempts/${attemptId}/witnesses/${witnessId}/review`, body),
};

/** /attempts/{id}/statements */
export const statementsApi = {
  list: (attemptId: string) => api.get<Array<{ id: string; attempt_id: string; witness_id: string | null; kind: string; fields: Record<string, unknown> | null; submitted_at: string | null; created_at: string }>>(`/attempts/${attemptId}/statements`),
};

/** /attempts/{id}/evidence */
export const evidenceApi = {
  list: (attemptId: string) => api.get<Evidence[]>(`/attempts/${attemptId}/evidence`),
  init: (attemptId: string, body: { type: string; file_name?: string; file_url?: string; size_bytes?: number; mime_type?: string; description?: string }) =>
    api.post<{ evidence_id: string; upload_url: string | null; upload_fields: Record<string, string> | null }>(
      `/attempts/${attemptId}/evidence/init`, body
    ),
  complete: (attemptId: string, evidenceId: string, body: { etag?: string; sha256?: string }) =>
    api.post<Evidence>(`/attempts/${attemptId}/evidence/${evidenceId}/complete`, body),
};

/** /notifications */
export const notificationsApi = {
  list: () => api.get<Notification[]>("/notifications"),
  markRead: (id: string) => api.post<Notification>(`/notifications/${id}/read`),
};

/** /audit (adjudicator + admin) */
export const auditApi = {
  list: (page = 1, page_size = 50) => api.get<AuditLogEntry[]>("/audit", { query: { page, page_size } }),
};

/** /analytics (adjudicator + admin) */
export const analyticsApi = {
  overview: () => api.get<OverviewStats>("/analytics/overview"),
};

/** /search */
export const searchApi = {
  search: (q: string, attempt_id?: string) =>
    api.post<SearchResult[]>("/search", { q, attempt_id }),
};

/** /invitations — witness-side */
export interface WitnessInvitationOut {
  witness_id: string;
  attempt_id: string;
  attempt_title: string;
  attempt_location: string | null;
  attempt_date: string | null;
  witness_name: string;
  witness_role: string;
  status: string;
  decision: string | null;
  token: string | null;
  invited_at: string | null;
  completed_at: string | null;
}

export const invitationsApi = {
  mine: () => api.get<WitnessInvitationOut[]>("/invitations/mine"),
  resolve: (token: string) => api.get<{
    witness_id: string;
    attempt_id: string;
    attempt_title: string;
    attempt_location: string | null;
    attempt_date: string | null;
    attempt_category: string | null;
    attempt_description: string | null;
    witness_name: string;
    witness_email: string;
    witness_role: string;
    witness_organisation: string | null;
    witness_expertise: string | null;
    status: string;
  }>(`/invitations/${token}`),
};

/** /clarifications */
export const clarificationsApi = {
  create: (attemptId: string, body: { subject: string; witness_id?: string; body: string }) =>
    api.post<Clarification>(`/attempts/${attemptId}/clarifications`, body),
  update: (clarifId: string, body: { status?: string }) =>
    api.patch<Clarification>(`/clarifications/${clarifId}`, body),
  postMessage: (clarifId: string, body: { body: string }) =>
    api.post(`/clarifications/${clarifId}/messages`, body),
};
