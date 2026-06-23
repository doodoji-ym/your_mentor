"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// 현재 사용자가 teacher(또는 admin)인지 확인하고 id 반환.
async function requireTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "teacher" && me?.role !== "admin") {
    throw new Error("권한이 없습니다.");
  }
  return user.id;
}

export async function createStudent(formData: FormData) {
  const teacherId = await requireTeacher();

  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const displayName = String(formData.get("display_name") || "").trim();
  const gradeRaw = formData.get("grade");
  const grade = gradeRaw ? Number(gradeRaw) : null;

  const admin = createAdminClient();

  // 학생 auth 계정 생성 (트리거가 profiles 행을 함께 생성)
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw new Error(error.message);
  const studentId = created.user.id;

  // 역할/학년/소유권 설정 + 선생님-학생 연결
  await admin
    .from("profiles")
    .update({
      role: "student",
      grade,
      created_by: teacherId,
      display_name: displayName || email.split("@")[0],
    })
    .eq("id", studentId);

  await admin
    .from("teacher_students")
    .insert({ teacher_id: teacherId, student_id: studentId });

  revalidatePath("/teacher/students");
}

export async function updateStudent(formData: FormData) {
  const teacherId = await requireTeacher();
  const studentId = String(formData.get("student_id"));

  const admin = createAdminClient();
  // 소유권 확인
  const { data: link } = await admin
    .from("teacher_students")
    .select("student_id")
    .eq("teacher_id", teacherId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!link) throw new Error("담당 학생이 아닙니다.");

  const displayName = String(formData.get("display_name") || "").trim();
  const gradeRaw = formData.get("grade");
  await admin
    .from("profiles")
    .update({
      display_name: displayName,
      grade: gradeRaw ? Number(gradeRaw) : null,
    })
    .eq("id", studentId);

  revalidatePath("/teacher/students");
}

export async function deleteStudent(formData: FormData) {
  const teacherId = await requireTeacher();
  const studentId = String(formData.get("student_id"));

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("teacher_students")
    .select("student_id")
    .eq("teacher_id", teacherId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!link) throw new Error("담당 학생이 아닙니다.");

  // auth 사용자 삭제 → profiles/links/conversations cascade
  const { error } = await admin.auth.admin.deleteUser(studentId);
  if (error) throw new Error(error.message);

  revalidatePath("/teacher/students");
}
