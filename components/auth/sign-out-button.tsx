"use client";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isProductionAuthEnabled } from "@/lib/env";
export function SignOutButton() { const router = useRouter(); if (!isProductionAuthEnabled()) return null; return <button onClick={async () => { await getSupabaseBrowserClient().auth.signOut(); router.push("/sign-in"); router.refresh(); }} className="text-xs text-zinc-400 hover:text-white">Sign out</button>; }
