import "server-only";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cache } from "react";

export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/");
  }

  return data.claims;
});
