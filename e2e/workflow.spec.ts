import { test, expect } from "@playwright/test";
const key = "rsas-quality-monitor:v1:dataset";
async function fillReport(
  page: import("@playwright/test").Page,
  n = "45",
  d = "50",
) {
  await page
    .getByRole("link", { name: "Input Data Unit", exact: true })
    .first()
    .click();
  await page.getByLabel("Bulan pengukuran").selectOption("1");
  await page.getByLabel("Numerator (pembilang)", { exact: true }).fill(n);
  await page.getByLabel("Denominator (penyebut)", { exact: true }).fill(d);
  await page.getByLabel("Metode / jenis sampel").fill("Total sampling");
  await page
    .getByLabel("Label / pseudonim petugas internal")
    .fill("Tim unit uji");
}
test("master lengkap, tidak ada capaian fiktif, dan halaman responsif", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Dashboard Eksekutif" }),
  ).toBeVisible();
  await expect(
    page.getByText("Belum ada data final yang dapat dinilai"),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Master Indikator", exact: true })
    .click();
  await expect(page.locator(".master-list button")).toHaveCount(34);
  await expect(page.getByRole("row")).toHaveCount(25);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/input");
  await expect(
    page.getByRole("heading", { name: "Input Data Unit" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("input → autosave → refresh → ajukan → verifikasi lokal → laporan → edit", async ({
  page,
}) => {
  await page.goto("/");
  await fillReport(page);
  await expect(page.getByText("90,0%", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k) || "{}").records?.length,
        key,
      ),
    )
    .toBe(1);
  await page.reload();
  await page.getByLabel("Bulan pengukuran").selectOption("1");
  await expect(
    page.getByLabel("Numerator (pembilang)", { exact: true }),
  ).toHaveValue("45");
  await page
    .getByRole("button", { name: "Ajukan laporan", exact: true })
    .click();
  await page.getByLabel("Persona kerja").selectOption("Komite Mutu");
  await page
    .getByRole("link", { name: "Verifikasi Komite Mutu", exact: true })
    .click();
  await page.getByLabel("Label peninjau", { exact: true }).fill("Tim mutu uji");
  await page
    .getByLabel("Temuan & catatan verifikasi")
    .fill("Data agregat telah ditinjau.");
  await page
    .getByRole("button", { name: "Verifikasi lokal", exact: true })
    .click();
  await expect(
    page.getByRole("table").getByText("Tercapai", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Laporan", exact: true })
    .first()
    .click();
  await expect(page.locator(".report table").first()).toContainText("45/50");
  await expect(page.locator(".report table").first()).toContainText("90,0");
  await expect(page.locator(".report .recharts-surface").first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".report-letterhead")).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await page.goto("/input");
  await page.getByLabel("Bulan pengukuran").selectOption("1");
  await page.getByLabel("Numerator (pembilang)", { exact: true }).fill("40");
  await page.getByRole("button", { name: "Simpan draft", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k) || "{}").records?.[0].status,
        key,
      ),
    )
    .toBe("draft");
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k) || "{}").records?.length,
        key,
      ),
    )
    .toBe(1);
});
test("validasi angka dan N/A, tanpa numerator palsu", async ({ page }) => {
  await page.goto("/input");
  await fillReport(page, "51", "50");
  await page.getByRole("button", { name: "Simpan draft", exact: true }).click();
  await expect(
    page.getByText("Numerator tidak boleh melebihi denominator.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Numerator (pembilang)", { exact: true }).fill("0");
  await page.getByLabel("Denominator (penyebut)", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Simpan draft", exact: true }).click();
  await expect(
    page.getByText("Alasan tidak ada objek ukur wajib diisi.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Alasan tidak ada objek ukur (wajib)")
    .fill("Tidak ada populasi eligible bulan ini");
  await page.getByRole("button", { name: "Simpan draft", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (k) =>
          JSON.parse(localStorage.getItem(k) || "{}").records?.[0].denominator,
        key,
      ),
    )
    .toBe(0);
  await expect(page.locator(".calculator strong")).toHaveText("N/A");
});
test("ekspor unit → impor perangkat lain → dedupe → konflik eksplisit", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await fillReport(page);
  await page.getByRole("button", { name: "Simpan draft", exact: true }).click();
  await page.getByRole("link", { name: "Impor / Ekspor", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Ekspor Data Unit JSON" }).click();
  const file = await downloaded;
  const path = await file.path();
  expect(path).toBeTruthy();
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto("/transfer");
  await other.getByLabel("Persona kerja").selectOption("Admin/Pimpinan");
  await other.getByLabel("Berkas impor JSON").setInputFiles(path!);
  await expect(
    other.getByRole("heading", { name: "Pratinjau impor" }),
  ).toBeVisible();
  await other.getByLabel("Saya telah meninjau sumber data").check();
  await other.getByRole("button", { name: "Gabungkan data terpilih" }).click();
  await expect
    .poll(() =>
      other.evaluate(
        (k) => JSON.parse(localStorage.getItem(k) || "{}").records?.length,
        key,
      ),
    )
    .toBe(1);
  await other.getByLabel("Berkas impor JSON").setInputFiles([]);
  await other.getByLabel("Berkas impor JSON").setInputFiles(path!);
  await expect(other.getByText("Duplikat · dilewati")).toBeVisible();
  await other.getByRole("button", { name: "Batalkan impor" }).click();
  await other.goto("/input");
  await other.getByLabel("Bulan pengukuran").selectOption("1");
  await other.getByLabel("Numerator (pembilang)", { exact: true }).fill("40");
  await other
    .getByRole("button", { name: "Simpan draft", exact: true })
    .click();
  await other.goto("/transfer");
  await other.getByLabel("Persona kerja").selectOption("Admin/Pimpinan");
  await other.getByLabel("Berkas impor JSON").setInputFiles(path!);
  await expect(other.getByLabel("Konflik 0:0")).toBeVisible();
  await expect(
    other.getByRole("button", { name: "Gabungkan data terpilih" }),
  ).toBeDisabled();
  await other.getByLabel("Konflik 0:0").selectOption("local");
  await other.getByLabel("Saya telah meninjau sumber data").check();
  await other.getByRole("button", { name: "Gabungkan data terpilih" }).click();
  expect(
    await other.evaluate(
      (k) => JSON.parse(localStorage.getItem(k) || "{}").records[0].numerator,
      key,
    ),
  ).toBe(40);
  await context.close();
});

test("penugasan RS, sampel minimal, dan tindak lanjut sampai penutupan", async ({
  page,
}) => {
  await page.goto("/master");
  await page.getByLabel("Persona kerja").selectOption("Admin/Pimpinan");
  await page.getByLabel("Tugaskan IMP-RS-05 ke IGD", { exact: true }).check();
  await page
    .getByRole("link", { name: "Input Data Unit", exact: true })
    .first()
    .click();
  await page.getByLabel("Indikator input").selectOption("IMP-RS-05");
  await page.getByLabel("Bulan pengukuran").selectOption("1");
  await page.getByLabel("Numerator (pembilang)", { exact: true }).fill("100");
  await page.getByLabel("Denominator (penyebut)", { exact: true }).fill("150");
  await page.getByLabel("Metode / jenis sampel").fill("Observasi");
  await page
    .getByLabel("Label / pseudonim petugas internal")
    .fill("Tim observasi uji");
  await page
    .getByRole("button", { name: "Ajukan laporan", exact: true })
    .click();
  await page.getByLabel("Persona kerja").selectOption("Komite Mutu");
  await page
    .getByRole("link", { name: "Verifikasi Komite Mutu", exact: true })
    .click();
  await page.getByLabel("Label peninjau", { exact: true }).fill("Komite uji");
  await page
    .getByLabel("Temuan & catatan verifikasi")
    .fill("Perlu penambahan peluang observasi.");
  await page
    .getByRole("button", { name: "Verifikasi lokal", exact: true })
    .click();
  await expect(
    page.getByRole("table").getByText("Sampel tidak memadai", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Rencana Tindak Lanjut", exact: true })
    .click();
  await page.getByRole("button", { name: "Buat tindak lanjut" }).click();
  await page
    .getByLabel("Masalah / temuan")
    .fill("Sampel kurang dari 200 peluang");
  await page
    .getByLabel("Tindakan perbaikan")
    .fill("Tambahkan observasi peluang pada periode berikutnya");
  await page.getByLabel("PIC / penanggung jawab").fill("Tim mutu");
  await page.getByRole("button", { name: "Simpan tindak lanjut" }).click();
  await expect(page.getByRole("table")).toContainText(
    "Sampel kurang dari 200 peluang",
  );
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Evaluasi (Study/Check)")
    .fill("Pelaksanaan dievaluasi dalam rapat; referensi BA-UJI");
  await page
    .locator("form")
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("CLOSED");
  await page.getByRole("button", { name: "Simpan tindak lanjut" }).click();
  await expect(page.getByRole("table")).toContainText("Ditutup");
});
