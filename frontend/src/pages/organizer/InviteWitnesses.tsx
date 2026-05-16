import { useMemo, useState } from "react";
import { Send, Trash2, Plus, CheckCircle2, Mail, Link2, ExternalLink, Copy, Eye, X } from "lucide-react";
import { Card, PageHeader, Button, Badge } from "@/components/ui";
import { attempts } from "@/mock-data/portal";
import { formatDate, formatTime } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { addInvitations, removeInvitation, makeToken, type Invitation } from "@/redux/invitations";

interface Draft { id: number; name: string; email: string; expertise: string }

export default function InviteWitnesses() {
  const dispatch = useAppDispatch();
  const me = useAppSelector((s) => s.auth.user);
  const allInvitations = useAppSelector((s) => s.invitations.items);

  const [attemptId, setAttemptId] = useState(attempts[0]?.id ?? "");
  const attempt = attempts.find((a) => a.id === attemptId);
  const [drafts, setDrafts] = useState<Draft[]>([{ id: 1, name: "", email: "", expertise: "" }]);
  const [justSent, setJustSent] = useState<Invitation[]>([]);
  const [previewing, setPreviewing] = useState<Invitation | null>(null);

  const invitationsForAttempt = useMemo(
    () => allInvitations.filter((i) => i.attemptId === attemptId).sort((a, b) => b.sentAt.localeCompare(a.sentAt)),
    [allInvitations, attemptId]
  );

  function update(i: number, patch: Partial<Draft>) {
    setDrafts((d) => d.map((row) => (row.id === i ? { ...row, ...patch } : row)));
  }
  function addRow() {
    setDrafts((d) => [...d, { id: Date.now() + Math.random(), name: "", email: "", expertise: "" }]);
  }
  function removeRow(i: number) {
    setDrafts((d) => (d.length === 1 ? d : d.filter((r) => r.id !== i)));
  }

  function sendAll() {
    const valid = drafts.filter((d) => d.email.trim() && d.name.trim());
    if (valid.length === 0) return;
    const now = new Date().toISOString();
    const records: Invitation[] = valid.map((d, idx) => ({
      id: `INV-${Date.now()}-${idx}`,
      token: makeToken(),
      attemptId,
      witnessName: d.name.trim(),
      witnessEmail: d.email.trim(),
      expertise: d.expertise.trim(),
      status: "Invited",
      sentAt: now,
      organizerName: me?.name ?? "Organizer",
    }));
    dispatch(addInvitations(records));
    setJustSent(records);
    setDrafts([{ id: 1, name: "", email: "", expertise: "" }]);
  }

  function linkFor(token: string) {
    return `${window.location.origin}/witness/invite/${token}`;
  }
  async function copyLink(token: string) {
    try { await navigator.clipboard.writeText(linkFor(token)); } catch { /* noop */ }
  }

  return (
    <>
      <PageHeader
        eyebrow="Organizer"
        title="Invite witnesses"
        subtitle="Send credentialed magic-link invitations to independent witnesses for one of your record attempts."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT — compose new invitations */}
        <Card className="lg:col-span-2">
          <h3 className="font-semibold text-soft">Compose invitations</h3>
          <div className="mt-4">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-muted">Attempt</span>
              <select className="input mt-1" value={attemptId} onChange={(e) => setAttemptId(e.target.value)}>
                {attempts.length === 0 && <option value="">No attempts available</option>}
                {attempts.map((a) => <option key={a.id} value={a.id}>{a.id} — {a.title}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-5 space-y-3">
            {drafts.map((d) => (
              <div key={d.id} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 md:col-span-3">
                  <span className="text-[11px] uppercase tracking-wider text-muted">Full name</span>
                  <input className="input mt-1" placeholder="Full name" value={d.name} onChange={(e) => update(d.id, { name: e.target.value })} />
                </div>
                <div className="col-span-12 md:col-span-4">
                  <span className="text-[11px] uppercase tracking-wider text-muted">Email</span>
                  <input className="input mt-1" type="email" placeholder="email@example.org" value={d.email} onChange={(e) => update(d.id, { email: e.target.value })} />
                </div>
                <div className="col-span-10 md:col-span-4">
                  <span className="text-[11px] uppercase tracking-wider text-muted">Expertise</span>
                  <input className="input mt-1" placeholder="Area of expertise" value={d.expertise} onChange={(e) => update(d.id, { expertise: e.target.value })} />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <button onClick={() => removeRow(d.id)} className="btn-ghost !p-2 border border-line w-full justify-center" disabled={drafts.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex justify-between">
              <button onClick={addRow} className="btn-ghost border border-line"><Plus className="h-4 w-4" /> Add witness</button>
              <Button onClick={sendAll} disabled={!drafts.some((d) => d.email.trim() && d.name.trim())}>
                <Send className="h-4 w-4" /> Send invitations
              </Button>
            </div>
          </div>

          {justSent.length > 0 && (
            <div className="mt-5 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  Sent {justSent.length} invitation{justSent.length > 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-[12px] text-emerald-800/80 mt-1">
                In production each witness receives an email with a personalised sign-in link.
                In this demo, copy the link or open it in a new tab to act as that witness.
              </p>
              <ul className="mt-3 space-y-2">
                {justSent.map((inv) => (
                  <li key={inv.id} className="rounded-lg bg-white border border-emerald-200 p-3 flex flex-wrap items-center gap-2">
                    <Mail className="h-4 w-4 text-emerald-700 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-soft truncate">{inv.witnessName}</div>
                      <div className="text-[11px] text-muted truncate">{inv.witnessEmail}</div>
                    </div>
                    <button onClick={() => setPreviewing(inv)} className="btn-ghost border border-line !py-1 !px-2 text-[12px]"><Eye className="h-3.5 w-3.5" /> Preview email</button>
                    <button onClick={() => copyLink(inv.token)} className="btn-ghost border border-line !py-1 !px-2 text-[12px]"><Copy className="h-3.5 w-3.5" /> Copy link</button>
                    <a href={linkFor(inv.token)} target="_blank" rel="noreferrer" className="btn-primary !py-1 !px-2 text-[12px]">
                      <ExternalLink className="h-3.5 w-3.5" /> Open as witness
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* RIGHT — already invited for selected attempt */}
        <Card>
          <h3 className="font-semibold text-soft">Invitations for this attempt</h3>
          <p className="text-xs text-muted mt-1 truncate">{attempt?.title ?? "No attempt selected"}</p>
          <ul className="mt-4 divide-y divide-line max-h-[60vh] overflow-y-auto">
            {invitationsForAttempt.length === 0 && (
              <li className="py-8 text-center text-sm text-muted">No invitations sent yet for this attempt.</li>
            )}
            {invitationsForAttempt.map((inv) => (
              <li key={inv.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-soft truncate">{inv.witnessName}</div>
                    <div className="text-[11px] text-muted truncate">{inv.witnessEmail}</div>
                  </div>
                  <StatusPill status={inv.status} />
                </div>
                <div className="text-[11px] text-muted mt-1">
                  Sent {formatDate(inv.sentAt)} {formatTime(inv.sentAt)}
                  {inv.submittedAt && <> &middot; submitted {formatDate(inv.submittedAt)}</>}
                  {inv.reviewedAt && <> &middot; {inv.status.toLowerCase()} {formatDate(inv.reviewedAt)}</>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button onClick={() => copyLink(inv.token)} className="text-[11px] text-royal hover:underline inline-flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> Copy link
                  </button>
                  <a href={linkFor(inv.token)} target="_blank" rel="noreferrer" className="text-[11px] text-royal hover:underline inline-flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Open
                  </a>
                  <button onClick={() => setPreviewing(inv)} className="text-[11px] text-royal hover:underline inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Email
                  </button>
                  <button
                    onClick={() => dispatch(removeInvitation(inv.id))}
                    className="ml-auto text-[11px] text-rose-700 hover:underline inline-flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {previewing && (
        <EmailPreview invitation={previewing} attemptTitle={attempts.find((a) => a.id === previewing.attemptId)?.title ?? ""} onClose={() => setPreviewing(null)} />
      )}
    </>
  );
}

function StatusPill({ status }: { status: Invitation["status"] }) {
  const tone =
    status === "Approved" ? "green" :
    status === "Rejected" ? "red" :
    status === "Submitted" ? "blue" :
    status === "Clarification Requested" ? "amber" : "default";
  return <Badge tone={tone as any}>{status}</Badge>;
}

function EmailPreview({ invitation, attemptTitle, onClose }: { invitation: Invitation; attemptTitle: string; onClose: () => void }) {
  const link = `${window.location.origin}/witness/invite/${invitation.token}`;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-line shadow-panel max-w-2xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-line bg-canvas flex items-center justify-between">
          <div className="text-sm font-semibold text-soft inline-flex items-center gap-2">
            <Mail className="h-4 w-4 text-royal" /> Email preview
          </div>
          <button onClick={onClose} className="btn-ghost !p-1.5"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4 border-b border-line text-xs">
          <div><span className="text-muted">From:</span> <span className="text-soft">Guinness World Records &lt;no-reply@gwr.com&gt;</span></div>
          <div><span className="text-muted">To:</span> <span className="text-soft">{invitation.witnessName} &lt;{invitation.witnessEmail}&gt;</span></div>
          <div><span className="text-muted">Subject:</span> <span className="text-soft">You&rsquo;ve been invited to witness {attemptTitle}</span></div>
        </div>
        <div className="p-6 text-sm text-soft leading-relaxed">
          <p>Dear {invitation.witnessName.split(" ")[0]},</p>
          <p className="mt-3">
            <span className="font-semibold">{invitation.organizerName}</span> has invited you to act as an
            independent witness for the Guinness World Records&trade; attempt:
          </p>
          <p className="mt-3 font-semibold text-royal">{attemptTitle} &middot; {invitation.attemptId}</p>
          <p className="mt-3">
            Please complete and digitally sign your witness statement using the secure link below.
            The form will be pre-filled with your name and the event&rsquo;s details &mdash; you only need
            to add your observations, final measurement and signature.
          </p>
          <div className="mt-5 text-center">
            <a href={link} target="_blank" rel="noreferrer" className="btn-primary inline-flex">
              Complete witness form &rarr;
            </a>
          </div>
          <p className="mt-5 text-xs text-muted break-all">Or copy this link into your browser: {link}</p>
          <p className="mt-5 text-xs text-muted">
            This invitation was issued by Guinness World Records on behalf of {invitation.organizerName}.
            If you weren&rsquo;t expecting it, you can safely ignore this email.
          </p>
        </div>
      </div>
    </div>
  );
}
