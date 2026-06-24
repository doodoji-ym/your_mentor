"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { toLoginEmail, isPlainId, validatePlainId } from "@/lib/auth-id";

async function requireAdmin() {
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
  if (me?.role !== "admin") throw new Error("권한이 없습니다.");
  return user.id;
}

export async function createTeacher(formData: FormData) {
  const adminId = await requireAdmin();

  const loginId = String(formData.get("login_id") || "").trim();
  const idErr = isPlainId(loginId) ? validatePlainId(loginId) : null;
  if (idErr) throw new Error(idErr);
  const email = toLoginEmail(loginId);
  const password = String(formData.get("password"));
  const displayName = String(formData.get("display_name") || "").trim();

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw new Error(error.message);

  await admin
    .from("profiles")
    .update({
      role: "teacher",
      display_name: displayName || loginId,
      login_id: loginId,
      created_by: adminId,
    })
    .eq("id", created.user.id);

  revalidatePath("/admin");
}

export async function deleteTeacher(formData: FormData) {
  await requireAdmin();
  const teacherId = String(formData.get("teacher_id"));

  const admin = createAdminClient();
  const { data: t } = await admin
    .from("profiles")
    .select("role")
    .eq("id", teacherId)
    .single();
  if (t?.role !== "teacher") throw new Error("선생님 계정이 아닙니다.");

  const { error } = await admin.auth.admin.deleteUser(teacherId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}
