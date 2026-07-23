import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <p className="text-zinc-600 dark:text-zinc-400">
        Landing page — authentication coming later.
      </p>
      <Link
        href="/journal"
        className="font-medium text-zinc-950 underline dark:text-zinc-50"
      >
        Go to journal
      </Link>
    </main>
  );
}
