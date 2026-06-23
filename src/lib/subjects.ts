export type Subject = "math" | "english";

export const SUBJECT_OPTIONS: { value: Subject; label: string }[] = [
  { value: "math", label: "수학" },
  { value: "english", label: "영어" },
];

export function subjectLabel(s: string | null | undefined): string {
  if (s === "english") return "영어";
  if (s === "math") return "수학";
  return "미분류";
}
