import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
test("production with missing backend fails closed and never displays demo figures", async ({
  page,
}) => {
  const server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5175",
      "--strictPort",
    ],
    {
      env: {
        ...process.env,
        VITE_DATA_MODE: "production",
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_ANON_KEY: "",
      },
      stdio: "ignore",
    },
  );
  try {
    await expect
      .poll(
        async () => {
          try {
            return (await fetch("http://127.0.0.1:5175")).status;
          } catch {
            return 0;
          }
        },
        { timeout: 15000 },
      )
      .toBe(200);
    await page.goto("http://127.0.0.1:5175/pimpinan/dashboard");
    await expect(page.getByRole("alert")).toContainText(
      "Konfigurasi Supabase belum lengkap",
    );
    await expect(
      page.getByText("DEMO MODE — DATA SINTETIS.", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Masuk", exact: true }),
    ).toBeDisabled();
  } finally {
    server.kill("SIGTERM");
  }
});
