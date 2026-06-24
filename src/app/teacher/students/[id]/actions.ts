"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateProblems } from "@/lib/homework";
import { subjectLabel, type Subject } from "@/lib/subjects";

// 선택한 대화(학생이 어려워한 문제/질문)들로 유사 유형 숙제를 생성.
export async function createAssignment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const studentId = String(formData.get("student_id"));
  const convIds = formData.getAll("conv_ids").map(String);
  const deadlineRaw = String(formData.get("deadline") || "");
  const count = Math.min(10, Math.max(1, Number(formData.get("count") || 3)));
  if (convIds.length === 0) throw new Error("문제를 1개 이상 선택하세요.");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "teacher" && me?.role !== "admin")
    throw new Error("권한이 없습니다.");

  // 선택한 대화 (RLS: 자기 학생 대화만 조회됨)
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, subject, summary")
    .in("id", convIds)
    .eq("student_id", studentId);
  const topics = (convs ?? []).map((c) => c.summary || "이전에 어려워한 문제");
  const subject = ((convs ?? []).find((c) => c.subject)?.subject ??
    "math") as Subject;

  const { data: student } = await supabase
    .from("profiles")
    .select("grade")
    .eq("id", studentId)
    .single();

  const problems = await generateProblems({
    subject,
    grade: student?.grade ?? null,
    topics,
    count,
  });
  if (problems.length === 0) throw new Error("문제 생성에 실패했습니다.");

  const { data: asgn, error } = await supabase
    .from("assignments")
    .insert({
      teacher_id: user.id,
      student_id: studentId,
      title: `${subjectLabel(subject)} 숙제 (${problems.length}문제)`,
      deadline: deadlineRaw ? new Date(deadlineRaw).toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: pErr } = await supabase.from("assignment_problems").insert(
    problems.map((p, i) => ({
      assignment_id: asgn.id,
      position: i + 1,
      problem_text: p,
    })),
  );
  if (pErr) throw new Error(pErr.message);

  revalidatePath(`/teacher/students/${studentId}`);
}
