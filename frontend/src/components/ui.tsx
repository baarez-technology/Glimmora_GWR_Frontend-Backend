import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...p }, ref) => (
    <div ref={ref} className={cn("panel p-5", className)} {...p} />
  )
);
Card.displayName = "Card";

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4 gap-4">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-soft">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "gold" | "ghost" | "outline";
}
export const Button = forwardRef<HTMLButtonElement, BtnProps>(
  ({ className, variant = "primary", ...p }, ref) => {
    const cls =
      variant === "gold"
        ? "btn-gold"
        : variant === "ghost"
          ? "btn-ghost"
          : variant === "outline"
            ? "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold border border-royal bg-white text-royal hover:bg-royal/[0.04] transition"
            : "btn-primary";
    return <button ref={ref} className={cn(cls, className)} {...p} />;
  }
);
Button.displayName = "Button";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn("input", className)} {...p} />
);
Input.displayName = "Input";

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "gold" | "blue" | "green" | "red" | "amber";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "bg-canvas text-soft border-line",
    gold: "bg-[#FBF5E5] text-[#8A6F1F] border-[#E8D49B]",
    blue: "bg-[#E8F0FB] text-royal border-[#BFD4F0]",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Progress({ value, tone = "blue" }: { value: number; tone?: "blue" | "gold" | "green" | "red" }) {
  const tones: Record<string, string> = {
    blue: "bg-royal",
    gold: "bg-gold",
    green: "bg-emerald-500",
    red: "bg-rose-500",
  };
  return (
    <div className="h-1.5 w-full rounded-full bg-canvas overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow = "GWR · Witness & Adjudicator Portal",
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8 pb-4 sm:pb-5 border-b border-line">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.22em] text-royal font-bold mb-2">{eyebrow}</div>
        <h1 className="text-2xl sm:text-[28px] lg:text-[32px] font-bold tracking-tight text-soft leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-2 max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
