import { notFound } from "next/navigation";
import { isValidLang } from "@/lib/language";
import type { LangKey } from "@/lib/language";
import { listUsers, type User } from "@/lib/db";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ lang: string }> };

function formatUnixTime(ts: number): string {
    return new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function parseGroups(raw: string | null): string {
    if (!raw) return "—";
    try {
        const arr = JSON.parse(raw) as unknown[];
        return arr.length > 0 ? arr.join(", ") : "—";
    } catch {
        return raw;
    }
}

const COLUMNS: { label: string; render: (u: User) => string }[] = [
    { label: "email", render: (u) => u.email },
    { label: "name", render: (u) => u.name ?? "—" },
    { label: "sub", render: (u) => (u.sub ? u.sub.slice(0, 12) + "…" : "—") },
    { label: "groups", render: (u) => parseGroups(u.groups) },
    { label: "country", render: (u) => u.country ?? "—" },
    { label: "首次登录", render: (u) => formatUnixTime(u.created_at) },
    { label: "最近活跃", render: (u) => formatUnixTime(u.last_seen_at) },
    { label: "token 到期", render: (u) => (u.token_exp ? formatUnixTime(u.token_exp) : "—") },
];

export default async function UsersPage({ params }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();
    const l = lang as LangKey;

    let users: User[] = [];
    let dbError = false;

    try {
        users = await listUsers();
    } catch (error) {
        console.error("Failed to list users:", error);
        dbError = true;
    }

    return (
        <>
            <SiteHeader lang={l} />
            <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">用户列表</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        所有曾通过 Cloudflare Access 认证并访问过 /console 的用户，按最近活跃时间倒序。
                    </p>
                </div>

                {dbError && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        <strong>数据库不可用</strong> — D1 绑定未找到（可能是本地{" "}
                        <code className="font-mono">next dev</code> 环境）。请使用{" "}
                        <code className="font-mono">pnpm preview</code> 或{" "}
                        <code className="font-mono">wrangler dev</code> 并确保已执行 migration。
                    </div>
                )}

                {!dbError && (
                    <section className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                已认证用户
                            </h2>
                            <span className="text-xs text-gray-400">{users.length} 人</span>
                        </div>

                        {users.length === 0 ? (
                            <div className="px-5 py-10 text-center text-sm text-gray-400">
                                暂无用户记录。访问任意 /console 页面后将自动写入。
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {COLUMNS.map((col) => (
                                                <th
                                                    key={col.label}
                                                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap"
                                                >
                                                    {col.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {users.map((u) => (
                                            <tr key={u.id} className="hover:bg-gray-50">
                                                {COLUMNS.map((col) => (
                                                    <td
                                                        key={col.label}
                                                        className="px-4 py-3 text-gray-700 whitespace-nowrap font-mono text-xs"
                                                    >
                                                        {col.render(u)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}
            </main>
            <SiteFooter lang={l} />
        </>
    );
}
