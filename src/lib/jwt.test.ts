import { describe, it, expect } from "vitest";
import { parseJwtPayload } from "@/lib/jwt";

// Helper: build a compact JWT with a given payload object
function makeJwt(payload: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const body = btoa(JSON.stringify(payload))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${header}.${body}.fakesig`;
}

describe("parseJwtPayload", () => {
    it("returns null for a plain string (not 3 parts)", () => {
        expect(parseJwtPayload("notajwt")).toBeNull();
    });

    it("returns null for a 2-part token", () => {
        expect(parseJwtPayload("a.b")).toBeNull();
    });

    it("returns null for a 4-part token", () => {
        expect(parseJwtPayload("a.b.c.d")).toBeNull();
    });

    it("returns null when the payload part is invalid base64", () => {
        expect(parseJwtPayload("header.!!!invalid!!.sig")).toBeNull();
    });

    it("returns null when the payload decodes to non-JSON", () => {
        const bad = btoa("not json").replace(/=/g, "");
        expect(parseJwtPayload(`h.${bad}.s`)).toBeNull();
    });

    it("parses a standard CF Access JWT payload", () => {
        const payload = {
            sub: "user-abc-123",
            email: "test@example.com",
            name: "Test User",
            iat: 1700000000,
            exp: 1700086400,
        };
        const result = parseJwtPayload(makeJwt(payload));
        expect(result).not.toBeNull();
        expect(result!.sub).toBe("user-abc-123");
        expect(result!.email).toBe("test@example.com");
        expect(result!.name).toBe("Test User");
        expect(result!.iat).toBe(1700000000);
        expect(result!.exp).toBe(1700086400);
    });

    it("parses groups array", () => {
        const result = parseJwtPayload(makeJwt({ groups: ["admin", "editor"] }));
        expect(result!.groups).toEqual(["admin", "editor"]);
    });

    it("parses aud as a string", () => {
        const result = parseJwtPayload(makeJwt({ aud: "my-app-id" }));
        expect(result!.aud).toBe("my-app-id");
    });

    it("parses aud as an array", () => {
        const result = parseJwtPayload(makeJwt({ aud: ["app1", "app2"] }));
        expect(result!.aud).toEqual(["app1", "app2"]);
    });

    it("handles base64url padding variants (no trailing =)", () => {
        // Ensure the padding logic handles payloads of different lengths
        for (const extra of ["", "x", "xy", "xyz"]) {
            const payload = { note: extra };
            const result = parseJwtPayload(makeJwt(payload));
            expect(result).not.toBeNull();
            expect(result!.note).toBe(extra);
        }
    });

    it("preserves unknown extra claims via index signature", () => {
        const result = parseJwtPayload(makeJwt({ custom_claim: "hello" }));
        expect(result!["custom_claim"]).toBe("hello");
    });

    it("returns an empty object payload without error", () => {
        const result = parseJwtPayload(makeJwt({}));
        expect(result).toEqual({});
    });
});
