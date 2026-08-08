// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import FileDeleteSection from "@/components/FileDeleteSection";

const labels = {
    deleteFile: "Delete File",
    deleteFileConfirm: "Are you sure you want to delete?",
};

function setup() {
    return render(
        <FileDeleteSection
            lang="en"
            fileId="file-123"
            redirectTo="/en/console/files"
            labels={labels}
        />
    );
}

beforeEach(() => {
    vi.restoreAllMocks();
    // Allow assignment to window.location.href
    Object.defineProperty(window, "location", {
        value: { href: "" },
        writable: true,
        configurable: true,
    });
});

describe("FileDeleteSection", () => {
    it("renders the delete button with the correct label", () => {
        const { getByRole } = setup();
        expect(getByRole("button", { name: labels.deleteFile })).toBeTruthy();
    });

    it("renders the section heading with the label", () => {
        const { container } = setup();
        const heading = container.querySelector("h3");
        expect(heading?.textContent).toBe(labels.deleteFile);
    });

    it("does NOT call fetch when confirm dialog is cancelled", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(false);
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);

        const { getByRole } = setup();
        fireEvent.click(getByRole("button", { name: labels.deleteFile }));

        // Give any async work a chance to run
        await new Promise((r) => setTimeout(r, 0));
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("calls DELETE on the correct console URL when confirmed", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(true);
        const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal("fetch", fetchSpy);

        const { getByRole } = setup();
        fireEvent.click(getByRole("button", { name: labels.deleteFile }));

        await waitFor(() => {
            expect(fetchSpy).toHaveBeenCalledWith(
                "/en/console/files/file-123/actions",
                { method: "DELETE" }
            );
        });
    });

    it("redirects to redirectTo when delete succeeds", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(true);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

        const { getByRole } = setup();
        fireEvent.click(getByRole("button", { name: labels.deleteFile }));

        await waitFor(() => {
            expect(window.location.href).toBe("/en/console/files");
        });
    });

    it("does NOT redirect when delete request fails", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(true);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

        const { getByRole } = setup();
        fireEvent.click(getByRole("button", { name: labels.deleteFile }));

        await new Promise((r) => setTimeout(r, 50));
        expect(window.location.href).toBe("");
    });

    it("shows the confirm message from labels", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
        vi.stubGlobal("fetch", vi.fn());

        const { getByRole } = setup();
        fireEvent.click(getByRole("button", { name: labels.deleteFile }));

        expect(confirmSpy).toHaveBeenCalledWith(labels.deleteFileConfirm);
    });
});
