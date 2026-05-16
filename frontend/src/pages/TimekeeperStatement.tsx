import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trophy,
  Printer,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Mail,
  Timer,
  Activity,
  FileWarning,
  RefreshCw,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { witnesses, attemptMeta, activityRows, restRows } from "@/mock-data";
import type { Witness } from "@/types";
import { formatDate, formatTime } from "@/lib/utils";
import { buildLogbook, fmtDuration } from "@/lib/gwr";
import {
  downloadFilledTimekeeperStatement,
  fillTimekeeperStatementPdf,
  type TimekeeperStatementFill,
} from "@/lib/timekeeperStatementPdf";

const TEMPLATE_URL = "/timekeeper-statement-template-2022.pdf";

export default function TimekeeperStatement() {
  const list = useMemo(() => witnesses.filter((w: Witness) => w.role === "timekeeper"), []);
  const [idx, setIdx] = useState(0);
  const w = list[idx];
  const printRef = useRef<HTMLDivElement>(null);

  const witnessById = useMemo(() => Object.fromEntries(witnesses.map((wi) => [wi.id, wi])), []);
  const log = useMemo(() => buildLogbook(activityRows, restRows, witnessById), [witnessById]);

  const fillPayload: TimekeeperStatementFill | null = useMemo(() => {
    if (!w) return null;
    const presentDates =
      w.shiftStartISO && w.shiftEndISO
        ? `${formatDate(w.shiftStartISO)} ${formatTime(w.shiftStartISO)} → ${formatDate(w.shiftEndISO)} ${formatTime(w.shiftEndISO)}`
        : `${formatDate(attemptMeta.startISO)} ${formatTime(attemptMeta.startISO)} → ${formatDate(attemptMeta.endISO)} ${formatTime(attemptMeta.endISO)}`;
    const roleAndEquipment =
      "Served as one of two independent timekeepers for the full attempt window. " +
      "Master clock NTP-synchronised to time.cloudflare.com and time.google.com, audited every 60s. " +
      "Max observed deviation across the attempt: ±0.01s. Co-timekeeper readings cross-checked at every " +
      "shift handover and counter-signed. All start, end and incident timestamps logged to a tamper-evident " +
      `append-only ledger. Total activity recorded: ${fmtDuration(log.totalActivityMin)}; ` +
      `total rest taken: ${fmtDuration(log.totalRestTakenMin)}.`;
    return {
      declarationName: `${w.firstName} ${w.lastName}`,
      recordTitle: attemptMeta.recordTitle,
      applicationRef: attemptMeta.applicationRef,
      firstName: w.firstName,
      lastName: w.lastName,
      organisation: w.organisation,
      nationality: w.nationality ?? "",
      email: w.email,
      telephone: w.telephone ?? "",
      roleAndEquipment,
      expertise: w.expertise,
      finalMeasurement: w.finalMeasurement ?? "",
      venue: attemptMeta.venue,
      cityTown: attemptMeta.city,
      country: attemptMeta.country,
      presentDates,
      completedISO: w.completedAt ?? new Date().toISOString(),
      signatureDataUrl: w.signatureDataUrl,
    };
  }, [w, log]);

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
        const blob = await fillTimekeeperStatementPdf(fillPayload, TEMPLATE_URL);
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
    if (!fillPayload || !w) return;
    if (!templateExists) {
      alert(
        `Template PDF not found.\n\nPlace the official GWR Time Keeper Statement template at:\nfrontend/public/timekeeper-statement-template-2022.pdf`,
      );
      return;
    }
    await downloadFilledTimekeeperStatement(
      fillPayload,
      `GWR_Timekeeper_Statement_${w.firstName}_${w.lastName}.pdf`,
    );
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;
    win.document.write(`
      <html><head><title>Timekeeper Statement — ${w?.firstName} ${w?.lastName}</title>
      <style>
        body{font-family:Inter,ui-sans-serif,system-ui;color:#1F2937;padding:48px;max-width:780px;margin:0 auto;line-height:1.55}
        h1{color:#003B7A;font-size:22px;margin:0}
        h2{color:#0057B8;font-size:12px;text-transform:uppercase;letter-spacing:.18em;margin:18px 0 6px}
        .bar{background:#C8A44D;height:4px;margin:14px 0}
        .seal-dot{width:36px;height:36px;border-radius:50%;background:#0057B8;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800}
        @media print { body { padding:24px } }
      </style></head><body>${printRef.current.innerHTML}
      <script>window.onload=()=>setTimeout(()=>window.print(),250)</script>
      </body></html>`);
    win.document.close();
  };

  if (!w) {
    return (
      <Card>
        <div className="text-muted">No timekeepers added yet. Add one in the Witness System.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timekeeper Statement"
        subtitle="Two independent timekeepers are required (Rule 9). This page builds their official statements from the master timing log."
        actions={
          <>
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
                (i === idx
                  ? "border-royal bg-royal/[0.06] text-royal"
                  : "border-line bg-white hover:bg-canvas")
              }
            >
              <div className="font-semibold flex items-center gap-1.5">
                <Timer className="h-3 w-3" />
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
        <div className="space-y-4">
          <Card>
            <CardHeader title="Timekeeper" />
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-gold text-white mx-auto flex items-center justify-center text-lg font-bold">
                {w.firstName[0]}{w.lastName[0]}
              </div>
              <div className="font-bold mt-2">{w.firstName} {w.lastName}</div>
              <div className="text-[12px] text-muted">{w.organisation}</div>
            </div>
            <div className="mt-4 space-y-2 text-[12px]">
              <div className="flex items-center gap-2 text-muted">
                {w.status === "completed" ? (
                  <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span>Signed</span></>
                ) : w.status === "in-progress" ? (
                  <><Clock className="h-4 w-4 text-amber-500" /><span>Awaiting signature</span></>
                ) : (
                  <><Mail className="h-4 w-4 text-amber-500" /><span>Invitation pending</span></>
                )}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Email</div>
                {w.email}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Master timing log summary" />
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-muted">Total activity</span>
                <strong>{fmtDuration(log.totalActivityMin)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total rest</span>
                <strong>{fmtDuration(log.totalRestTakenMin)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Activity sequences</span>
                <strong>{activityRows.length}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Rest sequences</span>
                <strong>{restRows.length}</strong>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <span className="text-muted">NTP sync deviation</span>
                <strong className="text-emerald-700">±0.01s</strong>
              </div>
            </div>
          </Card>
        </div>

        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between bg-canvas px-5 py-3 border-b border-line">
            <div className="text-[11px] uppercase tracking-wider font-bold text-royal">Timekeeper statement preview</div>
            <Badge tone="gold">GWR Rule 9</Badge>
          </div>
          <div ref={printRef} className="bg-white p-8 text-[13px] leading-relaxed">
            <div className="flex items-center gap-3 mb-3">
              <div className="seal-dot h-10 w-10 rounded-full bg-royal text-white font-extrabold flex items-center justify-center">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[20px] font-bold text-royal-400 leading-tight">GUINNESS WORLD RECORDS</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted">Independent Timekeeper Statement</div>
              </div>
            </div>
            <div className="bar h-1 bg-gold mb-5" />

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mb-2">1) Declaration</h2>
            <p className="text-[12.5px]">
              I, <strong>{w.firstName} {w.lastName}</strong> of <strong>{w.organisation}</strong>, served as one of
              two independent timekeepers for the Guinness World Records™ attempt titled{" "}
              <strong>{attemptMeta.recordTitle}</strong> (application ref{" "}
              <strong>{attemptMeta.applicationRef}</strong>). I declare independence from the record organisers and
              participants and confirm I have nothing to gain from the outcome.
            </p>

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mt-5 mb-2">
              2) Timekeeping methodology
            </h2>
            <ul className="text-[12.5px] list-disc pl-5 space-y-1">
              <li>Master clock NTP-synchronised to <code>time.cloudflare.com</code> and <code>time.google.com</code>, audited every 60 s.</li>
              <li>Maximum observed deviation across the attempt window: <strong>±0.01 seconds</strong>.</li>
              <li>Co-timekeeper readings cross-checked at every shift handover and counter-signed.</li>
              <li>All start, end and incident timestamps logged to a tamper-evident append-only ledger.</li>
            </ul>

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mt-5 mb-2">
              3) Recorded times
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-[12.5px]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Attempt start</div>
                <div className="border-b border-line pb-1">{formatDate(attemptMeta.startISO)} {formatTime(attemptMeta.startISO)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Attempt end</div>
                <div className="border-b border-line pb-1">{formatDate(attemptMeta.endISO)} {formatTime(attemptMeta.endISO)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Final measurement</div>
                <div className="border-b border-line pb-1">{w.finalMeasurement ?? "—"}</div>
              </div>
            </div>

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mt-5 mb-2">
              4) Incidents / pauses
            </h2>
            <p className="text-[12.5px] text-muted">
              <Activity className="h-3 w-3 inline mr-1" />
              {log.violations.length === 0
                ? "No rule-violating incidents recorded. All rest sequences fell within the earned-rest balance per GWR Endurance Marathon rules."
                : `${log.violations.length} compliance issue(s) flagged — see attached activity logbook for full incident detail.`}
            </p>

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mt-5 mb-2">
              5) Statement completed by
            </h2>
            <div className="flex gap-6 mt-2">
              <div className="flex-1 border-t border-soft pt-1.5">
                <div className="text-[10px] text-muted uppercase tracking-wider">Signature</div>
                <div className="text-[11px] italic">
                  {w.status === "completed" ? `${w.firstName} ${w.lastName} — signed electronically` : "(awaiting signature)"}
                </div>
              </div>
              <div className="flex-1 border-t border-soft pt-1.5">
                <div className="text-[10px] text-muted uppercase tracking-wider">Date</div>
                <div>{w.completedAt ? formatDate(w.completedAt) : "—"}</div>
              </div>
            </div>

            <div className="mt-6 text-[10px] text-muted italic">
              Auto-generated by Glimmora GWR Submission OS · {new Date().toLocaleString()}
            </div>
          </div>
        </Card>
      </div>

      {/* ===== Official GWR Time Keeper Statement template — auto-filled ===== */}
      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between bg-canvas px-5 py-3 border-b border-line">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-royal">
              Official GWR Time Keeper Statement Template 2022
            </div>
            <div className="text-[11.5px] text-muted mt-0.5">
              The selected timekeeper's details — declaration, role &amp; equipment
              narrative, expertise, final measurement, dates present and digital
              signature — are stamped onto the real GWR PDF.
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
              Place the official GWR Time Keeper Statement template at:
            </p>
            <code className="block mt-3 bg-canvas border border-line rounded px-3 py-2 text-[11.5px] text-soft inline-block">
              frontend/public/timekeeper-statement-template-2022.pdf
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
          <code>src/lib/timekeeperStatementPdf.ts</code> if any value lands a few
          pixels off.
        </div>
      </Card>
    </div>
  );
}
