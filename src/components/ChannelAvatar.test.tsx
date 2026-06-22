// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ChannelAvatar from "@/components/ChannelAvatar";

describe("ChannelAvatar", () => {
    it("renders an img element snapshot with default size", () => {
        const { container } = render(
            <ChannelAvatar channelId="ch-001" channelName="My Channel" />
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders with a custom size", () => {
        const { container } = render(
            <ChannelAvatar channelId="ch-002" channelName="Bigger Channel" size={64} />
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("sets src to the channel avatar API endpoint", () => {
        const { container } = render(
            <ChannelAvatar channelId="abc-123" channelName="Test" />
        );
        const img = container.querySelector("img");
        expect(img?.getAttribute("src")).toBe("/api/channel/avatar/abc-123");
    });

    it("sets alt to channelName", () => {
        const { container } = render(
            <ChannelAvatar channelId="x" channelName="Acme Corp" />
        );
        const img = container.querySelector("img");
        expect(img?.getAttribute("alt")).toBe("Acme Corp");
    });

    it("applies width and height from size prop", () => {
        const { container } = render(
            <ChannelAvatar channelId="x" channelName="X" size={32} />
        );
        const img = container.querySelector("img");
        expect(img?.getAttribute("width")).toBe("32");
        expect(img?.getAttribute("height")).toBe("32");
    });
});
