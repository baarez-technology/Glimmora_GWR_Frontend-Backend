import { useEffect } from "react";
import { Bell, Search, ShieldCheck, ChevronDown, Command, Menu } from "lucide-react";
import {
  useAppDispatch,
  useAppSelector,
  setSearchOpen,
  setPaletteOpen,
  setNotificationsOpen,
  setMobileSidebarOpen,
} from "@/redux/store";
import { notifications } from "@/mock-data/portal";

export default function TopNavbar() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const role = user?.role ?? "witness";

  const unread = notifications.filter((n) => (n.role === "all" || n.role === role) && n.unread).length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dispatch(setPaletteOpen(true));
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        dispatch(setSearchOpen(true));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  return (
    <header className="sticky top-0 z-20 h-16 flex items-center gap-2 sm:gap-4 px-3 sm:px-6 lg:px-8 border-b border-line bg-white/95 backdrop-blur">
      {/* Mobile hamburger */}
      <button
        onClick={() => dispatch(setMobileSidebarOpen(true))}
        className="lg:hidden btn-ghost !p-2"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={() => dispatch(setSearchOpen(true))}
        className="flex-1 max-w-xl flex items-center gap-2 rounded-xl bg-canvas border border-line px-3 py-2 text-sm text-muted hover:border-royal/40 transition-all min-w-0"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate hidden sm:inline">Search witnesses, attempts, evidence&hellip;</span>
        <span className="truncate sm:hidden">Search…</span>
        <kbd className="ml-auto chip !text-[10px] hidden sm:inline-flex">/</kbd>
      </button>

      <button
        onClick={() => dispatch(setPaletteOpen(true))}
        className="hidden md:inline-flex items-center gap-2 chip hover:border-royal/40 transition"
      >
        <Command className="h-3.5 w-3.5 text-royal" />
        Quick actions
        <kbd className="!text-[10px]">⌘K</kbd>
      </button>

      <div className="hidden xl:flex items-center gap-2 chip">
        <ShieldCheck className="h-3.5 w-3.5 text-royal" />
        Secure session &middot; TLS 1.3
      </div>

      <button
        onClick={() => dispatch(setNotificationsOpen(true))}
        className="btn-ghost relative !p-2"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-gold text-[10px] font-bold text-white px-1 flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 border-l border-line">
        <div className="h-9 w-9 rounded-full bg-royal text-white flex items-center justify-center font-semibold text-sm shrink-0">
          {user?.avatarInitials ?? "?"}
        </div>
        <div className="hidden lg:block min-w-0">
          <div className="text-sm font-semibold leading-tight text-soft truncate">{user?.name}</div>
          <div className="text-[11px] text-muted truncate">{user?.roleLabel}</div>
        </div>
        <ChevronDown className="hidden lg:block h-4 w-4 text-muted shrink-0" />
      </div>
    </header>
  );
}
