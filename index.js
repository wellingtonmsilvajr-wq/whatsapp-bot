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

  // Atualização da conexão
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

  // ==============================
  // 📌 RESPOSTA AUTOMÁTICA COM MENU
  // ==============================

  sock.ev.on("messages.upsert", async (msg) => {
    const message = msg.messages[0];
    if (!message.message) return;

    const from = message.key.remoteJid;
    const text =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";

    const clean = text.trim().toLowerCase();

    console.log("Mensagem recebida:", text);

    // Menu principal
    if (
      clean === "oi" ||
      clean === "ola" ||
      clean === "olá" ||
      clean === "menu" ||
      clean === "bom dia" ||
      clean === "boa tarde" ||
      clean === "boa noite"
    ) {
      await sock.sendMessage(from, {
        text: `
Olá! 👋  
Escolha uma opção abaixo:

1 - 📞 Falar com um vendedor  
2 - 💰 Financeiro  
3 - 🏭 Produção
      `
      });
      return;
    }

    // ==============================
    // OPÇÃO 1 - VENDEDOR
    // ==============================
    if (clean === "1") {
      await sock.sendMessage(from, {
        text: `
Escolha o vendedor:

1️⃣ - Falar com **Léia**  
2️⃣ - Falar com **Luís**
        `
      });
      return;
    }

    // Léia
    if (clean === "1️⃣" || clean === "1 vende" || clean.includes("leia")) {
      await sock.sendMessage(from, {
        text: "🔄 Abrindo WhatsApp da atendente Léia..."
      });

      await sock.sendMessage(from, {
        text: "https://wa.me/5561999149474"
      });

      return;
    }

    // Luís
    if (clean === "2️⃣" || clean === "2 vende" || clean.includes("luis")) {
      await sock.sendMessage(from, {
        text: "🔄 Abrindo WhatsApp do atendente Luís..."
      });

      await sock.sendMessage(from, {
        text: "https://wa.me/5561998535931"
      });

      return;
    }

    // ==============================
    // OPÇÃO 2 - FINANCEIRO
    // ==============================
    if (clean === "2") {
      await sock.sendMessage(from, {
        text: "🔄 Abrindo WhatsApp do Financeiro..."
      });

      await sock.sendMessage(from, {
        text: "https://wa.me/5561998372346"
      });

      return;
    }

    // ==============================
    // OPÇÃO 3 - PRODUÇÃO
    // ==============================
    if (clean === "3") {
      await sock.sendMessage(from, {
        text: "🏭 Obrigado pelo contato! Assim que possível estarei retornando sua mensagem."
      });

      return;
    }

    // Resposta padrão
    await sock.sendMessage(from, {
      text: "Desculpe, não entendi 😕\n\nDigite *menu* para ver as opções novamente."
    });
  });
}

startBot();

app.listen(PORT, () => console.log(`🌐 Servidor Web ativo na porta ${PORT}`));
