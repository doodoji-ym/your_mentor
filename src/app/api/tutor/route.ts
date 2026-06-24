import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runTutorTurn, type TurnMsg } from "@/lib/tutor";
import { classifySubject } from "@/lib/classify";
import { summarizeConversation } from "@/lib/homework";
import { subjectLabel, type Subject } from "@/lib/subjects";

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

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, subject, mode, is_concept, summary, problem_image_url, answer_disclosed, understanding_score")
    .eq("id", conversationId)
    .single();
  if (!conv) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("grade, allowed_subjects")
    .eq("id", user.id)
    .single();
  const allowed: string[] = profile?.allowed_subjects ?? ["math"];

  // 현재 메시지 이전까지의 히스토리
  const { data: historyRows } = await supabase
    .from("messages")
    .select("sender, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  const history = (historyRows ?? []) as TurnMsg[];
  const isFirstTurn = history.length === 0;

  // 학생 메시지 저장
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender: "student",
    content: text,
  });

  // 과목 결정: 이미 정해졌으면 그대로, 아니면(개념질문) 분류
  let subject = conv.subject as Subject | null;
  if (!subject) {
    const detected = await classifySubject({
      text,
      imageUrl: conv.problem_image_url,
    });
    if (detected === "other" || !allowed.includes(detected)) {
      const blockMsg =
        detected === "other"
          ? "나는 수학·영어 학습만 도와줄 수 있어. 어떤 문제나 개념이 궁금한지 알려줄래?"
          : `이 계정에는 ${subjectLabel(detected)} 과목이 배정되어 있지 않아. 선생님께 문의해줘.`;
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender: "assistant",
        content: blockMsg,
        guardrail_flag: "blocked_offtopic",
        understanding_at_turn: conv.understanding_score,
      });
      return NextResponse.json({
        reply: blockMsg,
        understanding: conv.understanding_score,
        flag: "blocked_offtopic",
      });
    }
    subject = detected;
    await supabase
      .from("conversations")
      .update({ subject })
      .eq("id", conversationId);
  } else if (!allowed.includes(subject)) {
    // 방어: 배정 안 된 과목으로 설정된 대화
    const blockMsg = `이 계정에는 ${subjectLabel(subject)} 과목이 배정되어 있지 않아. 선생님께 문의해줘.`;
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender: "assistant",
      content: blockMsg,
      guardrail_flag: "blocked_offtopic",
      understanding_at_turn: conv.understanding_score,
    });
    return NextResponse.json({
      reply: blockMsg,
      understanding: conv.understanding_score,
      flag: "blocked_offtopic",
    });
  }

  let result;
  try {
    result = await runTutorTurn({
      subject,
      grade: profile?.grade ?? null,
      mode: conv.mode,
      isConcept: conv.is_concept,
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

  // 첫 턴이면 교사 리스트용 한 줄 요약 생성·저장
  if (isFirstTurn && !conv.summary) {
    const summary = await summarizeConversation({
      text,
      imageUrl: conv.problem_image_url,
    });
    if (summary) {
      await supabase
        .from("conversations")
        .update({ summary })
        .eq("id", conversationId);
    }
  }

  return NextResponse.json({
    reply: result.reply,
    understanding: result.understanding,
    flag: result.flag,
  });
}
