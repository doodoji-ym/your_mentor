import OpenAI from "openai";
import { buildTutorSystemPrompt, type TutorMode } from "./prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAIN_MODEL = "gpt-5";
const GUARD_MODEL = "gpt-5-mini";

export type GuardrailFlag =
  | "ok"
  | "blocked_offtopic"
  | "redacted_premature_answer"
  | "answer_disclosed";

export type TurnMsg = { sender: "student" | "assistant"; content: string };

export type TutorResult = {
  reply: string;
  understanding: number;
  disclosed: boolean;
  flag: GuardrailFlag;
};

const TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
    understanding: { type: "integer" },
    off_topic: { type: "boolean" },
    disclosed_answer: { type: "boolean" },
  },
  required: ["reply", "understanding", "off_topic", "disclosed_answer"],
} as const;

function clamp(n: unknown): number {
  const x = Math.round(Number(n));
  return Number.isNaN(x) ? 0 : Math.max(0, Math.min(100, x));
}

// 메인 튜터 호출 → (이해도<90이면) 출력 검증 레이어로 답 누설 점검.
export async function runTutorTurn(opts: {
  grade: number | null;
  mode: TutorMode;
  history: TurnMsg[];
  studentText: string;
  imageUrl?: string | null;
}): Promise<TutorResult> {
  const system = buildTutorSystemPrompt({ grade: opts.grade, mode: opts.mode });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
  ];
  for (const m of opts.history) {
    messages.push({
      role: m.sender === "student" ? "user" : "assistant",
      content: m.content,
    });
  }

  const userParts: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: "text", text: opts.studentText || "이 문제 풀이를 도와줘." },
  ];
  if (opts.imageUrl) {
    userParts.push({ type: "image_url", image_url: { url: opts.imageUrl } });
  }
  messages.push({ role: "user", content: userParts });

  const completion = await openai.chat.completions.create({
    model: MAIN_MODEL,
    reasoning_effort: "medium",
    messages,
    response_format: {
      type: "json_schema",
      json_schema: { name: "tutor_turn", strict: true, schema: TURN_SCHEMA },
    },
  });

  const parsed = JSON.parse(completion.choices[0].message.content ?? "{}");
  const understanding = clamp(parsed.understanding);
  let reply: string = String(parsed.reply ?? "");
  let disclosed = Boolean(parsed.disclosed_answer);
  let flag: GuardrailFlag = "ok";

  if (parsed.off_topic) {
    return {
      reply:
        reply ||
        "나는 수학 문제만 도와줄 수 있어. 풀고 있는 수학 문제를 보여줄래?",
      understanding,
      disclosed: false,
      flag: "blocked_offtopic",
    };
  }

  if (understanding < 90) {
    const leaked = await checkLeak(reply);
    if (leaked) {
      reply =
        "거의 다 온 것 같아! 그런데 마지막 정답은 네가 직접 마무리해 보자. 지금까지 네 생각을 한 단계만 더 밀어붙여 볼까? 어디까지 확신이 서?";
      flag = "redacted_premature_answer";
      disclosed = false;
    }
  } else if (disclosed) {
    flag = "answer_disclosed";
  }

  return { reply, understanding, disclosed, flag };
}

// 출력 검증 레이어 — 별도(저렴한) 모델로 "최종 답/완성 풀이 누설" 여부만 판정.
async function checkLeak(reply: string): Promise<boolean> {
  try {
    const r = await openai.chat.completions.create({
      model: GUARD_MODEL,
      reasoning_effort: "low",
      messages: [
        {
          role: "system",
          content:
            '다음은 수학 튜터가 학생에게 보낼 메시지다. 이 메시지가 문제의 "최종 정답"이나 "완성된 전체 풀이"를 사실상 알려주면 leak=true, 힌트/개념/되묻기 수준이면 leak=false.',
        },
        { role: "user", content: reply },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "leak_check",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { leak: { type: "boolean" } },
            required: ["leak"],
          },
        },
      },
    });
    return Boolean(JSON.parse(r.choices[0].message.content ?? "{}").leak);
  } catch {
    // 검증 실패 시 안전하게 누설로 간주하지 않되, 메인 게이트가 1차 방어.
    return false;
  }
}
