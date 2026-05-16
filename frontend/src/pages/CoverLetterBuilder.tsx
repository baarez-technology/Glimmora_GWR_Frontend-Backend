import { useEffect, useMemo, useState } from "react";
import { Wand2, Printer, Download, CheckCircle2, FileWarning, RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, Input, PageHeader, Badge } from "@/components/ui";
import { attemptMeta as seed } from "@/mock-data";
import type { AttemptMeta } from "@/types";
import { downloadFilledCoverLetter, fillCoverLetterPdf, type CoverLetterFill } from "@/lib/coverLetterPdf";

const TEMPLATE_URL = "/cover-letter-template-2022.pdf";

const EVIDENCE_OPTIONS = [
  "Witnesses' statement",
  "Video of the record measurement",
  "Photographs of the record",
  "Specific evidence as requested in the guidelines for this record attempt",
] as const;

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-muted font-semibold mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-muted mt-1">{hint}</div>}
    </label>
  );
}

export default function CoverLetterBuilder() {
  const [meta, setMeta] = useState<AttemptMeta>(seed);
  const [currentRecord, setCurrentRecord] = useState("First attempt — no current minimum set by GWR");
  const [attemptResults, setAttemptResults] = useState("72h 00m 00.00s of continuous AI platform development");
  const [signedBy, setSignedBy] = useState("Dr. Anika Bose, Prof. Karim El-Sayed");
  const [otherEvidence, setOtherEvidence] = useState("");
  const [evidenceOther, setEvidenceOther] = useState(false);
  const [evidence, setEvidence] = useState<string[]>([...EVIDENCE_OPTIONS]);
  const [aiBusy, setAiBusy] = useState(false);

  const [templateExists, setTemplateExists] = useState<boolean | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Check whether the template PDF is present in /public
  useEffect(() => {
    fetch(TEMPLATE_URL, { method: "HEAD" })
      .then((r) => setTemplateExists(r.ok))
      .catch(() => setTemplateExists(false));
  }, []);

  const completeness = useMemo(() => {
    let f = 0, t = 0;
    Object.values(meta).forEach((v) => {
      t += 1;
      if (typeof v === "string" ? v.trim().length > 0 : v != null) f += 1;
    });
    return Math.round((f / t) * 100);
  }, [meta]);

  const fillPayload: CoverLetterFill = useMemo(
    () => ({
      recordTitle: meta.recordTitle,
      applicationRef: meta.applicationRef,
      currentRecord,
      attemptResults,
      holderFirstName: meta.contactFirstName,
      holderLastName: meta.contactLastName,
      holderOrganisation: meta.teamName || meta.organisation,
      holderNationality: meta.contactNationality,
      holderGender: meta.contactGender,
      location: `${meta.venue}, ${meta.city}, ${meta.country}`,
      startISO: meta.startISO,
      endISO: meta.endISO,
      attemptDescription: meta.attemptDescription,
      evidence: {
        witnessStatement: evidence.includes("Witnesses' statement"),
        video: evidence.includes("Video of the record measurement"),
        photos: evidence.includes("Photographs of the record"),
        specific: evidence.includes("Specific evidence as requested in the guidelines for this record attempt"),
        other: evidenceOther,
        otherText: otherEvidence,
        signedBy,
      },
      completedFirstName: meta.contactFirstName,
      completedLastName: meta.contactLastName,
      completedISO: new Date().toISOString(),
    }),
    [meta, currentRecord, attemptResults, evidence, evidenceOther, otherEvidence, signedBy],
  );

  // Rebuild the inline preview whenever data changes (debounced)
  useEffect(() => {
    if (!templateExists) return;
    let cancelled = false;
    setRebuilding(true);
    setPreviewError(null);
    const debugGrid = new URLSearchParams(window.location.search).get("cl-debug") === "1";
    const t = setTimeout(async () => {
      try {
        const blob = await fillCoverLetterPdf(fillPayload, TEMPLATE_URL, { debugGrid });
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (err) {
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : "Failed to build preview");
      } finally {
        if (!cancelled) setRebuilding(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [fillPayload, templateExists]);

  const toggleEvidence = (e: string) =>
    setEvidence((arr) => (arr.includes(e) ? arr.filter((x) => x !== e) : [...arr, e]));

  const runAIFill = async () => {
    setAiBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    setMeta((m) => ({
      ...m,
      attemptDescription:
        "Glimmora International hosted a continuous 72-hour AI platform development hackathon at its Chennai " +
        "Innovation Hall from 09:00 IST on 12 May 2026 to 09:00 IST on 15 May 2026. Forty-two vetted " +
        "participants — full-time AI engineers, recent computer-science graduates and credentialed " +
        "contributors — designed, built and shipped multiple AI platforms. The attempt was supervised by " +
        "two specialist AI witnesses and timekept to ±0.01s by two independent NTP-synced timekeepers. " +
        "All activity and rest sequences were logged using the official GWR Activity Log Book templates.",
    }));
    setAiBusy(false);
  };

  const handleDownload = async () => {
    if (!templateExists) {
      alert(
        `Template PDF not found.\n\nPlease place the official Guinness World Records cover letter template at:\nfrontend/public/cover-letter-template-2022.pdf`,
      );
      return;
    }
    await downloadFilledCoverLetter(fillPayload, `GWR_Cover_Letter_${meta.applicationRef}.pdf`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cover Letter Builder"
        subtitle="Fill the form on the left — the official GWR Cover Letter template loads on the right, with your values overlaid onto the real PDF. Download a filled copy in one click."
        actions={
          <>
            <Button variant="outline" onClick={runAIFill} disabled={aiBusy}>
              <Wand2 className="h-4 w-4" /> {aiBusy ? "Drafting…" : "AI prefill"}
            </Button>
            <Button variant="gold" onClick={handleDownload}>
              <Download className="h-4 w-4" /> Download filled PDF
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ===== Left: editable form ===== */}
        <Card>
          <CardHeader
            title="Form fields"
            subtitle="Mirror of the official GWR Cover Letter Template (2022)"
            action={
              <Badge tone={completeness === 100 ? "green" : "gold"}>
                <CheckCircle2 className="h-3 w-3" /> {completeness}% complete
              </Badge>
            }
          />

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="1) Record Title">
                <Input value={meta.recordTitle} onChange={(e) => setMeta({ ...meta, recordTitle: e.target.value })} />
              </Field>
              <Field label="2) Application Reference Number">
                <Input value={meta.applicationRef} onChange={(e) => setMeta({ ...meta, applicationRef: e.target.value })} />
              </Field>
            </div>

            <Field label="3) Current Record or 'minimum'">
              <Input value={currentRecord} onChange={(e) => setCurrentRecord(e.target.value)} />
            </Field>

            <Field label="4) Your Attempt Results">
              <Input value={attemptResults} onChange={(e) => setAttemptResults(e.target.value)} />
            </Field>

            <div className="rounded-lg border border-line p-3 space-y-3">
              <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">
                5) New record holder
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="First Name" value={meta.contactFirstName} onChange={(e) => setMeta({ ...meta, contactFirstName: e.target.value })} />
                <Input placeholder="Nationality" value={meta.contactNationality} onChange={(e) => setMeta({ ...meta, contactNationality: e.target.value })} />
                <Input placeholder="Last Name" value={meta.contactLastName} onChange={(e) => setMeta({ ...meta, contactLastName: e.target.value })} />
                <select
                  className="input"
                  value={meta.contactGender}
                  onChange={(e) => setMeta({ ...meta, contactGender: e.target.value as AttemptMeta["contactGender"] })}
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
                <Input
                  className="sm:col-span-2"
                  placeholder="Organization / Team Name"
                  value={meta.teamName}
                  onChange={(e) => setMeta({ ...meta, teamName: e.target.value })}
                />
              </div>
            </div>

            <Field label="Location of attempt">
              <Input
                value={`${meta.venue}, ${meta.city}, ${meta.country}`}
                onChange={(e) => {
                  const parts = e.target.value.split(",").map((p) => p.trim());
                  setMeta({ ...meta, venue: parts[0] ?? "", city: parts[1] ?? "", country: parts[2] ?? "" });
                }}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Start date">
                <Input
                  type="datetime-local"
                  value={meta.startISO.slice(0, 16)}
                  onChange={(e) => setMeta({ ...meta, startISO: e.target.value })}
                />
              </Field>
              <Field label="End date">
                <Input
                  type="datetime-local"
                  value={meta.endISO.slice(0, 16)}
                  onChange={(e) => setMeta({ ...meta, endISO: e.target.value })}
                />
              </Field>
            </div>

            <Field label="6) Tell us more about your attempt" hint={`${meta.attemptDescription.length} chars`}>
              <textarea
                className="input min-h-[140px] resize-y leading-relaxed"
                value={meta.attemptDescription}
                onChange={(e) => setMeta({ ...meta, attemptDescription: e.target.value })}
              />
            </Field>

            <Field label="7) Evidence being uploaded">
              <div className="space-y-2">
                {EVIDENCE_OPTIONS.map((opt) => (
                  <label key={opt} className="flex items-start gap-2 rounded-lg border border-line p-2.5 hover:bg-canvas cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evidence.includes(opt)}
                      onChange={() => toggleEvidence(opt)}
                      className="mt-0.5 accent-royal"
                    />
                    <span className="text-sm text-soft">{opt}</span>
                  </label>
                ))}
                <label className="flex items-start gap-2 rounded-lg border border-line p-2.5 hover:bg-canvas cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evidenceOther}
                    onChange={(e) => setEvidenceOther(e.target.checked)}
                    className="mt-0.5 accent-royal"
                  />
                  <div className="flex-1">
                    <div className="text-sm text-soft">Other material (please specify)</div>
                    <Input
                      className="mt-1"
                      placeholder="Specify other material…"
                      value={otherEvidence}
                      onChange={(e) => setOtherEvidence(e.target.value)}
                      disabled={!evidenceOther}
                    />
                  </div>
                </label>
                <Field label="Witnesses' statement — signed by">
                  <Input value={signedBy} onChange={(e) => setSignedBy(e.target.value)} placeholder="Witness names…" />
                </Field>
              </div>
            </Field>
          </div>
        </Card>

        {/* ===== Right: actual official PDF, auto-filled ===== */}
        <div className="xl:sticky xl:top-6 self-start">
          <Card className="!p-0 overflow-hidden">
            <div className="flex items-center justify-between bg-canvas px-5 py-3 border-b border-line">
              <div className="text-[11px] uppercase tracking-wider font-bold text-royal">
                Official GWR Cover Letter Template 2022
              </div>
              <div className="flex items-center gap-2">
                {rebuilding && (
                  <span className="text-[11px] text-muted flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Updating…
                  </span>
                )}
                <Badge tone="gold">Auto-filled</Badge>
              </div>
            </div>

            {templateExists === null && (
              <div className="p-8 text-center text-[12px] text-muted">Checking template…</div>
            )}

            {templateExists === false && (
              <div className="p-8 text-center">
                <FileWarning className="h-10 w-10 text-amber-500 mx-auto mb-3" />
                <div className="font-bold text-soft mb-1">Template PDF not found</div>
                <p className="text-[12.5px] text-muted leading-relaxed max-w-md mx-auto">
                  To embed the official template here and auto-fill it, download the GWR cover letter
                  template PDF (the file you already have) and place it at:
                </p>
                <code className="block mt-3 bg-canvas border border-line rounded px-3 py-2 text-[11.5px] text-soft inline-block">
                  frontend/public/cover-letter-template-2022.pdf
                </code>
                <div className="text-[11px] text-muted mt-3">Then refresh this page.</div>
              </div>
            )}

            {templateExists && !previewUrl && !previewError && (
              <div className="flex items-center justify-center bg-canvas text-[12px] text-muted" style={{ height: "82vh" }}>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Generating PDF preview…
              </div>
            )}

            {templateExists && previewError && (
              <div className="p-8 text-center bg-canvas" style={{ minHeight: "40vh" }}>
                <FileWarning className="h-10 w-10 text-rose-500 mx-auto mb-3" />
                <div className="font-bold text-soft mb-1">Could not render preview</div>
                <div className="text-[12px] text-muted">{previewError}</div>
                <div className="text-[11px] text-muted mt-2">You can still download the filled PDF using the button above.</div>
              </div>
            )}

            {templateExists && previewUrl && (
              <object
                key={previewUrl}
                data={previewUrl + "#toolbar=0&navpanes=0"}
                type="application/pdf"
                className="block w-full bg-canvas"
                style={{ height: "82vh" }}
              >
                <div className="p-6 text-[12px] text-muted">
                  Your browser cannot display PDFs inline.{" "}
                  <a href={previewUrl} download className="text-royal underline">Download the filled PDF</a>.
                </div>
              </object>
            )}

            <div className="flex items-center justify-between px-5 py-3 bg-canvas border-t border-line">
              <div className="text-[11px] text-muted">
                Your values are overlaid onto the real GWR PDF. Coordinates can be tuned in <code>src/lib/coverLetterPdf.ts</code> if any field lands a few pixels off.
              </div>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
