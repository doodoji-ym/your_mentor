import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runTutorTurn, type TurnMsg } from "@/lib/tutor";

export async function POST(req: NextRequest) {
  const { conversationId, text } = await req.json();
  if (!conversationId || typeof text !== "string") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS가 본인 대화만 노출
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, mode, problem_image_url, answer_disclosed")
    .eq("id", conversationId)
    .single();
  if (!conv) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("grade")
    .eq("id", user.id)
    .single();

  const { data: historyRows } = await supabase
    .from("messages")
    .select("sender, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  const history = (historyRows ?? []) as TurnMsg[];

  // 학생 메시지 저장
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender: "student",
    content: text,
  });

  let result;
  try {
    result = await runTutorTurn({
      grade: profile?.grade ?? null,
      mode: conv.mode,
      history,
      studentText: text,
      imageUrl: conv.problem_image_url,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "tutor failed" },
      { status: 500 },
    );
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender: "assistant",
    content: result.reply,
    guardrail_flag: result.flag,
    understanding_at_turn: result.understanding,
  });

  await supabase
    .from("conversations")
    .update({
      understanding_score: result.understanding,
      answer_disclosed: conv.answer_disclosed || result.disclosed,
    })
    .eq("id", conversationId);

  return NextResponse.json({
    reply: result.reply,
    understanding: result.understanding,
    flag: result.flag,
  });
}
