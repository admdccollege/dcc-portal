import { expect, test } from "@playwright/test";
import { expectToast, login } from "./helpers";

test.describe.configure({ mode: "serial" });

test("office creates a student with an auto-generated admission number", async ({ page }) => {
  await login(page, "office@dcc.example");
  await page.goto("/students/new");
  const name = `E2E Student ${Date.now().toString().slice(-5)}`;
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Date of birth").fill("2009-05-14");
  await page.getByLabel("Guardian name").fill("E2E Guardian");
  await page.getByLabel("Programme").selectOption({ label: "HS-ARTS — Higher Secondary (Arts)" });
  await page.getByLabel("Class / semester").selectOption({ label: "Class XI" });
  await page.getByRole("button", { name: "Create student" }).click();
  await expectToast(page, "Student record created");
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText(/DCC\/\d{4}\/\d{4}/).first()).toBeVisible();
});

test("form validation blocks invalid input", async ({ page }) => {
  await login(page, "office@dcc.example");
  await page.goto("/students/new");
  await page.getByRole("button", { name: "Create student" }).click();
  await expect(page.getByText("Name is required")).toBeVisible();
});

test("teacher records attendance for an assigned subject", async ({ page }) => {
  await login(page, "teacher.physics@dcc.example");
  await page.goto("/attendance");
  await page.getByLabel("Class").selectOption({ label: "HS-SCI · Class XI" });
  await page.getByLabel("Subject").selectOption({ label: "HS-PHY — Physics" });
  await page.getByLabel("Period").fill("5");
  await page.getByRole("button", { name: "Mark all present" }).click();
  await page.getByRole("radiogroup").first().getByRole("radio", { name: "A", exact: true }).click();
  await page.getByRole("button", { name: /Save attendance|Update attendance/ }).click();
  await expectToast(page, /Attendance saved/);
});

test("accountant records a payment and opens the receipt", async ({ page }) => {
  await login(page, "accounts@dcc.example");
  await page.goto("/fees?due=outstanding");
  await page.getByRole("button", { name: "Record payment" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (₹)").fill("250");
  await dialog.getByLabel("Method").selectOption("cash");
  await dialog.getByRole("button", { name: "Confirm payment" }).click();
  await expect(dialog.getByText("Payment recorded")).toBeVisible();
  const href = await dialog.getByRole("link", { name: "Print receipt" }).getAttribute("href");
  const pdf = await page.request.get(href!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
});

test("overpayment is prevented in the payment form", async ({ page }) => {
  await login(page, "accounts@dcc.example");
  await page.goto("/fees?due=outstanding");
  await page.getByRole("button", { name: "Record payment" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (₹)").fill("99999999");
  await expect(dialog.getByText(/exceeds the outstanding balance/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Confirm payment" })).toBeDisabled();
});

test("examination lifecycle: marks entry → lock → process → approve → publish → student view → verify", async ({ page }) => {
  // 1. Exam controller creates an exam for MSC-CHEM Semester 1 with all subjects
  await login(page, "exams@dcc.example");
  await page.goto("/examinations");
  await page.getByRole("button", { name: "New examination" }).click();
  const d = page.getByRole("dialog");
  const examName = `E2E Test ${Date.now().toString().slice(-5)}`;
  await d.getByLabel("Programme").selectOption({ label: "MSC-CHEM — Master of Science (Chemistry)" });
  await d.getByLabel("Class / semester").selectOption({ label: "Semester 1" });
  await d.getByLabel("Examination name").fill(examName);
  await d.getByLabel("Type").selectOption({ label: "Internal Assessment" });
  await d.getByLabel("Grading scheme").selectOption({ label: "Sample — PG semester (verify with university)" });
  await d.getByRole("button", { name: "Create" }).click();
  await expectToast(page, "Examination created");
  await page.getByRole("link", { name: examName }).click();

  await page.getByRole("button", { name: "Add all subjects" }).click();
  const d2 = page.getByRole("dialog");
  await d2.getByLabel("Maximum marks").fill("50");
  await d2.getByLabel("Pass marks").fill("20");
  await d2.getByRole("button", { name: "Create" }).click();
  await expectToast(page, "Subjects added");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByRole("button", { name: "Open marks entry" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expectToast(page, "Marks entry opened");

  // 2. Enter marks for every subject (first candidate absent in the first subject)
  await expect(page.getByRole("link", { name: "Enter marks" })).toHaveCount(3);
  const count = 3;
  for (let i = 0; i < count; i++) {
    await page.getByRole("link", { name: "Enter marks" }).nth(i).click();
    const inputs = page.getByRole("textbox", { name: /Marks for/ });
    await expect(inputs.first()).toBeEditable();
    const n = await inputs.count();
    for (let k = 0; k < n; k++) await inputs.nth(k).fill(String(25 + ((k * 7 + i) % 25)));
    if (i === 0) await page.getByRole("combobox", { name: /Status for/ }).first().selectOption("absent");
    await page.getByRole("button", { name: /Save \d+ change/ }).click();
    await expectToast(page, /mark\(s\) saved/);
    await page.getByRole("link", { name: examName }).click();
    await expect(page.getByRole("link", { name: "Enter marks" })).toHaveCount(3);
  }
  await expect(page.getByText("Missing marks").locator("..").getByText("0", { exact: true })).toBeVisible();

  // 3. Lock and process
  await page.getByRole("button", { name: "Lock marks" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expectToast(page, "Marks locked");
  await page.getByRole("button", { name: "Process results" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByText("Draft results")).toBeVisible();
  const resultsUrl = page.url();

  // 4. Principal approves
  await login(page, "principal@dcc.example");
  await page.goto(resultsUrl);
  await page.getByRole("button", { name: "Approve results" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expectToast(page, "Results approved");

  // 5. Exam controller publishes
  await login(page, "exams@dcc.example");
  await page.goto(resultsUrl);
  await page.getByRole("button", { name: "Publish results" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
  await expectToast(page, "Results published");
  const marksheetHref = await page.getByRole("link", { name: "Marksheet" }).first().getAttribute("href");
  const pdf = await page.request.get(marksheetHref!);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");

  // 6. Verification page confirms a published code
  const xlsx = await page.request.get(resultsUrl.replace("/results/", "/api/export/results/") + "?format=csv");
  const code = (await xlsx.text()).trim().split("\n")[1].split(",").pop()!.trim();
  await page.goto(`/verify/${code}`);
  await expect(page.getByRole("heading", { name: "Authentic statement of marks" })).toBeVisible();
  await page.goto("/verify/NOTAREALCODE1");
  await expect(page.getByRole("heading", { name: "No matching published result" })).toBeVisible();
});

test("a student sees only published results", async ({ page }) => {
  await login(page, "student.science@dcc.example");
  await page.goto("/my/results");
  await expect(page.getByText("Unit Test I")).toBeVisible();
  await expect(page.getByText("Internal Assessment I")).toHaveCount(0);
});
