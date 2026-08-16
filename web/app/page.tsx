import { AuthEntry } from "@/components/auth/auth-entry";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-full flex-1 flex-col overflow-hidden bg-[linear-gradient(145deg,#eefaf3_0%,#d9f0e3_48%,#b9ddc8_100%)] text-journal-text">
      <div
        aria-hidden
        className="absolute -top-32 -left-24 size-96 rounded-full bg-white/35 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute right-[-8rem] bottom-[-10rem] size-[30rem] rounded-full bg-[#77bd94]/25 blur-3xl"
      />

      <header className="relative z-10 flex w-full items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-journal-text"
        >
          My Journal
        </Link>
        <AuthEntry />
      </header>

      <section className="relative z-0 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div className="max-w-2xl">
          <p className="mb-5 text-sm font-semibold tracking-[0.2em] text-journal-muted uppercase">
            A quieter place for your thoughts
          </p>
          <h1 className="text-5xl leading-[1.05] font-semibold tracking-[-0.045em] text-balance sm:text-6xl lg:text-7xl">
            Notice how your days{" "}
            <span className="text-[#579372]">really feel.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-journal-muted">
            Write freely in a private, calming space with optional live mood
            reflections that respond gently as your thoughts unfold.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/journal"
              className="rounded-full bg-journal-text px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_26px_-10px_rgba(47,89,67,0.75)] transition hover:-translate-y-0.5 hover:bg-[#244b36]"
            >
              Explore the journal
            </Link>
            <span className="text-sm text-journal-muted">
              No account required for this preview
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="rotate-2 rounded-[2rem] border border-white/70 bg-white/60 p-7 shadow-[0_28px_80px_-35px_rgba(39,86,61,0.55)] backdrop-blur-md">
            <p className="text-xs font-semibold tracking-[0.18em] text-journal-muted uppercase">
              Today
            </p>
            <p className="mt-4 text-xl leading-8 font-medium">
              “I slowed down long enough to hear what I actually needed.”
            </p>
            <div className="mt-8 h-2 overflow-hidden rounded-full bg-journal-bg">
              <div className="h-full w-3/4 rounded-full bg-journal-accent" />
            </div>
            <p className="mt-3 text-sm text-journal-muted">
              A gentle reflection—not a judgment.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
