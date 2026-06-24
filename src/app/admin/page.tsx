import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { createTeacher, deleteTeacher } from "./actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/");

  const { data: teachers } = await supabase
    .from("profiles")
    .select("id, display_name, login_id, created_at")
    .eq("role", "teacher")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">관리자</h1>
          <p className="text-sm text-gray-500">
            {me?.display_name} · 선생님 {teachers?.length ?? 0}명
          </p>
        </div>
        <form action={signOut}>
          <button className="text-sm text-gray-500 underline">로그아웃</button>
        </form>
      </header>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 font-semibold">선생님 등록</h2>
        <form action={createTeacher} className="grid grid-cols-2 gap-2">
          <input
            name="display_name"
            placeholder="이름"
            required
            className="rounded border px-3 py-2"
          />
          <input
            name="login_id"
            type="text"
            placeholder="로그인 아이디(4자+)"
            required
            autoCapitalize="off"
            className="rounded border px-3 py-2"
          />
          <input
            name="password"
            type="text"
            placeholder="초기 비밀번호(6자+)"
            required
            minLength={6}
            className="col-span-2 rounded border px-3 py-2"
          />
          <button className="col-span-2 rounded bg-slate-900 px-4 py-2 text-white">
            등록
          </button>
        </form>
      </section>

      <section className="space-y-2">
        {(teachers ?? []).length === 0 && (
          <p className="text-sm text-gray-500">아직 등록된 선생님이 없습니다.</p>
        )}
        {(teachers ?? []).map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-lg border px-4 py-3"
          >
            <p className="font-medium">
              {t.display_name}
              {t.login_id && (
                <span className="ml-2 text-xs font-normal text-gray-400">
                  @{t.login_id}
                </span>
              )}
            </p>
            <form action={deleteTeacher}>
              <input type="hidden" name="teacher_id" value={t.id} />
              <button className="text-sm text-red-600 underline">삭제</button>
            </form>
          </div>
        ))}
      </section>
    </main>
  );
}
