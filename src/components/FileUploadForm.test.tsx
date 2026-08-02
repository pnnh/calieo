// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import FileUploadForm from "@/components/FileUploadForm";

const labels = {
    newFile: "Upload File",
    fileTooLarge: "File is too large (max 20 MB).",
    uploadError: "Upload failed. Please try again.",
    maxFilesExceeded: "Too many files selected (max 20 per upload).",
    batchTooLarge: "Total selected file size exceeds 300 MB.",
    uploadResultCreated: "Uploaded",
    uploadResultRenamed: "Uploaded (renamed)",
    uploadResultFailed: "Failed",
};

function setup(parentId?: string | null) {
    return render(<FileUploadForm lang="en" parentId={parentId} labels={labels} />);
}

/** Attach File objects to the hidden file input so the component can read them. */
function attachFiles(container: HTMLElement, files: File[]) {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
        value: {
            ...files,
            length: files.length,
            item: (i: number) => files[i] ?? null,
        },
        configurable: true,
    });
}

function makeFile(name: string, sizeBytes: number, type = "application/octet-stream"): File {
    const file = new File(["x"], name, { type });
    Object.defineProperty(file, "size", { value: sizeBytes, configurable: true });
    return file;
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
    it("renders a file input that accepts multiple files and a submit button", () => {
        const { container, getByRole } = setup();
        const input = container.querySelector<HTMLInputElement>('input[type="file"]');
        expect(input).toBeTruthy();
        expect(input!.multiple).toBe(true);
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

    it("shows maxFilesExceeded error and does NOT fetch when more than 20 files are selected", async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);

        const { container, findByText } = setup();
        const many = Array.from({ length: 21 }, (_, i) => makeFile(`f${i}.txt`, 100));
        attachFiles(container, many);

        fireEvent.submit(container.querySelector("form")!);

        expect(await findByText(labels.maxFilesExceeded)).toBeTruthy();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("shows batchTooLarge error and does NOT fetch when total selected size exceeds 300 MB", async () => {
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);

        const { container, findByText } = setup();
        const big = [
            makeFile("a.bin", 150 * 1024 * 1024),
            makeFile("b.bin", 151 * 1024 * 1024),
        ];
        attachFiles(container, big);

        fireEvent.submit(container.querySelector("form")!);

        expect(await findByText(labels.batchTooLarge)).toBeTruthy();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("skips an oversized individual file client-side but still uploads the remaining valid files", async () => {
        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({
                    results: [{ originalFilename: "small.txt", status: "created", fileId: "id-1" }],
                }),
        });
        vi.stubGlobal("fetch", fetchSpy);

        const { container, findByText } = setup();
        const oversized = makeFile("large.bin", 21 * 1024 * 1024);
        const valid = makeFile("small.txt", 100, "text/plain");
        attachFiles(container, [oversized, valid]);

        fireEvent.submit(container.querySelector("form")!);

        await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
        const body = fetchSpy.mock.calls[0][1].body as FormData;
        expect(body.getAll("file")).toHaveLength(1);
        expect((body.getAll("file")[0] as File).name).toBe("small.txt");

        expect(await findByText("large.bin")).toBeTruthy();
        expect(await findByText(labels.fileTooLarge)).toBeTruthy();
    });

    it("calls POST /[lang]/console/upload with FormData when a valid file is selected", async () => {
        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({
                    results: [{ originalFilename: "hello.txt", status: "created", fileId: "new-id-42" }],
                }),
        });
        vi.stubGlobal("fetch", fetchSpy);

        const { container } = setup();
        attachFiles(container, [makeFile("hello.txt", 5, "text/plain")]);
        fireEvent.submit(container.querySelector("form")!);

        await waitFor(() => {
            expect(fetchSpy).toHaveBeenCalledWith(
                "/en/console/upload",
                expect.objectContaining({ method: "POST" })
            );
        });
    });

    it("redirects to the new file page when a single file upload succeeds", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        results: [{ originalFilename: "hello.txt", status: "created", fileId: "new-id-42" }],
                    }),
            })
        );

        const { container } = setup();
        attachFiles(container, [makeFile("hello.txt", 5, "text/plain")]);
        fireEvent.submit(container.querySelector("form")!);

        await waitFor(() => {
            expect(window.location.href).toBe("/en/console/files/new-id-42");
        });
    });

    it("redirects to the new file page when a single file upload succeeds with a renamed result", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        results: [
                            {
                                originalFilename: "hello.txt",
                                status: "renamed",
                                fileId: "new-id-7",
                                finalFilename: "hello-abc123.txt",
                            },
                        ],
                    }),
            })
        );

        const { container } = setup();
        attachFiles(container, [makeFile("hello.txt", 5, "text/plain")]);
        fireEvent.submit(container.querySelector("form")!);

        await waitFor(() => {
            expect(window.location.href).toBe("/en/console/files/new-id-7");
        });
    });

    it("shows a per-file results list for a multi-file batch with mixed outcomes", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        results: [
                            { originalFilename: "a.txt", status: "created", fileId: "id-a" },
                            {
                                originalFilename: "b.txt",
                                status: "renamed",
                                fileId: "id-b",
                                finalFilename: "b-xyz789.txt",
                            },
                            { originalFilename: "c.txt", status: "failed", error: "Upload failed. Please try again." },
                        ],
                    }),
            })
        );

        const { container, findByText } = setup();
        attachFiles(container, [
            makeFile("a.txt", 5, "text/plain"),
            makeFile("b.txt", 5, "text/plain"),
            makeFile("c.txt", 5, "text/plain"),
        ]);
        fireEvent.submit(container.querySelector("form")!);

        expect(await findByText("a.txt")).toBeTruthy();
        expect(await findByText(labels.uploadResultCreated)).toBeTruthy();
        expect(await findByText("b-xyz789.txt")).toBeTruthy();
        expect(await findByText(labels.uploadResultRenamed)).toBeTruthy();
        expect(await findByText("Upload failed. Please try again.")).toBeTruthy();
        expect(window.location.href).toBe("");
    });

    it("redirects to the file list when every file in a multi-file batch succeeds", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        results: [
                            { originalFilename: "a.txt", status: "created", fileId: "id-a" },
                            { originalFilename: "b.txt", status: "created", fileId: "id-b" },
                        ],
                    }),
            })
        );

        const { container } = setup();
        attachFiles(container, [makeFile("a.txt", 5, "text/plain"), makeFile("b.txt", 5, "text/plain")]);
        fireEvent.submit(container.querySelector("form")!);

        await waitFor(() => {
            expect(window.location.href).toBe("/en/console/files");
        });
    });

    it("redirects to the file list with the parentId query when a batch succeeds inside a directory", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        results: [
                            { originalFilename: "a.txt", status: "created", fileId: "id-a" },
                            { originalFilename: "b.txt", status: "created", fileId: "id-b" },
                        ],
                    }),
            })
        );

        const { container } = setup("dir-123");
        attachFiles(container, [makeFile("a.txt", 5, "text/plain"), makeFile("b.txt", 5, "text/plain")]);
        fireEvent.submit(container.querySelector("form")!);

        await waitFor(() => {
            expect(window.location.href).toBe("/en/console/files?parent=dir-123");
        });
    });

    it("shows error from server response when the whole batch is rejected", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                json: () => Promise.resolve({ error: "Parent directory not found." }),
            })
        );

        const { container, findByText } = setup();
        attachFiles(container, [makeFile("hi.txt", 2, "text/plain")]);
        fireEvent.submit(container.querySelector("form")!);

        expect(await findByText("Parent directory not found.")).toBeTruthy();
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
        attachFiles(container, [makeFile("hi.txt", 2, "text/plain")]);
        fireEvent.submit(container.querySelector("form")!);

        expect(await findByText(labels.uploadError)).toBeTruthy();
    });

    it("shows generic uploadError when fetch throws a network error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

        const { container, findByText } = setup();
        attachFiles(container, [makeFile("hi.txt", 2, "text/plain")]);
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
        attachFiles(container, [makeFile("hi.txt", 2, "text/plain")]);
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
        attachFiles(container, [makeFile("hi.txt", 2, "text/plain")]);
        fireEvent.submit(container.querySelector("form")!);

        await waitFor(() => {
            const btn = getByRole("button") as HTMLButtonElement;
            expect(btn.disabled).toBe(false);
        });
    });
});

