// 로그인 아이디는 이메일일 필요 없음. 일반 문자열(4자+)을 받아 Supabase Auth용 합성 이메일로 변환.
// 기존 이메일 계정과의 호환을 위해 '@'가 있으면 그대로 사용.
const SYNTHETIC_DOMAIN = "yourmentor.local";

export function isPlainId(id: string): boolean {
  return !id.includes("@");
}

// 일반 아이디 규칙: 4자 이상, 영숫자/._- (이메일 local-part 호환)
export function validatePlainId(id: string): string | null {
  if (!/^[a-zA-Z0-9._-]{4,}$/.test(id)) {
    return "아이디는 4자 이상의 영문/숫자/._- 만 사용할 수 있어요.";
  }
  return null;
}

export function toLoginEmail(id: string): string {
  const t = id.trim().toLowerCase();
  return t.includes("@") ? t : `${t}@${SYNTHETIC_DOMAIN}`;
}

// 화면 표시용: 합성 이메일이면 아이디만, 진짜 이메일이면 그대로.
export function fromLoginEmail(email: string | null | undefined): string {
  if (!email) return "";
  return email.endsWith(`@${SYNTHETIC_DOMAIN}`)
    ? email.slice(0, -(SYNTHETIC_DOMAIN.length + 1))
    : email;
}
