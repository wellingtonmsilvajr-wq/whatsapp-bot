import express from "express";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode";

const app = express();
const PORT = process.env.PORT || 3000;

let sock;
let qrCodeImage = null;

// === TELEFONES DESTINO ===
const financeiro = "5561998372346@s.whatsapp.net";
const leia = "5561999149474@s.whatsapp.net";
const luis = "5561998535931@s.whatsapp.net";

// === HORÁRIO DE FUNCIONAMENTO ===
// 7h às 17h
function dentroDoHorario() {
  const agora = new Date();
  const hora = agora.getHours();
  return hora >= 7 && hora < 17;
}

const mensagemForaHorario = `
⚠️ *Fora do horário de atendimento*

Nosso horário é:
🕒 *7h às 17h (segunda a sexta)*

Recebemos sua mensagem e retornaremos assim que possível! 😊
`;

// ROTA INICIAL
app.get("/", (req, res) => {
  res.send(`
    <h1>Bot WhatsApp</h1>
    <p>Clique abaixo para ver o QR Code:</p>
    <a href="/qr" style="font-size:20px;">➡ Ver QR Code</a>
  `);
});

// ROTA DO QR
app.get("/qr", (req, res) => {
  if (!qrCodeImage) {
    return res.send("<h2>Aguardando geração do QR...</h2>");
  }

  res.send(`
    <h1>Escaneie o QR Code no WhatsApp</h1>
    <img src="${qrCodeImage}" />
  `);
});

// === INÍCIO DO BOT ===
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
  });

  // GERAR QR CODE
  sock.ev.on("connection.update", async (update) => {
    const { qr, connection } = update;

    if (qr) {
      console.log("📌 QR gerado! Acesse /qr para escanear");
      qrCodeImage = await qrcode.toDataURL(qr);
    }

    if (connection === "open") {
      console.log("✅ BOT CONECTADO AO WHATSAPP!");
      qrCodeImage = null;
    }

    if (connection === "close") {
      console.log("❌ Conexão perdida. Tentando reconectar…");
      startBot();
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // === RECEBENDO MENSAGENS ===
  sock.ev.on("messages.upsert", async (msg) => {
    const message = msg.messages[0];
    if (!message.message) return;

    const from = message.key.remoteJid;
    const textoOriginal =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      "";

    const texto = textoOriginal.trim();

    console.log("📩 Mensagem recebida:", texto);

    // === VERIFICA HORÁRIO ===
    if (!dentroDoHorario()) {
      await sock.sendMessage(from, { text: mensagemForaHorario });
      return;
    }

    // === OPÇÃO 1 → ESCOLHER VENDEDOR ===
    if (texto === "1") {
      await sock.sendMessage(from, {
        text: `Escolha o vendedor:

1️⃣ - Falar com vendedora Léia  
2️⃣ - Falar com vendedor Luís`,
      });
      return;
    }

    // === OPÇÃO 2 → FINANCEIRO ===
    if (texto === "2") {
      await sock.sendMessage(financeiro, {
        text: `📩 *Mensagem encaminhada automaticamente*\n\n"${textoOriginal}"`,
      });

      await sock.sendMessage(from, {
        text: "Encaminhei sua mensagem para o setor financeiro. Em breve eles retornarão!",
      });
      return;
    }

    // === OPÇÃO 3 → PRODUÇÃO ===
    if (texto === "3") {
      await sock.sendMessage(from, {
        text: "Obrigado pelo contato! Assim que possível estarei retornando sua mensagem.",
      });
      return;
    }

    // === DIRECIONAMENTO PARA VENDEDORA LÉIA ===
    if (["1️⃣", "Léia", "Leia", "leia", "léia"].includes(texto)) {
      await sock.sendMessage(leia, {
        text: `📩 *Nova mensagem encaminhada automaticamente:*\n\n"${textoOriginal}"`,
      });

      await sock.sendMessage(from, {
        text: "Encaminhei sua mensagem para a vendedora Léia! 📞",
      });
      return;
    }

    // === DIRECIONAMENTO PARA VENDEDOR LUÍS ===
    if (["2️⃣", "Luis", "Luís", "luis", "luís"].includes(texto)) {
      await sock.sendMessage(luis, {
        text: `📩 *Nova mensagem encaminhada automaticamente:*\n\n"${textoOriginal}"`,
      });

      await sock.sendMessage(from, {
        text: "Encaminhei sua mensagem para o vendedor Luís! 📞",
      });
      return;
    }

    // === MENU PADRÃO PARA QUALQUER MENSAGEM ===
    await sock.sendMessage(from, {
      text: `Olá! Selecione uma opção:

1 - 📞 Falar com um vendedor  
2 - 💰 Financeiro  
3 - 🏭 Produção
`,
    });
  });
}

startBot();

// Servidor web para o Render
app.listen(PORT, () => console.log(`🌐 Servidor ativo na porta ${PORT}`));
