import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, PageHeader, Badge, Button } from "@/components/ui";
import { formatDate, relativeTime } from "@/lib/utils";
import { Plus, ArrowRight, Loader2, AlertTriangle, FileText } from "lucide-react";
import { attemptsApi } from "@/lib/api/resources";
import { ApiError } from "@/lib/api";
import { useToast } from "@/components/Toaster";
import Modal from "@/components/Modal";

function statusTone(s: string): "blue" | "green" | "gold" | "default" | "red" {
  const v = s.toLowerCase();
  if (v.includes("approved") || v.includes("ratified")) return "green";
  if (v.includes("live") || v.includes("review")) return "blue";
  if (v.includes("draft") || v.includes("pending")) return "gold";
  if (v.includes("reject") || v.includes("cancel")) return "red";
  return "default";
}

export default function Submissions() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    event_id: "",
    record_title: "",
    category: "",
    description: "",
    attempt_date: "",
    location: "",
  });

  const { data: attempts = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["attempts"],
    queryFn: () => attemptsApi.list(),
    refetchOnWindowFocus: false,
  });

  const { data: availableEvents = [] } = useQuery({
    queryKey: ["attempts", "available-events"],
    queryFn: () => attemptsApi.availableEvents(),
    enabled: creating,
    refetchOnWindowFocus: false,
  });

  const create = useMutation({
    mutationFn: () => attemptsApi.create({
      record_title: draft.record_title,
      category: draft.category || undefined,
      description: draft.description || undefined,
      attempt_date: draft.attempt_date || undefined,
      location: draft.location || undefined,
      event_id: draft.event_id || undefined,
    }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["attempts"] });
      setCreating(false);
      setDraft({ event_id: "", record_title: "", category: "", description: "", attempt_date: "", location: "" });
      toast({ title: "Submission created", description: created.application_ref, tone: "success" });
    },
    onError: (e) => {
      toast({
        title: "Could not create submission",
        description: e instanceof ApiError ? e.message : "Unknown error",
        tone: "danger",
      });
    },
  });

  return (
    <>
      <PageHeader
        eyebrow="Organizer"
        title="Submissions"
        subtitle="Every record attempt you are organizing &mdash; pulled live from the backend."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New submission
          </Button>
        }
      />

      {isLoading && (
        <Card className="py-16 flex items-center justify-center gap-2 text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading submissions…
        </Card>
      )}

      {isError && (
        <Card>
          <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 p-3 text-sm inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error instanceof ApiError ? error.message : "Couldn't reach /attempts. Is the backend running?"}
          </div>
          <button onClick={() => refetch()} className="mt-3 btn-ghost text-xs">Retry</button>
        </Card>
      )}

      {!isLoading && !isError && attempts.length === 0 && (
        <Card className="text-center py-12">
          <FileText className="h-8 w-8 mx-auto text-royal/30" />
          <div className="mt-2 text-sm font-semibold text-soft">No submissions yet</div>
          <div className="text-[12px] text-muted mt-1">Click <strong>New submission</strong> to start your first record attempt.</div>
          <Button className="mt-4 mx-auto" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Create one
          </Button>
        </Card>
      )}

      {!isLoading && attempts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attempts.map((a) => (
            <Card key={a.id} className="hover:shadow-soft transition flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-royal font-semibold tracking-wide">{a.application_ref}</div>
                  <h3 className="text-base font-bold text-soft mt-1 leading-snug">{a.record_title}</h3>
                </div>
                <Badge tone={statusTone(a.status)}>{a.status}</Badge>
              </div>
              {a.description && (
                <p className="text-xs text-muted mt-2 line-clamp-2">{a.description}</p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                <KV label="Category">{a.category || "—"}</KV>
                <KV label="Location">{a.location || "—"}</KV>
                <KV label="Attempt date">{a.attempt_date ? formatDate(a.attempt_date) : "—"}</KV>
                <KV label="Created">{relativeTime(a.created_at)}</KV>
              </div>
              <div className="mt-auto pt-4 flex items-center justify-between border-t border-line">
                <Link to="/witnesses" className="text-xs text-royal hover:underline">Witnesses</Link>
                <Link to="/evidence/upload" className="text-xs text-royal hover:underline inline-flex items-center gap-1">
                  Manage <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={creating}
        title="Create a new record attempt"
        subtitle="This will create a draft on the GWR backend."
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button
              onClick={() => create.mutate()}
              disabled={!draft.record_title.trim() || create.isPending}
            >
              {create.isPending ? "Creating…" : "Create submission"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="GWR event (assigned by admin)" full>
            <select
              className="input"
              value={draft.event_id}
              onChange={(e) => {
                const id = e.target.value;
                const ev = availableEvents.find((x) => x.id === id);
                setDraft((d) => ({
                  ...d,
                  event_id: id,
                  // Auto-fill blanks from the chosen event
                  record_title: d.record_title || (ev?.title ?? ""),
                  category: d.category || (ev?.category ?? ""),
                  location: d.location || [ev?.venue, ev?.city, ev?.country].filter(Boolean).join(", "),
                  attempt_date: d.attempt_date || (ev?.start_iso?.slice(0, 10) ?? ""),
                }));
              }}
            >
              <option value="">— File a standalone attempt (no event) —</option>
              {availableEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.id} · {ev.title} · {ev.city || "—"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Record title" full>
            <input
              className="input"
              value={draft.record_title}
              onChange={(e) => setDraft((d) => ({ ...d, record_title: e.target.value }))}
              placeholder="e.g. Largest line of robot dancers in unison"
              autoFocus
            />
          </Field>
          <Field label="Category">
            <input
              className="input"
              value={draft.category}
              onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
              placeholder="Athletics, Mass Participation…"
            />
          </Field>
          <Field label="Location">
            <input
              className="input"
              value={draft.location}
              onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              placeholder="London, UK"
            />
          </Field>
          <Field label="Attempt date" full>
            <input
              type="date"
              className="input"
              value={draft.attempt_date}
              onChange={(e) => setDraft((d) => ({ ...d, attempt_date: e.target.value }))}
            />
          </Field>
          <Field label="Description" full>
            <textarea
              className="input min-h-[88px]"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="One-paragraph description of the attempt."
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm text-soft truncate">{children}</div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
