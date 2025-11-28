import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";

async function connectBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📌 Escaneie o QR Code abaixo:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("Conexão caiu. Reconectando:", shouldReconnect);
            if (shouldReconnect) connectBot();
        }

        if (connection === "open") {
            console.log("🔥 BOT CONECTADO AO WHATSAPP!");
        }
    });

    sock.ev.on("messages.upsert", async (msg) => {
        const mensagem = msg.messages[0];
        if (!mensagem.message) return;

        const remetente = mensagem.key.remoteJid;
        const texto = mensagem.message.conversation || 
                      mensagem.message.extendedTextMessage?.text || "";

        console.log("📩 Mensagem recebida:", texto);

        if (texto.toLowerCase() === "oi") {
            await sock.sendMessage(remetente, { text: "Olá! 👋 Como posso ajudar?" });
        }

        if (texto.toLowerCase() === "menu") {
            await sock.sendMessage(remetente, { 
                text: "Escolha uma opção:\n1️⃣ Vendas\n2️⃣ Produção\n3️⃣ Suporte" 
            });
        }
    });
}

connectBot();
