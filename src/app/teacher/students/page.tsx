import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { GRADE_OPTIONS, gradeLabel } from "@/lib/grade";
import { createStudent, deleteStudent } from "./actions";

export default async function StudentsPage() {
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
  if (me?.role !== "teacher" && me?.role !== "admin") redirect("/");

  // 담당 학생 목록 (RLS가 자기 학생만 노출)
  const { data: links } = await supabase
    .from("teacher_students")
    .select("student_id")
    .eq("teacher_id", user.id);
  const ids = (links ?? []).map((l) => l.student_id);
  const { data: students } = ids.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, grade, created_at")
        .in("id", ids)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">학생 관리</h1>
          <p className="text-sm text-gray-500">
            {me?.display_name} 선생님 · {students?.length ?? 0}명
          </p>
        </div>
        <form action={signOut}>
          <button className="text-sm text-gray-500 underline">로그아웃</button>
        </form>
      </header>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 font-semibold">학생 등록</h2>
        <form action={createStudent} className="grid grid-cols-2 gap-2">
          <input
            name="display_name"
            placeholder="이름"
            required
            className="rounded border px-3 py-2"
          />
          <select
            name="grade"
            defaultValue=""
            className="rounded border px-3 py-2 text-sm"
          >
            <option value="">학년 선택</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          <input
            name="email"
            type="email"
            placeholder="로그인 이메일"
            required
            className="rounded border px-3 py-2"
          />
          <input
            name="password"
            type="text"
            placeholder="초기 비밀번호"
            required
            className="rounded border px-3 py-2"
          />
          <button className="col-span-2 rounded bg-slate-900 px-4 py-2 text-white">
            등록
          </button>
        </form>
      </section>

      <section className="space-y-2">
        {(students ?? []).length === 0 && (
          <p className="text-sm text-gray-500">아직 등록된 학생이 없습니다.</p>
        )}
        {(students ?? []).map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-lg border px-4 py-3"
          >
            <div>
              <p className="font-medium">{s.display_name}</p>
              <p className="text-sm text-gray-500">
                {gradeLabel(s.grade) ?? "학년 미설정"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/teacher/students/${s.id}`}
                className="text-sm text-slate-700 underline"
              >
                대화 보기
              </Link>
              <form action={deleteStudent}>
                <input type="hidden" name="student_id" value={s.id} />
                <button className="text-sm text-red-600 underline">삭제</button>
              </form>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
