import { api } from "@/lib/api";

export type Region = "Europe" | "Americas" | "Asia-Pacific" | "MEA";
export type TravelStatus = "Available" | "Assigned" | "Travelling" | "On-site" | "Completed" | "Off-duty";

export interface AdminEvent {
  id: string;
  title: string;
  category: string;
  organizer: string | null;
  organizer_user_id: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  timezone: string;
  lat: number;
  lon: number;
  start_iso: string | null;
  end_iso: string | null;
  status: "Draft" | "Scheduled" | "Live" | "Completed" | "Cancelled";
  priority: "Low" | "Standard" | "High" | "Flagship";
  participant_count: number;
  required_adjudicators: number;
  description: string | null;
  geofence_radius_m: number;
  created_at: string;
  updated_at: string;
}

export interface AdminAdjudicator {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  initials: string;
  home_city: string | null;
  home_country: string | null;
  region: Region;
  specialties: string[];
  languages: string[];
  certifications: string[];
  rating: number;
  years_experience: number;
  status: "Active" | "On leave" | "Suspended";
  created_at: string;
  updated_at: string;
}

export interface AdminAssignment {
  id: string;
  event_id: string;
  adjudicator_id: string;
  role: "Lead Adjudicator" | "Adjudicator" | "Observer";
  status: "Assigned" | "Travelling" | "On-site" | "Completed" | "Cancelled";
  note: string | null;
  assigned_at: string;
}

export interface AdjudicatorLocation {
  adjudicator_id: string;
  lat: number;
  lon: number;
  city: string | null;
  country: string | null;
  travel_status: TravelStatus;
  accuracy_m: number;
  consent: boolean;
  battery_pct: number;
  last_ping_iso: string;
}

export interface AdjudicatorCheckIn {
  id: string;
  adjudicator_id: string;
  ts: string;
  city: string | null;
  country: string | null;
  travel_status: TravelStatus;
  note: string | null;
}

export const adminEventsApi = {
  list: (status?: string) => api.get<AdminEvent[]>("/admin/events", { query: { status } }),
  get: (id: string) => api.get<AdminEvent>(`/admin/events/${id}`),
  create: (body: Partial<AdminEvent>) => api.post<AdminEvent>("/admin/events", body),
  update: (id: string, body: Partial<AdminEvent>) => api.patch<AdminEvent>(`/admin/events/${id}`, body),
  delete: (id: string) => api.delete(`/admin/events/${id}`),
};

export const adminAdjudicatorsApi = {
  list: (region?: string) => api.get<AdminAdjudicator[]>("/admin/adjudicators", { query: { region } }),
  get: (id: string) => api.get<AdminAdjudicator>(`/admin/adjudicators/${id}`),
  create: (body: Partial<AdminAdjudicator>) => api.post<AdminAdjudicator>("/admin/adjudicators", body),
  update: (id: string, body: Partial<AdminAdjudicator>) => api.patch<AdminAdjudicator>(`/admin/adjudicators/${id}`, body),
  delete: (id: string) => api.delete(`/admin/adjudicators/${id}`),
};

export const adminAssignmentsApi = {
  list: (params: { event_id?: string; adjudicator_id?: string } = {}) =>
    api.get<AdminAssignment[]>("/admin/assignments", { query: params }),
  create: (body: { event_id: string; adjudicator_id: string; role: string; note?: string }) =>
    api.post<AdminAssignment>("/admin/assignments", body),
  update: (id: string, body: Partial<AdminAssignment>) =>
    api.patch<AdminAssignment>(`/admin/assignments/${id}`, body),
  delete: (id: string) => api.delete(`/admin/assignments/${id}`),
};

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export const adminUsersApi = {
  list: (role?: string) => api.get<AdminUser[]>("/admin/users", { query: { role } }),
};

export const trackingApi = {
  listLocations: () => api.get<AdjudicatorLocation[]>("/admin/tracking/locations"),
  ping: (adj_id: string, body: { lat: number; lon: number; city?: string; country?: string; travel_status: string; accuracy_m?: number; battery_pct?: number; note?: string }) =>
    api.post<AdjudicatorLocation>(`/admin/tracking/${adj_id}/ping`, body),
  toggleConsent: (adj_id: string) => api.post<AdjudicatorLocation>(`/admin/tracking/${adj_id}/consent`),
  listCheckIns: (adjudicator_id?: string, limit = 50) =>
    api.get<AdjudicatorCheckIn[]>("/admin/tracking/checkins", { query: { adjudicator_id, limit } }),
};
