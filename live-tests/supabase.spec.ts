import { test, expect, type BrowserContext, type Page } from "@playwright/test";
const required = [
  "RSAS_LIVE_URL",
  "RSAS_LIVE_PERIOD",
  "RSAS_LIVE_INDICATOR",
  "RSAS_LIVE_UNIT",
  "RSAS_LIVE_UNIT_EMAIL",
  "RSAS_LIVE_UNIT_PASSWORD",
  "RSAS_LIVE_VALIDATOR_EMAIL",
  "RSAS_LIVE_VALIDATOR_PASSWORD",
  "RSAS_LIVE_MUTU_EMAIL",
  "RSAS_LIVE_MUTU_PASSWORD",
  "RSAS_LIVE_LEADER_EMAIL",
  "RSAS_LIVE_LEADER_PASSWORD",
];
test("staging: four independent browser sessions synchronize only published measurements", async ({
  browser,
}) => {
  test.skip(
    process.env.RSAS_LIVE_ENV !== "staging" ||
      required.some((name) => !process.env[name]),
    "Requires explicit staging opt-in, prepared equivalent master and four assigned accounts; production sync is unverified without these.",
  );
  const contexts: BrowserContext[] = [];
  async function login(role: string): Promise<Page> {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    await page.goto(process.env.RSAS_LIVE_URL + "/pimpinan/dashboard");
    await page
      .getByLabel("Email", { exact: true })
      .fill(process.env[`RSAS_LIVE_${role}_EMAIL`]!);
    await page
      .getByLabel("Kata sandi", { exact: true })
      .fill(process.env[`RSAS_LIVE_${role}_PASSWORD`]!);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Dashboard Mutu & Tren", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("DEMO MODE — DATA SINTETIS.", { exact: true }),
    ).toHaveCount(0);
    return page;
  }
  async function decide(page: Page, id: string, action: string) {
    await page.goto(process.env.RSAS_LIVE_URL + `/workflow/submissions/${id}`);
    await page
      .getByLabel("Catatan keputusan / alasan", { exact: true })
      .fill("Pengujian staging sintetis, bukan data pelayanan.");
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Keputusan disimpan.");
  }
  try {
    const unit = await login("UNIT"),
      validator = await login("VALIDATOR"),
      mutu = await login("MUTU"),
      leader = await login("LEADER");
    await leader
      .getByLabel("Indikator analisis", { exact: true })
      .selectOption(process.env.RSAS_LIVE_INDICATOR!);
    await leader
      .getByLabel("Akhir bulan", { exact: true })
      .fill(process.env.RSAS_LIVE_PERIOD!);
    const before = await leader
      .locator(".workflow-export table")
      .last()
      .locator("tbody tr")
      .count();
    await unit.goto(process.env.RSAS_LIVE_URL + "/unit/input");
    await unit
      .getByLabel("Unit pelapor", { exact: true })
      .selectOption(process.env.RSAS_LIVE_UNIT!);
    await unit
      .getByLabel("Indikator pengajuan", { exact: true })
      .selectOption(process.env.RSAS_LIVE_INDICATOR!);
    await unit
      .getByLabel("Periode pengajuan", { exact: true })
      .fill(process.env.RSAS_LIVE_PERIOD!);
    await unit.getByLabel("Numerator pengajuan", { exact: true }).fill("9");
    await unit.getByLabel("Denominator pengajuan", { exact: true }).fill("10");
    await unit
      .getByRole("button", { name: "Simpan draft pengajuan", exact: true })
      .click();
    await expect(unit.getByRole("status")).toContainText("Draft disimpan.");
    await unit.reload();
    await expect(
      unit.getByLabel("Numerator pengajuan", { exact: true }),
    ).toHaveValue("9");
    await unit
      .getByRole("button", { name: "Ajukan ke Validator", exact: true })
      .click();
    await expect(unit.getByRole("status")).toContainText("Pengajuan dikirim");
    const id = new URL(unit.url()).searchParams.get("id")!;
    await decide(validator, id, "Mulai validasi");
    await decide(validator, id, "Setujui → Tim Mutu");
    await leader
      .getByRole("button", { name: "Muat ulang", exact: true })
      .click();
    await expect(
      leader.locator(".workflow-export table").last().locator("tbody tr"),
    ).toHaveCount(before);
    await decide(mutu, id, "Terbitkan data resmi");
    // No reload: Realtime (with documented polling fallback) must update the other browser.
    await expect(
      leader.locator(".workflow-export table").last().locator("tbody tr"),
    ).toHaveCount(before + 1, { timeout: 40000 });
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
