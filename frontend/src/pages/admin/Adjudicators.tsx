import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star, Globe, Search, Languages, Award, Phone, Mail, Plus, Pencil, Trash2, BarChart3,
  Loader2, AlertTriangle,
} from "lucide-react";
import { Card, PageHeader, Badge, Button } from "@/components/ui";
import { useToast } from "@/components/Toaster";
import AdjudicatorFormModal from "@/components/AdjudicatorFormModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { adminAdjudicatorsApi, adminAssignmentsApi, trackingApi, type AdminAdjudicator, type Region } from "@/lib/api/admin";
import { ApiError } from "@/lib/api";
import { formatTime, relativeTime } from "@/lib/utils";

const REGIONS: (Region | "All")[] = ["All", "Europe", "Americas", "Asia-Pacific", "MEA"];

const TRAVEL_TONE: Record<string, "green" | "blue" | "gold" | "amber" | "red" | "default"> = {
  Available: "green",
  Assigned: "blue",
  Travelling: "gold",
  "On-site": "green",
  Completed: "default",
  "Off-duty": "default",
};

export default function Adjudicators() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const adjQ = useQuery({ queryKey: ["admin", "adjudicators"], queryFn: () => adminAdjudicatorsApi.list() });
  const assignmentsQ = useQuery({ queryKey: ["admin", "assignments"], queryFn: () => adminAssignmentsApi.list() });
  const locationsQ = useQuery({ queryKey: ["admin", "locations"], queryFn: () => trackingApi.listLocations() });

  const adjudicators = adjQ.data ?? [];
  const assignments = assignmentsQ.data ?? [];
  const locations = locationsQ.data ?? [];

  const [q, setQ] = useState("");
  const [region, setRegion] = useState<typeof REGIONS[number]>("All");
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<{ adj?: AdminAdjudicator } | null>(null);
  const [confirmDel, setConfirmDel] = useState<AdminAdjudicator | null>(null);

  // Auto-select first row when data loads
  if (!selected && adjudicators.length > 0) {
    setSelected(adjudicators[0].id);
  }

  const create = useMutation({
    mutationFn: (body: Partial<AdminAdjudicator>) => adminAdjudicatorsApi.create(body),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["admin", "adjudicators"] });
      toast({ title: "Adjudicator added", description: `${a.name} · ${a.region}`, tone: "success" });
      setModal(null);
    },
    onError: (e) => toast({ title: "Couldn't add adjudicator", description: errMsg(e), tone: "danger" }),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AdminAdjudicator> }) => adminAdjudicatorsApi.update(id, body),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["admin", "adjudicators"] });
      toast({ title: "Adjudicator updated", description: a.name, tone: "success" });
      setModal(null);
    },
    onError: (e) => toast({ title: "Couldn't update adjudicator", description: errMsg(e), tone: "danger" }),
  });
  const del = useMutation({
    mutationFn: (id: string) => adminAdjudicatorsApi.delete(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["admin", "adjudicators"] });
      qc.invalidateQueries({ queryKey: ["admin", "assignments"] });
      qc.invalidateQueries({ queryKey: ["admin", "locations"] });
      toast({ title: "Adjudicator removed", tone: "warning" });
      if (selected === id) setSelected(null);
      setConfirmDel(null);
    },
    onError: (e) => toast({ title: "Couldn't remove adjudicator", description: errMsg(e), tone: "danger" }),
  });

  const filtered = useMemo(() => {
    return adjudicators.filter((a) => {
      if (region !== "All" && a.region !== region) return false;
      if (!q.trim()) return true;
      const n = q.toLowerCase();
      return (
        a.name.toLowerCase().includes(n) ||
        (a.home_city ?? "").toLowerCase().includes(n) ||
        a.specialties.join(" ").toLowerCase().includes(n) ||
        a.languages.join(" ").toLowerCase().includes(n)
      );
    });
  }, [q, region, adjudicators]);

  const sel = adjudicators.find((a) => a.id === selected) ?? null;
  const selLoc = sel ? locations.find((l) => l.adjudicator_id === sel.id) : null;
  const selAssignments = sel ? assignments.filter((x) => x.adjudicator_id === sel.id) : [];

  return (
    <>
      <PageHeader
        eyebrow="Admin · Adjudicators"
        title="Adjudicator roster"
        subtitle="Live roster from the backend — specialties, languages, certifications, and current field status."
        actions={
          <Button onClick={() => setModal({})}>
            <Plus className="h-4 w-4" /> Onboard adjudicator
          </Button>
        }
      />

      {adjQ.isError && (
        <Card className="mb-5">
          <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 p-3 text-sm inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {errMsg(adjQ.error)}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-soft">Roster</h3>
              <Badge tone="default">{filtered.length}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Name, city, specialty…"
                  className="input pl-8 py-1.5 text-sm w-64"
                />
              </div>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as typeof REGIONS[number])}
                className="input py-1.5 text-sm"
              >
                {REGIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {adjQ.isLoading && (
            <div className="py-12 flex items-center justify-center gap-2 text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading roster…
            </div>
          )}

          {!adjQ.isLoading && filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-line p-8 text-center">
              <div className="text-sm font-semibold text-soft">{adjudicators.length === 0 ? "No adjudicators yet" : "No matches"}</div>
              <div className="text-[12px] text-muted mt-1">
                {adjudicators.length === 0 ? "Click “Onboard adjudicator” to add the first one." : "Try a different region or clear the search query."}
              </div>
              {adjudicators.length > 0 && (
                <button onClick={() => { setQ(""); setRegion("All"); }} className="btn-ghost mt-3">Reset filters</button>
              )}
            </div>
          )}

          {!adjQ.isLoading && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted text-left">
                    <th className="py-2 pr-4">Adjudicator</th>
                    <th className="py-2 pr-4 hidden md:table-cell">Region</th>
                    <th className="py-2 pr-4 hidden lg:table-cell">Specialties</th>
                    <th className="py-2 pr-4 hidden sm:table-cell">Rating</th>
                    <th className="py-2 pr-4">Workload</th>
                    <th className="py-2 pr-4 hidden sm:table-cell">Status</th>
                    <th className="py-2 pr-4 hidden xl:table-cell">Field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((a) => {
                    const loc = locations.find((l) => l.adjudicator_id === a.id);
                    const load = assignments.filter((x) => x.adjudicator_id === a.id && x.status !== "Completed" && x.status !== "Cancelled").length;
                    return (
                      <tr
                        key={a.id}
                        onClick={() => setSelected(a.id)}
                        className={`cursor-pointer hover:bg-canvas/60 ${selected === a.id ? "bg-royal/[0.04]" : ""}`}
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-royal/10 text-royal flex items-center justify-center text-[11px] font-bold">
                              {a.initials}
                            </div>
                            <div>
                              <div className="font-semibold text-soft">{a.name}</div>
                              <div className="text-[11px] text-muted">{a.home_city ?? "—"}, {a.home_country ?? "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-soft hidden md:table-cell">{a.region}</td>
                        <td className="py-3 pr-4 text-muted hidden lg:table-cell">{a.specialties.slice(0, 2).join(", ") || "—"}</td>
                        <td className="py-3 pr-4 hidden sm:table-cell">
                          <span className="inline-flex items-center gap-1 text-soft">
                            <Star className="h-3.5 w-3.5 text-gold fill-gold" /> {a.rating}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge tone={load === 0 ? "default" : load <= 2 ? "blue" : load <= 4 ? "gold" : "red"}>{load} active</Badge>
                        </td>
                        <td className="py-3 pr-4 hidden sm:table-cell">
                          <Badge tone={a.status === "Active" ? "green" : a.status === "On leave" ? "amber" : "red"}>{a.status}</Badge>
                        </td>
                        <td className="py-3 pr-4 hidden xl:table-cell">
                          {loc ? <Badge tone={TRAVEL_TONE[loc.travel_status]}>{loc.travel_status}</Badge> : <span className="text-[11px] text-muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="lg:sticky lg:top-20">
          {sel ? (
            <>
              <div className="flex items-start gap-3 justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 rounded-full bg-royal/10 text-royal flex items-center justify-center text-sm font-bold shrink-0">
                    {sel.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-soft truncate">{sel.name}</div>
                    <div className="text-[11px] text-muted">{sel.id} · {sel.years_experience}y experience</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setModal({ adj: sel })} className="btn-ghost !p-1.5" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setConfirmDel(sel)} className="btn-ghost !p-1.5" title="Remove from roster">
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone={sel.status === "Active" ? "green" : sel.status === "On leave" ? "amber" : "red"}>{sel.status}</Badge>
                <Badge tone="default">{sel.region}</Badge>
                <Badge tone="gold"><Star className="h-3 w-3 fill-current" /> {sel.rating}</Badge>
                <Badge tone="blue"><BarChart3 className="h-3 w-3" /> {selAssignments.length} assignments</Badge>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={sel.email} />
                <DetailRow icon={<Globe className="h-3.5 w-3.5" />} label="Home base" value={`${sel.home_city ?? "—"}, ${sel.home_country ?? "—"}`} />
                <DetailRow icon={<Languages className="h-3.5 w-3.5" />} label="Languages" value={sel.languages.join(", ") || "—"} />
                <DetailRow icon={<Award className="h-3.5 w-3.5" />} label="Specialties" value={sel.specialties.join(" · ") || "—"} />
                <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Certifications" value={sel.certifications.join(" · ") || "—"} />
              </dl>

              <div className="mt-5 pt-4 border-t border-line">
                <div className="text-[10px] uppercase tracking-wider text-muted mb-2">Current location</div>
                {selLoc ? (
                  <div className="rounded-lg border border-line p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-soft">{selLoc.city ?? "—"}, {selLoc.country ?? "—"}</div>
                      <Badge tone={TRAVEL_TONE[selLoc.travel_status]}>{selLoc.travel_status}</Badge>
                    </div>
                    <div className="text-[11px] text-muted mt-1">
                      Last ping {relativeTime(selLoc.last_ping_iso)} · {formatTime(selLoc.last_ping_iso)} · ±{selLoc.accuracy_m}m · {selLoc.battery_pct}% battery
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">Consent: {selLoc.consent ? "Granted" : "Withheld"}</div>
                  </div>
                ) : (
                  <div className="text-[11px] text-muted">No location telemetry on file.</div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-line">
                <div className="text-[10px] uppercase tracking-wider text-muted mb-2">Active assignments</div>
                {selAssignments.length === 0 ? (
                  <div className="text-[12px] text-muted">No active assignments.</div>
                ) : (
                  <ul className="space-y-2">
                    {selAssignments.map((a) => (
                      <li key={a.id} className="text-[12px] flex items-center justify-between gap-2">
                        <span className="text-soft truncate">{a.event_id}</span>
                        <Badge tone={a.status === "On-site" ? "green" : a.status === "Travelling" ? "gold" : "blue"}>{a.role}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-muted text-sm">Pick a row</div>
          )}
        </Card>
      </div>

      <AdjudicatorFormModal
        open={!!modal}
        initial={modal?.adj ?? null}
        onClose={() => setModal(null)}
        submitting={create.isPending || update.isPending}
        onSubmit={(form) => {
          if (modal?.adj) update.mutate({ id: modal.adj.id, body: form });
          else create.mutate(form);
        }}
      />
      <ConfirmDialog
        open={!!confirmDel}
        title={`Remove ${confirmDel?.name}?`}
        description="They will be removed from the roster and all their active assignments and tracking history will be cleared. This cannot be undone."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={() => confirmDel && del.mutate(confirmDel.id)}
        onCancel={() => setConfirmDel(null)}
      />
    </>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
        {icon} {label}
      </div>
      <div className="mt-0.5 text-soft break-words">{value}</div>
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Unknown error";
}
