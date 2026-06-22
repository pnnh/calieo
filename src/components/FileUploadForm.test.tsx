// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import FileUploadForm from "@/components/FileUploadForm";

const labels = {
    newFile: "Upload File",
    fileTooLarge: "File is too large (max 50 MB).",
    uploadError: "Upload failed. Please try again.",
};

function setup() {
    return render(<FileUploadForm lang="en" labels={labels} />);
}

/** Attach a File object to the hidden file input so the component can read it. */
function attachFile(container: HTMLElement, file: File) {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
        value: { 0: file, length: 1, item: (i: number) => (i === 0 ? file : null) },
        configurable: true,
    });
}

beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
        value: { href: "" },
        writable: true,
        configurable: true,
    });
});

describe("FileUploadForm", () => {
    it("renders a file input and a submit button", () => {
        const { container, getByRole } = setup();
        expect(container.querySelector('input[type="file"]')).toBeTruthy();
        expect(getByRole("button", { name: labels.newFile })).toBeTruthy();
    });

    it("submit button is enabled initially", () => {
        const { getByRole } = setup();
        const btn = getByRole("button", { name: labels.newFile }) as HTMLButtonElement;
        expect(btn.disabled).toBe(false);
    });

    it("shows no error message initially", () => {
        const { container } = setup();
        expect(container.querySelector(".text-red-700")).toBeNull();
    });

    it("does NOT call fetch when no file is selected", async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);

        const { container } = setup();
        fireEvent.submit(container.querySelector("form")!);

        await new Promise((r) => setTimeout(r, 0));
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("shows fileTooLarge error and does NOT fetch for an oversized file", async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);

        const { container, findByText } = setup();

        const largeFile = new File(["x"], "large.bin", { type: "application/octet-stream" });
        Object.defineProperty(largeFile, "size", { value: 51 * 1024 * 1024, configurable: true });
        attachFile(container, largeFile);

        fireEvent.submit(container.querySelector("form")!);

        expect(await findByText(labels.fileTooLarge)).toBeTruthy();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("calls POST /[lang]/console/upload with FormData when a valid file is selected", async () => {
        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ id: "new-id-42" }),
        });
        vi.stubGlobal("fetch", fetchSpy);

        const { container } = setup();
        attachFile(container, new File(["hello"], "hello.txt", { type: "text/plain" }));
        fireEvent.submit(container.querySelector("form")!);

        await waitFor(() => {
            expect(fetchSpy).toHaveBeenCalledWith(
                "/en/console/upload",
                expect.objectContaining({ method: "POST" })
            );
        });
    });

    it("redirects to the new file page when upload succeeds", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ id: "new-id-42" }),
            })
        );

        const { container } = setup();
        attachFile(container, new File(["hello"], "hello.txt"));
        fireEvent.submit(container.querySelector("form")!);

        await waitFor(() => {
            expect(window.location.href).toBe("/en/console/files/new-id-42");
        });
    });

    it("shows error from server response when upload fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({ error: "Disk quota exceeded" }),
            })
        );

        const { container, findByText } = setup();
        attachFile(container, new File(["hi"], "hi.txt"));
        fireEvent.submit(container.querySelector("form")!);

        expect(await findByText("Disk quota exceeded")).toBeTruthy();
        expect(window.location.href).toBe("");
    });

    it("shows generic uploadError when server response has no error field", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({}),
            })
        );

        const { container, findByText } = setup();
        attachFile(container, new File(["hi"], "hi.txt"));
        fireEvent.submit(container.querySelector("form")!);

        expect(await findByText(labels.uploadError)).toBeTruthy();
    });

    it("shows generic uploadError when fetch throws a network error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

        const { container, findByText } = setup();
        attachFile(container, new File(["hi"], "hi.txt"));
        fireEvent.submit(container.querySelector("form")!);

        expect(await findByText(labels.uploadError)).toBeTruthy();
    });

    it("disables the submit button and shows '…' while uploading", async () => {
        // Hang fetch indefinitely so we can inspect intermediate state
        let resolveFetch!: (v: unknown) => void;
        vi.stubGlobal(
            "fetch",
            vi.fn().mockReturnValue(new Promise((r) => { resolveFetch = r; }))
        );

        const { container, getByRole } = setup();
        attachFile(container, new File(["hi"], "hi.txt"));
        fireEvent.submit(container.querySelector("form")!);

        await waitFor(() => {
            const btn = getByRole("button") as HTMLButtonElement;
            expect(btn.disabled).toBe(true);
            expect(btn.textContent).toBe("…");
        });

        // Resolve to avoid test teardown warnings
        resolveFetch({ ok: false, json: () => Promise.resolve({}) });
    });

    it("re-enables the submit button after upload completes", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({ error: "err" }),
            })
        );

        const { container, getByRole } = setup();
        attachFile(container, new File(["hi"], "hi.txt"));
        fireEvent.submit(container.querySelector("form")!);

        await waitFor(() => {
            const btn = getByRole("button") as HTMLButtonElement;
            expect(btn.disabled).toBe(false);
        });
    });
});
