import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/language";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = {
    params: Promise<{ lang: string }>;
    children: React.ReactNode;
};

export default async function ConsoleLayout({ params, children }: Props) {
    const { lang } = await params;
    if (!isValidLang(lang)) notFound();

    // Enforce authentication for all console pages via the Calieo session cookie.
    try {
        await getCurrentUser();
    } catch {
        redirect(`/${lang}/account/signin?return_to=${encodeURIComponent(`/${lang}/console`)}`);
    }

    return <>{children}</>;
}
