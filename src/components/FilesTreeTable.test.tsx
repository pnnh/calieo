// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";

const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mockRefresh }),
}));

import FilesTreeTable from "@/components/FilesTreeTable";

const labels = {
    directory: "Directory",
    filePublished: "Published",
    fileDraft: "Draft",
    fileTitle: "Title",
    editFile: "Edit",
    size: "Size",
    fileStatus: "Status",
    updated: "Updated",
    deleteSelected: "Delete Selected",
    deleteSelectedConfirm: "Delete selected?",
    deleteDirectoryHasChildren: "Cannot delete a directory with children",
    noFilesYet: "No files yet",
};

function createDataTransfer() {
    const store: Record<string, string> = {};
    return {
        effectAllowed: "",
        dropEffect: "",
        setData(format: string, value: string) {
            store[format] = value;
        },
        getData(format: string) {
            return store[format] ?? "";
        },
    } as unknown as DataTransfer;
}

beforeEach(() => {
    mockRefresh.mockReset();
    vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
            ok: true,
        }),
    );
});

describe("FilesTreeTable drag and drop", () => {
    it("moves a file into a directory when the filename is dropped on the target directory", async () => {
        const initialRows = [
            {
                id: "file-1",
                title: "Document",
                mimeType: "text/plain",
                size: 42,
                isPublished: false,
                updatedAt: Date.now(),
            },
            {
                id: "dir-1",
                title: "Target Folder",
                mimeType: "directory",
                size: 0,
                isPublished: false,
                updatedAt: Date.now(),
            },
        ];

        const { container, getByText } = render(
            <FilesTreeTable lang="en" initialRows={initialRows} labels={labels} />,
        );

        const fileName = getByText("Document");
        const targetRow = getByText("Target Folder").closest("tr");

        expect(targetRow).toBeTruthy();

        const dataTransfer = createDataTransfer();
        fireEvent.dragStart(fileName, { dataTransfer });
        fireEvent.dragOver(targetRow as Element, { dataTransfer });
        fireEvent.drop(targetRow as Element, { dataTransfer });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/en/console/files/file-1/actions",
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ parentId: "dir-1" }),
                },
            );
        });

        await waitFor(() => {
            expect(mockRefresh).toHaveBeenCalled();
        });

        expect(container.querySelectorAll("tr").length).toBeGreaterThan(0);
    });

    it("shows edit action links for both files and directories", () => {
        const initialRows = [
            {
                id: "file-1",
                title: "Document",
                mimeType: "text/plain",
                size: 42,
                isPublished: false,
                updatedAt: Date.now(),
            },
            {
                id: "dir-1",
                title: "Target Folder",
                mimeType: "directory",
                size: 0,
                isPublished: false,
                updatedAt: Date.now(),
            },
        ];

        const { getByLabelText } = render(
            <FilesTreeTable lang="en" initialRows={initialRows} labels={labels} />,
        );

        const fileEditLink = getByLabelText("Edit: Document") as HTMLAnchorElement;
        const dirEditLink = getByLabelText("Edit: Target Folder") as HTMLAnchorElement;

        expect(fileEditLink.getAttribute("href")).toBe("/en/console/files/file-1");
        expect(dirEditLink.getAttribute("href")).toBe("/en/console/files/dir-1");
    });
});

describe("FilesTreeTable bulk delete", () => {
    it("deletes nested selections from deepest child to parent to avoid conflicts", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(true);

        const initialRows = [
            {
                id: "dir-1",
                title: "Parent Folder",
                mimeType: "directory",
                size: 0,
                isPublished: false,
                updatedAt: Date.now(),
            },
        ];

        const childRows = [
            {
                id: "file-1",
                title: "Child File",
                mimeType: "text/plain",
                size: 42,
                isPublished: false,
                updatedAt: Date.now(),
            },
        ];

        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === "string" ? input : input.toString();
            if (url.includes("/console/files-children?parentId=dir-1")) {
                return {
                    ok: true,
                    json: async () => ({ files: childRows }),
                } as Response;
            }

            if (url.endsWith("/file-1/actions") && init?.method === "DELETE") {
                return { ok: true, status: 204 } as Response;
            }

            if (url.endsWith("/dir-1/actions") && init?.method === "DELETE") {
                return { ok: true, status: 204 } as Response;
            }

            throw new Error(`Unexpected request: ${url}`);
        });

        vi.stubGlobal("fetch", fetchMock);

        const { container, getByLabelText, getByRole, getByText } = render(
            <FilesTreeTable lang="en" initialRows={initialRows} labels={labels} />,
        );

        fireEvent.click(getByLabelText("Expand"));

        await waitFor(() => {
            expect(getByText("Child File")).toBeTruthy();
        });

        const checkboxes = container.querySelectorAll('tbody input[type="checkbox"]');
        fireEvent.click(checkboxes[0]);
        fireEvent.click(checkboxes[1]);

        fireEvent.click(getByRole("button", { name: labels.deleteSelected }));

        await waitFor(() => {
            expect(fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith("/actions") && init?.method === "DELETE")).toHaveLength(2);
        });

        const deleteCalls = fetchMock.mock.calls
            .filter(([url, init]) => String(url).endsWith("/actions") && init?.method === "DELETE")
            .map(([url]) => String(url));

        expect(deleteCalls).toEqual([
            "/en/console/files/file-1/actions",
            "/en/console/files/dir-1/actions",
        ]);
    });
});
