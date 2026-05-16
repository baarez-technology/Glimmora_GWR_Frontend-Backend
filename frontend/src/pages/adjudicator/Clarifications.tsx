import { useState } from "react";
import { MessageSquareWarning, Send, Search } from "lucide-react";
import { Badge, Card, PageHeader, Button } from "@/components/ui";
import { clarifications } from "@/mock-data/portal";
import { formatDate, formatTime } from "@/lib/utils";

export default function Clarifications() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string | null>(clarifications[0]?.id ?? null);
  const [reply, setReply] = useState("");
  const list = clarifications.filter((c) => `${c.subject} ${c.to}`.toLowerCase().includes(q.toLowerCase()));
  const c = clarifications.find((x) => x.id === active) ?? clarifications[0] ?? null;

  if (!c) {
    return (
      <>
        <PageHeader eyebrow="Adjudicator" title="Clarifications" subtitle="Threaded follow-ups with witnesses and organizers." />
        <Card>
          <div className="py-12 text-center">
            <MessageSquareWarning className="h-8 w-8 text-muted mx-auto mb-3" />
            <h3 className="font-semibold text-soft">No clarifications yet</h3>
            <p className="text-sm text-muted mt-1 max-w-md mx-auto">
              When you request a clarification from a witness or organizer during a review, the conversation will appear here.
            </p>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Adjudicator" title="Clarifications" subtitle="Threaded follow-ups with witnesses and organizers." />
      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-4 !p-3">
          <div className="px-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input className="input pl-9" placeholder="Search threads&hellip;" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <ul className="mt-3 divide-y divide-line max-h-[70vh] overflow-y-auto">
            {list.map((cc) => (
              <li key={cc.id}>
                <button
                  onClick={() => setActive(cc.id)}
                  className={`w-full text-left px-3 py-3 transition ${cc.id === active ? "bg-royal/[0.06]" : "hover:bg-canvas"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-soft truncate">{cc.subject}</div>
                    <Badge tone={cc.status === "Open" ? "amber" : cc.status === "Closed" ? "default" : "blue"}>{cc.status}</Badge>
                  </div>
                  <div className="text-[11px] text-muted mt-1">To {cc.to} &middot; {formatDate(cc.openedAt)}</div>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="col-span-12 lg:col-span-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-soft">{c.subject}</h3>
              <div className="text-[11px] text-muted mt-0.5">Attempt {c.attemptId} &middot; opened {formatDate(c.openedAt)} {formatTime(c.openedAt)}</div>
            </div>
            <Badge tone={c.status === "Open" ? "amber" : "blue"}>{c.status}</Badge>
          </div>

          <div className="mt-5 space-y-4">
            <Bubble from={c.from} role="Adjudicator" mine>
              {c.preview}
            </Bubble>
            {c.status === "Responded" && (
              <Bubble from={c.to} role="Witness">
                Acknowledged &mdash; calibration certificate uploaded as evidence #E-118. Standing by for further questions.
              </Bubble>
            )}
          </div>

          <div className="mt-6">
            <textarea className="input min-h-[100px]" placeholder="Type your reply&hellip;" value={reply} onChange={(e) => setReply(e.target.value)} />
            <div className="mt-3 flex items-center justify-between">
              <div className="text-[11px] text-muted flex items-center gap-2"><MessageSquareWarning className="h-3.5 w-3.5" /> Reply visible to {c.to}.</div>
              <Button disabled={!reply.trim()}>
                <Send className="h-4 w-4" /> Send reply
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function Bubble({ from, role, mine, children }: { from: string; role: string; mine?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm border ${mine ? "bg-royal/[0.05] border-royal/30 text-soft" : "bg-canvas border-line text-soft"}`}>
        <div className="text-[11px] uppercase tracking-wider text-muted mb-1">{from} &middot; {role}</div>
        {children}
      </div>
    </div>
  );
}
