import { requireUser } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();
  return children;
}
