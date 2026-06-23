import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MathMarkdown } from "@/lib/markdown";
import { gradeLabel } from "@/lib/grade";

export default async function StudentLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conv?: string }>;
}) {
  const { id } = await params;
  const { conv: selectedConv } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS: is_teacher_of(id)가 아니면 student 행이 안 보임
  const { data: student } = await supabase
    .from("profiles")
    .select("id, display_name, grade")
    .eq("id", id)
    .single();
  if (!student) notFound();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, problem_text, understanding_score, answer_disclosed, created_at")
    .eq("student_id", id)
    .order("created_at", { ascending: false });

  const { data: messages } = selectedConv
    ? await supabase
        .from("messages")
        .select("id, sender, content, guardrail_flag, understanding_at_turn")
        .eq("conversation_id", selectedConv)
        .order("created_at", { ascending: true })
    : { data: null };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/teacher/students" className="text-sm text-gray-500 underline">
            ← 학생 목록
          </Link>
          <h1 className="mt-1 text-xl font-bold">
            {student.display_name}
            {gradeLabel(student.grade) ? ` · ${gradeLabel(student.grade)}` : ""}
          </h1>
        </div>
      </header>

      <div className="grid grid-cols-[220px_1fr] gap-4">
        <aside className="space-y-1">
          <h2 className="mb-2 text-sm font-semibold text-gray-500">대화 목록</h2>
          {(conversations ?? []).length === 0 && (
            <p className="text-sm text-gray-400">대화 없음</p>
          )}
          {(conversations ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/teacher/students/${id}?conv=${c.id}`}
              className={`block rounded px-2 py-2 text-sm ${
                selectedConv === c.id ? "bg-slate-900 text-white" : "hover:bg-gray-100"
              }`}
            >
              {c.problem_text?.slice(0, 18) || "문제 풀이"}
              <span className="block text-xs opacity-70">
                이해도 {c.understanding_score}
                {c.answer_disclosed ? " · 답공개" : ""}
              </span>
            </Link>
          ))}
        </aside>

        <section className="space-y-3">
          {!selectedConv && (
            <p className="text-sm text-gray-400">
              왼쪽에서 대화를 선택하면 전체 채팅 내용을 볼 수 있어요.
            </p>
          )}
          {(messages ?? []).map((m) => (
            <div
              key={m.id}
              className={m.sender === "student" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.sender === "student"
                    ? "max-w-[80%] rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white"
                    : "max-w-[85%] rounded-2xl border bg-white px-3 py-2 text-sm"
                }
              >
                {m.sender === "assistant" ? (
                  <>
                    <MathMarkdown>{m.content}</MathMarkdown>
                    <div className="mt-1 text-[10px] text-gray-400">
                      이해도 {m.understanding_at_turn ?? "-"} · {m.guardrail_flag}
                    </div>
                  </>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
