import { test, expect, type Page } from "@playwright/test";
async function persona(page: Page, name: string) {
  await page
    .getByLabel("Persona DEMO", { exact: true })
    .selectOption({ label: name });
}
async function fill(page: Page, n = "9", d = "10") {
  await page.goto("/unit/input");
  await page.getByLabel("Periode pengajuan", { exact: true }).fill("2026-04");
  await page.getByLabel("Numerator pengajuan", { exact: true }).fill(n);
  await page.getByLabel("Denominator pengajuan", { exact: true }).fill(d);
}
async function review(page: Page, action: string) {
  await page
    .getByLabel("Catatan keputusan / alasan", { exact: true })
    .fill("Catatan agregat sintetis untuk pengujian.");
  await page.getByRole("button", { name: action, exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Keputusan disimpan.");
}
test("demo: reject → resubmit → validator → clarification → publish → amendment", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fill(page);
  await expect(
    page.getByText("DEMO MODE — DATA SINTETIS.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ajukan ke Validator", exact: true })
    .click();
  await expect(
    page.getByText("Pengajuan dikirim ke Validator.", { exact: true }),
  ).toBeVisible();
  const inputUrl = page.url();
  const id = new URL(inputUrl).searchParams.get("id")!;
  await persona(page, "Validator");
  await page.getByRole("link", { name: "Validasi", exact: true }).click();
  await page
    .getByRole("link", { name: "Lihat Riwayat Validasi", exact: true })
    .click();
  await review(page, "Mulai validasi");
  await review(page, "Kembalikan untuk revisi");
  await expect(
    page.getByRole("heading", { name: "Perlu revisi", exact: true }),
  ).toBeVisible();
  await persona(page, "Petugas Unit");
  await page.goto(inputUrl);
  await page.getByLabel("Numerator pengajuan", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Ajukan ke Validator", exact: true })
    .click();
  await expect(
    page.getByText("Pengajuan dikirim ke Validator.", { exact: true }),
  ).toBeVisible();
  await persona(page, "Validator");
  await page.goto(`/workflow/submissions/${id}`);
  await review(page, "Mulai validasi");
  await review(page, "Setujui → Tim Mutu");
  await persona(page, "Pimpinan");
  await page.goto("/workflow/reports");
  await expect(page.locator(".workflow-export")).not.toContainText(
    "2026-04-01",
  );
  await persona(page, "Tim Mutu");
  await page.getByRole("link", { name: "Inbox Mutu", exact: true }).click();
  await page
    .getByRole("link", { name: "Lihat Riwayat Validasi", exact: true })
    .click();
  await review(page, "Minta klarifikasi");
  await persona(page, "Petugas Unit");
  await page.goto(inputUrl);
  await page
    .getByRole("button", { name: "Ajukan ke Validator", exact: true })
    .click();
  await expect(
    page.getByText("Pengajuan dikirim ke Validator.", { exact: true }),
  ).toBeVisible();
  await persona(page, "Validator");
  await page.goto(`/workflow/submissions/${id}`);
  await review(page, "Mulai validasi");
  await review(page, "Setujui → Tim Mutu");
  await persona(page, "Tim Mutu");
  await review(page, "Terbitkan data resmi");
  await expect(
    page.getByRole("heading", { name: "Diterbitkan", exact: true }),
  ).toBeVisible();
  await persona(page, "Pimpinan");
  await page.goto("/workflow/reports");
  const row = page
    .getByRole("row")
    .filter({
      has: page.getByRole("link", { name: "DEMO-PROP · DEMO-A", exact: true }),
    })
    .filter({ hasText: "2026-04" });
  await expect(row).toContainText("100 %");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Ekspor CSV resmi", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("DEMO-laporan.csv");
  await persona(page, "Petugas Unit");
  await page.goto(`/workflow/submissions/${id}`);
  await review(page, "Buat amendemen");
  await page.goto(inputUrl);
  await page.getByLabel("Numerator pengajuan", { exact: true }).fill("5");
  await page
    .getByRole("button", { name: "Simpan draft pengajuan", exact: true })
    .click();
  await expect(
    page.getByText("Draft disimpan.", { exact: true }),
  ).toBeVisible();
  await persona(page, "Pimpinan");
  await page.goto("/workflow/reports");
  await expect(
    page
      .getByRole("row")
      .filter({
        has: page.getByRole("link", {
          name: "DEMO-PROP · DEMO-A",
          exact: true,
        }),
      })
      .filter({ hasText: "2026-04" }),
  ).toContainText("100 %");
  expect(errors).toEqual([]);
});
test("draft survives refresh and stale tab cannot overwrite another change", async ({
  page,
  context,
}) => {
  await fill(page);
  await page
    .getByRole("button", { name: "Simpan draft pengajuan", exact: true })
    .click();
  await expect(
    page.getByText("Draft disimpan.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Numerator pengajuan", { exact: true }),
  ).toHaveValue("9");
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(
    other.getByLabel("Numerator pengajuan", { exact: true }),
  ).toHaveValue("9");
  await other.getByLabel("Numerator pengajuan", { exact: true }).fill("7");
  await page.getByLabel("Numerator pengajuan", { exact: true }).fill("8");
  await page
    .getByRole("button", { name: "Simpan draft pengajuan", exact: true })
    .click();
  await expect(
    page.getByText("Draft disimpan.", { exact: true }),
  ).toBeVisible();
  await other
    .getByRole("button", { name: "Simpan draft pengajuan", exact: true })
    .click();
  await expect(other.getByRole("status")).toContainText("CONFLICT");
  await page.reload();
  await expect(
    page.getByLabel("Numerator pengajuan", { exact: true }),
  ).toHaveValue("8");
  await other.close();
});
test("denominator zero, no cases and N/A are distinct from measured zero", async ({
  page,
}) => {
  await fill(page, "0", "0");
  await expect(page.getByRole("alert")).toContainText("Denominator nol");
  await page
    .getByLabel("Jenis pelaporan", { exact: true })
    .selectOption("no_cases");
  await page
    .getByLabel(/Alasan terstruktur/)
    .fill("Tidak ada peluang sintetis pada periode ini");
  await page
    .getByRole("button", { name: "Simpan draft pengajuan", exact: true })
    .click();
  await expect(
    page.getByText("Draft disimpan.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".calculator strong")).toHaveText("N/A");
  await page.reload();
  await expect(page.getByLabel("Jenis pelaporan", { exact: true })).toHaveValue(
    "no_cases",
  );
  await page
    .getByLabel("Jenis pelaporan", { exact: true })
    .selectOption("measured");
  await page.getByLabel("Numerator pengajuan", { exact: true }).fill("0");
  await page.getByLabel("Denominator pengajuan", { exact: true }).fill("10");
  await expect(page.locator(".calculator strong")).toHaveText("0 %");
});
test("old storage is preserved and a separate browser receives only its own demo", async ({
  page,
  browser,
}) => {
  const raw = '{"unparseable":"legacy recovery example"}';
  await page.addInitScript(
    (value) => localStorage.setItem("rsas-quality-monitor:v1:dataset", value),
    raw,
  );
  await fill(page);
  await page
    .getByRole("button", { name: "Simpan draft pengajuan", exact: true })
    .click();
  await expect(
    page.getByText("Draft disimpan.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("rsas-quality-monitor:v1:dataset"),
    ),
  ).toBe(raw);
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto("/unit/submissions");
  await expect(
    other.getByRole("row").filter({ hasText: "2026-04" }),
  ).toHaveCount(0);
  await expect(
    other.getByText("DEMO MODE — DATA SINTETIS.", { exact: true }),
  ).toBeVisible();
  await context.close();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Buka menu workflow", exact: true })
    .click();
  await expect(page.locator(".sidebar")).toHaveClass(/open/);
  await page
    .getByRole("button", { name: "Tutup menu workflow", exact: true })
    .click();
  await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
  await page.goto("/pimpinan/dashboard");
  await expect(
    page.getByRole("heading", { name: "Dashboard Mutu & Tren", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("menu roles deny management pages and files require consent and valid format", async ({
  page,
}) => {
  await page.goto("/workflow/users");
  await expect(
    page.getByRole("heading", { name: "Akses halaman ditolak", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Manajemen User", exact: true }),
  ).toHaveCount(0);
  await fill(page);
  await page
    .getByRole("button", { name: "Simpan draft pengajuan", exact: true })
    .click();
  await expect(
    page.getByText("Draft disimpan.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Upload bukti aman", { exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel(
      "Saya memastikan bukti hanya berisi data agregat non-sensitif.",
      { exact: true },
    )
    .check();
  await page.getByLabel("Upload bukti aman", { exact: true }).setInputFiles({
    name: "fake.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a PDF"),
  });
  await expect(page.getByRole("status")).toContainText(
    "PDF, PNG, JPEG yang valid",
  );
});

test("admin creates a period-specific scalar target and unit completes a corrective action", async ({
  page,
}) => {
  await page.goto("/workflow/master");
  await persona(page, "Admin");
  await page.getByRole("button", { name: "DEMO-TIME", exact: true }).click();
  await page.getByLabel("Periode target", { exact: true }).fill("2026-04");
  await page.getByLabel("Target sah", { exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Sahkan versi & target periode", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Versi definisi dan target periode disimpan.",
  );
  await persona(page, "Petugas Unit");
  await page.goto("/unit/input");
  await page
    .getByLabel("Indikator pengajuan", { exact: true })
    .selectOption("DEMO-TIME");
  await page.getByLabel("Periode pengajuan", { exact: true }).fill("2026-04");
  await page.getByLabel("Nilai (menit)", { exact: true }).fill("14");
  await page
    .getByRole("button", { name: "Simpan draft pengajuan", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Draft disimpan.");
  const id = new URL(page.url()).searchParams.get("id")!;
  await page
    .getByRole("link", { name: "Rencana Tindak Lanjut", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Buat tindak lanjut mutu", exact: true })
    .click();
  await page.getByLabel("Pengajuan sumber", { exact: true }).selectOption(id);
  await page
    .getByLabel("Rencana tindakan", { exact: true })
    .fill("Latihan perbaikan proses sintetis");
  await page.getByLabel("PIC tindakan", { exact: true }).fill("Tim demo");
  await page
    .getByLabel("Status tindakan", { exact: true })
    .selectOption("CLOSED");
  await page
    .getByLabel("Evaluasi efektivitas", { exact: true })
    .fill("Hasil latihan dievaluasi; tidak menyimpulkan kausalitas.");
  await page
    .getByRole("button", { name: "Simpan rencana mutu", exact: true })
    .click();
  await expect(page.getByRole("table")).toContainText("CLOSED");
});
