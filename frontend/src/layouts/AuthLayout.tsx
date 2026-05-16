import { Outlet } from "react-router-dom";
import { Trophy, ShieldCheck, ScrollText, Users } from "lucide-react";

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-canvas">
      {/* Mobile/tablet branding header */}
      <header className="lg:hidden relative overflow-hidden bg-gradient-to-br from-royal to-royal-400 text-white p-5 sm:p-7">
        <div className="absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-gold/25 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white text-royal flex items-center justify-center shadow-panel">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/85">Guinness World Records</div>
            <div className="font-bold text-sm sm:text-base truncate">Witness & Adjudicator Portal</div>
          </div>
        </div>
      </header>
      <aside className="relative hidden lg:flex flex-col justify-between p-8 xl:p-12 w-1/2 overflow-hidden bg-gradient-to-br from-royal to-royal-400 text-white">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-gold/25 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white text-royal flex items-center justify-center shadow-panel">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/85">Guinness World Records</div>
            <div className="font-bold">Witness &amp; Adjudicator Portal</div>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-bold leading-tight">
            Where world records are <span className="text-gold-300">witnessed</span> with precision.
          </h1>
          <p className="mt-4 text-white/90">
            The official digital workspace where independent witnesses, organizers and Guinness
            adjudicators collaborate to verify record attempts &mdash; replacing decades of paper forms,
            scans and manual reviews.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 text-center">
            {[
              { v: "8,240+", l: "Witnesses verified" },
              { v: "180+", l: "Countries" },
              { v: "99.98%", l: "Audit integrity" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl bg-white/15 border border-white/30 p-4 backdrop-blur">
                <div className="text-xl font-bold text-white">{s.v}</div>
                <div className="text-[11px] uppercase tracking-wider text-white/85 mt-1">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-2.5 text-sm text-white/90">
            <div className="flex items-center gap-3"><Users className="h-4 w-4 text-gold-300" /> Role-based access for Witnesses, Adjudicators &amp; Organizers</div>
            <div className="flex items-center gap-3"><ScrollText className="h-4 w-4 text-gold-300" /> Digital statements, signatures &amp; immutable audit trail</div>
            <div className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-gold-300" /> AI validation, identity checks &amp; tamper detection</div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/75">
          &copy; {new Date().getFullYear()} Guinness World Records Limited &middot; Confidential verification system
        </div>
      </aside>
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 bg-white">
        <Outlet />
      </main>
    </div>
  );
}
