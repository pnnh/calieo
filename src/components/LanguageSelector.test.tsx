// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

const mockPush = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
}));

import LanguageSelector from "@/components/LanguageSelector";
import { supportedLanguages } from "@/lib/language";

beforeEach(() => {
    mockPush.mockReset();
});

describe("LanguageSelector", () => {
    it("renders a <select> element", () => {
        const { container } = render(<LanguageSelector currentLang="en" />);
        expect(container.querySelector("select")).toBeTruthy();
    });

    it("renders an <option> for every supported language", () => {
        const { container } = render(<LanguageSelector currentLang="en" />);
        const options = container.querySelectorAll("option");
        expect(options.length).toBe(supportedLanguages.length);
    });

    it("has the current language pre-selected", () => {
        const { container } = render(<LanguageSelector currentLang="zh" />);
        const select = container.querySelector("select") as HTMLSelectElement;
        expect(select.value).toBe("zh");
    });

    it("each option value matches the supported language key", () => {
        const { container } = render(<LanguageSelector currentLang="en" />);
        const options = Array.from(container.querySelectorAll("option"));
        const optionValues = options.map((o) => o.getAttribute("value"));
        const supportedKeys = supportedLanguages.map((l) => l.key);
        expect(optionValues.sort()).toEqual(supportedKeys.sort());
    });

    it("each option label is the human-readable language name", () => {
        const { container } = render(<LanguageSelector currentLang="en" />);
        const options = Array.from(container.querySelectorAll("option"));
        for (const { key, name } of supportedLanguages) {
            const opt = options.find((o) => o.getAttribute("value") === key);
            expect(opt?.textContent).toBe(name);
        }
    });

    it("calls router.push with the correct path when selection changes", () => {
        const { container } = render(<LanguageSelector currentLang="en" />);
        const select = container.querySelector("select")!;
        fireEvent.change(select, { target: { value: "fr" } });
        expect(mockPush).toHaveBeenCalledWith("/fr/");
    });

    it("appends pathSuffix to the pushed URL", () => {
        const { container } = render(
            <LanguageSelector currentLang="en" pathSuffix="tools/basex/" />
        );
        const select = container.querySelector("select")!;
        fireEvent.change(select, { target: { value: "ja" } });
        expect(mockPush).toHaveBeenCalledWith("/ja/tools/basex/");
    });

    it("uses an empty pathSuffix by default (results in trailing slash)", () => {
        const { container } = render(<LanguageSelector currentLang="en" />);
        const select = container.querySelector("select")!;
        fireEvent.change(select, { target: { value: "de-DE" } });
        expect(mockPush).toHaveBeenCalledWith("/de-DE/");
    });

    it("calls router.push exactly once per change event", () => {
        const { container } = render(<LanguageSelector currentLang="en" />);
        fireEvent.change(container.querySelector("select")!, { target: { value: "es" } });
        expect(mockPush).toHaveBeenCalledTimes(1);
    });
});
