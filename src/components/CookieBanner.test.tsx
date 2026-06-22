// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/link", () => import("@/components/__mocks__/next").then((m) => ({ default: m.MockLink })));

import CookieBanner from "@/components/CookieBanner";

const CONSENT_KEY = "cookie-consent";

beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    // Clear consent cookie
    document.cookie = `${CONSENT_KEY}=; Max-Age=0; Path=/`;
});

describe("CookieBanner — visibility", () => {
    it("is hidden when 'accepted' is already stored in localStorage", () => {
        localStorage.setItem(CONSENT_KEY, "accepted");
        const { queryByRole } = render(<CookieBanner lang="en" />);
        expect(queryByRole("dialog")).toBeNull();
    });

    it("is hidden when 'declined' is already stored in localStorage", () => {
        localStorage.setItem(CONSENT_KEY, "declined");
        const { queryByRole } = render(<CookieBanner lang="en" />);
        expect(queryByRole("dialog")).toBeNull();
    });

    it("is visible when no consent is stored", async () => {
        const { findByRole } = render(<CookieBanner lang="en" />);
        // useEffect runs after paint; waitFor / findBy accounts for that
        expect(await findByRole("dialog")).toBeTruthy();
    });
});

describe("CookieBanner — accept interaction", () => {
    it("hides the banner after clicking accept", async () => {
        const { findByRole, getByRole, queryByRole } = render(<CookieBanner lang="en" />);
        await findByRole("dialog"); // wait for banner to appear

        // Find the accept button (has "Got it" or equivalent text)
        const buttons = document.querySelectorAll("button");
        const acceptBtn = Array.from(buttons).find(
            (b) => b.textContent && !b.textContent.includes("No")
        )!;
        fireEvent.click(acceptBtn);

        await waitFor(() => {
            expect(queryByRole("dialog")).toBeNull();
        });
    });

    it("saves 'accepted' to localStorage after clicking accept", async () => {
        const { findByRole } = render(<CookieBanner lang="en" />);
        await findByRole("dialog");

        const buttons = document.querySelectorAll("button");
        const acceptBtn = Array.from(buttons).find(
            (b) => b.textContent && !b.textContent.includes("No")
        )!;
        fireEvent.click(acceptBtn);

        await waitFor(() => {
            expect(localStorage.getItem(CONSENT_KEY)).toBe("accepted");
        });
    });
});

describe("CookieBanner — decline interaction", () => {
    it("hides the banner after clicking decline", async () => {
        const { findByRole, queryByRole } = render(<CookieBanner lang="en" />);
        await findByRole("dialog");

        const buttons = document.querySelectorAll("button");
        const declineBtn = Array.from(buttons).find(
            (b) => b.textContent?.includes("No")
        )!;
        fireEvent.click(declineBtn);

        await waitFor(() => {
            expect(queryByRole("dialog")).toBeNull();
        });
    });

    it("saves 'declined' to localStorage after clicking decline", async () => {
        const { findByRole } = render(<CookieBanner lang="en" />);
        await findByRole("dialog");

        const buttons = document.querySelectorAll("button");
        const declineBtn = Array.from(buttons).find(
            (b) => b.textContent?.includes("No")
        )!;
        fireEvent.click(declineBtn);

        await waitFor(() => {
            expect(localStorage.getItem(CONSENT_KEY)).toBe("declined");
        });
    });
});

describe("CookieBanner — content", () => {
    it("contains a link to the privacy policy page", async () => {
        const { findByRole, container } = render(<CookieBanner lang="en" />);
        await findByRole("dialog");
        const link = container.querySelector('a[href="/en/privacy/"]');
        expect(link).toBeTruthy();
    });

    it("renders correctly for Chinese locale", async () => {
        const { findByRole } = render(<CookieBanner lang="zh" />);
        expect(await findByRole("dialog")).toBeTruthy();
    });
});
