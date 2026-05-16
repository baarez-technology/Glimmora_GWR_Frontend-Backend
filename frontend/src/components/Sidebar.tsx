import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  GitBranch,
  FolderOpen,
  Bell,
  Settings,
  Users,
  Gavel,
  ShieldAlert,
  HelpCircle,
  ScrollText,
  Trophy,
  ChevronsLeft,
  Send,
  UploadCloud,
  BarChart3,
  Activity,
  Sparkles,
  LogOut,
  FilePlus2,
  MessagesSquare,
  Package,
  Lock,
  UserCheck,
  Timer,
  ClipboardSignature,
  Search as SearchIcon,
  CalendarCheck,
  MapPin as MapPinIcon,
  Compass,
  Inbox as InboxIcon,
  CalendarRange,
} from "lucide-react";
import {
  useAppDispatch,
  useAppSelector,
  toggleSidebar,
  setMobileSidebarOpen,
  logout,
  type Role,
} from "@/redux/store";
import { cn } from "@/lib/utils";

const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;

const NAV_BY_ROLE: Record<Role, { section: string; items: { to: string; label: string; icon: any }[] }[]> = {
  witness: [
    { section: "Workspace", items: [
      { to: "/witness/attempts", label: "Assigned Attempts", icon: ClipboardList },
      { to: "/witness/statements", label: "Witness Statements", icon: FileText },
      { to: "/witness/timeline", label: "Verification Timeline", icon: GitBranch },
      { to: "/witness/evidence", label: "Uploaded Evidence", icon: FolderOpen },
    ]},
    { section: "Account", items: [
      { to: "/witness/notifications", label: "Notifications", icon: Bell },
      { to: "/witness/settings", label: "Settings", icon: Settings },
    ]},
  ],
  admin: [
    { section: "Operations", items: [
      { to: "/admin/dashboard", label: "Mission Control", icon: LayoutDashboard },
      { to: "/admin/tracking", label: "Live Tracking", icon: Compass },
      { to: "/admin/inbox", label: "Inbox", icon: InboxIcon },
    ]},
    { section: "Manage", items: [
      { to: "/admin/events", label: "Events", icon: CalendarCheck },
      { to: "/admin/adjudicators", label: "Adjudicators", icon: Gavel },
      { to: "/admin/assignments", label: "Assignments", icon: MapPinIcon },
      { to: "/admin/calendar", label: "Calendar", icon: CalendarRange },
    ]},
    { section: "Insights", items: [
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ]},
    { section: "Compliance", items: [
      { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ]},
  ],
  adjudicator: [
    { section: "Review", items: [
      { to: "/adjudicator/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/adjudicator/witnesses", label: "Witness Reviews", icon: Users },
      { to: "/adjudicator/attempts", label: "Attempt Reviews", icon: Gavel },
      { to: "/adjudicator/ai-validation", label: "AI Validation", icon: ShieldAlert },
      { to: "/adjudicator/clarifications", label: "Clarifications", icon: HelpCircle },
    ]},
    { section: "Compliance", items: [
      { to: "/adjudicator/audit", label: "Audit Logs", icon: ScrollText },
      { to: "/adjudicator/settings", label: "Settings", icon: Settings },
    ]},
  ],
  // Organizer uses the full Evidence Submission Platform nav
  organizer: [
    { section: "Overview", items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
    ]},
    { section: "Setup", items: [
      { to: "/submissions/new", label: "Attempt Setup", icon: FilePlus2 },
      { to: "/cover-letter", label: "Cover Letter", icon: FileText },
    ]},
    { section: "Witnesses", items: [
      { to: "/witnesses", label: "Witness System", icon: Users },
      { to: "/organizer/invite", label: "Invite Witnesses", icon: Send },
      { to: "/steward-statement", label: "Steward Statement", icon: UserCheck },
      { to: "/timekeeper-statement", label: "Timekeeper Statement", icon: Timer },
      { to: "/witness-statement", label: "Witness Statement", icon: ClipboardSignature },
    ]},
    { section: "Attempt", items: [
      { to: "/logbook", label: "Activity Logbook", icon: Activity },
    ]},
    { section: "Evidence", items: [
      { to: "/evidence/upload", label: "Evidence Upload", icon: UploadCloud },
      { to: "/review", label: "Evidence Review", icon: ShieldAlert },
      { to: "/ai/processing", label: "AI Processing", icon: Sparkles },
      { to: "/search", label: "Smart Search", icon: SearchIcon },
      { to: "/timeline", label: "Smart Timeline", icon: GitBranch },
      { to: "/validation", label: "AI Validation", icon: ShieldAlert },
    ]},
    { section: "Collaborate", items: [
      { to: "/collaboration", label: "Collaboration", icon: MessagesSquare },
      { to: "/clarifications", label: "Clarifications", icon: HelpCircle },
      { to: "/report", label: "Report Generation", icon: FileText },
    ]},
    { section: "Submit", items: [
      { to: "/package", label: "Submission Package", icon: Package },
      { to: "/security", label: "Security & Audit", icon: Lock },
    ]},
    { section: "Reports", items: [
      { to: "/organizer/reports", label: "Reports", icon: BarChart3 },
      { to: "/organizer/settings", label: "Settings", icon: Settings },
    ]},
    ...(isDev ? [{ section: "Dev", items: [
      { to: "/witness/sign/wt_8f3a91", label: "Witness Sign (demo)", icon: Send },
    ]}] : []),
  ],
};

export default function Sidebar() {
  const collapsedPref = useAppSelector((s) => s.ui.sidebarCollapsed);
  const mobileOpen = useAppSelector((s) => s.ui.mobileSidebarOpen);
  const role = useAppSelector((s) => s.auth.user?.role);
  const dispatch = useAppDispatch();
  const sections = role ? NAV_BY_ROLE[role] : [];

  // Force expanded layout on mobile (drawer mode) regardless of stored collapsed preference.
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const collapsed = isDesktop ? collapsedPref : false;

  const workspaceLabel =
    role === "adjudicator" ? "Adjudicator"
    : role === "witness" ? "Witness"
    : role === "organizer" ? "Organizer"
    : role === "admin" ? "Operations Admin"
    : "";

  // On mobile, the drawer is full-width-narrow (260) when open; ignore collapsed state.
  // On desktop, respect collapsed/expanded width.
  const widthDesktop = collapsedPref ? 72 : 260;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 bg-white border-r border-line flex flex-col gwr-sidebar",
        "transition-transform lg:transition-[width,transform] duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0"
      )}
      style={{ width: 260, ["--gwr-sb-w" as any]: `${widthDesktop}px` }}
    >
      <style>{`
        @media (min-width: 1024px) {
          .gwr-sidebar { width: var(--gwr-sb-w) !important; }
        }
      `}</style>
      <div className="h-16 flex items-center px-5 border-b border-line">
        <div className="h-9 w-9 rounded-lg bg-royal flex items-center justify-center shrink-0">
          <Trophy className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="ml-3 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-royal font-bold">GWR Portal</div>
            <div className="text-sm font-bold truncate text-soft">{workspaceLabel} Workspace</div>
          </div>
        )}
        <button
          onClick={() => {
            if (isDesktop) dispatch(toggleSidebar());
            else dispatch(setMobileSidebarOpen(false));
          }}
          className="ml-auto btn-ghost !p-1.5"
          aria-label="Toggle sidebar"
        >
          <ChevronsLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      <nav className="overflow-y-auto flex-1 py-5 px-3">
        {sections.map((group) => (
          <div key={group.section} className="mb-5">
            {!collapsed && (
              <div className="px-3 mb-2 text-[10px] uppercase tracking-[0.2em] text-muted font-semibold">
                {group.section}
              </div>
            )}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors relative",
                      isActive ? "bg-royal/[0.08] text-royal font-semibold" : "text-soft hover:bg-canvas"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-royal" />
                      )}
                      <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-royal" : "text-muted")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-line">
        <button
          onClick={() => dispatch(logout())}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-soft hover:bg-canvas transition-colors"
        >
          <LogOut className="h-4 w-4 text-muted" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
