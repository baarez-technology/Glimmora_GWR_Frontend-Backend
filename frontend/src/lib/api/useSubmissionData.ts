import { useEffect, useState } from "react";
import { attemptsApi, witnessesApi, statementsApi } from "./resources";
import type { Attempt, Witness as ApiWitness } from "./types";
import type { AdminEvent } from "./admin";
import type { AttemptMeta, Witness as UiWitness, WitnessRole, WitnessStatus } from "@/types";
import type { Steward } from "@/mock-data";

/**
 * Maps backend witness rows + their statement fields into the UI-shaped
 * `Witness[]` / `Steward[]` / `AttemptMeta` that the existing PDF render
 * pages (WitnessStatement, StewardStatement, TimekeeperStatement) expect.
 */

type Statement = Awaited<ReturnType<typeof statementsApi.list>>[number];

function splitName(full: string | null | undefined): { firstName: string; lastName: string } {
  if (!full) return { firstName: "", lastName: "" };
  const parts = full.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function detectRole(raw: string | null | undefined): WitnessRole {
  const r = (raw ?? "").toLowerCase();
  if (r.includes("timekeep")) return "timekeeper";
  if (r.includes("specialist") || r.includes("expert")) return "specialist";
  return "independent";
}

function isStewardRole(raw: string | null | undefined): boolean {
  return (raw ?? "").toLowerCase().includes("steward");
}

function mapStatus(s: string, hasDecision: boolean): WitnessStatus {
  if (hasDecision) return "completed";
  if (s === "completed") return "completed";
  if (s === "invited") return "in-progress";
  if (s === "rejected") return "rejected";
  return "pending";
}

function readField(fields: Record<string, unknown> | null | undefined, ...keys: string[]): string {
  if (!fields) return "";
  const lcKeys = keys.map((k) => k.toLowerCase());
  for (const [k, v] of Object.entries(fields)) {
    if (lcKeys.includes(k.toLowerCase()) && (typeof v === "string" || typeof v === "number")) {
      return String(v);
    }
  }
  return "";
}

function fieldsToDeclaration(fields: Record<string, unknown> | null | undefined): string {
  if (!fields) return "";
  return Object.entries(fields)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : Array.isArray(v) ? v.join(", ") : JSON.stringify(v)}`)
    .join("\n");
}

function fieldsToRulesObserved(fields: Record<string, unknown> | null | undefined): string[] {
  const rules = readField(fields, "Rule compliance observed", "Rules observed", "Rule compliance");
  if (!rules) return [];
  return rules.split(/\n|;|·/).map((s) => s.trim()).filter(Boolean);
}

function mapWitness(api: ApiWitness, stmt: Statement | undefined): UiWitness {
  const fields = (stmt?.fields ?? null) as Record<string, unknown> | null;
  const { firstName, lastName } = splitName(readField(fields, "Full name", "Name") || api.full_name);
  const role = detectRole(api.role);
  return {
    id: api.id,
    firstName,
    lastName,
    email: api.email,
    organisation: api.organisation ?? "",
    expertise: api.expertise ?? readField(fields, "Field of expertise", "Expertise"),
    role,
    status: mapStatus(api.status, !!api.decision),
    inviteSentAt: api.invited_at ?? undefined,
    completedAt: api.completed_at ?? undefined,
    shiftStartISO: readField(fields, "Start time observed", "Shift start", "Start") || undefined,
    shiftEndISO: readField(fields, "End time observed", "Shift end", "End") || undefined,
    signatureDataUrl: undefined,
    declaration: fieldsToDeclaration(fields),
    rulesObserved: fieldsToRulesObserved(fields),
    finalMeasurement: readField(fields, "Final measurement", "Measurement"),
    telephone: api.phone ?? undefined,
    nationality: readField(fields, "Nationality"),
    willingToBeContacted: true,
    token: api.token ?? "",
  };
}

function mapSteward(api: ApiWitness, stmt: Statement | undefined): Steward {
  const fields = (stmt?.fields ?? null) as Record<string, unknown> | null;
  const { firstName, lastName } = splitName(readField(fields, "Full name", "Name") || api.full_name);
  return {
    id: api.id,
    firstName,
    lastName,
    email: api.email,
    organisation: api.organisation ?? "",
    responsibility: api.expertise || readField(fields, "Responsibility", "Role at attempt") || api.role,
    shiftStartISO: readField(fields, "Start time observed", "Shift start") || undefined,
    shiftEndISO: readField(fields, "End time observed", "Shift end") || undefined,
    status: api.status === "completed" ? "completed" : api.status === "invited" ? "in-progress" : "pending",
    completedAt: api.completed_at ?? undefined,
    declaration: fieldsToDeclaration(fields),
    observations: fieldsToRulesObserved(fields),
  };
}

function attemptToMeta(a: Attempt | undefined, ev: AdminEvent | undefined): AttemptMeta {
  const [city = "", country = ""] = (a?.location ?? "").split(",").map((s) => s.trim()).reverse();
  return {
    recordTitle: a?.record_title || ev?.title || "",
    applicationRef: a?.application_ref ?? "",
    organisation: ev?.organizer ?? "",
    teamName: "",
    venue: ev?.venue || a?.location || "",
    city: ev?.city || city,
    country: ev?.country || country,
    startISO: ev?.start_iso || a?.attempt_date || new Date().toISOString(),
    endISO: ev?.end_iso || a?.attempt_date || new Date().toISOString(),
    participantCount: ev?.participant_count ?? 0,
    attemptDescription: a?.description || ev?.description || "",
    measurementMethod: "",
    contactFirstName: "",
    contactLastName: "",
    contactNationality: "",
    contactGender: "Other",
  };
}

export interface SubmissionData {
  attempt: Attempt | null;
  event: AdminEvent | null;
  attemptMeta: AttemptMeta;
  witnesses: UiWitness[];
  stewards: Steward[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useSubmissionData(): SubmissionData {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [witnesses, setWitnesses] = useState<UiWitness[]>([]);
  const [stewards, setStewards] = useState<Steward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const attempts = await attemptsApi.list();
        if (cancelled) return;
        const current = attempts[0] ?? null;
        setAttempt(current);
        if (!current) {
          setEvent(null);
          setWitnesses([]);
          setStewards([]);
          return;
        }
        const [ws, sts, availableEvents] = await Promise.all([
          witnessesApi.list(current.id).catch(() => [] as ApiWitness[]),
          statementsApi.list(current.id).catch(() => [] as Statement[]),
          current.event_id
            ? attemptsApi.availableEvents().catch(() => [] as AdminEvent[])
            : Promise.resolve([] as AdminEvent[]),
        ]);
        if (cancelled) return;
        const linkedEvent = current.event_id
          ? availableEvents.find((e) => e.id === current.event_id) ?? null
          : null;
        setEvent(linkedEvent);
        const stmtByWitness = new Map<string, Statement>();
        sts.forEach((s) => { if (s.witness_id) stmtByWitness.set(s.witness_id, s); });

        const uiWitnesses: UiWitness[] = [];
        const uiStewards: Steward[] = [];
        for (const w of ws) {
          const stmt = stmtByWitness.get(w.id);
          if (isStewardRole(w.role)) uiStewards.push(mapSteward(w, stmt));
          else uiWitnesses.push(mapWitness(w, stmt));
        }
        setWitnesses(uiWitnesses);
        setStewards(uiStewards);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load submission data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  return {
    attempt,
    event,
    attemptMeta: attemptToMeta(attempt ?? undefined, event ?? undefined),
    witnesses,
    stewards,
    loading,
    error,
    reload: () => setTick((t) => t + 1),
  };
}
