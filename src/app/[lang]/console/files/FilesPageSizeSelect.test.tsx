// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";

const mockReplace = vi.hoisted(() => vi.fn());
const mockPathname = vi.hoisted(() => vi.fn(() => "/en/console/files"));
const mockSearchParamsToString = vi.hoisted(() => vi.fn(() => "parent=dir-1&q=notes&page=2&pageSize=20"));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: mockReplace }),
    usePathname: () => mockPathname(),
    useSearchParams: () => ({ toString: mockSearchParamsToString }),
}));

import FilesPageSizeSelect from "./FilesPageSizeSelect";

beforeEach(() => {
    mockReplace.mockReset();
    mockPathname.mockReturnValue("/en/console/files");
    mockSearchParamsToString.mockReturnValue("parent=dir-1&q=notes&page=2&pageSize=20");
});

describe("FilesPageSizeSelect", () => {
    it("replaces the current route with an updated pageSize while preserving other query params", async () => {
        const { container } = render(
            <FilesPageSizeSelect label="Items per page" value={20} options={[20, 40, 80]} />,
        );

        fireEvent.change(container.querySelector("select") as HTMLSelectElement, {
            target: { value: "40" },
        });

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith(
                "/en/console/files?parent=dir-1&q=notes&page=2&pageSize=40",
            );
        });
    });
});