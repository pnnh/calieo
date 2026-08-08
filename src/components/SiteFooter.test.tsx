// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/link", () => import("@/components/__mocks__/next").then((m) => ({ default: m.MockLink })));

import SiteFooter from "@/components/SiteFooter";

describe("SiteFooter", () => {
    it("renders English footer snapshot", () => {
        const { container } = render(<SiteFooter lang="en" />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders Chinese footer snapshot", () => {
        const { container } = render(<SiteFooter lang="zh" />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders German footer snapshot", () => {
        const { container } = render(<SiteFooter lang="de-DE" />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("contains site name text", () => {
        const { container } = render(<SiteFooter lang="en" />);
        expect(container.textContent).toContain("Calieo");
    });

    it("contains a privacy policy link for the current lang", () => {
        const { container } = render(<SiteFooter lang="fr" />);
        const link = container.querySelector('a[href="/fr/privacy/"]');
        expect(link).not.toBeNull();
    });

    it("includes the current year in the copyright notice", () => {
        const { container } = render(<SiteFooter lang="en" />);
        expect(container.textContent).toContain(String(new Date().getFullYear()));
    });
});
