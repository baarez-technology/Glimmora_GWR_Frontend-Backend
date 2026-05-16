import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Trophy,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Eraser,
  Printer,
} from "lucide-react";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { witnesses, attemptMeta } from "@/mock-data";
import { api } from "@/lib/api";
import type { Witness } from "@/types";

interface BackendInvitation {
  witness_id: string;
  attempt_id: string;
  attempt_title: string;
  witness_name: string;
  witness_role: string;
  status: string;
}

const RULES_OBSERVED = [
  "Rule 1: hackathon lasted minimum 24 hours of continuous development",
  "Rule 2: focus on AI platform development (LLMs, ML, NLP, CV)",
  "Rule 3: participation was voluntary, no salaried compensation",
  "Rule 6: all participants remained at the hosting venue",
  "Rule 9: official timekeeping log maintained at all times",
  "Endurance: timer clearly visible in background",
  "Endurance: 2 independent witnesses present during all active periods",
];

function useSignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    ctx.scale(ratio, ratio);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let drawing = false;
    let last: { x: number; y: number } | null = null;
    const pos = (ev: PointerEvent) => {
      const r = c.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      drawing = true;
      last = pos(e);
      c.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!drawing || !last) return;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      setHasInk(true);
    };
    const up = () => {
      drawing = false;
      last = null;
    };
    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    c.addEventListener("pointerup", up);
    c.addEventListener("pointerleave", up);
    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      c.removeEventListener("pointerup", up);
      c.removeEventListener("pointerleave", up);
    };
  }, []);

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  const dataUrl = () => canvasRef.current?.toDataURL("image/png") ?? "";

  return { canvasRef, hasInk, clear, dataUrl };
}

export default function WitnessSign() {
  const { token } = useParams<{ token: string }>();
  const localWitness = witnesses.find((w) => w.token === token) as Witness | undefined;
  const [remote, setRemote] = useState<BackendInvitation | null>(null);
  const [resolving, setResolving] = useState(!localWitness);
  const [resolveError, setResolveError] = useState<string | null>(null);

  useEffect(() => {
    if (localWitness || !token) { setResolving(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const inv = await api.get<BackendInvitation>(`/invitations/${token}`);
        if (!cancelled) setRemote(inv);
      } catch (e: any) {
        if (!cancelled) setResolveError(e?.message ?? "Invalid or expired invitation");
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, localWitness]);

  const witness: Witness | undefined = localWitness ?? (remote ? {
    id: remote.witness_id,
    firstName: remote.witness_name.split(" ")[0] ?? "",
    lastName: remote.witness_name.split(" ").slice(1).join(" ") ?? "",
    email: "",
    organisation: "",
    expertise: "",
    role: (remote.witness_role as Witness["role"]) ?? "independent",
    status: (remote.status === "completed" ? "completed" : remote.status === "invited" ? "in-progress" : "pending") as Witness["status"],
    token: token!,
  } as Witness : undefined);

  const { canvasRef, hasInk, clear, dataUrl } = useSignaturePad();

  const [form, setForm] = useState({
    declaration: witness?.declaration ?? "",
    expertise: witness?.expertise ?? "",
    telephone: witness?.telephone ?? "",
    nationality: witness?.nationality ?? "",
    presentTimes:
      witness?.shiftStartISO && witness?.shiftEndISO
        ? `${witness.shiftStartISO} → ${witness.shiftEndISO}`
        : "",
    finalMeasurement: witness?.finalMeasurement ?? "72h 00m 00.00s",
    rulesObserved: witness?.rulesObserved ?? RULES_OBSERVED.slice(0, 5),
    willing: witness?.willingToBeContacted ?? true,
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (resolving) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="text-center max-w-md">
          <h2 className="font-bold text-lg">Verifying invitation…</h2>
        </Card>
      </div>
    );
  }

  if (!witness) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="text-center max-w-md">
          <Trophy className="h-8 w-8 text-royal mx-auto mb-3" />
          <h2 className="font-bold text-lg">Invitation not found</h2>
          <p className="text-sm text-muted mt-1">
            {resolveError ?? "This link may have expired. Please contact the record organiser to receive a new signing invitation."}
          </p>
        </Card>
      </div>
    );
  }

  const toggleRule = (r: string) =>
    setForm((f) => ({
      ...f,
      rulesObserved: f.rulesObserved.includes(r)
        ? f.rulesObserved.filter((x) => x !== r)
        : [...f.rulesObserved, r],
    }));

  const submit = async () => {
    if (!hasInk) {
      alert("A handwritten signature is required.");
      return;
    }
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post(`/invitations/${token}/statement`, {
        fields: {
          declaration: form.declaration,
          expertise: form.expertise,
          telephone: form.telephone,
          nationality: form.nationality,
          presentTimes: form.presentTimes,
          finalMeasurement: form.finalMeasurement,
          rulesObserved: form.rulesObserved,
          willingToBeContacted: form.willing,
        },
        signature_png: dataUrl(),
      });
      setSubmitted(true);
    } catch (e: any) {
      setSubmitError(e?.message ?? "Failed to submit statement");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Card className="max-w-md text-center !p-8">
          <div className="h-14 w-14 rounded-full bg-emerald-50 border border-emerald-200 mx-auto flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="font-bold text-xl mt-3">Witness statement received</h2>
          <p className="text-sm text-muted mt-2">
            Thank you, {witness.firstName}. Your signed statement has been added to the Guinness
            World Records submission for{" "}
            <strong className="text-soft">{attemptMeta.recordTitle}</strong>.
          </p>
          <p className="text-[11px] text-muted mt-4">
            A copy of your statement PDF will be emailed to {witness.email}.
          </p>
          <Button variant="outline" className="mt-5" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Download your copy
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Witness Statement"
        subtitle={`You have been invited to witness an official Guinness World Records attempt. Please complete the form below.`}
      />

      <Card className="!p-0 overflow-hidden">
        {/* Header band */}
        <div className="bg-blue-shine text-white px-4 sm:px-6 py-4 sm:py-5 flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <Trophy className="h-6 w-6 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] opacity-80">Guinness World Records</div>
            <div className="font-bold text-base sm:text-lg truncate">{attemptMeta.recordTitle}</div>
            <div className="text-[12px] opacity-80 truncate">App ref: {attemptMeta.applicationRef}</div>
          </div>
          <Badge tone="gold"><Sparkles className="h-3 w-3" /> Digital signing</Badge>
        </div>

        {/* Form */}
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">1) Declaration of independence</h3>
              <p className="text-[12px] text-muted mb-2">
                I, <strong>{witness.firstName} {witness.lastName}</strong>, declare that I am not associated with, or related to, the record organisers or participants, nor have anything to gain from the final outcome of the attempt.
              </p>
              <textarea
                className="input min-h-[80px]"
                value={form.declaration}
                onChange={(e) => setForm({ ...form, declaration: e.target.value })}
                placeholder="Any further declaration / context…"
              />
            </div>

            <div>
              <h3 className="font-semibold text-sm">2) Contact details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <Input value={witness.firstName} disabled />
                <Input value={witness.lastName} disabled />
                <Input value={witness.email} disabled className="sm:col-span-2" />
                <Input
                  placeholder="Telephone"
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                />
                <Input
                  placeholder="Nationality"
                  value={form.nationality}
                  onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                />
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm">3) What did you witness?</h3>
              <p className="text-[12px] text-muted mb-2">Tick all rules you personally observed being followed.</p>
              <div className="space-y-1.5">
                {RULES_OBSERVED.map((r) => (
                  <label key={r} className="flex items-start gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={form.rulesObserved.includes(r)}
                      onChange={() => toggleRule(r)}
                      className="mt-0.5 accent-royal"
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">4) Your field of expertise</h3>
              <Input
                value={form.expertise}
                onChange={(e) => setForm({ ...form, expertise: e.target.value })}
                placeholder="e.g., ML systems · 10 years"
              />
            </div>

            <div>
              <h3 className="font-semibold text-sm">5) Final measurement (per timekeeper)</h3>
              <Input
                value={form.finalMeasurement}
                onChange={(e) => setForm({ ...form, finalMeasurement: e.target.value })}
              />
            </div>

            <div>
              <h3 className="font-semibold text-sm">6) Attempt location</h3>
              <div className="grid grid-cols-1 gap-2 mt-2">
                <Input value={attemptMeta.venue} disabled />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input value={attemptMeta.city} disabled />
                  <Input value={attemptMeta.country} disabled />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm">7) When were you present?</h3>
              <Input
                value={form.presentTimes}
                onChange={(e) => setForm({ ...form, presentTimes: e.target.value })}
                placeholder="e.g., 2026-05-12 09:00 → 13:00 IST"
              />
            </div>

            <div>
              <h3 className="font-semibold text-sm">8) Handwritten signature</h3>
              <p className="text-[12px] text-muted mb-2 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> All signatures must be handwritten — please sign on the pad below using a mouse, stylus or finger.
              </p>
              <div className="rounded-lg border border-dashed border-line bg-canvas/40">
                <canvas
                  ref={canvasRef}
                  className="block w-full h-[160px] rounded-lg cursor-crosshair touch-none"
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-muted">
                  {hasInk ? "Signature captured ✓" : "Awaiting signature…"}
                </span>
                <Button variant="ghost" onClick={clear}>
                  <Eraser className="h-3.5 w-3.5" /> Clear
                </Button>
              </div>
            </div>

            <label className="flex items-start gap-2 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={form.willing}
                onChange={(e) => setForm({ ...form, willing: e.target.checked })}
                className="mt-0.5 accent-royal"
              />
              I am willing to be contacted by Guinness World Records to discuss any details regarding this record claim.
            </label>
          </section>
        </div>

        <div className="bg-canvas px-6 py-4 flex items-center justify-between border-t border-line">
          <div className="text-[11px] text-muted">
            {submitError ? (
              <span className="text-rose-700">{submitError}</span>
            ) : (
              <>By submitting, a Guinness-compliant PDF will be auto-generated and attached to the submission package.</>
            )}
          </div>
          <Button variant="gold" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit witness statement"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
