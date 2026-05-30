import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
    const cookieStore = await cookies();
    const lang = cookieStore.get("lang")?.value || "en";
    redirect(`/${lang}/console`);
}
