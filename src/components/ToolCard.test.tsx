// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import type { ToolData } from "@/data/tools";

vi.mock("next/link", () => import("@/components/__mocks__/next").then((m) => ({ default: m.MockLink })));
vi.mock("next/image", () => import("@/components/__mocks__/next").then((m) => ({ default: m.MockImage })));

import ToolCard from "@/components/ToolCard";
import ToolGrid from "@/components/ToolGrid";

const TOOL_FIXTURE: ToolData = {
    id: "basex",
    url: "https://basex.calieo.xyz",
    logo: "/images/basex/logo.png",
    tags: ["encoding", "base64", "base58"],
    name: {
        en: "BaseX",
        es: "BaseX",
        fr: "BaseX",
        "de-DE": "BaseX",
        "pt-PT": "BaseX",
        ja: "BaseX",
        zh: "BaseX",
        "zh-TW": "BaseX",
    },
    description: {
        en: "Base encoding & decoding toolkit.",
        es: "Kit de codificación Base.",
        fr: "Boîte à outils d'encodage Base.",
        "de-DE": "Base-Kodierungswerkzeug.",
        "pt-PT": "Kit de codificação Base.",
        ja: "Baseエンコードツール。",
        zh: "Base 编解码工具集。",
        "zh-TW": "Base 編解碼工具集。",
    },
    features: {
        en: ["Base64", "Base32"],
        es: ["Base64", "Base32"],
        fr: ["Base64", "Base32"],
        "de-DE": ["Base64", "Base32"],
        "pt-PT": ["Base64", "Base32"],
        ja: ["Base64", "Base32"],
        zh: ["Base64", "Base32"],
        "zh-TW": ["Base64", "Base32"],
    },
    detail: {
        en: "Details about BaseX.",
        es: "Detalles sobre BaseX.",
        fr: "Détails sur BaseX.",
        "de-DE": "Details zu BaseX.",
        "pt-PT": "Detalhes sobre BaseX.",
        ja: "BaseXの詳細。",
        zh: "关于 BaseX 的详情。",
        "zh-TW": "關於 BaseX 的詳情。",
    },
};

const TOOL_FIXTURE_2: ToolData = {
    ...TOOL_FIXTURE,
    id: "hashx",
    url: "https://hashx.calieo.xyz",
    logo: "/images/hashx/logo.png",
    tags: ["hash", "md5", "sha256"],
    name: { ...TOOL_FIXTURE.name, en: "HashX" },
    description: { ...TOOL_FIXTURE.description, en: "Hashing toolkit." },
};

describe("ToolCard", () => {
    it("renders English card snapshot", () => {
        const { container } = render(<ToolCard tool={TOOL_FIXTURE} lang="en" />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders Chinese card snapshot", () => {
        const { container } = render(<ToolCard tool={TOOL_FIXTURE} lang="zh" />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("links to the correct detail URL", () => {
        const { container } = render(<ToolCard tool={TOOL_FIXTURE} lang="en" />);
        const links = container.querySelectorAll('a[href="/en/tools/basex/"]');
        expect(links.length).toBeGreaterThan(0);
    });

    it("renders the tool logo img", () => {
        const { container } = render(<ToolCard tool={TOOL_FIXTURE} lang="en" />);
        const img = container.querySelector("img");
        expect(img?.getAttribute("src")).toBe("/images/basex/logo.png");
    });

    it("renders all provided tags (up to 3)", () => {
        const { container } = render(<ToolCard tool={TOOL_FIXTURE} lang="en" />);
        const tagSpans = container.querySelectorAll("span");
        const tagTexts = Array.from(tagSpans).map((s) => s.textContent);
        expect(tagTexts).toContain("encoding");
        expect(tagTexts).toContain("base64");
        expect(tagTexts).toContain("base58");
    });

    it("links the launch button to tool.url", () => {
        const { container } = render(<ToolCard tool={TOOL_FIXTURE} lang="en" />);
        const launchLink = container.querySelector('a[href="https://basex.calieo.xyz"]');
        expect(launchLink).not.toBeNull();
        expect(launchLink?.getAttribute("target")).toBe("_blank");
        expect(launchLink?.getAttribute("rel")).toBe("noopener noreferrer");
    });
});

describe("ToolGrid", () => {
    it("renders an empty grid snapshot", () => {
        const { container } = render(<ToolGrid tools={[]} lang="en" />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders a single-tool grid snapshot", () => {
        const { container } = render(<ToolGrid tools={[TOOL_FIXTURE]} lang="en" />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders a two-tool grid snapshot", () => {
        const { container } = render(
            <ToolGrid tools={[TOOL_FIXTURE, TOOL_FIXTURE_2]} lang="en" />
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders one ToolCard per tool", () => {
        const { container } = render(
            <ToolGrid tools={[TOOL_FIXTURE, TOOL_FIXTURE_2]} lang="en" />
        );
        // Each card has an external launch link
        const launchLinks = container.querySelectorAll('a[target="_blank"]');
        expect(launchLinks.length).toBe(2);
    });
});
