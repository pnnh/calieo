"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Props = {
    label: string;
    value: number;
    options: readonly number[];
};

export default function FilesPageSizeSelect({ label, value, options }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    function handleChange(nextValue: string) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("pageSize", nextValue);

        const qs = params.toString();
        startTransition(() => {
            router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
        });
    }

    return (
        <label className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-xs font-medium text-gray-600">{label}</span>
            <select
                value={String(value)}
                disabled={isPending}
                onChange={(e) => handleChange(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            >
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
        </label>
    );
}