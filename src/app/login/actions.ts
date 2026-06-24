"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { toLoginEmail, isPlainId, validatePlainId } from "@/lib/auth-id";

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const { error } = await supabase.auth.signInWithPassword({
    email: toLoginEmail(id),
    password: String(formData.get("password")),
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent("아이디 또는 비밀번호가 올바르지 않아요.")}`);
  }
  redirect("/");
}

// 개발용 셀프 가입(기본 role=student). 운영에선 선생님이 학생을 등록.
export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  if (isPlainId(id)) {
    const err = validatePlainId(id);
    if (err) redirect(`/login?error=${encodeURIComponent(err)}`);
  }
  const { error } = await supabase.auth.signUp({
    email: toLoginEmail(id),
    password: String(formData.get("password")),
    options: { data: { display_name: id } },
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/");
}
