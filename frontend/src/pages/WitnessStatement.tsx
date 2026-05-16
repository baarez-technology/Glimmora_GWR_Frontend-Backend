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
  ShieldCheck,
  FileWarning,
  RefreshCw,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { useSubmissionData } from "@/lib/api/useSubmissionData";
import type { Witness } from "@/types";
import { formatDate, formatTime } from "@/lib/utils";
import {
  downloadFilledWitnessStatement,
  fillWitnessStatementPdf,
  type WitnessStatementFill,
} from "@/lib/witnessStatementPdf";

const TEMPLATE_URL = "/witness-statement-template-2022.pdf";

const independents = (w: Witness) => w.role !== "timekeeper";

export default function WitnessStatement() {
  const { witnesses, attemptMeta, loading } = useSubmissionData();
  const list = useMemo(() => witnesses.filter(independents), [witnesses]);
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (idx >= list.length) setIdx(0); }, [list.length, idx]);
  const w = list[idx];
  const printRef = useRef<HTMLDivElement>(null);

  const fillPayload: WitnessStatementFill | null = useMemo(() => {
    if (!w) return null;
    const presentDates =
      w.shiftStartISO && w.shiftEndISO
        ? `${formatDate(w.shiftStartISO)} ${formatTime(w.shiftStartISO)} → ${formatDate(w.shiftEndISO)} ${formatTime(w.shiftEndISO)}`
        : "";
    const witnessDetails =
      (w.rulesObserved && w.rulesObserved.length > 0)
        ? w.rulesObserved.map((r) => `• ${r}`).join("\n")
        : (w.declaration ?? "");
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
      witnessDetails,
      expertise: w.expertise,
      finalMeasurement: w.finalMeasurement ?? "",
      venue: attemptMeta.venue,
      cityTown: attemptMeta.city,
      country: attemptMeta.country,
      presentDates,
      completedISO: w.completedAt ?? new Date().toISOString(),
      signatureDataUrl: w.signatureDataUrl,
    };
  }, [w]);

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
        const blob = await fillWitnessStatementPdf(fillPayload, TEMPLATE_URL);
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
    if (!fillPayload) return;
    if (!templateExists) {
      alert(
        `Template PDF not found.\n\nPlace the official GWR Witness Statement template at:\nfrontend/public/witness-statement-template-2022.pdf`,
      );
      return;
    }
    await downloadFilledWitnessStatement(
      fillPayload,
      `GWR_Witness_Statement_${w.firstName}_${w.lastName}.pdf`,
    );
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open("", "_blank", "width=900,height=1100");
    if (!win) return;
    win.document.write(`
      <html><head><title>Witness Statement — ${w.firstName} ${w.lastName}</title>
      <style>
        body{font-family:Inter,ui-sans-serif,system-ui;color:#1F2937;padding:48px;max-width:780px;margin:0 auto;line-height:1.55}
        h1{color:#003B7A;font-size:22px;margin:0 0 6px}
        h2{color:#0057B8;font-size:12px;text-transform:uppercase;letter-spacing:.18em;margin:18px 0 6px}
        .row{display:flex;gap:16px;margin:6px 0}.row > div{flex:1}
        .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.16em;color:#6B7280;font-weight:600;margin-bottom:2px}
        .val{font-size:13px;border-bottom:1px solid #E5E7EB;padding-bottom:4px;min-height:20px}
        .bar{background:#C8A44D;height:4px;margin:14px 0}
        .seal{display:flex;align-items:center;gap:10px;margin-bottom:6px}
        .seal-dot{width:36px;height:36px;border-radius:50%;background:#0057B8;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px}
        ul{margin:4px 0 0;padding-left:20px}
        .sig{margin-top:24px;display:flex;gap:24px}
        .sig > div{flex:1;border-top:1px solid #1F2937;padding-top:6px;font-size:11px;color:#6B7280}
        @media print { body { padding:24px } }
      </style></head><body>
      ${printRef.current.innerHTML}
      <script>window.onload=()=>setTimeout(()=>window.print(),250)</script>
      </body></html>
    `);
    win.document.close();
  };

  if (!w) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Witness Statement"
          subtitle="Official GWR Witness Statement document for each independent / specialist witness — auto-built from form data and digital signature."
        />
        <Card>
          <div className="py-12 text-center">
            <FileWarning className="h-8 w-8 text-muted mx-auto mb-3" />
            <h3 className="font-semibold text-soft">{loading ? "Loading witnesses…" : "No witnesses to render"}</h3>
            {!loading && (
              <>
                <p className="text-sm text-muted mt-1 max-w-md mx-auto">
                  Add independent or specialist witnesses in the <strong>Witness System</strong> page first.
                  Once they're invited and complete the form, their official GWR Witness Statement will appear here.
                </p>
                <Button className="mt-4" onClick={() => window.location.assign("/witnesses")}>
                  <Mail className="h-4 w-4" /> Open Witness System
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Witness Statement"
        subtitle="Official GWR Witness Statement document for each independent / specialist witness — auto-built from form data and digital signature."
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

      {/* Witness selector strip */}
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
                  : "border-line bg-white hover:bg-canvas text-soft")
              }
            >
              <div className="font-semibold">
                {wi.firstName} {wi.lastName}
              </div>
              <div className="text-[10px] text-muted capitalize">{wi.role} · {wi.status.replace("-", " ")}</div>
            </button>
          ))}
          <Button variant="ghost" onClick={() => setIdx((i) => Math.min(list.length - 1, i + 1))} disabled={idx === list.length - 1}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar info */}
        <Card>
          <CardHeader title="Witness profile" />
          <div className="text-center">
            <div className="h-16 w-16 rounded-full bg-royal text-white mx-auto flex items-center justify-center text-lg font-bold">
              {w.firstName[0]}{w.lastName[0]}
            </div>
            <div className="font-bold mt-2">{w.firstName} {w.lastName}</div>
            <div className="text-[12px] text-muted">{w.organisation}</div>
          </div>
          <div className="mt-4 space-y-2 text-[12px]">
            <div className="flex items-center gap-2 text-muted">
              {w.status === "completed" ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Signed {w.completedAt && formatDate(w.completedAt)}</span>
                </>
              ) : w.status === "in-progress" ? (
                <>
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span>Awaiting signature</span>
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 text-amber-500" />
                  <span>Invitation pending</span>
                </>
              )}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Email</div>
              {w.email}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Field of expertise</div>
              {w.expertise}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Role</div>
              <Badge tone={w.role === "specialist" ? "blue" : "default"}>
                <ShieldCheck className="h-3 w-3" />
                {w.role === "specialist" ? "Specialist Witness" : "Independent Witness"}
              </Badge>
            </div>
          </div>
        </Card>

        {/* PDF preview */}
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between bg-canvas px-5 py-3 border-b border-line">
            <div className="text-[11px] uppercase tracking-wider font-bold text-royal">Live document preview</div>
            <Badge tone="gold">GWR Template 2022</Badge>
          </div>

          <div ref={printRef} className="bg-white p-8 text-[13px] leading-relaxed">
            <div className="seal flex items-center gap-3 mb-3">
              <div className="seal-dot h-10 w-10 rounded-full bg-royal text-white font-extrabold flex items-center justify-center">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[20px] font-bold text-royal-400 leading-tight">GUINNESS WORLD RECORDS</div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted">Witness Statement</div>
              </div>
            </div>
            <div className="bar h-1 bg-gold mb-5" />

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mb-2">1) Declaration</h2>
            <p className="text-[12.5px]">
              I, <strong>{w.firstName} {w.lastName}</strong>, declare that I am not associated with, or related to,
              the record organisers or participants, nor have anything to gain from the final outcome of the attempt.
              Therefore I have acted as a witness of the Guinness World Records™ attempt for the record:
            </p>
            <div className="row flex gap-4 mt-3">
              <div className="flex-1">
                <div className="lbl text-[10px] uppercase tracking-wider text-muted font-semibold">Record Title</div>
                <div className="val border-b border-line pb-1">{attemptMeta.recordTitle}</div>
              </div>
              <div className="flex-1">
                <div className="lbl text-[10px] uppercase tracking-wider text-muted font-semibold">Application Ref</div>
                <div className="val border-b border-line pb-1">{attemptMeta.applicationRef}</div>
              </div>
            </div>

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mt-5 mb-2">
              2) Contact details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12.5px]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">First name</div>
                <div className="border-b border-line pb-1">{w.firstName}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Last name</div>
                <div className="border-b border-line pb-1">{w.lastName}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Organisation</div>
                <div className="border-b border-line pb-1">{w.organisation}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Email</div>
                <div className="border-b border-line pb-1">{w.email}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Nationality</div>
                <div className="border-b border-line pb-1">{w.nationality ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Telephone</div>
                <div className="border-b border-line pb-1">{w.telephone ?? "—"}</div>
              </div>
            </div>

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mt-5 mb-2">
              3) What did you witness?
            </h2>
            <ul className="text-[12.5px] list-disc pl-5">
              {(w.rulesObserved ?? ["—"]).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-[12.5px]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">4) Field of expertise</div>
                <div className="border-b border-line pb-1">{w.expertise}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">5) Final measurement</div>
                <div className="border-b border-line pb-1">{w.finalMeasurement ?? attemptMeta.endISO}</div>
              </div>
            </div>

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mt-5 mb-2">
              6) Where did the record attempt take place?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-[12.5px]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Venue</div>
                <div className="border-b border-line pb-1">{attemptMeta.venue}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">City</div>
                <div className="border-b border-line pb-1">{attemptMeta.city}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Country</div>
                <div className="border-b border-line pb-1">{attemptMeta.country}</div>
              </div>
            </div>

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mt-5 mb-2">
              7) When were you present at the record attempt?
            </h2>
            <div className="text-[12.5px] border-b border-line pb-1">
              {w.shiftStartISO && w.shiftEndISO
                ? `${formatDate(w.shiftStartISO)} ${formatTime(w.shiftStartISO)} → ${formatTime(w.shiftEndISO)}`
                : "—"}
            </div>

            <h2 className="text-[11px] uppercase tracking-[0.18em] text-royal font-bold mt-5 mb-2">
              8) This witness statement was completed by
            </h2>
            <div className="sig flex gap-6 mt-4">
              <div className="flex-1 border-t border-soft pt-1.5">
                <div className="text-[10px] text-muted uppercase tracking-wider">Signature</div>
                <div className="text-[11px] italic text-soft">
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

      {/* ===== Official GWR Witness Statement template — auto-filled ===== */}
      <Card className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between bg-canvas px-5 py-3 border-b border-line">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-royal">
              Official GWR Witness Statement Template 2022
            </div>
            <div className="text-[11.5px] text-muted mt-0.5">
              Your form values are overlaid onto the real GWR PDF. Each field is
              filled by AcroForm name then flattened so it renders identically
              in every PDF viewer.
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
              Place the official GWR Witness Statement template at:
            </p>
            <code className="block mt-3 bg-canvas border border-line rounded px-3 py-2 text-[11.5px] text-soft inline-block">
              frontend/public/witness-statement-template-2022.pdf
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
          Field positions can be tuned in <code>src/lib/witnessStatementPdf.ts</code>{" "}
          if any value lands a few pixels off.
        </div>
      </Card>
    </div>
  );
}
