require("./Files/function.js");
require("./config.js");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
  jidDecode, 
  downloadContentFromMessage
} = require("baileys");

const chalk = require("chalk");
const Pino = require("pino");
const fs = require("fs");
const DataBase = require("./Files/database.js");
const database = new DataBase();
global.groupMetadataCache = new Map()
const serialize = require("./Files/serialize");

const loadDb = async () => {
  const load = await database.read() || {};
  global.db = {
    users: load.users || {},
    groups: load.groups || {},
    settings: load.settings || {}
  };
  await database.write(global.db);
  setInterval(() => database.write(global.db), 2000);
};

loadDb();

async function StartBot() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    logger: Pino({ level: "silent" }),
    browser: Browsers.ubuntu("Safari"),
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false, 
    cachedGroupMetadata: async (jid) => {
        if (!global.groupMetadataCache.has(jid)) {
            const metadata = await sock.groupMetadata(jid).catch((err) => {});
            await global.groupMetadataCache.set(jid, metadata);
            return metadata;
        }
        return global.groupMetadataCache.get(jid);
    }
  });

  // Pastikan sock.waUploadToServer ada (fallback ke CatBox jika tidak ada)
  if (!sock.waUploadToServer) {
      sock.waUploadToServer = async (buffer, type) => {
          const url = await global.CatBox(buffer);
          return { url };
      };
  }

  if (!sock.authState.creds.registered) {
    console.log(chalk.white("●> 𝐖𝐚𝐢𝐭 𝐅𝐨𝐫 𝐏𝐚𝐢𝐫𝐢𝐧𝐠 𝐂𝐨𝐝𝐞.. 🚀"));
    setTimeout(async () => {
      const code = await sock.requestPairingCode(global.pairingNumber.trim(), "SANZOLIN");
      console.log(chalk.white(`●> 𝐏𝐚𝐢𝐫𝐢𝐧𝐠 𝐂𝐨𝐝𝐞: ${code}`));
    }, 4000);
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;
    const m = await serialize(sock, msg);
    if (m.isBaileys) return
    require("./Oline.js")(sock, m);
  });

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log("Reconnecting...");
        StartBot();
      } else {
        console.log("Connection Closed");
      }
    }
    if (connection === "open") {
      console.log("Bot online!");
      // Jalankan scheduler autojpm
      startAutoJpm(sock);
      startAutoSwgc(sock);
      if (typeof global.StartJpm === 'function') {
        global.StartJpm(sock); 
        
      }
    }
  });
  
  sock.ev.on("group-participants.update", async (update) => {
  const { id, participants, action, author } = update;
  const groupMetadata = await sock.groupMetadata(id);
  global.groupMetadataCache.set(id, groupMetadata);
  })
  
  sock.downloadMediaMessage = async (m, type, filename = "") => {
    if (!m || !(m.url || m.directPath)) return Buffer.alloc(0);
    const stream = await downloadContentFromMessage(m, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    if (filename) await fs.promises.writeFile(filename, buffer);
    return filename && fs.existsSync(filename) ? filename : buffer;
 };

  sock.decodeJid = jid => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      const decode = jidDecode(jid) || {};
      return decode.user && decode.server ? `${decode.user}@${decode.server}` : jid;
    }
    return jid;
  };

  return sock;
}

// Scheduler autojpm (cek setiap menit)
function startAutoJpm(sock) {
  setInterval(async () => {
    try {
      const setting = global.db?.settings?.autojpm;
      if (!setting || !setting.enabled) return;
      const now = Date.now();
      if (now - setting.lastRun >= setting.interval * 60000) {
        console.log('Menjalankan autojpm otomatis...');
        if (typeof global.kirimAutoJpm === 'function') {
          await global.kirimAutoJpm(sock);
        }
      }
    } catch (e) {
      console.error('Error autojpm interval:', e);
    }
  }, 60000);
}
function startAutoSwgc(sock) {
  setInterval(async () => {
    try {
      const setting = global.db?.settings?.autojpmswgc;
      if (!setting || !setting.enabled) return;
      const now = Date.now();
      if (now - setting.lastRun >= setting.interval * 60000) {
        console.log('Menjalankan autojpmswgc otomatis...');
        if (typeof global.kirimAutoSwgc === 'function') {
          await global.kirimAutoSwgc(sock);
        }
      }
    } catch (e) {
      console.error('Error autojpmswgc interval:', e);
    }
  }, 60000);
}

StartBot();