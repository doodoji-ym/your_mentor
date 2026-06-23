import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 로그인 후 역할에 따라 분기. (미인증은 미들웨어가 /login으로 보냄)
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (me?.role === "admin") redirect("/admin");
  if (me?.role === "teacher") redirect("/teacher/students");
  redirect("/learn");
}
