import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trophy,
  Printer,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  UserCheck,
  Plus,
  FileWarning,
  RefreshCw,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, Input, PageHeader } from "@/components/ui";
import { stewards as seed, attemptMeta } from "@/mock-data";
import type { Steward } from "@/mock-data";
import { formatDate, formatTime } from "@/lib/utils";
import {
  downloadFilledStewardStatement,
  fillStewardStatementPdf,
  type StewardStatementFill,
} from "@/lib/stewardStatementPdf";

const TEMPLATE_URL = "/steward-statement-template-2022.pdf";

export default function StewardStatement() {
  const [list, setList] = useState<Steward[]>(seed);
  const [idx, setIdx] = useState(0);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    organisation: "",
    responsibility: "",
  });
  const s = list[idx];
  const printRef = useRef<HTMLDivElement>(null);

  const fillPayload: StewardStatementFill | null = useMemo(() => {
    if (!s) return null;
    const presentDates =
      s.shiftStartISO && s.shiftEndISO
        ? `${formatDate(s.shiftStartISO)} ${formatTime(s.shiftStartISO)} → ${formatDate(s.shiftEndISO)} ${formatTime(s.shiftEndISO)}`
        : "";
    const role = [s.responsibility, s.declaration].filter(Boolean).join("\n\n");
    const obs = s.observations?.map((o) => `• ${o}`).join("\n") ?? "";
    return {
      declarationName: `${s.firstName} ${s.lastName}`,
      recordTitle: attemptMeta.recordTitle,
      applicationRef: attemptMeta.applicationRef,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      telephone: "",
      city: attemptMeta.city,
      stateProvinceRegion: "",
      country: attemptMeta.country,
      presentDates,
      role,
      participantsObserved:
        `${attemptMeta.participantCount ?? 0} participants observed in total.\n\n` +
        `Counting method: sign-in ledger at venue entry checkpoint, cross-referenced against ` +
        `ID verification log and headcount at 30-minute intervals throughout the shift.\n\n` +
        obs,
      participantsValid:
        `${attemptMeta.participantCount ?? 0} participants participated fully as per the record guidelines ` +
        `(GWR Rule 4 eligibility a/b/c verified for every participant before commencement).`,
      participantsDisqualified:
        "0 participants disqualified. No eligibility or rule-compliance issues were raised " +
        "during the shift; all participants remained within the hosting venue and followed " +
        "the published record guidelines.",
      completedISO: s.completedAt ?? new Date().toISOString(),
    };
  }, [s]);

  const [templateExists, setTemplateExists] = useState<boolean | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    fetch(TEMPLATE_URL, { method: "HEAD" })
      .then((r) => setTemplateExists(r.ok))
      .catch(() => setTemplateExists(false));
  }, []);

  useEffect(() => {
    if (!templateExists || !fillPayload) return;
    let cancelled = false;
    setRebuilding(true);
    setPreviewError(null);
    const t = setTimeout(async () => {
      try {
        const blob = await fillStewardStatementPdf(fillPayload, TEMPLATE_URL);
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

  const handleDownloadTemplate = async () => {
    if (!fillPayload || !s) return;
    if (!templateExists) {
      alert(
        `Template PDF not found.\n\nPlace the official GWR Steward Statement template at:\nfrontend/public/steward-statement-template-2022.pdf`,
      );
      return;
    }
    await downloadFilledStewardStatement(
      fillPayload,
      `GWR_Steward_Statement_${s.firstName}_${s.lastName}.pdf`,
    );
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;
    win.document.write(`
      <html><head><title>Steward Statement — ${s?.firstName} ${s?.lastName}</title>
      <style>
        body{font-family:Inter,ui-sans-serif,system-ui;color:#1F2937;padding:48px;max-width:780px;margin:0 auto;line-height:1.55}
        h2{color:#0057B8;font-size:12px;text-transform:uppercase;letter-spacing:.18em;margin:18px 0 6px}
        .bar{background:#C8A44D;height:4px;margin:14px 0}
        @media print { body { padding:24px } }
      </style></head><body>${printRef.current.innerHTML}
      <script>window.onload=()=>setTimeout(()=>window.print(),250)</script>
      </body></html>`);
    win.document.close();
  };

  const addSteward = () => {
    if (!draft.firstName || !draft.lastName) return;
    const id = `S-${String(list.length + 1).padStart(3, "0")}`;
    setList([
      ...list,
      {
        id,
        firstName: draft.firstName,
        lastName: draft.lastName,
        email: draft.email,
        organisation: draft.organisation,
        responsibility: draft.responsibility,
        status: "pending",
      },
    ]);
    setIdx(list.length);
    setDraft({ firstName: "", lastName: "", email: "", organisation: "", responsibility: "" });
    setAdding(false);
  };

  if (!s) {
    return (
      <Card>
        <div className="text-muted">No stewards added yet.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Steward Statement"
        subtitle="Stewards declare their oversight of specific aspects of the attempt — eligibility verification, venue boundary, welfare. Each statement is auto-generated from form data and attached to the submission."
        actions={
          <>
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add steward
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4" /> Print summary
            </Button>
            <Button variant="gold" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4" /> Download official GWR PDF
            </Button>
          </>
        }
      />

      <Card className="!p-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Button variant="ghost" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {list.map((wi, i) => (
            <button
              key={wi.id}
              onClick={() => setIdx(i)}
              className={
                "shrink-0 rounded-lg border px-3 py-2 text-left text-[12px] transition " +
                (i === idx ? "border-royal bg-royal/[0.06] text-royal" : "border-line bg-white hover:bg-canvas")
              }
            >
              <div className="font-semibold flex items-center gap-1.5">
                <UserCheck className="h-3 w-3" />
                {wi.firstName} {wi.lastName}
              </div>
              <div className="text-[10px] text-muted capitalize">{wi.status.replace("-", " ")}</div>
            </button>
          ))}
          <Button variant="ghost" onClick={() => setIdx((i) => Math.min(list.length - 1, i + 1))} disabled={idx === list.length - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
        <Card>
          <CardHeader title="Steward" />
          <div className="text-center">
            <div className="h-16 w-16 rounded-full bg-royal text-white mx-auto flex items-center justify-center text-lg font-bold">
              {s.firstName[0]}{s.lastName[0]}
            </div>
            <div className="font-bold mt-2">{s.firstName} {s.lastName}</div>
            <div className="text-[12px] text-muted">{s.organisation}</div>
          </div>
          <div className="mt-4 space-y-2 text-[12px]">
            <div className="flex items-center gap-2 text-muted">
              {s.status === "completed" ? (
                <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span>Signed</span></>
              ) : (
                <><Clock className="h-4 w-4 text-amber-500" /><span>{s.status === "in-progress" ? "In progress" : "Pending"}</span></>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Responsibility</div>
              {s.responsibility}
            </div>
            {s.shiftStartISO && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Shift</div>
                {formatDate(s.shiftStartISO)} {formatTime(s.shiftStartISO)} → {s.shiftEndISO && formatTime(s.shiftEndISO)}
              </div>
            )}
          </div>
        </Card>

        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between bg-canvas px-5 py-3 border-b border-line">
            <div className="text-[11px] uppercase tracking-wider font-bold text-royal">Steward statement preview</div>
            <Badge tone="gold">GWR-compliant template</Badge>
          </div>
          <div ref={printRef} className="bg-white p-8 text-[13px] leading-relaxed">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-royal text-white font-extrabold flex items-center justify-center">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[20px] font-bold text-royal-400 leading-tight">GUINNESS WORLD RECORDS</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted">Steward Statement</div>
              </div>
            </div>
            <div className="bar h-1 bg-gold mb-5" />

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mb-2">1) Declaration</h2>
            <p className="text-[12.5px]">
              I, <strong>{s.firstName} {s.lastName}</strong> of <strong>{s.organisation}</strong>, acted as a
              steward during the Guinness World Records™ attempt titled{" "}
              <strong>{attemptMeta.recordTitle}</strong> (application ref{" "}
              <strong>{attemptMeta.applicationRef}</strong>) held at{" "}
              <strong>{attemptMeta.venue}, {attemptMeta.city}</strong>.
            </p>
            <p className="text-[12.5px] mt-2">{s.declaration ?? "—"}</p>

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mt-5 mb-2">2) Area of responsibility</h2>
            <div className="border-b border-line pb-1">{s.responsibility}</div>

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mt-5 mb-2">3) Shift details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12.5px]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Start</div>
                <div className="border-b border-line pb-1">
                  {s.shiftStartISO ? `${formatDate(s.shiftStartISO)} ${formatTime(s.shiftStartISO)}` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">End</div>
                <div className="border-b border-line pb-1">
                  {s.shiftEndISO ? `${formatDate(s.shiftEndISO)} ${formatTime(s.shiftEndISO)}` : "—"}
                </div>
              </div>
            </div>

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mt-5 mb-2">
              4) Observations and confirmations
            </h2>
            {s.observations && s.observations.length > 0 ? (
              <ul className="text-[12.5px] list-disc pl-5 space-y-1">
                {s.observations.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-muted">(no observations recorded)</p>
            )}

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mt-5 mb-2">5) Statement completed by</h2>
            <div className="flex gap-6 mt-2">
              <div className="flex-1 border-t border-soft pt-1.5">
                <div className="text-[10px] text-muted uppercase tracking-wider">Signature</div>
                <div className="text-[11px] italic">
                  {s.status === "completed" ? `${s.firstName} ${s.lastName} — signed electronically` : "(awaiting signature)"}
                </div>
              </div>
              <div className="flex-1 border-t border-soft pt-1.5">
                <div className="text-[10px] text-muted uppercase tracking-wider">Date</div>
                <div>{s.completedAt ? formatDate(s.completedAt) : "—"}</div>
              </div>
            </div>

            <div className="mt-6 text-[10px] text-muted italic">
              Auto-generated by Glimmora GWR Submission OS · {new Date().toLocaleString()}
            </div>
          </div>
        </Card>
      </div>

      {/* ===== Official GWR Steward Statement template — auto-filled ===== */}
      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between bg-canvas px-5 py-3 border-b border-line">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-royal">
              Official GWR Steward Statement Template 2022
            </div>
            <div className="text-[11.5px] text-muted mt-0.5">
              Selected steward's declaration, contact details, role narrative
              and participant counts are stamped onto the real GWR PDF.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rebuilding && (
              <span className="text-[11px] text-muted flex items-center gap-1">
                <RefreshCw className="h-3 w-3 animate-spin" /> Updating…
              </span>
            )}
            <Badge tone="gold">Auto-filled</Badge>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4" /> Download
            </Button>
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
              Place the official GWR Steward Statement template at:
            </p>
            <code className="block mt-3 bg-canvas border border-line rounded px-3 py-2 text-[11.5px] text-soft inline-block">
              frontend/public/steward-statement-template-2022.pdf
            </code>
          </div>
        )}

        {templateExists && !previewUrl && !previewError && (
          <div className="flex items-center justify-center bg-canvas text-[12px] text-muted" style={{ height: "92vh" }}>
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
            style={{ height: "92vh" }}
          >
            <div className="p-6 text-[12px] text-muted">
              Your browser cannot display PDFs inline.{" "}
              <a href={previewUrl} download className="text-royal underline">
                Download the filled PDF
              </a>
              .
            </div>
          </object>
        )}

        <div className="px-5 py-3 bg-canvas border-t border-line text-[11px] text-muted">
          Field positions can be tuned in{" "}
          <code>src/lib/stewardStatementPdf.ts</code> if any value lands a few
          pixels off.
        </div>
      </Card>

      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-soft/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg">
            <CardHeader title="Add steward" subtitle={attemptMeta.recordTitle} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="First name" value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
              <Input placeholder="Last name" value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
              <Input className="sm:col-span-2" placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              <Input className="sm:col-span-2" placeholder="Organisation" value={draft.organisation} onChange={(e) => setDraft({ ...draft, organisation: e.target.value })} />
              <Input className="sm:col-span-2" placeholder="Area of responsibility" value={draft.responsibility} onChange={(e) => setDraft({ ...draft, responsibility: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button variant="gold" onClick={addSteward}>Add steward</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
