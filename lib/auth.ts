import "server-only";
import { redirect } from "next/navigation";
import { isProductionAuthEnabled } from "@/lib/env";
import { getSupabaseUser } from "@/lib/supabase/server";

export type FaustUser = { id: string; email?: string; mode: "local" | "supabase" };
export async function getCurrentUser(): Promise<FaustUser> { if (!isProductionAuthEnabled()) return { id: "local-development-user", mode: "local" }; const user = await getSupabaseUser(); if (!user) redirect("/sign-in"); return { id: user.id, email: user.email, mode: "supabase" }; }
