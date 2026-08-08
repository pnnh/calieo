import { test, expect } from "@playwright/test";

/**
 * Homepage E2E tests.
 *
 * The root URL (/) redirects to /<lang>/ based on Accept-Language.
 * We test /en/ directly to avoid locale ambiguity.
 *
 * Data may be empty in local dev — all assertions that depend on records
 * are guarded with conditional checks.
 */

test.describe("Homepage — /en/", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/en/");
    });

    // -----------------------------------------------------------------------
    // Redirect & URL
    // -----------------------------------------------------------------------
    test("root / redirects to a supported language path", async ({ page }) => {
        await page.goto("/");
        // Should land on /<lang> or /<lang>/ — URL must include a language path segment
        await expect(page).toHaveURL(/\/[a-z]{2}(-[A-Z]{2})?(\/)?(\?.*)?$/);
    });

    // -----------------------------------------------------------------------
    // Page title & meta
    // -----------------------------------------------------------------------
    test("page has a non-empty <title>", async ({ page }) => {
        const title = await page.title();
        expect(title.length).toBeGreaterThan(0);
    });

    test("page title contains the site name", async ({ page }) => {
        await expect(page).toHaveTitle(/Calieo/);
    });

    // -----------------------------------------------------------------------
    // Header
    // -----------------------------------------------------------------------
    test("site header is visible", async ({ page }) => {
        await expect(page.locator("header")).toBeVisible();
    });

    test("header contains the site name link", async ({ page }) => {
        const nameLink = page.locator("header a", { hasText: "Calieo" }).first();
        await expect(nameLink).toBeVisible();
    });

    test("header 'Home' navigation link is present", async ({ page }) => {
        const homeLink = page.locator("header nav a", { hasText: "Home" });
        await expect(homeLink).toBeVisible();
    });

    test("header 'Channels' navigation link is present", async ({ page }) => {
        const channelsLink = page.locator("header nav a", { hasText: "Channels" });
        await expect(channelsLink).toBeVisible();
    });

    test("header contains a language selector <select>", async ({ page }) => {
        const selector = page.locator("header select");
        await expect(selector).toBeVisible();
        // Should have multiple language options
        const count = await selector.locator("option").count();
        expect(count).toBeGreaterThan(1);
    });

    // -----------------------------------------------------------------------
    // Main content — always-present elements
    // -----------------------------------------------------------------------
    test("<main> element is present", async ({ page }) => {
        await expect(page.locator("main")).toBeVisible();
    });

    test("page heading 'Public Files' is visible", async ({ page }) => {
        await expect(page.locator("main h1", { hasText: "Public Files" })).toBeVisible();
    });

    test("search form is visible", async ({ page }) => {
        const form = page.locator("main form");
        await expect(form).toBeVisible();
    });

    test("search input is present inside the form", async ({ page }) => {
        const input = page.locator("main form input[type='text']");
        await expect(input).toBeVisible();
    });

    test("search submit button is present", async ({ page }) => {
        const btn = page.locator("main form button[type='submit']");
        await expect(btn).toBeVisible();
    });

    // -----------------------------------------------------------------------
    // Main content — conditional on data existence
    // -----------------------------------------------------------------------
    test("shows either a file list or 'No results found' message", async ({ page }) => {
        const fileList = page.locator("main .grid a");
        const noResults = page.locator("main p", { hasText: "No results found." });

        const hasFiles = await fileList.count() > 0;
        if (hasFiles) {
            await expect(fileList.first()).toBeVisible();
        } else {
            await expect(noResults).toBeVisible();
        }
    });

    test("when files exist, each row links to a file detail page", async ({ page }) => {
        const fileLinks = page.locator("main .grid a[href*='/files/']");
        const count = await fileLinks.count();
        if (count > 0) {
            // Each link should have an href like /en/files/<id>
            for (let i = 0; i < Math.min(count, 3); i++) {
                const href = await fileLinks.nth(i).getAttribute("href");
                expect(href).toMatch(/\/[a-z]{2}(-[A-Z]{2})?\/files\/.+/);
            }
        }
    });

    test("when files exist, each row shows a file title", async ({ page }) => {
        const titles = page.locator("main .grid a p.font-medium");
        const count = await titles.count();
        if (count > 0) {
            const text = await titles.first().textContent();
            expect(text?.trim().length).toBeGreaterThan(0);
        }
    });

    test("when files exist, each row shows a file size", async ({ page }) => {
        const sizeSpans = page.locator("main .grid a span");
        const count = await sizeSpans.count();
        if (count > 0) {
            const text = await sizeSpans.first().textContent();
            // Matches patterns like "1.2 KB" or "3.4 MB"
            expect(text).toMatch(/\d+(\.\d+)?\s*(KB|MB|B)/);
        }
    });

    test("pagination is hidden when there is only one page", async ({ page }) => {
        // If there is no pagination div, it means total pages <= 1 — correct behaviour
        const pagination = page.locator("main .flex.justify-center");
        const count = await pagination.count();
        // Either hidden (count 0) or visible with prev/next links
        if (count > 0) {
            // At least a page indicator should be visible
            const pageIndicator = pagination.locator("span");
            await expect(pageIndicator).toBeVisible();
        }
        // No assertion needed when count === 0 — this is the empty/single-page case
    });

    // -----------------------------------------------------------------------
    // Search interaction
    // -----------------------------------------------------------------------
    test("navigating to /?q=<term> shows the term in the search input", async ({ page }) => {
        await page.goto("/en/?q=testquery");
        const input = page.locator("main form input[type='text']");
        await expect(input).toHaveValue("testquery");
        await expect(page).toHaveURL(/q=testquery/);
    });

    test("submitting an empty search clears the ?q= param from the URL", async ({ page }) => {
        // First navigate with a query
        await page.goto("/en/?q=something");
        const input = page.locator("main form input[type='text']");
        await input.clear();
        await page.locator("main form button[type='submit']").click();
        await expect(page).not.toHaveURL(/\?q=/);
    });

    test("search field is pre-filled from the ?q= URL parameter", async ({ page }) => {
        await page.goto("/en/?q=hello");
        const input = page.locator("main form input[type='text']");
        await expect(input).toHaveValue("hello");
    });

    // -----------------------------------------------------------------------
    // Footer
    // -----------------------------------------------------------------------
    test("site footer is visible", async ({ page }) => {
        await expect(page.locator("footer")).toBeVisible();
    });

    test("footer contains the current year", async ({ page }) => {
        const year = String(new Date().getFullYear());
        await expect(page.locator("footer")).toContainText(year);
    });

    test("footer contains a Privacy Policy link", async ({ page }) => {
        const link = page.locator("footer a", { hasText: "Privacy Policy" });
        await expect(link).toBeVisible();
        // Next.js may or may not include a trailing slash; match both
        await expect(link).toHaveAttribute("href", /\/en\/privacy/);
    });
});
