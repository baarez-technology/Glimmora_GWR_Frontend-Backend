import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Modal from "@/components/Modal";
import { Button } from "@/components/ui";
import type { AdminEvent } from "@/lib/api/admin";
import { adminUsersApi } from "@/lib/api/admin";

interface Props {
  open: boolean;
  initial?: AdminEvent | null;
  defaultGeofenceM: number;
  onClose: () => void;
  onSubmit: (e: Partial<AdminEvent>) => void;
  submitting?: boolean;
}

const STATUS_OPTIONS: AdminEvent["status"][] = ["Draft", "Scheduled", "Live", "Completed", "Cancelled"];
const PRIORITY_OPTIONS: AdminEvent["priority"][] = ["Low", "Standard", "High", "Flagship"];

const COMMON_TZ = [
  "Europe/London", "Europe/Berlin", "Europe/Madrid", "Atlantic/Reykjavik",
  "America/New_York", "America/Los_Angeles", "America/Guayaquil",
  "Asia/Tokyo", "Asia/Dubai", "Asia/Singapore",
  "Africa/Lagos", "Australia/Sydney",
];

type FormState = Omit<AdminEvent, "id" | "created_at" | "updated_at"> & { id?: string };

function blank(defaultGeofenceM: number): FormState {
  const start = new Date(Date.now() + 14 * 86400000).toISOString();
  const end = new Date(Date.now() + 14 * 86400000 + 3 * 3600000).toISOString();
  return {
    title: "",
    category: "Music & Performing Arts",
    organizer: "",
    organizer_user_id: null,
    venue: "",
    city: "",
    country: "",
    timezone: "Europe/London",
    lat: 51.5,
    lon: -0.12,
    start_iso: start,
    end_iso: end,
    status: "Draft",
    priority: "Standard",
    participant_count: 1,
    required_adjudicators: 1,
    description: "",
    geofence_radius_m: defaultGeofenceM,
  };
}

function isoToInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function inputToIso(v: string): string | null {
  if (!v) return null;
  return new Date(v + ":00Z").toISOString();
}

export default function EventFormModal({ open, initial, defaultGeofenceM, onClose, onSubmit, submitting }: Props) {
  const isEdit = !!initial;
  const [form, setForm] = useState<FormState>(() => initial ?? blank(defaultGeofenceM));

  const { data: organizers = [] } = useQuery({
    queryKey: ["admin", "users", "organizer"],
    queryFn: () => adminUsersApi.list("organizer"),
    enabled: open,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (open) setForm(initial ?? blank(defaultGeofenceM));
  }, [open, initial, defaultGeofenceM]);

  const valid = form.title.trim() && (form.city ?? "").trim() && (form.venue ?? "").trim();

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit event · ${initial!.id}` : "Create new record attempt event"}
      subtitle={isEdit ? "Update details, status, or geo-fence radius." : "Define a new GWR record attempt and its venue."}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => valid && onSubmit(form)} disabled={!valid || !!submitting}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create event"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Event title" full>
          <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Largest line of robot dancers in unison" />
        </Field>

        <Field label="Category">
          <select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {["Music & Performing Arts","Mass Participation","Athletics","Mind Sports","Acrobatics","Environment","Technology","Other"].map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>

        <Field label="Organizer (display)">
          <input className="input" value={form.organizer ?? ""} onChange={(e) => set("organizer", e.target.value)} placeholder="Organization or contact" />
        </Field>

        <Field label="Organizer account" full>
          <select
            className="input"
            value={form.organizer_user_id ?? ""}
            onChange={(e) => set("organizer_user_id", e.target.value || null)}
          >
            <option value="">— Open to any organizer —</option>
            {organizers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email} · {u.email}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-muted mt-1 block">
            Reserves this event for a specific organizer user. They'll see it in their "New submission" picker.
          </span>
        </Field>

        <Field label="Venue" full>
          <input className="input" value={form.venue ?? ""} onChange={(e) => set("venue", e.target.value)} placeholder="e.g. Royal Albert Hall · Main Stage" />
        </Field>

        <Field label="City">
          <input className="input" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Country">
          <input className="input" value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} />
        </Field>

        <Field label="Latitude">
          <input type="number" step="0.0001" className="input" value={form.lat} onChange={(e) => set("lat", Number(e.target.value))} />
        </Field>
        <Field label="Longitude">
          <input type="number" step="0.0001" className="input" value={form.lon} onChange={(e) => set("lon", Number(e.target.value))} />
        </Field>

        <Field label="Timezone">
          <select className="input" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {COMMON_TZ.map((tz) => <option key={tz}>{tz}</option>)}
          </select>
        </Field>
        <Field label="Geo-fence radius (m)">
          <input type="number" min={50} step={50} className="input" value={form.geofence_radius_m} onChange={(e) => set("geofence_radius_m", Number(e.target.value))} />
        </Field>

        <Field label="Starts (UTC)">
          <input type="datetime-local" className="input" value={isoToInput(form.start_iso)} onChange={(e) => set("start_iso", inputToIso(e.target.value))} />
        </Field>
        <Field label="Ends (UTC)">
          <input type="datetime-local" className="input" value={isoToInput(form.end_iso)} onChange={(e) => set("end_iso", inputToIso(e.target.value))} />
        </Field>

        <Field label="Status">
          <select className="input" value={form.status} onChange={(e) => set("status", e.target.value as AdminEvent["status"])}>
            {STATUS_OPTIONS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className="input" value={form.priority} onChange={(e) => set("priority", e.target.value as AdminEvent["priority"])}>
            {PRIORITY_OPTIONS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </Field>

        <Field label="Participants">
          <input type="number" min={1} className="input" value={form.participant_count} onChange={(e) => set("participant_count", Number(e.target.value))} />
        </Field>
        <Field label="Required adjudicators">
          <input type="number" min={1} className="input" value={form.required_adjudicators} onChange={(e) => set("required_adjudicators", Number(e.target.value))} />
        </Field>

        <Field label="Description" full>
          <textarea className="input min-h-[88px]" value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="One-paragraph description of the attempt and any unusual constraints." />
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
