export const PAGE_SIZE_OPTIONS = [20, 40, 80] as const;
export const DEFAULT_PAGE_SIZE = 20;

export function parsePage(value: string | null | undefined): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function parsePageSize(value: string | null | undefined): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number])
        ? parsed
        : DEFAULT_PAGE_SIZE;
}

export function buildPageWindow(currentPage: number, totalPages: number, radius = 1): Array<number | "ellipsis"> {
    if (totalPages <= 1) {
        return [1];
    }

    const safeCurrent = Math.min(Math.max(1, currentPage), totalPages);
    const safeRadius = Math.max(0, radius);
    const pages = new Set<number>([1, totalPages]);

    for (let page = safeCurrent - safeRadius; page <= safeCurrent + safeRadius; page += 1) {
        if (page >= 1 && page <= totalPages) {
            pages.add(page);
        }
    }

    const sortedPages = [...pages].sort((left, right) => left - right);
    const result: Array<number | "ellipsis"> = [];

    for (let index = 0; index < sortedPages.length; index += 1) {
        const page = sortedPages[index];
        const previous = sortedPages[index - 1];

        if (index > 0 && page - previous > 1) {
            result.push("ellipsis");
        }

        result.push(page);
    }

    return result;
}