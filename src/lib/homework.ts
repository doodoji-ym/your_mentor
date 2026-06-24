import OpenAI from "openai";
import { type Subject, subjectLabel } from "./subjects";
import { gradeForPrompt } from "./grade";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 풀이 사진을 채점. reveal=false면 틀려도 정답 비공개(어디 틀렸는지+다시 풀기),
// reveal=true(2번째 오답)면 전체 풀이·정답 설명.
export async function gradeSubmission(opts: {
  subject: Subject;
  grade: number | null;
  problemText: string;
  imageUrl: string;
  reveal: boolean;
}): Promise<{ correct: boolean; feedback: string }> {
  const gradeText = gradeForPrompt(opts.grade) ?? "중·고 공통";
  const subj = subjectLabel(opts.subject);
  const system = opts.reveal
    ? `너는 ${subj} 채점관이다. 문제와 학생의 풀이 사진이 주어진다. 학생이 이미 두 번 틀렸다. 정답 여부를 correct로 판정하고, feedback에는 올바른 전체 풀이와 정답을 학년(${gradeText}) 수준으로 친절하게 설명하라. 수식은 LaTeX($...$, $$...$$).`
    : `너는 ${subj} 채점관이다. 문제와 학생의 풀이 사진이 주어진다. 학년(${gradeText}) 기준으로 채점하라. 맞으면 correct=true이고 feedback에 짧은 칭찬과 핵심 확인. 틀리면 correct=false이고 feedback에는 어디서/왜 틀렸는지만 짚어주되 정답은 절대 알려주지 말고 "다시 한 번 풀어봐"로 끝내라. 수식은 LaTeX.`;
  try {
    const r = await openai.chat.completions.create({
      model: "gpt-5",
      reasoning_effort: "medium",
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: `문제:\n${opts.problemText}\n\n아래는 학생의 풀이 사진이다.` },
            { type: "image_url", image_url: { url: opts.imageUrl } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "grade",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              correct: { type: "boolean" },
              feedback: { type: "string" },
            },
            required: ["correct", "feedback"],
          },
        },
      },
    });
    const parsed = JSON.parse(r.choices[0].message.content ?? "{}");
    return {
      correct: Boolean(parsed.correct),
      feedback: String(parsed.feedback ?? ""),
    };
  } catch (e) {
    return {
      correct: false,
      feedback: e instanceof Error ? `채점 오류: ${e.message}` : "채점 오류",
    };
  }
}

// 대화 한 줄 요약(교사 리스트용).
export async function summarizeConversation(opts: {
  text: string;
  imageUrl?: string | null;
}): Promise<string> {
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: "text", text: opts.text || "(이미지로 올린 문제)" },
  ];
  if (opts.imageUrl)
    content.push({ type: "image_url", image_url: { url: opts.imageUrl } });
  try {
    const r = await openai.chat.completions.create({
      model: "gpt-5-mini",
      reasoning_effort: "low",
      messages: [
        {
          role: "system",
          content:
            '학생이 올린 문제/질문을 교사용 한 줄(40자 이내) 요약으로 만들어라. 예: "이차방정식 인수분해", "현재완료 용법 질문". JSON으로만.',
        },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "summary",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: { summary: { type: "string" } },
            required: ["summary"],
          },
        },
      },
    });
    return JSON.parse(r.choices[0].message.content ?? "{}").summary ?? "";
  } catch {
    return "";
  }
}

// 학생이 어려워한 유형들과 비슷한 새 문제 N개 생성(정답 미포함).
export async function generateProblems(opts: {
  subject: Subject;
  grade: number | null;
  topics: string[];
  count: number;
}): Promise<string[]> {
  const gradeText = gradeForPrompt(opts.grade) ?? "중·고 공통";
  try {
    const r = await openai.chat.completions.create({
      model: "gpt-5",
      reasoning_effort: "medium",
      messages: [
        {
          role: "system",
          content: `너는 ${opts.subject === "english" ? "영어" : "수학"} 교사를 돕는다. 학생이 어려워한 아래 유형들과 비슷하지만 똑같지는 않은 새 문제를 정확히 ${opts.count}개 만들어라. 학생 수준(${gradeText})에 맞게. 각 문제는 그 자체로 완결되게. 정답·풀이는 절대 포함하지 말고 문제만. 수식은 LaTeX(인라인 $...$, 블록 $$...$$).`,
        },
        {
          role: "user",
          content: `학생이 어려워한 유형:\n- ${opts.topics.join("\n- ")}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "problems",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              problems: { type: "array", items: { type: "string" } },
            },
            required: ["problems"],
          },
        },
      },
    });
    return JSON.parse(r.choices[0].message.content ?? "{}").problems ?? [];
  } catch {
    return [];
  }
}
