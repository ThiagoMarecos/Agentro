const API_URL = "/api/v1";

export interface ChatMessageResponse {
  response: string;
  conversation_id: string;
  session_id: string;
  stage: string;
}

export async function sendChatMessage(
  storeId: string,
  channel: string,
  customerIdentifier: string,
  message: string,
): Promise<ChatMessageResponse> {
  const res = await fetch(`${API_URL}/chat/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Store-ID": storeId,
    },
    body: JSON.stringify({
      channel,
      customer_identifier: customerIdentifier,
      message,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}
