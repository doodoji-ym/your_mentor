"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/r2";
import { classifySubject } from "@/lib/classify";

// 사진 찍어 시작: 업로드 → 과목 자동분류 → 배정 과목이면 대화 생성, 아니면 차단.
export async function startProblem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("image") as File | null;
  const mode = formData.get("mode") === "review" ? "review" : "solve";
  if (!file || file.size === 0) redirect("/learn?error=nofile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("allowed_subjects")
    .eq("id", user.id)
    .single();
  const allowed: string[] = profile?.allowed_subjects ?? ["math"];

  const buf = Buffer.from(await file!.arrayBuffer());
  const ext = (file!.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const key = `problems/${user.id}/${randomUUID()}.${ext}`;
  const imageUrl = await uploadToR2(key, buf, file!.type || "image/jpeg");

  const detected = await classifySubject({ imageUrl });
  if (detected === "other" || !allowed.includes(detected)) {
    redirect(`/learn?blocked=${detected}`);
  }

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({
      student_id: user.id,
      subject: detected,
      mode,
      problem_image_url: imageUrl,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/learn/${conv.id}`);
}

// 개념·용어 질문: 사진 없이 시작. 배정 과목이 하나면 그 과목, 둘이면 첫 메시지에서 분류.
export async function startConcept() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("allowed_subjects")
    .eq("id", user.id)
    .single();
  const allowed: string[] = profile?.allowed_subjects ?? ["math"];
  const subject = allowed.length === 1 ? allowed[0] : null;

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({
      student_id: user.id,
      subject,
      is_concept: true,
      mode: "solve",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/learn/${conv.id}`);
}
