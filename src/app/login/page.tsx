import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold">AI 튜터</h1>
          <p className="text-sm text-gray-500">답 대신 힌트로 이끄는 수학 튜터</p>
        </div>

        {error && (
          <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <form className="space-y-3">
          <input
            name="id"
            type="text"
            required
            placeholder="아이디"
            autoCapitalize="off"
            className="w-full rounded border px-3 py-2"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="비밀번호"
            className="w-full rounded border px-3 py-2"
          />
          <div className="flex gap-2">
            <button
              formAction={signIn}
              className="flex-1 rounded bg-slate-900 px-4 py-2 text-white"
            >
              로그인
            </button>
            <button
              formAction={signUp}
              className="flex-1 rounded border px-4 py-2"
            >
              가입(개발용)
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
