import { config } from "../config.js";

export async function chatWithAi(
  messages: { role: string; content: string }[],
  systemExtra = ""
) {
  if (!config.openaiApiKey) {
    return {
      role: "assistant",
      content:
        "AI is not configured. Set OPENAI_API_KEY in the server environment. Once set, I can answer questions, summarize chats, and suggest playlist ideas (search queries / moods only — no unauthorized streaming).",
    };
  }

  const system = {
    role: "system",
    content: `You are Aether Assistant inside a community app. Be concise and helpful. You can suggest music moods and search queries but never claim to stream copyrighted audio. ${systemExtra}`,
  };

  const res = await fetch(`${config.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.openaiModel,
      messages: [system, ...messages],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI error: ${text}`);
  }
  const data = (await res.json()) as {
    choices: { message: { role: string; content: string } }[];
  };
  return data.choices[0].message;
}
