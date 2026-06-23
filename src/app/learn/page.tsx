import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { gradeLabel } from "@/lib/grade";
import { createProblem } from "./actions";

export default async function LearnPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("display_name, grade")
    .eq("id", user.id)
    .single();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, problem_text, understanding_score, answer_disclosed, created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">학습</h1>
          <p className="text-sm text-gray-500">
            {me?.display_name}
            {gradeLabel(me?.grade) ? ` · ${gradeLabel(me?.grade)}` : ""}
          </p>
        </div>
        <form action={signOut}>
          <button className="text-sm text-gray-500 underline">로그아웃</button>
        </form>
      </header>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 font-semibold">새 문제</h2>
        <form action={createProblem} className="space-y-3">
          <input
            name="image"
            type="file"
            accept="image/*"
            capture="environment"
            className="block w-full text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" name="mode" value="review" />
            답지/해설이 있는 문제예요 (review 모드)
          </label>
          <button className="w-full rounded bg-slate-900 px-4 py-2 text-white">
            문제 올리고 시작
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">지난 문제</h2>
        {(conversations ?? []).length === 0 && (
          <p className="text-sm text-gray-500">아직 푼 문제가 없어요.</p>
        )}
        {(conversations ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/learn/${c.id}`}
            className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-gray-50"
          >
            <span className="text-sm">
              {c.problem_text?.slice(0, 30) || "문제 풀이"}
            </span>
            <span className="text-xs text-gray-500">
              이해도 {c.understanding_score}
              {c.answer_disclosed ? " · ✅" : ""}
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
