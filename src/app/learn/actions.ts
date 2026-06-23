"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/r2";

export async function createProblem(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("image") as File | null;
  const mode = formData.get("mode") === "review" ? "review" : "solve";

  let imageUrl: string | null = null;
  if (file && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const key = `problems/${user.id}/${randomUUID()}.${ext}`;
    imageUrl = await uploadToR2(key, buf, file.type || "image/jpeg");
  }

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({
      student_id: user.id,
      subject: "math",
      mode,
      problem_image_url: imageUrl,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  redirect(`/learn/${conv.id}`);
}
