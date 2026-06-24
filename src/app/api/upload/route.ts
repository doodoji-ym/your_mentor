import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/r2";

// 채팅 중 이미지 업로드 → R2 → URL 반환.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("image") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const key = `uploads/${user.id}/${randomUUID()}.${ext}`;
  const url = await uploadToR2(key, buf, file.type || "image/jpeg");

  return NextResponse.json({ url });
}
