import { Button, Card, CardHeader, PageHeader } from "@/components/ui";
import { Award, Check, Download, FileText, Link2, Sparkles, Trophy } from "lucide-react";

const CHECKLIST = [
  "Event details captured & verified",
  "All required evidence categories present",
  "Witness statements notarized",
  "Continuous recording integrity confirmed",
  "AI duplicate set resolved",
  "Reviewer sign-offs collected (3/3)",
];

export default function ReportGeneration() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Generation"
        subtitle="Preview your submission-ready Guinness adjudication report and export in the format of your choice."
        actions={
          <>
            <Button variant="outline"><Download className="h-4 w-4" /> Export PDF</Button>
            <Button variant="outline"><Download className="h-4 w-4" /> Export ZIP</Button>
            <Button variant="gold"><Link2 className="h-4 w-4" /> Secure Link</Button>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="bg-white text-soft border-line">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-royal text-white flex items-center justify-center shadow-soft">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted">Guinness World Records</div>
                  <div className="font-bold text-soft">Official Adjudication Report</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-muted">Reference</div>
                <div className="font-mono font-bold">GWR-2025-0411</div>
              </div>
            </div>

            <h2 className="mt-6 text-2xl font-bold tracking-tight">Largest Simultaneous Yoga Session</h2>
            <div className="text-sm text-muted mt-1">Mass Participation · 22–23 April 2026 · New Delhi, India</div>

            <section className="mt-6">
              <h4 className="font-bold text-sm uppercase tracking-wider text-muted">Event Summary</h4>
              <p className="text-sm mt-2 leading-relaxed">
                Under adjudicator supervision, 12,418 verified participants completed a continuous 30-minute yoga routine.
                Counting was performed via aerial computer vision and confirmed against three independent witness teams.
                Continuous recording was preserved through multi-camera redundancy across the 21-hour 15-minute observation window.
              </p>
            </section>

            <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { l: "Participants", v: "12,418" },
                { l: "Duration", v: "21h 15m" },
                { l: "Evidence Items", v: "412" },
                { l: "Witnesses", v: "14" },
                { l: "AI Confidence", v: "94%" },
                { l: "Integrity Score", v: "98.4%" },
              ].map((s) => (
                <div key={s.l} className="rounded-xl border border-line p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted">{s.l}</div>
                  <div className="text-lg font-bold">{s.v}</div>
                </div>
              ))}
            </section>

            <section className="mt-6">
              <h4 className="font-bold text-sm uppercase tracking-wider text-muted">Verification Checklist</h4>
              <ul className="mt-2 space-y-2 text-sm">
                {CHECKLIST.map((c) => (
                  <li key={c} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-600" /> {c}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-6">
              <h4 className="font-bold text-sm uppercase tracking-wider text-muted">Adjudicator Notes</h4>
              <p className="text-sm mt-2 leading-relaxed">
                Aerial footage at 22:14 confirms crowd density exceeds the minimum requirement. Cross-referenced with timekeeper log,
                counts align within 0.4% tolerance. Recommendation: ratify record.
              </p>
            </section>

            <div className="mt-8 pt-4 border-t border-line flex items-center justify-between text-[11px] text-muted">
              <div>Prepared by Eleanor Whitfield · Senior Adjudicator</div>
              <div className="flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> Official document · do not distribute</div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="AI Insights" subtitle="Auto-generated" action={<Sparkles className="h-4 w-4 text-gold" />} />
            <ul className="text-sm space-y-2 text-soft">
              <li>• Crowd density consistently above 1.2 ppl/m² across all timed intervals.</li>
              <li>• Witness statement narratives have 96% mutual consistency.</li>
              <li>• No duplicate footage in the final export set.</li>
            </ul>
          </Card>
          <Card>
            <CardHeader title="Export Options" />
            <div className="space-y-2 text-sm">
              {[
                { Icon: FileText, l: "Adjudication PDF", s: "8.4 MB · signed & sealed" },
                { Icon: Download, l: "Evidence ZIP", s: "7.9 GB · folder-structured" },
                { Icon: Link2, l: "Secure Share Link", s: "expires in 14 days" },
              ].map((o) => (
                <button key={o.l} className="w-full panel p-3 flex items-center gap-3 hover:border-gold/30 transition text-left">
                  <o.Icon className="h-4 w-4 text-gold" />
                  <div>
                    <div className="text-sm font-semibold">{o.l}</div>
                    <div className="text-[11px] text-muted">{o.s}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
