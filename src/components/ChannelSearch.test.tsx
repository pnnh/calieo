// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

const mockPush = vi.hoisted(() => vi.fn());
const mockPathname = vi.hoisted(() => vi.fn(() => "/en/console/channels"));
const mockSearchParamsGet = vi.hoisted(() => vi.fn((_key: string) => null));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => mockPathname(),
    useSearchParams: () => ({ get: mockSearchParamsGet }),
}));

import ChannelSearch from "@/components/ChannelSearch";

beforeEach(() => {
    mockPush.mockReset();
    mockPathname.mockReturnValue("/en/console/channels");
    mockSearchParamsGet.mockReturnValue(null);
});

describe("ChannelSearch", () => {
    it("renders a text input and a submit button", () => {
        const { container } = render(<ChannelSearch placeholder="Search channels" />);
        expect(container.querySelector('input[type="text"]')).toBeTruthy();
        expect(container.querySelector('button[type="submit"]')).toBeTruthy();
    });

    it("uses the placeholder prop on both the input and the button", () => {
        const { container } = render(<ChannelSearch placeholder="Find a channel" />);
        const input = container.querySelector("input") as HTMLInputElement;
        expect(input.placeholder).toBe("Find a channel");
        const btn = container.querySelector("button")!;
        expect(btn.textContent).toBe("Find a channel");
    });

    it("initialises input value from the 'q' search param", () => {
        mockSearchParamsGet.mockImplementation((key) => key === "q" ? "initial" : null);
        const { container } = render(<ChannelSearch placeholder="Search" />);
        const input = container.querySelector("input") as HTMLInputElement;
        expect(input.value).toBe("initial");
    });

    it("initialises to empty string when 'q' param is absent", () => {
        const { container } = render(<ChannelSearch placeholder="Search" />);
        const input = container.querySelector("input") as HTMLInputElement;
        expect(input.value).toBe("");
    });

    it("updates input value as user types", () => {
        const { container } = render(<ChannelSearch placeholder="Search" />);
        const input = container.querySelector("input") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "my channel" } });
        expect(input.value).toBe("my channel");
    });

    it("calls router.push with ?q= param when a non-empty search is submitted", () => {
        const { container } = render(<ChannelSearch placeholder="Search" />);
        const input = container.querySelector("input")!;
        const form = container.querySelector("form")!;

        fireEvent.change(input, { target: { value: "test query" } });
        fireEvent.submit(form);

        expect(mockPush).toHaveBeenCalledWith(
            "/en/console/channels?q=test+query"
        );
    });

    it("calls router.push WITHOUT ?q= when search value is empty", () => {
        const { container } = render(<ChannelSearch placeholder="Search" />);
        fireEvent.submit(container.querySelector("form")!);
        expect(mockPush).toHaveBeenCalledWith("/en/console/channels");
    });

    it("calls router.push WITHOUT ?q= when search value is whitespace only", () => {
        const { container } = render(<ChannelSearch placeholder="Search" />);
        const input = container.querySelector("input")!;
        fireEvent.change(input, { target: { value: "   " } });
        fireEvent.submit(container.querySelector("form")!);
        expect(mockPush).toHaveBeenCalledWith("/en/console/channels");
    });

    it("trims whitespace from the search value before pushing", () => {
        const { container } = render(<ChannelSearch placeholder="Search" />);
        const input = container.querySelector("input")!;
        fireEvent.change(input, { target: { value: "  hello  " } });
        fireEvent.submit(container.querySelector("form")!);

        const calledUrl = mockPush.mock.calls[0][0] as string;
        expect(calledUrl).toContain("q=hello");
        expect(calledUrl).not.toContain(" ");
    });

    it("uses the current pathname as the base URL", () => {
        mockPathname.mockReturnValue("/zh/console/channels");
        const { container } = render(<ChannelSearch placeholder="Search" />);
        const input = container.querySelector("input")!;
        fireEvent.change(input, { target: { value: "demo" } });
        fireEvent.submit(container.querySelector("form")!);

        expect(mockPush).toHaveBeenCalledWith("/zh/console/channels?q=demo");
    });

    it("calls router.push exactly once per submit", () => {
        const { container } = render(<ChannelSearch placeholder="Search" />);
        fireEvent.submit(container.querySelector("form")!);
        expect(mockPush).toHaveBeenCalledTimes(1);
    });
});
