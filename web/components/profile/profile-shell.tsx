import Link from "next/link";
import type { ReactNode } from "react";

type ProfileShellProps = {
  activeSection: "general" | "analytics";
  children: ReactNode;
};

function navigationClass(isActive: boolean) {
  return `flex items-center justify-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition lg:justify-start ${
    isActive
      ? "bg-journal-text text-journal-surface shadow-sm"
      : "text-journal-text hover:bg-journal-bg"
  }`;
}

export function ProfileShell({ activeSection, children }: ProfileShellProps) {
  return (
    <div className="min-h-screen bg-[linear-gradient(145deg,#dff5e8_0%,#c6ead5_52%,#b5ddc6_100%)] px-4 py-5 text-journal-text sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-7">
        <aside className="rounded-3xl border border-white/70 bg-journal-surface/85 p-3 shadow-[0_18px_50px_-32px_rgba(47,89,67,0.55)] backdrop-blur-xl lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:p-5">
          <div className="px-2 py-2">
            <Link href="/journal" className="text-lg font-semibold tracking-tight">My Journal</Link>
          </div>
          <nav aria-label="Profile sections" className="mt-3 grid grid-cols-3 gap-2 lg:mt-8 lg:grid-cols-1">
            <Link href="/profile" aria-current={activeSection === "general" ? "page" : undefined} className={navigationClass(activeSection === "general")}>
              <span aria-hidden="true">○</span> General
            </Link>
            <Link href="/profile/analytics" aria-current={activeSection === "analytics" ? "page" : undefined} className={navigationClass(activeSection === "analytics")}>
              <span aria-hidden="true">⌁</span> Analytics
            </Link>
            <span className="flex cursor-not-allowed items-center justify-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-journal-muted/65 lg:justify-start" title="Coming soon">
              <span aria-hidden="true">⚙</span> Settings
            </span>
          </nav>
          <Link href="/journal" className="mt-4 hidden items-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold transition hover:bg-journal-bg focus-visible:outline-2 focus-visible:outline-journal-text lg:absolute lg:bottom-5 lg:left-5 lg:right-5 lg:flex">
            <span aria-hidden="true">←</span> Back to journal
          </Link>
        </aside>
        {children}
      </div>
    </div>
  );
}
