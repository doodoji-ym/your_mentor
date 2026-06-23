import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/");

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">관리자</h1>
        <form action={signOut}>
          <button className="text-sm text-gray-500 underline">로그아웃</button>
        </form>
      </header>
      <p className="text-gray-500">선생님 등록·관리 화면 — 구현 예정 (Phase 1).</p>
    </main>
  );
}
