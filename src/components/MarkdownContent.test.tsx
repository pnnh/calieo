// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import MarkdownContent from "@/components/MarkdownContent";

describe("MarkdownContent", () => {
    it("renders a heading snapshot", () => {
        const { container } = render(<MarkdownContent content="# Hello World" />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders a paragraph snapshot", () => {
        const { container } = render(
            <MarkdownContent content="This is a **bold** and _italic_ paragraph." />
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders a link snapshot", () => {
        const { container } = render(
            <MarkdownContent content="Visit [Calieo](https://calieo.xyz)" />
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders a code block snapshot", () => {
        const { container } = render(
            <MarkdownContent content={"```\nconsole.log('hi');\n```"} />
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders an unordered list snapshot", () => {
        const { container } = render(
            <MarkdownContent content={"- item one\n- item two\n- item three"} />
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders an image tag from markdown", () => {
        const { container } = render(
            <MarkdownContent content="![alt text](https://example.com/img.png)" />
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("strips disallowed tags (script)", () => {
        const { container } = render(
            <MarkdownContent content='<script>alert("xss")</script> safe text' />
        );
        const html = container.innerHTML;
        expect(html).not.toContain("<script>");
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders empty string without error", () => {
        const { container } = render(<MarkdownContent content="" />);
        expect(container.firstChild).toMatchSnapshot();
    });
});
