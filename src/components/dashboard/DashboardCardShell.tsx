import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface DashboardCardShellProps {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
}

/** Shared panel/heading chrome for the six dashboard widgets, so each one only supplies its own body. */
export function DashboardCardShell({ title, icon: Icon, children }: DashboardCardShellProps) {
  return (
    <div className="panel dashboard-card">
      <h3 className="dashboard-card-title">
        {Icon ? <Icon size={17} aria-hidden="true" /> : null}
        {title}
      </h3>
      <div className="dashboard-card-body">{children}</div>
    </div>
  );
}
