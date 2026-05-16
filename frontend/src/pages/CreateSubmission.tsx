import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import WorkflowStepper from "@/components/WorkflowStepper";
import { Button, Card, CardHeader, Input, PageHeader } from "@/components/ui";
import { Sparkles, ChevronRight, ChevronLeft, Check, Loader2, Calendar } from "lucide-react";
import { attemptsApi } from "@/lib/api/resources";
import type { AdminEvent } from "@/lib/api/admin";
import { formatDate } from "@/lib/utils";

const STEPS = [
  { label: "Record details", description: "Name, category, and core record information." },
  { label: "Event details", description: "Date, location, organizer, and conditions." },
  { label: "Description", description: "Narrative summary & adjudication context." },
  { label: "Review", description: "Confirm and create submission workspace." },
];

interface Adjudicator {
  adjudicator_id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export default function CreateSubmission() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Event source data
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [adjudicators, setAdjudicators] = useState<Adjudicator[]>([]);

  // Editable form fields (initialised from event)
  const [recordName, setRecordName] = useState("");
  const [category, setCategory] = useState("");
  const [internalRef, setInternalRef] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venue, setVenue] = useState("");
  const [location, setLocation] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [participantCount, setParticipantCount] = useState("");
  const [description, setDescription] = useState("");
  const [conditions, setConditions] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await attemptsApi.availableEvents();
        if (cancelled) return;
        setEvents(list);
        if (list.length > 0 && !selectedEventId) {
          setSelectedEventId(list[0].id);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load admin events");
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId),
    [events, selectedEventId]
  );

  // Whenever the selected event changes, pre-fill the editable fields.
  useEffect(() => {
    if (!selectedEvent) return;
    setRecordName(selectedEvent.title || "");
    setCategory(selectedEvent.category || "");
    setInternalRef(""); // application_ref auto-generated server-side
    setStartDate(toDateInput(selectedEvent.start_iso));
    setEndDate(toDateInput(selectedEvent.end_iso));
    setVenue(selectedEvent.venue || "");
    setLocation([selectedEvent.city, selectedEvent.country].filter(Boolean).join(", "));
    setOrganizer(selectedEvent.organizer || "");
    setParticipantCount(String(selectedEvent.participant_count ?? ""));
    setDescription(selectedEvent.description || "");
    // Fetch adjudicators assigned to this event
    attemptsApi.eventAdjudicators(selectedEvent.id)
      .then(setAdjudicators)
      .catch(() => setAdjudicators([]));
  }, [selectedEvent]);

  const adjudicatorLabel = adjudicators.length === 0
    ? "Not yet assigned by admin"
    : adjudicators.map((a) => `${a.name} (${a.role})`).join(", ");

  const handleCreate = async () => {
    if (!selectedEvent) {
      setError("Select an admin-created event first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await attemptsApi.create({
        record_title: recordName,
        category,
        description: [description, conditions].filter(Boolean).join("\n\nConditions:\n"),
        attempt_date: selectedEvent.start_iso ?? undefined,
        location: [venue, location].filter(Boolean).join(", "),
        event_id: selectedEvent.id,
      });
      navigate(`/dashboard`, { replace: true });
      void created;
    } catch (e: any) {
      setError(e?.message ?? "Failed to create submission");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Submission"
        subtitle="Initiate a new evidence workspace. Details auto-fill from the admin-created event you select."
        actions={<Button variant="outline">Save draft</Button>}
      />
      <WorkflowStepper steps={STEPS} current={step} />

      {/* Event source — locked when admin assigned exactly one event */}
      <Card>
        <CardHeader
          title="Source event"
          subtitle={
            events.length <= 1
              ? "Assigned by your administrator. All form fields below are pre-filled from this event."
              : "Your administrator has assigned multiple events to you. Select one to file this submission against."
          }
          action={<span className="chip"><Calendar className="h-3 w-3" /> {events.length} assigned</span>}
        />
        {eventsLoading ? (
          <div className="text-sm text-muted inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : events.length === 0 ? (
          <div className="text-sm text-muted">No event assigned to your account yet. Ask your administrator to assign an event in the Events page.</div>
        ) : events.length === 1 ? (
          <div className="rounded-lg border border-line bg-canvas p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{events[0].id}</div>
            <div className="text-base font-semibold text-soft mt-0.5">{events[0].title}</div>
            <div className="text-[12px] text-muted mt-1 flex flex-wrap gap-2">
              {events[0].category && <span>{events[0].category}</span>}
              {events[0].city && <><span>·</span><span>{[events[0].venue, events[0].city, events[0].country].filter(Boolean).join(", ")}</span></>}
              {events[0].start_iso && <><span>·</span><span>{formatDate(events[0].start_iso)}{events[0].end_iso && events[0].end_iso !== events[0].start_iso ? ` → ${formatDate(events[0].end_iso)}` : ""}</span></>}
            </div>
          </div>
        ) : (
          <select
            className="input"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.id} · {e.title} {e.city ? `· ${e.city}` : ""}{e.start_iso ? ` · ${formatDate(e.start_iso)}` : ""}
              </option>
            ))}
          </select>
        )}
      </Card>

      <Card>
        <CardHeader title={STEPS[step].label} subtitle={STEPS[step].description} action={<span className="chip">Step {step + 1} of {STEPS.length}</span>} />

        {step === 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Record name">
              <Input value={recordName} onChange={(e) => setRecordName(e.target.value)} placeholder="e.g. Largest Simultaneous Yoga Session" />
            </Field>
            <Field label="Category">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="" disabled>Select a category…</option>
                <option>Mass Participation</option>
                <option>Engineering Feats</option>
                <option>Arts & Media</option>
                <option>Technology</option>
                <option>Endurance</option>
                <option>Athletics</option>
                <option>Environment</option>
                <option>Acrobatics</option>
                <option>Music & Performing Arts</option>
                {category && !DEFAULT_CATEGORIES.includes(category) && (
                  <option value={category}>{category}</option>
                )}
              </select>
            </Field>
            <Field label="Internal reference" hint="Auto-generated on save">
              <Input value={internalRef} onChange={(e) => setInternalRef(e.target.value)} placeholder="Auto · GWR-XXXXXXXX" disabled />
            </Field>
            <Field label="Adjudicator" hint="Assigned by admin">
              <Input value={adjudicatorLabel} readOnly />
            </Field>
            <div className="md:col-span-2 panel p-3 bg-gold/[0.04] border-gold/20 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-gold mt-0.5" />
              <p className="text-xs text-soft">
                <span className="text-gold font-semibold">From admin:</span>{" "}
                {selectedEvent ? (
                  <>Pre-filled from <strong>{selectedEvent.id}</strong> ({selectedEvent.title}). Edit any field as needed before continuing.</>
                ) : "Select a source event above to auto-fill these fields."}
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Event date"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="Event end date"><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
            <Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, country" /></Field>
            <Field label="Venue"><Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue name" /></Field>
            <Field label="Organizer"><Input value={organizer} onChange={(e) => setOrganizer(e.target.value)} placeholder="Organizing body" /></Field>
            <Field label="Number of participants"><Input type="number" value={participantCount} onChange={(e) => setParticipantCount(e.target.value)} placeholder="0" /></Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="Record description">
              <textarea
                className="input min-h-[160px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the record attempt, goals, methodology and adjudication context…"
              />
            </Field>
            <Field label="Special conditions / variants">
              <textarea
                className="input min-h-[100px]"
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                placeholder="e.g. continuous performance for 24 hours, weather conditions, group size constraints…"
              />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <ReviewRow k="Source event" v={selectedEvent ? `${selectedEvent.id} · ${selectedEvent.title}` : "—"} />
            <ReviewRow k="Record" v={recordName || "—"} />
            <ReviewRow k="Category" v={category || "—"} />
            <ReviewRow k="Event Date" v={startDate ? `${startDate}${endDate && endDate !== startDate ? ` → ${endDate}` : ""}` : "—"} />
            <ReviewRow k="Location" v={[venue, location].filter(Boolean).join(", ") || "—"} />
            <ReviewRow k="Organizer" v={organizer || "—"} />
            <ReviewRow k="Adjudicator" v={adjudicatorLabel} />
            <ReviewRow k="Participants" v={participantCount || "—"} />
            <div className="panel p-3 mt-4 bg-emerald-50 border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
              <Check className="h-4 w-4" /> Ready to create workspace. Internal reference will be auto-generated as <code>GWR-XXXXXXXX</code>.
            </div>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2">{error}</div>}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="gold" disabled={!selectedEvent} onClick={() => setStep((s) => s + 1)}>Continue <ChevronRight className="h-4 w-4" /></Button>
          ) : (
            <Button variant="gold" disabled={submitting || !selectedEvent} onClick={handleCreate}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Create Submission
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

const DEFAULT_CATEGORIES = [
  "Mass Participation", "Engineering Feats", "Arts & Media", "Technology",
  "Endurance", "Athletics", "Environment", "Acrobatics", "Music & Performing Arts",
];

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-end justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
        {hint && <span className="text-[10px] text-muted">{hint}</span>}
      </div>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ReviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-line">
      <span className="text-[11px] uppercase tracking-wider text-muted">{k}</span>
      <span className="text-sm font-medium">{v}</span>
    </div>
  );
}
