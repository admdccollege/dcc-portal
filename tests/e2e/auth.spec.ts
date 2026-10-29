import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

test("protected pages redirect to login and return after sign-in", async ({ page }) => {
  await page.goto("/students");
  await expect(page).toHaveURL(/\/login\?next=%2Fstudents/);
  await page.getByLabel("Email").fill("office@dcc.example");
  await page.getByLabel("Password").fill("DccDemo@2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/students$/);
  await expect(page.getByRole("heading", { name: "Student Management" })).toBeVisible();
});

test("wrong password shows a generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("office@dcc.example");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
});

test("open redirects are blocked", async ({ page }) => {
  await page.goto("/login?next=//evil.example.com");
  await page.getByLabel("Email").fill("principal@dcc.example");
  await page.getByLabel("Password").fill("DccDemo@2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/localhost:3000\/dashboard/);
});

test("each role lands on its home and can sign out", async ({ page }) => {
  await login(page, "student.science@dcc.example");
  await expect(page).toHaveURL(/\/my$/);
  await expect(page.getByRole("link", { name: "My Results" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fees & Payments" })).toHaveCount(0);
  await logout(page);
  await login(page, "teacher.physics@dcc.example");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("link", { name: "Attendance", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Users & Permissions" })).toHaveCount(0);
});
