import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WorkflowStepper({
  steps,
  current,
}: {
  steps: { label: string; description?: string }[];
  current: number;
}) {
  return (
    <ol className="flex flex-wrap items-stretch gap-3">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <li key={s.label} className="flex-1 min-w-[140px] sm:min-w-[180px]">
            <div className={cn(
              "panel p-4 h-full transition",
              state === "active" && "border-royal/40 shadow-glow",
              state === "done" && "border-emerald-200",
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold",
                  state === "done" && "bg-emerald-50 text-emerald-700",
                  state === "active" && "bg-royal text-white",
                  state === "pending" && "bg-canvas text-muted",
                )}>
                  {state === "done" ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted">Step {i + 1}</div>
                  <div className="text-sm font-semibold text-soft">{s.label}</div>
                </div>
              </div>
              {s.description && <p className="text-xs text-muted mt-2">{s.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
