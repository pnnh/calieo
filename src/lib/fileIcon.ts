/**
 * Returns an emoji icon for a given MIME type.
 * Used to provide visual cues in file list tables.
 */
export function fileIcon(mimeType: string): string {
    if (mimeType === "directory") return "📁";
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType.startsWith("video/")) return "🎬";
    if (mimeType.startsWith("audio/")) return "🎵";
    if (mimeType === "application/pdf") return "📕";
    if (
        mimeType.includes("zip") ||
        mimeType.includes("tar") ||
        mimeType.includes("gzip") ||
        mimeType.includes("compressed") ||
        mimeType.includes("7z") ||
        mimeType.includes("rar")
    )
        return "🗜️";
    if (
        mimeType.includes("spreadsheet") ||
        mimeType.includes("excel") ||
        mimeType === "text/csv"
    )
        return "📊";
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📽️";
    if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
    if (mimeType.startsWith("text/")) return "📄";
    if (mimeType.includes("json") || mimeType.includes("xml")) return "📋";
    return "📄";
}
