import express from "express";
import makeWASocket, { useMultiFileAuthState, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import qrcode from "qrcode";

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeImage = null;

// Rota inicial
app.get("/", (req, res) => {
  res.send(`
    <h1>Bot WhatsApp</h1>
    <p>Clique abaixo para ver o QR Code:</p>
    <a href="/qr" style="font-size:20px;">➡ Ver QR Code</a>
  `);
});

// Rota do QR
app.get("/qr", (req, res) => {
  if (!qrCodeImage) {
    return res.send("<h2>Aguardando geração do QR...</h2>");
  }

  res.send(`
    <h1>Escaneie o QR Code no WhatsApp</h1>
    <img src="${qrCodeImage}" />
  `);
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state
  });

  // Quando o QR aparecer
  sock.ev.on("connection.update", async (update) => {
    const { qr, connection } = update;

    if (qr) {
      console.log("📌 QR gerado! Acesse /qr para escanear.");
      qrCodeImage = await qrcode.toDataURL(qr);
    }

    if (connection === "open") {
      console.log("✅ BOT CONECTADO AO WHATSAPP!");
      qrCodeImage = null; 
    }

    if (connection === "close") {
      console.log("❌ Conexão perdida. Tentando reconectar...");
      startBot();
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // MENSAGEM AUTOMÁTICA
  sock.ev.on("messages.upsert", async (msg) => {
    const message = msg.messages[0];
    if (!message.message) return;

    const from = message.key.remoteJid;
    const text = message.message.conversation || message.message.extendedTextMessage?.text;

    if (text) {
      console.log("Mensagem recebida:", text);

      await sock.sendMessage(from, { text: "Oi! Seu bot está funcionando 😄" });
    }
  });
}

startBot();

// Mantém a porta aberta para o Render
app.listen(PORT, () => console.log(`🌐 Servidor Web ativo na porta ${PORT}`));
