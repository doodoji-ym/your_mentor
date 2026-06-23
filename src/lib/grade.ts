// 학년 코드(내부 1~12 정수) ↔ 한국 학제 라벨.
//   1~6  = 초1~초6,  7~9 = 중1~중3,  10~12 = 고1~고3
export type GradeOption = { value: number; label: string };

export const GRADE_OPTIONS: GradeOption[] = [
  { value: 1, label: "초1" },
  { value: 2, label: "초2" },
  { value: 3, label: "초3" },
  { value: 4, label: "초4" },
  { value: 5, label: "초5" },
  { value: 6, label: "초6" },
  { value: 7, label: "중1" },
  { value: 8, label: "중2" },
  { value: 9, label: "중3" },
  { value: 10, label: "고1" },
  { value: 11, label: "고2" },
  { value: 12, label: "고3" },
];

export function gradeLabel(grade: number | null | undefined): string | null {
  if (grade == null) return null;
  return GRADE_OPTIONS.find((g) => g.value === grade)?.label ?? null;
}

// GPT-5 프롬프트용 — "중3 (중학교 3학년)" 형태로 학제까지 명시.
export function gradeForPrompt(grade: number | null | undefined): string | null {
  const label = gradeLabel(grade);
  if (!label) return null;
  const stage = grade! <= 6 ? "초등학교" : grade! <= 9 ? "중학교" : "고등학교";
  const n = grade! <= 6 ? grade! : grade! <= 9 ? grade! - 6 : grade! - 9;
  return `${label} (${stage} ${n}학년)`;
}
