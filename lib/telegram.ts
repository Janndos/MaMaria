/* ============================================================================
 *  Telegram Bot API (server-only)
 *  ----------------------------------------------------------------------------
 *  Posts the generated menu / news announcements to a Telegram chat/channel.
 *  Credentials live only in environment variables and never reach the browser:
 *    TELEGRAM_BOT_TOKEN   bot token from @BotFather
 *    TELEGRAM_CHAT_ID     target chat/channel id (e.g. -1001234567890 or @canal)
 *    TELEGRAM_CHANNEL     (optional) public @username of the channel, used only to
 *                         build a t.me link back to the posted message.
 *  The bot must be an admin of the target channel to post.
 * ========================================================================== */

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

type TgResult = { ok: true; messageId?: number; url?: string | null } | { ok: false; error: string };

const NOT_CONFIGURED =
  "Telegram nu este configurat. Setați TELEGRAM_BOT_TOKEN și TELEGRAM_CHAT_ID în variabilele de mediu.";

/** Public link to a posted message, when a channel @username is configured. */
function channelLink(messageId?: number): string | null {
  const ch = process.env.TELEGRAM_CHANNEL;
  if (!ch || !messageId) return null;
  return `https://t.me/${ch.replace(/^@/, "")}/${messageId}`;
}

async function callTelegram(method: string, form: FormData): Promise<TgResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  form.append("chat_id", process.env.TELEGRAM_CHAT_ID!);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (data?.ok) {
      const messageId = data.result?.message_id as number | undefined;
      return { ok: true, messageId, url: channelLink(messageId) };
    }
    console.error(`Telegram ${method} error:`, res.status, data);
    return { ok: false, error: data?.description ? `Telegram: ${data.description}` : "Telegram a respins cererea." };
  } catch (e) {
    console.error(`Telegram ${method} exception:`, e);
    return { ok: false, error: "Serviciul Telegram nu este disponibil momentan." };
  }
}

/** Send a photo (menu image, or a news announcement image + caption). */
export async function sendPhoto(
  image: Buffer, caption?: string, opts?: { filename?: string; type?: string },
): Promise<TgResult> {
  if (!telegramConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const form = new FormData();
  form.append(
    "photo",
    new Blob([new Uint8Array(image)], { type: opts?.type ?? "image/png" }),
    opts?.filename ?? "meniu.png",
  );
  if (caption) form.append("caption", caption);
  return callTelegram("sendPhoto", form);
}

/** Send a plain-text announcement (no image). */
export async function sendMessage(text: string): Promise<TgResult> {
  if (!telegramConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const form = new FormData();
  form.append("text", text);
  return callTelegram("sendMessage", form);
}

/** Send the menu PDF as a document (optional archive copy). */
export async function sendDocument(pdf: Buffer, filename: string, caption?: string): Promise<TgResult> {
  if (!telegramConfigured()) return { ok: false, error: NOT_CONFIGURED };
  const form = new FormData();
  form.append("document", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), filename);
  if (caption) form.append("caption", caption);
  return callTelegram("sendDocument", form);
}
