import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { gradeLabel } from "@/lib/grade";
import { subjectLabel } from "@/lib/subjects";
import { ProblemCapture } from "./problem-capture";
import { startConcept } from "./actions";

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ blocked?: string; error?: string }>;
}) {
  const { blocked, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("display_name, grade, allowed_subjects")
    .eq("id", user.id)
    .single();
  const allowed: string[] = me?.allowed_subjects ?? ["math"];

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, subject, is_concept, understanding_score, answer_disclosed, created_at")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, status, deadline, assignment_problems(count)")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false });

  const blockedMsg =
    blocked === "other"
      ? "수학·영어 문제만 올릴 수 있어요. 다시 찍어볼래?"
      : blocked
        ? `${subjectLabel(blocked)} 과목은 배정되어 있지 않아요. 선생님께 문의하세요.`
        : error === "nofile"
          ? "사진을 선택해줘."
          : null;

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">학습</h1>
          <p className="text-sm text-gray-500">
            {me?.display_name}
            {gradeLabel(me?.grade) ? ` · ${gradeLabel(me?.grade)}` : ""} ·{" "}
            {allowed.map((s) => subjectLabel(s)).join("·")}
          </p>
        </div>
        <form action={signOut}>
          <button className="text-sm text-gray-500 underline">로그아웃</button>
        </form>
      </header>

      {blockedMsg && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">
          {blockedMsg}
        </p>
      )}

      <section className="space-y-3">
        <ProblemCapture />
        <form action={startConcept}>
          <button className="w-full rounded-xl border px-4 py-5 text-center text-base font-semibold text-slate-800">
            💬 개념·용어 질문하기
          </button>
        </form>
        <p className="text-center text-xs text-gray-400">
          모르는 문제는 찍어서, 헷갈리는 개념은 질문으로 시작해요.
        </p>
      </section>

      {(assignments ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">숙제</h2>
          {(assignments ?? []).map((a) => {
            const n =
              (a.assignment_problems as { count: number }[] | null)?.[0]
                ?.count ?? 0;
            return (
              <Link
                key={a.id}
                href={`/learn/homework/${a.id}`}
                className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-gray-50"
              >
                <span className="text-sm font-medium">
                  📝 {a.title}
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {n}문제
                    {a.deadline
                      ? ` · ~${new Date(a.deadline).toLocaleDateString("ko-KR")}`
                      : ""}
                  </span>
                </span>
                <span className="text-xs text-gray-500">
                  {a.status === "graded" ? "완료" : "풀어야 해요"}
                </span>
              </Link>
            );
          })}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">지난 기록</h2>
        {(conversations ?? []).length === 0 && (
          <p className="text-sm text-gray-500">아직 기록이 없어요.</p>
        )}
        {(conversations ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/learn/${c.id}`}
            className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-gray-50"
          >
            <span className="text-sm">
              {c.is_concept ? "💬 개념질문" : "📷 문제풀이"}
              <span className="ml-2 text-xs text-gray-400">
                {subjectLabel(c.subject)}
              </span>
            </span>
            <span className="text-xs text-gray-500">
              {c.is_concept
                ? ""
                : `이해도 ${c.understanding_score}${c.answer_disclosed ? " ✅" : ""}`}
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
