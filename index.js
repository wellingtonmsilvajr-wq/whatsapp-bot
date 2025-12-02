import express from "express";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;

let sock;
let qrCodeImage = null;

// === TELEFONES DESTINO ===
const financeiro = "5561998372346@s.whatsapp.net";
const leia = "5561999149474@s.whatsapp.net";
const luis = "5561998535931@s.whatsapp.net";

// === GERENTE (número principal do bot) ===
const gerente = "5561998746380@s.whatsapp.net";

// === HORÁRIO DE FUNCIONAMENTO === (7h às 17h)
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

// ============================
// SISTEMA DE CLIENTES ATENDIDOS
// ============================

// Arquivo onde salvamos os clientes já atendidos
const FILE_ATENDIDOS = "./clientes_atendidos.json";

// Se o arquivo não existir, cria vazio
if (!fs.existsSync(FILE_ATENDIDOS)) {
  fs.writeFileSync(FILE_ATENDIDOS, JSON.stringify([]));
}

// Carrega os clientes atendidos
function carregarClientes() {
  try {
    return JSON.parse(fs.readFileSync(FILE_ATENDIDOS, "utf8"));
  } catch (error) {
    return [];
  }
}

// Salva o cliente como atendido
function marcarComoAtendido(numero) {
  const lista = carregarClientes();
  if (!lista.includes(numero)) {
    lista.push(numero);
    fs.writeFileSync(FILE_ATENDIDOS, JSON.stringify(lista, null, 2));
  }
}

// Verifica se já é um cliente antigo
function clienteJaAtendido(numero) {
  const lista = carregarClientes();
  return lista.includes(numero);
}

// ============================
// ROTAS WEB
// ============================

app.get("/", (req, res) => {
  res.send(`
    <h1>Bot WhatsApp</h1>
    <p>Clique abaixo para ver o QR Code:</p>
    <a href="/qr" style="font-size:20px;">➡ Ver QR Code</a>
  `);
});

app.get("/qr", (req, res) => {
  if (!qrCodeImage) {
    return res.send("<h2>Aguardando geração do QR...</h2>");
  }

  res.send(`
    <h1>Escaneie o QR Code no WhatsApp</h1>
    <img src="${qrCodeImage}" />
  `);
});

// ============================
// INÍCIO DO BOT
// ============================

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
  });

  // QR CODE
  sock.ev.on("connection.update", async (update) => {
    const { qr, connection } = update;

    if (qr) {
      console.log("📌 QR gerado! Acesse /qr para escanear");
      qrCodeImage = await qrcode.toDataURL(qr);
    }

    if (connection === "open") {
      console.log("✅ BOT CONECTADO!");
      qrCodeImage = null;
    }

    if (connection === "close") {
      console.log("❌ Conexão caída. Reconectando…");
      startBot();
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // ============================
  // RECEBENDO MENSAGENS
  // ============================
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

    // EVITAR AUTO-RESPOSTA PARA MENSAGENS DO PRÓPRIO NÚMERO DO BOT
    if (from === gerente) return;

    // ============================
    // SOMENTE CLIENTES NOVOS RECEBEM O MENU AUTOMÁTICO
    // ============================
    const jaAtendido = clienteJaAtendido(from);

    if (!jaAtendido) {
      // Marca como cliente novo
      marcarComoAtendido(from);

      // Envia menu e encerra
      await sock.sendMessage(from, {
        text: `Olá! 👋 Como podemos ajudar?

1 - 📞 Falar com um vendedor  
2 - 💰 Financeiro  
3 - 🏭 Produção`,
      });

      return;
    }

    // ============================
    // DAQUI PARA BAIXO É O MENU NORMAL
    // ============================

    // VERIFICA HORÁRIO
    if (!dentroDoHorario()) {
      await sock.sendMessage(from, { text: mensagemForaHorario });
      return;
    }

    // OPÇÃO 1 — ESCOLHER VENDEDOR
    if (texto === "1") {
      await sock.sendMessage(from, {
        text: `Escolha o vendedor:

1️⃣ - Falar com vendedora Léia  
2️⃣ - Falar com vendedor Luís`,
      });
      return;
    }

    // OPÇÃO 2 — FINANCEIRO
    if (texto === "2") {
      await sock.sendMessage(financeiro, {
        text: `📩 *Mensagem encaminhada automaticamente*\n\n"${textoOriginal}"`,
      });

      await sock.sendMessage(from, {
        text: "Encaminhei sua mensagem para o financeiro! 💰",
      });
      return;
    }

    // OPÇÃO 3 — PRODUÇÃO (GERENTE)
    if (texto === "3") {
      await sock.sendMessage(gerente, {
        text: `📩 *Nova mensagem encaminhada automaticamente*\n\n"${textoOriginal}"`,
      });

      await sock.sendMessage(from, {
        text: "Encaminhei sua mensagem para o setor de produção! 🏭",
      });
      return;
    }

    // DIRECIONAR — LEIA
    if (["1️⃣", "Léia", "Leia", "leia", "léia"].includes(texto)) {
      await sock.sendMessage(leia, {
        text: `📩 *Mensagem encaminhada automaticamente*\n\n"${textoOriginal}"`,
      });

      await sock.sendMessage(from, {
        text: "Encaminhei sua mensagem para a vendedora Léia! 📞",
      });
      return;
    }

    // DIRECIONAR — LUÍS
    if (["2️⃣", "Luis", "Luís", "luis", "luís"].includes(texto)) {
      await sock.sendMessage(luis, {
        text: `📩 *Mensagem encaminhada automaticamente*\n\n"${textoOriginal}"`,
      });

      await sock.sendMessage(from, {
        text: "Encaminhei sua mensagem para o vendedor Luís! 📞",
      });
      return;
    }

    // MENU PADRÃO
    await sock.sendMessage(from, {
      text: `Olá! Selecione uma opção:

1 - 📞 Falar com um vendedor  
2 - 💰 Financeiro  
3 - 🏭 Produção`,
    });
  });
}

startBot();

app.listen(PORT, () =>
  console.log(`🌐 Servidor ativo na porta ${PORT}`)
);
