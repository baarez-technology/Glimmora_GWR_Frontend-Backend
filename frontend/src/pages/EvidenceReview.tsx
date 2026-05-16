import { useState } from "react";
import {
  FileVideo,
  Image as ImageIcon,
  FileText,
  Users,
  Newspaper,
  ShieldAlert,
  Search,
  Filter,
  Download,
  UserPlus,
  Check,
  X,
  Play,
  ChevronRight,
} from "lucide-react";
import { Badge, Button, PageHeader, Progress } from "@/components/ui";
import { evidence, comments } from "@/mock-data";
import ReviewerCommentPanel from "@/components/ReviewerCommentPanel";
import { cn, formatBytes } from "@/lib/utils";

const CATS = [
  { key: "video", label: "Videos", Icon: FileVideo, count: 18 },
  { key: "image", label: "Images", Icon: ImageIcon, count: 312 },
  { key: "document", label: "Documents", Icon: FileText, count: 14 },
  { key: "witness", label: "Witness Statements", Icon: Users, count: 8 },
  { key: "media", label: "Media Coverage", Icon: Newspaper, count: 22 },
  { key: "alerts", label: "AI Alerts", Icon: ShieldAlert, count: 4 },
];

export default function EvidenceReview() {
  const [active, setActive] = useState("video");
  const focused = evidence[0];
  return (
    <div className="space-y-4">
      <PageHeader
        title="Evidence Review Workspace"
        subtitle="GWR-2025-0411 · Largest Simultaneous Yoga Session"
        actions={
          <>
            <Button variant="outline"><UserPlus className="h-4 w-4" /> Assign reviewer</Button>
            <Button variant="outline"><Download className="h-4 w-4" /> Export</Button>
            <Button variant="ghost" className="!text-rose-700"><X className="h-4 w-4" /> Reject</Button>
            <Button variant="gold"><Check className="h-4 w-4" /> Approve</Button>
          </>
        }
      />

      <div className="panel p-2 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input className="input pl-9" placeholder="AI search · semantic filtering…" />
        </div>
        <Button variant="ghost"><Filter className="h-4 w-4" /> Filters</Button>
        <span className="ml-auto chip">Comparison mode: <span className="text-gold ml-1">off</span></span>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <aside className="col-span-12 md:col-span-3 lg:col-span-2 panel p-2 h-fit">
          {CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition",
                active === c.key
                  ? "bg-royal/[0.08] text-royal font-semibold border border-royal/30"
                  : "text-soft/80 hover:bg-canvas border border-transparent"
              )}
            >
              <c.Icon className={cn("h-4 w-4", active === c.key ? "text-royal" : "text-muted")} />
              <span className="flex-1 text-left truncate">{c.label}</span>
              <span className="text-[10px] text-muted">{c.count}</span>
            </button>
          ))}
        </aside>

        <section className="col-span-12 md:col-span-9 lg:col-span-7 panel overflow-hidden">
          <div className="relative aspect-video bg-gradient-to-br from-[#E8F0FB] to-[#F5F7FA] flex items-center justify-center">
            <button className="h-16 w-16 rounded-full bg-royal text-white flex items-center justify-center shadow-panel hover:scale-105 transition">
              <Play className="h-6 w-6" />
            </button>
            <div className="absolute top-3 left-3 chip !bg-white/95">{focused?.name ?? "No evidence selected"}</div>
            <div className="absolute top-3 right-3"><Badge tone="blue">AI verified 94%</Badge></div>
            <div className="absolute inset-x-3 bottom-3">
              <Progress value={32} tone="blue" />
              <div className="flex justify-between text-[11px] text-muted mt-1">
                <span>00:32:14</span><span>{focused?.duration ?? "—"}</span>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-line grid grid-cols-2 lg:grid-cols-4 gap-3">
            {evidence.slice(1, 9).map((e) => (
              <button key={e.id} className="text-left group">
                <div className="aspect-video rounded-lg bg-gradient-to-br from-[#E8F0FB] to-[#F5F7FA] border border-line group-hover:border-royal/40 transition" />
                <div className="mt-1.5 text-[11px] truncate text-soft">{e.name}</div>
              </button>
            ))}
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <div className="panel p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-2">AI Metadata</div>
            <Row k="Captured" v="22 April 2026 · 22:14:08 IST" />
            <Row k="Device" v="DJI Mavic 3 · 4K · 50fps" />
            <Row k="Codec" v="HEVC · 80 Mbps" />
            <Row k="Geo" v="28.5562° N, 77.1000° E" />
            <Row k="Size" v={focused ? formatBytes(focused.size) : "—"} />
            <div className="mt-3 pt-3 border-t border-line">
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1">Extracted Timestamps</div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {["22:14:08", "22:34:00", "23:00:00", "00:00:00", "02:00:00", "06:15:32"].map((t) => (
                  <span key={t} className="chip">{t}</span>
                ))}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-line">
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1">AI Summary</div>
              <p className="text-xs text-soft leading-relaxed">
                Continuous aerial footage of formation; participant count via computer vision aligns with timekeeper at 12,418 (±0.4%). No discontinuities detected.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-line">
              <div className="text-[10px] uppercase tracking-wider text-muted mb-1">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {(focused?.tags ?? []).concat(["aerial", "scene-A", "verified"]).map((t) => (
                  <span key={t} className="chip">{t}</span>
                ))}
              </div>
            </div>
          </div>
          <ReviewerCommentPanel comments={comments} />
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-muted">{k}</span>
      <span className="text-xs font-medium text-right">{v}</span>
    </div>
  );
}
