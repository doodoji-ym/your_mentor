import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeSubmission } from "@/lib/homework";
import type { Subject } from "@/lib/subjects";

export async function POST(req: NextRequest) {
  const { problemId, imageUrl } = await req.json();
  if (!problemId || typeof imageUrl !== "string" || !imageUrl) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 문제 + 과제(소유 학생 확인). RLS가 자기 과제 문제만 노출.
  const { data: problem } = await supabase
    .from("assignment_problems")
    .select(
      "id, assignment_id, problem_text, attempts, resolved, assignments(id, student_id, subject)",
    )
    .eq("id", problemId)
    .single();
  const assignment = problem?.assignments as
    | { id: string; student_id: string; subject: Subject }
    | undefined;
  if (!problem || !assignment || assignment.student_id !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (problem.resolved) {
    return NextResponse.json({ error: "이미 완료된 문제예요." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("grade")
    .eq("id", user.id)
    .single();

  const newAttempts = problem.attempts + 1;
  const reveal = newAttempts >= 2; // 2번째부터는 오답 시 정답 공개

  const result = await gradeSubmission({
    subject: assignment.subject,
    grade: profile?.grade ?? null,
    problemText: problem.problem_text,
    imageUrl,
    reveal,
  });

  // 정답이거나, 2번째 이상 오답이면 종료(정답 공개)
  const resolved = result.correct || reveal;

  const admin = createAdminClient();
  await admin
    .from("assignment_problems")
    .update({
      attempts: newAttempts,
      correct: result.correct,
      resolved,
      feedback: result.feedback,
      submission_url: imageUrl,
    })
    .eq("id", problemId);

  // 모든 문제가 끝났으면 과제 상태 갱신
  const { data: remaining } = await admin
    .from("assignment_problems")
    .select("id")
    .eq("assignment_id", assignment.id)
    .eq("resolved", false);
  if ((remaining ?? []).length === 0) {
    await admin
      .from("assignments")
      .update({ status: "graded" })
      .eq("id", assignment.id);
  }

  return NextResponse.json({
    correct: result.correct,
    resolved,
    feedback: result.feedback,
    attempts: newAttempts,
  });
}
