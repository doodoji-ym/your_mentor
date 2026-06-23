import { createClient } from "@supabase/supabase-js";

// service_role 키를 쓰는 관리자 클라이언트 — RLS를 우회한다.
// 학생 계정 생성/삭제처럼 권한 상위 작업에만, 반드시 서버에서만 사용할 것.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
