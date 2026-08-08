import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Thrown at import time so the failure is obvious immediately rather than
  // surfacing as a confusing runtime error deep in a data call.
  console.error(
    "Missing Supabase env vars. Copy .env.example to .env and fill in " +
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project settings."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");
