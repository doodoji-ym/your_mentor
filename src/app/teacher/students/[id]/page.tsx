import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MathMarkdown } from "@/lib/markdown";
import { gradeLabel } from "@/lib/grade";
import { subjectLabel } from "@/lib/subjects";
import { ZoomableImage } from "@/lib/zoomable-image";
import { createAssignment } from "./actions";

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

  const { data: student } = await supabase
    .from("profiles")
    .select("id, display_name, grade")
    .eq("id", id)
    .single();
  if (!student) notFound();

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, subject, summary, is_concept, understanding_score, problem_image_url, created_at")
    .eq("student_id", id)
    .order("created_at", { ascending: false });

  const selectedConvImage = selectedConv
    ? (conversations ?? []).find((c) => c.id === selectedConv)?.problem_image_url
    : null;

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, deadline, status, created_at, assignment_problems(count)")
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
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <header>
        <Link href="/teacher/students" className="text-sm text-gray-500 underline">
          ← 학생 목록
        </Link>
        <h1 className="mt-1 text-xl font-bold">
          {student.display_name}
          {gradeLabel(student.grade) ? ` · ${gradeLabel(student.grade)}` : ""}
        </h1>
      </header>

      {/* 낸 숙제 */}
      <section className="space-y-2">
        <h2 className="font-semibold">낸 숙제</h2>
        {(assignments ?? []).length === 0 && (
          <p className="text-sm text-gray-400">아직 낸 숙제가 없어요.</p>
        )}
        {(assignments ?? []).map((a) => {
          const n =
            (a.assignment_problems as { count: number }[] | null)?.[0]?.count ??
            0;
          return (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-gray-500">
                  {n}문제
                  {a.deadline
                    ? ` · 마감 ${new Date(a.deadline).toLocaleString("ko-KR")}`
                    : ""}
                  {` · ${a.status === "assigned" ? "출제됨" : a.status === "submitted" ? "제출됨" : "채점완료"}`}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {/* 숙제 출제 */}
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">숙제 출제</h2>
        <p className="text-xs text-gray-500">
          학생이 풀었던 문제/질문을 선택하면 비슷한 유형으로 새 문제를 만들어
          숙제로 냅니다.
        </p>
        <form action={createAssignment} className="space-y-3">
          <input type="hidden" name="student_id" value={id} />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {(conversations ?? []).length === 0 && (
              <p className="text-sm text-gray-400">기록이 없어요.</p>
            )}
            {(conversations ?? []).map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 rounded border px-3 py-2"
              >
                <label className="flex flex-1 items-center gap-2 text-sm">
                  <input type="checkbox" name="conv_ids" value={c.id} />
                  <span>
                    {c.summary || (c.is_concept ? "개념 질문" : "문제 풀이")}
                    <span className="ml-2 text-xs text-gray-400">
                      {subjectLabel(c.subject)}
                      {!c.is_concept && ` · 이해도 ${c.understanding_score}`}
                    </span>
                  </span>
                </label>
                <Link
                  href={`/teacher/students/${id}?conv=${c.id}`}
                  className="shrink-0 text-xs text-slate-600 underline"
                >
                  상세
                </Link>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1">
              문제 수
              <input
                name="count"
                type="number"
                min={1}
                max={10}
                defaultValue={3}
                className="w-16 rounded border px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-1">
              마감
              <input
                name="deadline"
                type="datetime-local"
                className="rounded border px-2 py-1"
              />
            </label>
            <button className="rounded bg-slate-900 px-4 py-2 text-white">
              선택한 문제로 숙제 내기
            </button>
          </div>
        </form>
      </section>

      {/* 선택한 대화 상세 */}
      {selectedConv && (
        <section className="space-y-3">
          <h2 className="font-semibold">대화 상세</h2>
          {selectedConvImage && (
            <ZoomableImage
              src={selectedConvImage}
              alt="문제"
              className="max-h-72 w-full cursor-zoom-in rounded border object-contain"
            />
          )}
          {(messages ?? []).map((m) => (
            <div
              key={m.id}
              className={
                m.sender === "student" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={
                  m.sender === "student"
                    ? "max-w-[80%] rounded-2xl bg-slate-900 px-3 py-2 text-sm text-white"
                    : "max-w-[85%] rounded-2xl border bg-white px-3 py-2 text-sm text-slate-900"
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
      )}
    </main>
  );
}
