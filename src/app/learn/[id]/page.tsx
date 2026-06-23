import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Chat, type ChatMessage } from "./chat";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, problem_image_url, mode, understanding_score")
    .eq("id", id)
    .single();
  if (!conv) notFound();

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender, content")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col p-4">
      <header className="mb-2 flex items-center justify-between">
        <Link href="/learn" className="text-sm text-gray-500 underline">
          ← 목록
        </Link>
        <span className="text-xs text-gray-500">
          {conv.mode === "review" ? "해설 모드" : "풀이 모드"} · 이해도{" "}
          {conv.understanding_score}
        </span>
      </header>

      {conv.problem_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={conv.problem_image_url}
          alt="문제"
          className="mb-3 max-h-56 w-full rounded border object-contain"
        />
      )}

      <Chat
        conversationId={conv.id}
        initialMessages={(messages ?? []) as ChatMessage[]}
      />
    </main>
  );
}
