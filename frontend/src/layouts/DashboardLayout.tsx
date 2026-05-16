import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TopNavbar from "@/components/TopNavbar";
import SearchOverlay from "@/components/SearchOverlay";
import CommandPalette from "@/components/CommandPalette";
import NotificationPanel from "@/components/NotificationPanel";
import { useAppDispatch, useAppSelector, setMobileSidebarOpen, type Role } from "@/redux/store";

export default function DashboardLayout({ requireRole }: { requireRole?: Role }) {
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const mobileOpen = useAppSelector((s) => s.ui.mobileSidebarOpen);
  const auth = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const location = useLocation();

  // Close mobile drawer on every route change
  useEffect(() => { dispatch(setMobileSidebarOpen(false)); }, [location.pathname, dispatch]);

  if (!auth.isAuthenticated || !auth.user) {
    return <Navigate to="/login" replace />;
  }
  if (requireRole && auth.user.role !== requireRole) {
    return <Navigate to={`/${auth.user.role}/dashboard`} replace />;
  }

  const desktopMargin = collapsed ? 72 : 260;

  return (
    <div className="min-h-screen flex bg-canvas" style={{ ["--gwr-shell-ml" as any]: `${desktopMargin}px` }}>
      <Sidebar />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-soft/40 backdrop-blur-sm lg:hidden"
          onClick={() => dispatch(setMobileSidebarOpen(false))}
          aria-hidden="true"
        />
      )}

      {/* Custom media-query rule so the shell margin only applies at lg+ */}
      <style>{`
        @media (min-width: 1024px) {
          .gwr-shell { margin-left: var(--gwr-shell-ml); transition: margin .3s; }
        }
      `}</style>

      <div className="gwr-shell flex-1 flex flex-col min-w-0">
        <TopNavbar />
        <main className="flex-1 p-4 sm:p-6 lg:p-10 animate-fadeIn max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <SearchOverlay />
      <CommandPalette />
      <NotificationPanel />
    </div>
  );
}
