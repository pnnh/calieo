import { describe, it, expect } from "vitest";
import { t } from "@/lib/i18n";
import { supportedLanguages } from "@/lib/language";

describe("t (i18n translation function)", () => {
    it("returns the English value for key 'siteName'", () => {
        expect(t("en", "siteName")).toBe("Calieo");
    });

    it("returns a non-empty string for every supported language and 'siteName' key", () => {
        for (const { key } of supportedLanguages) {
            const result = t(key, "siteName");
            expect(typeof result, `lang=${key}`).toBe("string");
            expect(result.length, `lang=${key}`).toBeGreaterThan(0);
        }
    });

    it("returns Chinese translation for zh", () => {
        const result = t("zh", "siteTagline");
        // Should be different from the English value
        expect(result).not.toBe(t("en", "siteTagline"));
        expect(result.length).toBeGreaterThan(0);
    });

    it("returns German translation for de-DE", () => {
        const result = t("de-DE", "siteTagline");
        expect(result).not.toBe(t("en", "siteTagline"));
        expect(result.length).toBeGreaterThan(0);
    });

    it("returns 'homeTitle' for each language as a non-empty string", () => {
        for (const { key } of supportedLanguages) {
            expect(t(key, "homeTitle").length).toBeGreaterThan(0);
        }
    });

    it("returns the English fallback when the key exists only in en", () => {
        // 'siteName' is always 'Calieo' regardless of language (brand name)
        for (const { key } of supportedLanguages) {
            expect(t(key, "siteName")).toBe("Calieo");
        }
    });
});
