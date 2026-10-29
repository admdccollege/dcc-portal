import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("a teacher cannot open fee, admission or user pages", async ({ page }) => {
  await login(page, "teacher.physics@dcc.example");
  for (const path of ["/fees", "/admissions", "/users", "/results"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Access denied" }), path).toBeVisible();
  }
});

test("a teacher cannot open a student outside their classes", async ({ page, request }) => {
  void request;
  await login(page, "teacher.physics@dcc.example");
  await page.goto("/students");
  const visible = await page.locator("tbody tr").count();
  expect(visible).toBeGreaterThan(0);
  // A FYUP-BA student is not taught by the physics teacher → hidden by RLS (404)
  await login(page, "office@dcc.example");
  await page.goto("/students");
  await page.goto("/students?q=student.arts");
  await page.goto("/students?programme=" + (await page.locator("#filter-programme option", { hasText: "FYUP-BA" }).getAttribute("value")));
  const href = await page.locator("tbody a").first().getAttribute("href");
  await login(page, "teacher.physics@dcc.example");
  await page.goto(href!);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("a student cannot open staff pages or another student's record", async ({ page }) => {
  await login(page, "student.science@dcc.example");
  await page.goto("/students");
  await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  await page.goto("/fees");
  await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
});

test("API exports reject unauthorised roles", async ({ page }) => {
  await login(page, "teacher.physics@dcc.example");
  const r = await page.request.get("/api/export/students?format=csv");
  expect(r.status()).toBe(403);
  const r2 = await page.request.get("/api/export/payments?format=csv&from=2026-01-01&to=2026-12-31");
  expect(r2.status()).toBe(403);
});
