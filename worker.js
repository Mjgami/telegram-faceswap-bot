const BOT_TOKEN = "8433790312:AAH0jswCqaSe8Qv3bWkJubOpc7JaaCK5lJw";
const API_URL = "https://ab-faceswap.vercel.app/swap";

// in-memory user sessions
const sessions = new Map();

export default {
  async fetch(req) {
    if (req.method !== "POST") {
      return new Response("OK");
    }

    const update = await req.json();
    const msg = update.message;
    if (!msg) return new Response("OK");

    const chatId = msg.chat.id;

    const tg = (method, body) =>
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

    // ---------- /start ----------
    if (msg.text === "/start") {
      sessions.set(chatId, []);
      await tg("sendMessage", {
        chat_id: chatId,
        text:
          "👋 *FaceSwap Bot*\n\n" +
          "📸 Send *SOURCE* image first\n" +
          "📸 Then send *TARGET* image\n\n" +
          "✨ I will swap faces for you",
        parse_mode: "Markdown"
      });
      return new Response("OK");
    }

    // ---------- PHOTO ----------
    if (msg.photo) {
      if (!sessions.has(chatId)) sessions.set(chatId, []);
      const photos = sessions.get(chatId);

      const fileId = msg.photo[msg.photo.length - 1].file_id;

      // get file path
      const fileInfo = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
      ).then(r => r.json());

      const fileUrl =
        `https://api.telegram.org/file/bot${BOT_TOKEN}/` +
        fileInfo.result.file_path;

      const imgBuffer = await fetch(fileUrl).then(r => r.arrayBuffer());
      photos.push(imgBuffer);

      if (photos.length === 1) {
        await tg("sendMessage", {
          chat_id: chatId,
          text: "✅ *Source image received*\n📤 Send target image",
          parse_mode: "Markdown"
        });
      }

      if (photos.length === 2) {
        await tg("sendMessage", {
          chat_id: chatId,
          text: "⏳ *Swapping faces...*",
          parse_mode: "Markdown"
        });

        try {
          const form = new FormData();
          form.append("source", new Blob([photos[0]]), "source.jpg");
          form.append("target", new Blob([photos[1]]), "target.jpg");

          const res = await fetch(API_URL, {
            method: "POST",
            headers: {
              "User-Agent": "Mozilla/5.0 (Android)",
              "origin": "https://ab-faceswap.vercel.app",
              "referer": "https://ab-faceswap.vercel.app/"
            },
            body: form
          });

          if (!res.ok) {
            await tg("sendMessage", {
              chat_id: chatId,
              text: "❌ API Error"
            });
            sessions.delete(chatId);
            return new Response("OK");
          }

          const resultBuffer = await res.arrayBuffer();

          const sendForm = new FormData();
          sendForm.append("chat_id", chatId);
          sendForm.append("photo", new Blob([resultBuffer]), "result.jpg");
          sendForm.append("caption", "✅ *Face Swap Completed*");

          await fetch(
            `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
            { method: "POST", body: sendForm }
          );

        } catch (e) {
          await tg("sendMessage", {
            chat_id: chatId,
            text: "❌ Error:\n`" + e.message + "`",
            parse_mode: "Markdown"
          });
        }

        sessions.delete(chatId);
      }
    }

    return new Response("OK");
  }
};
