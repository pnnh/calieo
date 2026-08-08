/**
 * Lightweight mocks for Next.js modules used inside React components.
 * Import this file at the top of any component test that renders
 * <Link> or <Image> from Next.js.
 *
 * Usage:
 *   import "@/components/__mocks__/next";
 *   import { vi } from "vitest";
 *   vi.mock("next/link", () => import("@/components/__mocks__/next").then(m => ({ default: m.MockLink })));
 */

import React from "react";

/** Drop-in stub for next/link — renders a plain <a> tag. */
export function MockLink({
    href,
    children,
    ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children?: React.ReactNode;
}) {
    return (
        <a href={href} {...rest}>
            {children}
        </a>
    );
}

/** Drop-in stub for next/image — renders a plain <img> tag. */
export function MockImage({
    src,
    alt,
    width,
    height,
    fill,
    ...rest
}: React.ImgHTMLAttributes<HTMLImageElement> & {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    fill?: boolean;
}) {
    return (
        <img
            src={typeof src === "string" ? src : String(src)}
            alt={alt}
            width={fill ? undefined : width}
            height={fill ? undefined : height}
            {...rest}
        />
    );
}
