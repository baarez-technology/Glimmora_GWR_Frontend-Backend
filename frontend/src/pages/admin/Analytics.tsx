import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Users, MapPin, Activity, Clock, Star, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { Card, PageHeader, Badge } from "@/components/ui";
import StatCard from "@/components/StatCard";
import { useAppSelector } from "@/redux/store";
import { computeSla } from "@/lib/utils";
import { adminEventsApi, adminAdjudicatorsApi, adminAssignmentsApi, trackingApi } from "@/lib/api/admin";

const REGION_COLORS: Record<string, string> = {
  Europe: "#2C5AA0",
  Americas: "#C9A227",
  "Asia-Pacific": "#10b981",
  MEA: "#e11d48",
};

export default function AnalyticsPage() {
  const settings = useAppSelector((s) => s.admin.settings);
  const eventsQ = useQuery({ queryKey: ["admin", "events"], queryFn: () => adminEventsApi.list() });
  const adjQ = useQuery({ queryKey: ["admin", "adjudicators"], queryFn: () => adminAdjudicatorsApi.list() });
  const asnQ = useQuery({ queryKey: ["admin", "assignments"], queryFn: () => adminAssignmentsApi.list() });
  const locQ = useQuery({ queryKey: ["admin", "locations"], queryFn: () => trackingApi.listLocations() });

  const events = eventsQ.data ?? [];
  const adjudicators = adjQ.data ?? [];
  const assignments = asnQ.data ?? [];
  const locations = locQ.data ?? [];

  const workload = useMemo(() => {
    return adjudicators
      .map((a) => ({
        name: a.name.split(" ").slice(-1)[0],
        full: a.name,
        active: assignments.filter((x) => x.adjudicator_id === a.id && x.status !== "Completed" && x.status !== "Cancelled").length,
        completed: assignments.filter((x) => x.adjudicator_id === a.id && x.status === "Completed").length,
        region: a.region,
      }))
      .sort((a, b) => b.active - a.active);
  }, [adjudicators, assignments]);

  const regionDistribution = useMemo(() => {
    const counts: Record<string, number> = { Europe: 0, Americas: 0, "Asia-Pacific": 0, MEA: 0 };
    events.forEach((e) => {
      const country = (e.country ?? "").toLowerCase();
      if (["united kingdom","germany","spain","iceland","france","italy"].some((c) => country.includes(c))) counts.Europe++;
      else if (["united states","canada","brazil","mexico","argentina","ecuador"].some((c) => country.includes(c))) counts.Americas++;
      else if (["japan","singapore","china","india","australia","thailand"].some((c) => country.includes(c))) counts["Asia-Pacific"]++;
      else counts.MEA++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [events]);

  const slaBuckets = useMemo(() => {
    const buckets = { Critical: 0, Warn: 0, Watch: 0, Ok: 0 };
    events.forEach((e) => {
      if (e.status === "Completed" || e.status === "Cancelled" || !e.start_iso) return;
      const s = computeSla(e.start_iso, settings.leadAssignmentSlaDays);
      if (s.urgency === "critical") buckets.Critical++;
      else if (s.urgency === "warn") buckets.Warn++;
      else if (s.urgency === "watch") buckets.Watch++;
      else buckets.Ok++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [events, settings.leadAssignmentSlaDays]);

  const throughput = useMemo(() => {
    const now = Date.now();
    const weeks = Array.from({ length: 8 }, (_, i) => ({
      label: `W-${7 - i}`, count: 0,
      start: now - (8 - i) * 7 * 86_400_000, end: now - (7 - i) * 7 * 86_400_000,
    }));
    assignments.forEach((a) => {
      const ts = new Date(a.assigned_at).getTime();
      const bucket = weeks.find((w) => ts >= w.start && ts < w.end);
      if (bucket) bucket.count++;
    });
    return weeks.map((w) => ({ name: w.label, assignments: w.count }));
  }, [assignments]);

  const topPerformers = [...adjudicators].sort((a, b) => b.rating - a.rating).slice(0, 4);

  const avgRating = adjudicators.length ? (adjudicators.reduce((acc, a) => acc + a.rating, 0) / adjudicators.length).toFixed(2) : "0";
  const avgYears = adjudicators.length ? (adjudicators.reduce((acc, a) => acc + a.years_experience, 0) / adjudicators.length).toFixed(1) : "0";
  const consentRate = locations.length ? Math.round((locations.filter((l) => l.consent).length / locations.length) * 100) : 0;
  const utilization = adjudicators.length ? Math.round((workload.filter((w) => w.active > 0).length / adjudicators.length) * 100) : 0;

  if (eventsQ.isLoading || adjQ.isLoading) {
    return <Card className="py-16 flex items-center justify-center gap-2 text-muted mt-10 max-w-md mx-auto"><Loader2 className="h-4 w-4 animate-spin" /> Loading analytics…</Card>;
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin · Analytics"
        title="Operations analytics"
        subtitle="Live from the backend — workload, SLA pressure, regional load, and roster performance."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Roster utilization %" value={utilization} Icon={Users} tone="blue" delta="active vs idle" />
        <StatCard label="Avg rating" value={Number(avgRating)} Icon={Star} tone="gold" />
        <StatCard label="Avg experience (yrs)" value={Number(avgYears)} Icon={TrendingUp} tone="green" />
        <StatCard label="Consent coverage %" value={consentRate} Icon={MapPin} tone="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold text-soft">Workload per adjudicator</h3>
              <p className="text-xs text-muted">Active assignments. Watch for outliers above and below the median.</p>
            </div>
            <Badge tone="default">{workload.length} on roster</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={workload}>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  formatter={(v, _, p) => [`${v} ${p.dataKey}`, p.payload.full]} />
                <Bar dataKey="active" stackId="a" fill="#2C5AA0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" stackId="a" fill="#C9A227" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-soft mb-2">Events by region</h3>
          <p className="text-xs text-muted mb-2">Geographic load distribution.</p>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={regionDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {regionDistribution.map((entry) => (
                    <Cell key={entry.name} fill={REGION_COLORS[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
        <Card>
          <h3 className="font-semibold text-soft mb-2 inline-flex items-center gap-2"><Activity className="h-4 w-4 text-royal" /> Assignment throughput (8 weeks)</h3>
          <p className="text-xs text-muted mb-2">Assignments created per week.</p>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={throughput}>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="assignments" stroke="#2C5AA0" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-soft mb-2 inline-flex items-center gap-2"><Clock className="h-4 w-4 text-royal" /> SLA pressure</h3>
          <p className="text-xs text-muted mb-2">Active events grouped by urgency vs Lead-assignment SLA ({settings.leadAssignmentSlaDays}d).</p>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={slaBuckets}>
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {slaBuckets.map((b) => (
                    <Cell key={b.name} fill={b.name === "Critical" ? "#e11d48" : b.name === "Warn" ? "#f59e0b" : b.name === "Watch" ? "#C9A227" : "#10b981"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h3 className="font-semibold text-soft mb-3 inline-flex items-center gap-2"><Star className="h-4 w-4 text-gold" /> Top performers</h3>
        {topPerformers.length === 0 ? (
          <div className="text-sm text-muted">No adjudicators on the roster yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {topPerformers.map((a) => (
              <div key={a.id} className="rounded-xl border border-line p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-royal/10 text-royal flex items-center justify-center text-[11px] font-bold">{a.initials}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-soft truncate">{a.name}</div>
                    <div className="text-[11px] text-muted">{a.region}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-[12px]">
                  <span className="inline-flex items-center gap-1 text-gold font-semibold"><Star className="h-3.5 w-3.5 fill-current" /> {a.rating}</span>
                  <span className="text-muted">{a.years_experience}y</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
