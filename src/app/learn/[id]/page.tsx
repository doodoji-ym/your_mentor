import { redirect, notFound } from "next/navigation";
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
    <Chat
      conversationId={conv.id}
      mode={conv.mode}
      imageUrl={conv.problem_image_url}
      initialUnderstanding={conv.understanding_score}
      initialMessages={(messages ?? []) as ChatMessage[]}
    />
  );
}
