import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomeworkProblem } from "./problem";

export default async function HomeworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: asgn } = await supabase
    .from("assignments")
    .select("id, title, deadline, status, student_id")
    .eq("id", id)
    .single();
  if (!asgn || asgn.student_id !== user.id) notFound();

  const { data: problems } = await supabase
    .from("assignment_problems")
    .select(
      "id, position, problem_text, attempts, resolved, correct, feedback, submission_url",
    )
    .eq("assignment_id", id)
    .order("position", { ascending: true });

  const done = (problems ?? []).filter((p) => p.resolved).length;

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <Link href="/learn" className="text-sm text-gray-500 underline">
        ← 목록
      </Link>
      <div>
        <h1 className="text-xl font-bold">{asgn.title}</h1>
        <p className="text-sm text-gray-500">
          {done}/{(problems ?? []).length} 완료
          {asgn.deadline
            ? ` · 마감 ${new Date(asgn.deadline).toLocaleString("ko-KR")}`
            : ""}
        </p>
      </div>

      {(problems ?? []).map((pr) => (
        <HomeworkProblem
          key={pr.id}
          problemId={pr.id}
          position={pr.position}
          problemText={pr.problem_text}
          initialResolved={pr.resolved}
          initialCorrect={pr.correct}
          initialAttempts={pr.attempts}
          initialFeedback={pr.feedback}
          initialSubmission={pr.submission_url}
        />
      ))}
    </main>
  );
}
