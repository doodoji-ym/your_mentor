import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type DetectedSubject = "math" | "english" | "other";

// 사진/텍스트가 어떤 과목인지 저렴한 모델로 분류 (서브에이전트 라우팅·차단용).
export async function classifySubject(opts: {
  text?: string | null;
  imageUrl?: string | null;
}): Promise<DetectedSubject> {
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [];
  if (opts.text) content.push({ type: "text", text: opts.text });
  if (opts.imageUrl)
    content.push({ type: "image_url", image_url: { url: opts.imageUrl } });
  if (content.length === 0) content.push({ type: "text", text: "(빈 입력)" });

  try {
    const r = await openai.chat.completions.create({
      model: "gpt-5-mini",
      reasoning_effort: "low",
      messages: [
        {
          role: "system",
          content:
            "학생이 올린 내용이 어떤 학습 과목인지 분류해라. math=수학(수식·방정식·도형·그래프·확률통계 등), english=영어(영어 지문·독해·문법·어휘), other=수학도 영어도 아님. JSON으로만 답하라.",
        },
        { role: "user", content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "subject_class",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              subject: { type: "string", enum: ["math", "english", "other"] },
            },
            required: ["subject"],
          },
        },
      },
    });
    const parsed = JSON.parse(r.choices[0].message.content ?? "{}");
    return (parsed.subject as DetectedSubject) ?? "other";
  } catch {
    return "other";
  }
}
