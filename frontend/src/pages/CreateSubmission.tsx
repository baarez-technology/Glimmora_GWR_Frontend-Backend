import { useState } from "react";
import WorkflowStepper from "@/components/WorkflowStepper";
import { Button, Card, CardHeader, Input, PageHeader } from "@/components/ui";
import { Sparkles, ChevronRight, ChevronLeft, Check } from "lucide-react";

const STEPS = [
  { label: "Record details", description: "Name, category, and core record information." },
  { label: "Event details", description: "Date, location, organizer, and conditions." },
  { label: "Description", description: "Narrative summary & adjudication context." },
  { label: "Review", description: "Confirm and create submission workspace." },
];

export default function CreateSubmission() {
  const [step, setStep] = useState(0);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Submission"
        subtitle="Initiate a new evidence workspace. AI will pre-organize evidence as you upload."
        actions={<Button variant="outline">Save draft</Button>}
      />
      <WorkflowStepper steps={STEPS} current={step} />

      <Card>
        <CardHeader title={STEPS[step].label} subtitle={STEPS[step].description} action={<span className="chip">Step {step + 1} of {STEPS.length}</span>} />

        {step === 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Record name"><Input placeholder="e.g. Largest Simultaneous Yoga Session" /></Field>
            <Field label="Category">
              <select className="input" defaultValue="">
                <option value="" disabled>Select a category…</option>
                <option>Mass Participation</option>
                <option>Engineering Feats</option>
                <option>Arts & Media</option>
                <option>Technology</option>
                <option>Endurance</option>
              </select>
            </Field>
            <Field label="Internal reference" hint="Auto-generated, editable">
              <Input placeholder="GWR-YYYY-####" />
            </Field>
            <Field label="Adjudicator">
              <Input placeholder="Assigned adjudicator name" />
            </Field>
            <div className="md:col-span-2 panel p-3 bg-gold/[0.04] border-gold/20 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-gold mt-0.5" />
              <p className="text-xs text-soft">
                <span className="text-gold font-semibold">AI suggestion:</span> Pick a category to get tailored folder recommendations.
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Event date"><Input type="date" /></Field>
            <Field label="Event end date"><Input type="date" /></Field>
            <Field label="Location"><Input placeholder="City, country" /></Field>
            <Field label="Venue"><Input placeholder="Venue name" /></Field>
            <Field label="Organizer"><Input placeholder="Organizing body" /></Field>
            <Field label="Number of participants"><Input type="number" placeholder="0" /></Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="Record description">
              <textarea className="input min-h-[160px]" placeholder="Describe the record attempt, goals, methodology and adjudication context…" />
            </Field>
            <Field label="Special conditions / variants">
              <textarea className="input min-h-[100px]" placeholder="e.g. continuous performance for 24 hours, weather conditions, group size constraints…" />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <ReviewRow k="Record" v="—" />
            <ReviewRow k="Category" v="—" />
            <ReviewRow k="Event Date" v="—" />
            <ReviewRow k="Location" v="—" />
            <ReviewRow k="Organizer" v="—" />
            <ReviewRow k="Adjudicator" v="—" />
            <div className="panel p-3 mt-4 bg-emerald-50 border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
              <Check className="h-4 w-4" /> Ready to create workspace. AI will pre-categorize uploads automatically.
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="gold" onClick={() => setStep((s) => s + 1)}>Continue <ChevronRight className="h-4 w-4" /></Button>
          ) : (
            <Button variant="gold"><Check className="h-4 w-4" /> Create Submission</Button>
          )}
        </div>
      </Card>
    </div>
  );
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
