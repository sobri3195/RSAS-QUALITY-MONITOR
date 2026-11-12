import { loadEnv } from "vite";
const variables = loadEnv("production", process.cwd(), "VITE_");
const key = variables.VITE_SUPABASE_ANON_KEY ?? "";
let role = "";
try {
  role =
    JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString())
      .role ?? "";
} catch {
  /* Publishable keys are not JWTs. */
}
if (key.startsWith("sb_secret_") || role === "service_role") {
  console.error(
    "Build refused: VITE_SUPABASE_ANON_KEY must be a publishable/anon key. Never expose a Supabase secret/service_role key.",
  );
  process.exit(1);
}
