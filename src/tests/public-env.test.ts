import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";
it("refuses public builds containing a secret or service role key without printing the key", () => {
  for (const key of [
    "sb_secret_synthetic_test_only",
    `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.test`,
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/check-public-env.mjs"],
      {
        encoding: "utf8",
        env: { ...process.env, VITE_SUPABASE_ANON_KEY: key },
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Build refused");
    expect(result.stderr).not.toContain(key);
  }
});
