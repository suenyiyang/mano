import { expect, test } from "@playwright/test";
import { setupAuthenticated } from "./helpers.js";

test.describe("Settings page (/app/settings)", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticated(page);
  });

  test("renders settings page with tabs", async ({ page }) => {
    await page.goto("/app/settings");

    await expect(page.getByRole("main").getByText("Settings")).toBeVisible();
    await expect(page.getByRole("button", { name: "Skills" })).toBeVisible();
    await expect(page.getByRole("button", { name: "MCP Servers" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Model Tiers" })).toBeVisible();
  });

  test("shows skills tab by default with add button", async ({ page }) => {
    await page.route("**/api/skills/list", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: [] }),
      }),
    );

    await page.goto("/app/settings");

    await expect(page.getByText("No skills configured yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Skill" })).toBeVisible();
  });

  test("renders existing skills", async ({ page }) => {
    await page.route("**/api/skills/list", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          skills: [
            {
              id: "sk1",
              userId: "user-1",
              name: "code-review",
              displayName: "Code Review",
              description: "Automated code review assistant",
              content: "Review the code",
              resources: [],
              scripts: [],
              isEnabled: true,
              createdAt: "2025-01-01T00:00:00Z",
              updatedAt: "2025-01-01T00:00:00Z",
            },
          ],
        }),
      }),
    );

    await page.goto("/app/settings");

    await expect(page.getByText("Code Review", { exact: true })).toBeVisible();
    await expect(page.getByText("code-review")).toBeVisible();
    await expect(page.getByText("Automated code review assistant")).toBeVisible();
  });

  test("opens create skill dialog", async ({ page }) => {
    await page.route("**/api/skills/list", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: [] }),
      }),
    );

    await page.goto("/app/settings");
    await page.getByRole("button", { name: "Add Skill" }).click();

    await expect(page.getByText("Create Skill")).toBeVisible();
    await expect(page.getByPlaceholder("Name (kebab-case)")).toBeVisible();
    await expect(page.getByPlaceholder("Display Name")).toBeVisible();
    await expect(page.getByPlaceholder("Skill content / prompt")).toBeVisible();
  });

  test("switches to MCP Servers tab", async ({ page }) => {
    await page.route("**/api/skills/list", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: [] }),
      }),
    );
    await page.route("**/api/mcp-servers/list", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ mcpServers: [] }),
      }),
    );

    await page.goto("/app/settings");
    await page.getByRole("button", { name: "MCP Servers" }).click();

    await expect(page.getByText("No MCP servers configured yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Server" })).toBeVisible();
  });

  test("renders existing MCP servers", async ({ page }) => {
    await page.route("**/api/skills/list", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: [] }),
      }),
    );
    await page.route("**/api/mcp-servers/list", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mcpServers: [
            {
              id: "mcp1",
              userId: "user-1",
              name: "filesystem",
              transport: "stdio",
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-filesystem"],
              url: null,
              env: {},
              isEnabled: true,
              createdAt: "2025-01-01T00:00:00Z",
              updatedAt: "2025-01-01T00:00:00Z",
            },
          ],
        }),
      }),
    );

    await page.goto("/app/settings");
    await page.getByRole("button", { name: "MCP Servers" }).click();

    await expect(page.getByText("filesystem")).toBeVisible();
    await expect(page.getByText("stdio")).toBeVisible();
    await expect(page.getByText("npx")).toBeVisible();
  });

  test("switches to Model Tiers tab", async ({ page }) => {
    await page.route("**/api/skills/list", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ skills: [] }),
      }),
    );
    await page.route("**/api/models/tiers", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tiers: [
            {
              tier: "pro",
              models: [
                {
                  provider: "openai",
                  apiModelId: "gpt-4o",
                  displayName: "GPT-4o",
                },
              ],
              rateLimit: {
                requestsPerMinute: 30,
                requestsPerDay: 1000,
                tokensPerDay: 500000,
              },
            },
          ],
        }),
      }),
    );

    await page.goto("/app/settings");
    await page.getByRole("button", { name: "Model Tiers" }).click();

    await expect(page.getByText("pro")).toBeVisible();
    await expect(page.getByText("GPT-4o", { exact: true })).toBeVisible();
    await expect(page.getByText("openai")).toBeVisible();
    await expect(page.getByText("30 req/min")).toBeVisible();
  });
});
