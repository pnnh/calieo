import { describe, expect, it } from "vitest";
import { buildPageWindow, DEFAULT_PAGE_SIZE, parsePage, parsePageSize, PAGE_SIZE_OPTIONS } from "./pagination";

describe("console files pagination helpers", () => {
    it("defaults to page 1 and the default page size", () => {
        expect(parsePage(null)).toBe(1);
        expect(parsePage(undefined)).toBe(1);
        expect(parsePage("abc")).toBe(1);
        expect(parsePageSize(null)).toBe(DEFAULT_PAGE_SIZE);
        expect(parsePageSize("abc")).toBe(DEFAULT_PAGE_SIZE);
    });

    it("accepts only supported page sizes", () => {
        for (const size of PAGE_SIZE_OPTIONS) {
            expect(parsePageSize(String(size))).toBe(size);
        }
        expect(parsePageSize("999")).toBe(DEFAULT_PAGE_SIZE);
    });

    it("builds a compact pagination window with ellipses", () => {
        expect(buildPageWindow(1, 1)).toEqual([1]);
        expect(buildPageWindow(1, 5)).toEqual([1, 2, "ellipsis", 5]);
        expect(buildPageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
        expect(buildPageWindow(10, 20)).toEqual([1, "ellipsis", 9, 10, 11, "ellipsis", 20]);
    });
});