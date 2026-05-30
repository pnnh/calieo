import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

type Props = { content: string };

export default function MarkdownContent({ content }: Props) {
    const raw = marked.parse(content, { async: false }) as string;
    const clean = sanitizeHtml(raw, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
        allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ["src", "alt", "width", "height"],
        },
    });

    return (
        <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: clean }}
        />
    );
}
