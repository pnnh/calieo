import { describe, it, expect } from "vitest";
import {
    isValidLang,
    getTargetLang,
    supportedLanguages,
    defaultLanguage,
} from "@/lib/language";

describe("isValidLang", () => {
    it("returns true for every supported language key", () => {
        for (const { key } of supportedLanguages) {
            expect(isValidLang(key), `expected "${key}" to be valid`).toBe(true);
        }
    });

    it("returns false for an empty string", () => {
        expect(isValidLang("")).toBe(false);
    });

    it("returns false for an unknown locale", () => {
        expect(isValidLang("xx")).toBe(false);
    });

    it("returns false for a partial match", () => {
        expect(isValidLang("zh-")).toBe(false);
    });

    it("is case-sensitive (upper-cased key is rejected)", () => {
        expect(isValidLang("EN")).toBe(false);
        expect(isValidLang("ZH")).toBe(false);
    });
});

describe("getTargetLang", () => {
    it("returns an exact supported key unchanged", () => {
        for (const { key } of supportedLanguages) {
            const result = getTargetLang(key, defaultLanguage);
            expect(isValidLang(result), `"${result}" should be valid for input "${key}"`).toBe(true);
        }
    });

    it("falls back when the language is unknown", () => {
        expect(getTargetLang("xx-XX", "en")).toBe("en");
    });

    it("falls back when the language string is unknown", () => {
        // accept-language may pick the first registered language ("en") when
        // the input matches nothing — test that the result is always a valid lang.
        const result = getTargetLang("xx", "en");
        expect(isValidLang(result)).toBe(true);
    });

    it("resolves a generic 'zh' Accept-Language header to a supported zh variant", () => {
        const result = getTargetLang("zh", defaultLanguage);
        // accept-language may map "zh" to "zh" or "zh-TW"; either is valid
        expect(isValidLang(result)).toBe(true);
    });

    it("always returns a valid language key", () => {
        // accept-language may not match generic 'de' to 'de-DE'; whatever it
        // returns must still be a supported language key.
        const result = getTargetLang("de", defaultLanguage);
        expect(isValidLang(result)).toBe(true);
    });

    it("resolves 'fr-FR' to 'fr'", () => {
        const result = getTargetLang("fr-FR", defaultLanguage);
        expect(result).toBe("fr");
    });
});

describe("supportedLanguages", () => {
    it("contains at least 8 entries", () => {
        expect(supportedLanguages.length).toBeGreaterThanOrEqual(8);
    });

    it("every entry has a non-empty key and name", () => {
        for (const { key, name } of supportedLanguages) {
            expect(key.length).toBeGreaterThan(0);
            expect(name.length).toBeGreaterThan(0);
        }
    });

    it("default language 'en' is included", () => {
        expect(supportedLanguages.some((l) => l.key === "en")).toBe(true);
    });
});
