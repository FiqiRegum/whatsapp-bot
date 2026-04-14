require("./config.js");
const chalk = require("chalk");
const fs = require("fs");
const util = require("util");
const crypto = require("crypto");
const { exec, spawn, execSync } = require('child_process');
const { prepareWAMessageMedia, generateWAMessageFromContent, generateWAMessageContent } = require("baileys");
const loadDb = require("./Files/load_database.js");
 
// Fungsi kirim autojpm ke semua grup (kecuali blacklist)
const kirimAutoJpm = async (sock, force = false) => {
  const setting = global.db.settings.autojpm;
  if (!setting.enabled && !force) return { success: 0, fail: 0, skipped: true };
  const now = Date.now();
  if (!force && (now - setting.lastRun) < setting.interval * 60000) 
    return { success: 0, fail: 0, skipped: true };

  const groups = await sock.groupFetchAllParticipating();
  const groupIds = Object.keys(groups).filter(id => !setting.blacklist.includes(id));
  let success = 0, fail = 0;
  for (let id of groupIds) {
    try {
      if (setting.media) {
        const mediaData = setting.media;
        if (mediaData.type === 'image') {
          await sock.sendMessage(id, { 
            image: Buffer.from(mediaData.data, 'base64'), 
            caption: setting.message,
            mimetype: mediaData.mimetype
          });
        } else if (mediaData.type === 'video') {
          await sock.sendMessage(id, { 
            video: Buffer.from(mediaData.data, 'base64'), 
            caption: setting.message,
            mimetype: mediaData.mimetype
          });
        }
      } else {
        await sock.sendMessage(id, { text: setting.message });
      }
      success++;
    } catch (e) {
      fail++;
    }
    await sleep(2000);
  }
  global.db.settings.autojpm.lastRun = now;
  console.log(`Autojpm selesai, sukses: ${success}, gagal: ${fail}`);
  return { success, fail, skipped: false };
};

// Ekspor fungsi agar bisa dipanggil dari index.js
global.kirimAutoJpm = kirimAutoJpm;

// Fungsi mengirim story ke semua grup (digunakan manual dan otomatis)
const kirimStoryGrup = async (sock, message, media = null) => {
  const groups = await sock.groupFetchAllParticipating();
  const groupIds = Object.keys(groups);
  let success = 0, failed = 0;
  const bgColors = ["#FF5733", "#33FF57", "#3357FF", "#F033FF", "#FF33F0", "#33FFF0", "#F0FF33", "#FF8333", "#8333FF", "#33FF83"];
  for (const jid of groupIds) {
    try {
      let content;
      if (media) {
        content = {
          [media.type]: { url: media.url },
          caption: message || undefined
        };
      } else {
        const randomColor = bgColors[Math.floor(Math.random() * bgColors.length)];
        content = {
          text: message,
          backgroundColor: randomColor,
          font: Math.floor(Math.random() * 7) + 1
        };
      }
      const inside = await generateWAMessageContent(content, {
        upload: sock.waUploadToServer || (async (buf) => ({ url: await global.CatBox(buf) })),
        logger: sock.logger
      });
      const messageSecret = crypto.randomBytes(32);
      const msg = await generateWAMessageFromContent(jid, {
        messageContextInfo: { messageSecret },
        groupStatusMessageV2: {
          message: {
            ...inside,
            messageContextInfo: { messageSecret }
          }
        }
      }, { userJid: sock.user.id });
      await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
      success++;
      await sleep(2000);
    } catch (err) {
      console.error(`Gagal kirim story ke ${jid}:`, err);
      failed++;
    }
  }
  return { success, failed };
};

// Ekspor fungsi untuk scheduler
global.kirimAutoSwgc = async (sock, force = false) => {
  const setting = global.db.settings.autojpmswgc;
  if (!setting.enabled && !force) return { success: 0, fail: 0, skipped: true };
  const now = Date.now();
  if (!force && (now - setting.lastRun) < setting.interval * 60000) 
    return { success: 0, fail: 0, skipped: true };

  let mediaObj = null;
  if (setting.media) {
    const buffer = Buffer.from(setting.media.data, 'base64');
    const url = await global.CatBox(buffer);
    if (url) mediaObj = { type: setting.media.type, url: url };
  }

  const result = await kirimStoryGrup(sock, setting.message, mediaObj);
  global.db.settings.autojpmswgc.lastRun = now;
  console.log(`AutoJpmSwgc selesai, sukses: ${result.success}, gagal: ${result.failed}`);
  return { success: result.success, fail: result.failed, skipped: false };
};

module.exports = async (sock, m) => {
  await loadDb(sock, m);
  const isCmd = m?.body?.startsWith(prefix);
  const quoted = m.quoted ? m.quoted : m;
  const mime = quoted?.msg?.mimetype || quoted?.mimetype || null;
  const args = m?.body?.trim().split(/ +/).slice(1) || [];
  const qmsg = m.quoted || m;
  const text = args.join(" ");
  const command = isCmd
    ? m.body.slice(prefix.length).trim().split(" ").shift().toLowerCase()
    : "";
  const cmd = prefix + command;
  const isOwner = m.isOwner
  let metadata = {};
if (m.isGroup) {
    try {
        if (global.groupMetadataCache.has(m.chat)) {
            metadata = await global.groupMetadataCache.get(m.chat);
        } else {
            metadata = await sock.groupMetadata(m.chat);
            global.groupMetadataCache.set(m.chat, metadata);
        }
    } catch (e) {
        metadata = {};
    }
}
  const admins = metadata?.participants
    ? metadata.participants.filter(p => p.admin !== null).map(p => p.id)
    : [];
  m.isAdmin = m.isGroup && admins ? admins.includes(m.sender) : false
  m.isBotAdmin = m.isGroup && admins ? admins.includes(m.botNumber) : false
    
  const qtext = {key: {remoteJid: "status@broadcast", participant: "0@s.whatsapp.net"}, message: {"extendedTextMessage": {"text": `By ${namaOwner}`}}}

    if (isCmd) {
    console.log(
      chalk.white("●> 𝐏𝐞𝐧𝐠𝐢𝐫𝐢𝐦 :"), chalk.blue(m.chat),
      "\n" + chalk.white("●> 𝐆𝐫𝐨𝐮𝐩   :"), chalk.blue(m.isGroup ? metadata.subject : "Private"),
      "\n" + chalk.white("●> 𝐏𝐞𝐬𝐚𝐧 :"), chalk.blue(cmd),
      "\n"
    );
  }

  switch (command) {
  
case "menu": {
    const botname = global.botName;
    const menuText = `
 𝙃𝙖𝙞 @${m.sender.split("@")[0]}👋
Selamat Datang Di *${global.botName}* *📌 ZYNE–JPM SIAP MELAYANI MU SAYANG*

┏━『 *AUTO MENU* 』
┃
┣⌬ .autojpmswgc
┣⌬ .setautoswgc
┣⌬ .autojpm
┣⌬ .setjpm
┣⌬ .autojoingc
┗━━━━━━━◧

┏━『 *MAIN MENU* 』
┃
┣⌬ .pushkontak
┣⌬ .jpm
┣⌬ .jpmht
┣⌬ .jpmswgc
┣⌬ .brat
┣⌬ .brat2
┣⌬ .cekidch
┣⌬ .bljpm
┗━━━━━━━◧

┏━『 *OWNER MENU 👑* 』
┃
┣⌬ .payment
┣⌬ .done
┣⌬ .proses
┣⌬ .backupsc
┗━━━━━━━◧
`.trim();

    const quotedTemplate = {
        key: {
            remoteJid: 'status@broadcast',
            participant: '0@s.whatsapp.net'
        },
        message: {
            newsletterAdminInviteMessage: {
                newsletterJid: global.idSaluran,
                newsletterName: global.namaSaluran,
                caption: `By Zyne`,
                inviteExpiration: 0
            }
        }
    };

    await sock.sendMessage(m.chat, {
        text: menuText,
        mentions: [m.sender],
        contextInfo: {
            externalAdReply: {
                title: global.botName,
                body: "Zyne Bot Whatsapp 2026",
                thumbnailUrl: "https://pixhost.to/show/7147/714638335_1001688332.jpg",
                mediaType: 1, // 1 = image
                sourceUrl: global.linkSaluran || "https://whatsapp.com/channel/0029Vb6WBVpGk1FrJ7Jqht1F",
                renderLargerThumbnail: false,
                showAdAttribution: true
            }
        }
    }, { quoted: quotedTemplate });
}
break;

case "brat": {
  if (!text) return m.reply(`*Contoh:* ${cmd} teks\n\nContoh: .brat Selamat pagi`);
  
  const apiKey = "123"; // Ganti dengan apikey Anda jika berbeda
  const apiUrl = `https://fyxzpedia-apikeys.vercel.app/imagecreator/brat?apikey=${apiKey}&text=${encodeURIComponent(text)}`;
  
  await m.reply("⏳ Membuat stiker brat...");
  
  try {
    const imageBuffer = await getBuffer(apiUrl);
    if (!imageBuffer) throw new Error("Gagal mengambil gambar dari API");
    
    await sock.sendMessage(m.chat, {
      sticker: imageBuffer,
      mimetype: 'image/webp'
    }, { quoted: m });
    
  } catch (err) {
    console.error("Error brat:", err);
    m.reply(`❌ Gagal membuat stiker brat.\nError: ${err.message}`);
  }
}
break;
case "brat2": {
  if (!text) return m.reply(`*Contoh:* ${cmd} teks\n\nContoh: .brat2 Selamat malam`);
  
  const apiKey = "123"; // Ganti dengan apikey Anda jika berbeda
  const apiUrl = `https://fyxzpedia-apikeys.vercel.app/imagecreator/bratvid?apikey=${apiKey}&text=${encodeURIComponent(text)}`;
  
  await m.reply("⏳ Membuat stiker video brat...");
  
  try {
    const videoBuffer = await getBuffer(apiUrl);
    if (!videoBuffer) throw new Error("Gagal mengambil video dari API");
    
    // Kirim sebagai stiker video
    await sock.sendMessage(m.chat, {
      sticker: videoBuffer,
      mimetype: 'video/mp4'
    }, { quoted: m });
    
  } catch (err) {
    console.error("Error brat2:", err);
    m.reply(`❌ Gagal membuat stiker video brat.\nError: ${err.message}`);
  }
}
break;
case "payment": {
    if (!isOwner) return m.reply(mess.owner);
    
    const imageUrl = global.paymentImage || "https://telegra.ph/file/placeholder.jpg";
    const caption = `━━━  𝗟𝗜𝗦𝗧 𝗔𝗟𝗟 𝗣𝗔𝗬𝗠𝗘𝗡𝗧  ━━━\n\n☐ GOPAY : ${global.gopay || "-"}\n☐ DANA  : ${global.dana || "-"}\n☐ OVO   : ${global.ovo || "-"}\n\n𝗡𝗼𝘁𝗲𝗱 : Sertakan bukti pembayaran demi keamanan bersama.\n\n~ ${global.botName}`;
    
    const quotedTemplate = {
        key: {
            remoteJid: 'status@broadcast',
            participant: '0@s.whatsapp.net'
        },
        message: {
            newsletterAdminInviteMessage: {
                newsletterJid: global.idSaluran,
                newsletterName: global.namaSaluran,
                caption: `Payment Info`,
                inviteExpiration: 0
            }
        }
    };
    
    await sock.sendMessage(m.chat, { image: { url: imageUrl }, caption: caption }, { quoted: quotedTemplate });
}
break;

case "done":
case "proses": {
    if (!isOwner) return m.reply(mess.owner);
    if (!text) return m.reply(`*Contoh:* ${cmd} Nama Barang`);
    
    const status = command === "done" ? "Done ✅" : "Proses 🔄";
    const tanggal = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const pesan = `𝗧𝗲𝗿𝗶𝗺𝗮𝗸𝗮𝘀𝗶𝗵 𝗧𝗲𝗹𝗮𝗵 𝗢𝗿𝗱𝗲𝗿 ✅\n📦 ${text}\n📃 Status : ${status}\n📆 ${tanggal}\n\n📢 Link Testimoni :https://whatsapp.com/channel/0029Vb6WBVpGk1FrJ7Jqht1F`;
    
    const quotedTemplate = {
        key: {
            remoteJid: 'status@broadcast',
            participant: '0@s.whatsapp.net'
        },
        message: {
            newsletterAdminInviteMessage: {
                newsletterJid: global.idSaluran,
                newsletterName: global.namaSaluran,
                caption: `Order Status`,
                inviteExpiration: 0
            }
        }
    };
    
    await sock.sendMessage(m.chat, { text: pesan }, { quoted: quotedTemplate });
}
break;

case "autojpmswgc": {
  if (!isOwner) return m.reply(mess.owner);
  const sub = args[0]?.toLowerCase();
  if (sub === 'on') {
    global.db.settings.autojpmswgc.enabled = true;
    m.reply('✅ Autojpmswgc diaktifkan');
  } else if (sub === 'off') {
    global.db.settings.autojpmswgc.enabled = false;
    m.reply('✅ Autojpmswgc dimatikan');
  } else if (sub === 'status') {
    const s = global.db.settings.autojpmswgc;
    let last = s.lastRun ? new Date(s.lastRun).toLocaleString('id-ID') : 'Belum pernah';
    let next = s.enabled && s.lastRun ? new Date(s.lastRun + s.interval*60000).toLocaleString('id-ID') : '-';
    let teks = `*Status Autojpmswgc*\n\nEnabled: ${s.enabled ? '✅' : '❌'}\nPesan: ${s.message}\nMedia: ${s.media ? '✅' : '❌'}\nInterval: ${s.interval} menit\nTerakhir: ${last}\nBerikutnya: ${next}`;
    m.reply(teks);
  } else {
    m.reply(`*Penggunaan Autojpmswgc*\n\n• ${cmd} on\n• ${cmd} off\n• ${cmd} status`);
  }
}
break;

case "setautoswgc": {
  if (!isOwner) return m.reply(mess.owner);
  if (!text) return m.reply(`*Contoh:* ${cmd} Halo semuanya|1jam\n\nKirim perintah ini dengan media (gambar/video) untuk menyertakan media.`);
  
  let [newMsg, intervalStr] = text.split('|').map(s => s.trim());
  if (!newMsg) return m.reply('Masukkan teks pesan');
  
  let interval = global.db.settings.autojpmswgc.interval;
  if (intervalStr) {
    let parsed = parseDuration(intervalStr);
    if (!parsed) return m.reply('Format interval salah. Gunakan angka + jam/menit/detik (contoh: 1jam, 30menit)');
    interval = parsed;
  }

  let media = null;
  if (/image|video/.test(mime)) {
    const buffer = await (m.quoted ? m.quoted.download() : m.download());
    if (buffer) {
      media = {
        type: mime.includes('image') ? 'image' : 'video',
        data: buffer.toString('base64'),
        mimetype: mime
      };
    }
  }

  global.db.settings.autojpmswgc.message = newMsg;
  global.db.settings.autojpmswgc.media = media;
  global.db.settings.autojpmswgc.interval = interval;
  
  let replyMsg = `✅ Pesan autojpmswgc diperbarui:\n"${newMsg}"\nInterval: ${interval} menit`;
  if (media) replyMsg += `\nMedia: ${media.type} disertakan.`;
  else replyMsg += `\n(Tanpa media)`;
  m.reply(replyMsg);
}
break;

case "jpmht":
case "hidetagall": {
  if (!isOwner) return m.reply(mess.owner);
  
  let mediaBuffer = null;
  let mediaType = null;
  let caption = text;
  
  // Deteksi jika ada media (gambar/video)
  if (/image|video/.test(mime)) {
    mediaType = mime.includes('image') ? 'image' : 'video';
    mediaBuffer = await (m.quoted ? m.quoted.download() : m.download());
    caption = text; // caption dari teks setelah command
  }
  
  if (!caption && !mediaBuffer) {
    return m.reply(`*Contoh Penggunaan:*\n${cmd} pesan\natau kirim media dengan caption ${cmd} pesan`);
  }
  
  const allGroups = await sock.groupFetchAllParticipating();
  const groupIds = Object.keys(allGroups);
  if (groupIds.length === 0) return m.reply("❌ Bot tidak bergabung di grup manapun.");
  
  await m.reply(`🚀 Memproses Hidetag ke ${groupIds.length} grup...\nPesan: ${caption || "tanpa teks"}`);
  
  let success = 0, fail = 0;
  for (const jid of groupIds) {
    try {
      // Ambil metadata grup untuk mendapatkan daftar member
      const metadata = await sock.groupMetadata(jid);
      const participants = metadata.participants.map(p => p.id);
      
      // Kirim pesan dengan mentions semua member
      if (mediaBuffer) {
        await sock.sendMessage(jid, {
          [mediaType]: mediaBuffer,
          caption: caption || "",
          mentions: participants
        });
      } else {
        await sock.sendMessage(jid, {
          text: caption,
          mentions: participants
        });
      }
      success++;
    } catch (err) {
      console.error(`Gagal kirim ke ${jid}:`, err);
      fail++;
    }
    await sleep(4000); // jeda 4 detik antar grup
  }
  
  m.reply(`✅ Hidetag selesai!\n📊 Total grup: ${groupIds.length}\n✅ Berhasil: ${success}\n❌ Gagal: ${fail}`);
}
break;

case "jasher":
case "jpm":
case "jaser": {
  if (!isOwner) return m.reply(mess.owner);
  if (!text) return m.reply(`*Contoh Penggunaan:*
${cmd} pesannya & bisa dengan foto juga`);
  let mediaPath;
  if (/image/.test(mime)) {
    mediaPath = await m.quoted ? await m.quoted.download() : await m.download()
  }
  const allGroups = await sock.groupFetchAllParticipating();
  const groupIds = Object.keys(allGroups);
  let successCount = 0;
  let fail = 0;
  let bl = 0;
  await m.reply(`🚀 Memproses ${mediaPath ? "Jpm Teks & Foto" : "Jpm Teks"}
  
- Total Grup: ${groupIds.length}`);
  for (const id of groupIds) {
    try {
      if (mediaPath) {
        await sock.sendMessage(id, {
          image: mediaPath,
          caption: text
        });
      } else {
        await sock.sendMessage(id, { text });
      }
      successCount++;
    } catch (e) {
      fail += 1
      console.error(`Gagal kirim ke grup ${id}:`, e);
    }
    await sleep(4000);
  }
  await sock.sendMessage(m.chat, {
    text: `Jpm ${mediaPath ? "Teks & Foto" : "Teks"} berhasil dikirim ✅
    
Berhasil: ${successCount}
Gagal: ${fail}
Blacklist: ${bl}`
  }, { quoted: m });
}
break;

case "stalkch":
case "sch":
case "idch":
case "cekidch": {
    if (!text) return m.reply(`*Contoh:* ${cmd} link/id channel`)
    if (!text.includes("https://whatsapp.com/channel/") && !text.includes("@newsletter"))
        return m.reply("Link atau id channel tidak valid")

    let result = text.trim(), opsi = "jid"
    if (text.includes("https://whatsapp.com/channel/")) {
        result = text.split("https://whatsapp.com/channel/")[1]
        opsi = "invite"
    }

    const res = await sock.newsletterMetadata(opsi, result)
    const teks =
        `*Channel Information 🌍*\n\n` +
        `- Nama: ${res.name}\n` +
        `- Total Pengikut: ${toRupiah(res.subscribers)}\n` +
        `- ID: ${res.id}\n` +
        `- Link: https://whatsapp.com/channel/${res.invite}`

    const msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: { text: teks },
                    nativeFlowMessage: {
                        buttons: [
                            { name: "cta_copy", buttonParamsJson: JSON.stringify({ display_text: "Copy Channel ID", copy_code: res.id }) }
                        ]
                    }
                }
            }
        }
    }, { userJid: m.sender, quoted: m })

    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id })
}
break

case "pushkontak":
case "puskontak": {
  if (!isOwner) return m.reply(mess.owner);
  if (!text) return m.reply(`*Contoh:* ${cmd} isi pesan`);

  global.textpushkontak = text;

  const groups = await sock.groupFetchAllParticipating();
  if (!groups || Object.keys(groups).length === 0)
    return m.reply("❌ Bot tidak tergabung di grup manapun.");

  global.dataAllGrup = groups;

  const rows = Object.values(groups).map(g => ({
    title: g.subject || "Tanpa Nama",
    description: `👥 ${g.participants.length} member`,
    id: `.pushkontak-response ${g.id}`
  }));

  await sock.sendMessage(m.chat, {
    text: `📢 *PUSH KONTAK*\n\nSilahkan pilih grup target:`,
    viewOnce: true,
    buttons: [
      {
        buttonId: "select_gc",
        buttonText: { displayText: "📂 Pilih Grup" },
        type: 4,
        nativeFlowInfo: {
          name: "single_select",
          paramsJson: JSON.stringify({
            title: "Daftar Grup",
            sections: [
              {
                title: "Pilih Target Grup",
                rows
              }
            ]
          })
        }
      }
    ],
    headerType: 1
  }, { quoted: m });
}
break;

case "pushkontak-response": {
  if (!isOwner) return m.reply(mess.owner);

  if (!global.textpushkontak || !global.dataAllGrup)
    return m.reply(
      "❌ Data pushkontak tidak ditemukan\nSilahkan ulangi dengan *.pushkontak pesan*"
    );

  const groupId = text;
  const groupData = global.dataAllGrup[groupId];
  if (!groupData) return m.reply("❌ Grup tidak ditemukan.");

  const messageText = global.textpushkontak;

  const members = groupData.participants
    .map(v => v.id)
    .filter(jid => jid && jid !== m.botNumber); // Perbaikan: gunakan m.botNumber

  await m.reply(
    `🚀 *Memulai Pushkontak*\n\n` +
    `📌 Grup : *${groupData.subject}*\n` +
    `👥 Total : *${members.length} member*`
  );

  let success = 0;

  for (const jid of members) {
    try {
      await sock.sendMessage(jid, { text: messageText }, { quoted: qtext });
      success++;
      await sleep(4000);
    } catch (e) {
      console.log("Gagal kirim ke:", jid);
    }
  }

  delete global.textpushkontak;
  delete global.dataAllGrup;

  return m.reply(
    `✅ *Pushkontak Selesai*\n\n` +
    `📤 Berhasil terkirim ke *${success} member*`
  );
}
break;

// ================= FITUR AUTOJPM =================
case "autojpm": {
  if (!isOwner) return m.reply(mess.owner);
  const sub = args[0]?.toLowerCase();
  if (sub === 'on') {
    global.db.settings.autojpm.enabled = true;
    m.reply('✅ Autojpm diaktifkan');
  } else if (sub === 'off') {
    global.db.settings.autojpm.enabled = false;
    m.reply('✅ Autojpm dimatikan');
  } else if (sub === 'status') {
    const s = global.db.settings.autojpm;
    let last = s.lastRun ? new Date(s.lastRun).toLocaleString('id-ID') : 'Belum pernah';
    let next = s.enabled && s.lastRun ? new Date(s.lastRun + s.interval*60000).toLocaleString('id-ID') : '-';
    let teks = `*Status Autojpm*\n\nEnabled: ${s.enabled ? '✅' : '❌'}\nPesan: ${s.message}\nMedia: ${s.media ? '✅' : '❌'}\nInterval: ${s.interval} menit\nBlacklist: ${s.blacklist.length} grup\nTerakhir: ${last}\nBerikutnya: ${next}`;
    m.reply(teks);
  } else {
    m.reply(`*Penggunaan Autojpm*\n\n• ${cmd} on\n• ${cmd} off\n• ${cmd} status`);
  }
}
break;

case "setjpm": {
  if (!isOwner) return m.reply(mess.owner);
  if (!text) return m.reply(`*Contoh:* ${cmd} Halo semuanya|1jam\n\nKirim perintah ini dengan media (gambar/video) untuk menyertakan media.`);
  
  let [newMsg, intervalStr] = text.split('|').map(s => s.trim());
  if (!newMsg) return m.reply('Masukkan teks pesan');
  
  let interval = global.db.settings.autojpm.interval;
  if (intervalStr) {
    let parsed = parseDuration(intervalStr);
    if (!parsed) return m.reply('Format interval salah. Gunakan angka + jam/menit/detik (contoh: 1jam, 30menit)');
    interval = parsed;
  }

  let media = null;
  if (/image|video/.test(mime)) {
    const buffer = await (m.quoted ? m.quoted.download() : m.download());
    if (buffer) {
      media = {
        type: mime.includes('image') ? 'image' : 'video',
        data: buffer.toString('base64'),
        mimetype: mime
      };
    }
  }

  global.db.settings.autojpm.message = newMsg;
  global.db.settings.autojpm.media = media;
  global.db.settings.autojpm.interval = interval;
  
  let replyMsg = `✅ Pesan autojpm diperbarui:\n"${newMsg}"\nInterval: ${interval} menit`;
  if (media) replyMsg += `\nMedia: ${media.type} disertakan.`;
  else replyMsg += `\n(Tanpa media)`;
  m.reply(replyMsg);
}
break;

// ================= BLACKLIST GRUP UNTUK AUTOJPM (INTERACTIVE) =================
case "bljpm": {
    if (!isOwner) return m.reply(mess.owner);
    
    const groups = await sock.groupFetchAllParticipating();
    const groupList = Object.values(groups);
    const blacklist = global.db.settings.autojpm.blacklist || [];
    
    // Siapkan daftar grup yang belum diblacklist
    const available = groupList.filter(g => !blacklist.includes(g.id));
    if (available.length === 0) {
        return m.reply("✅ Semua grup sudah masuk blacklist.");
    }
    
    let rows = [];
    for (let g of available) {
        rows.push({
            title: g.subject || "Tanpa Nama",
            description: `ID: ${g.id} | 👥 ${g.participants.length} member`,
            id: `.bljpm-add ${g.id}|${g.subject || "Tanpa Nama"}`
        });
    }
    
    const msg = await generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: {
                        text: `🔴 *Tambah Blacklist Autojpm*\nPilih grup yang ingin diblacklist:\n\nTotal tersedia: ${available.length}`
                    },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: "single_select",
                                buttonParamsJson: JSON.stringify({
                                    title: "Daftar Grup Tersedia",
                                    sections: [
                                        {
                                            title: "Pilih Grup untuk Diblacklist",
                                            rows: rows
                                        }
                                    ]
                                })
                            }
                        ]
                    }
                }
            }
        }
    }, { userJid: m.sender, quoted: m });
    
    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}
break;

case "bljpm-add": {
    if (!isOwner) return;
    if (!text) return;
    
    const [id, name] = text.split("|").map(s => s.trim());
    if (!id || !name) return m.reply("Data tidak valid.");
    
    const blacklist = global.db.settings.autojpm.blacklist;
    if (blacklist.includes(id)) {
        return m.reply(`❌ Grup *${name}* sudah ada di blacklist.`);
    }
    
    blacklist.push(id);
    m.reply(`✅ Grup *${name}* berhasil ditambahkan ke blacklist.`);
}
break;

case "delbljpm": {
    if (!isOwner) return m.reply(mess.owner);
    
    const blacklist = global.db.settings.autojpm.blacklist;
    if (blacklist.length === 0) {
        return m.reply("📭 Tidak ada grup dalam blacklist.");
    }
    
    const groups = await sock.groupFetchAllParticipating();
    const groupList = Object.values(groups);
    
    let rows = [
        {
            title: "🗑️ Hapus Semua",
            description: "Hapus semua grup dari blacklist",
            id: `.delbljpm-response all`
        }
    ];
    
    for (let id of blacklist) {
        let grup = groupList.find(g => g.id === id);
        let name = grup ? (grup.subject || "Unknown") : "Unknown (tidak ditemukan)";
        rows.push({
            title: name,
            description: `ID: ${id}`,
            id: `.delbljpm-response ${id}|${name}`
        });
    }
    
    const msg = await generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    body: {
                        text: `🟢 *Hapus Blacklist Autojpm*\nPilih grup yang ingin dihapus dari blacklist:\n\nTotal blacklist: ${blacklist.length}`
                    },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: "single_select",
                                buttonParamsJson: JSON.stringify({
                                    title: "Daftar Blacklist",
                                    sections: [
                                        {
                                            title: "Pilih Grup untuk Dihapus",
                                            rows: rows
                                        }
                                    ]
                                })
                            }
                        ]
                    }
                }
            }
        }
    }, { userJid: m.sender, quoted: m });
    
    await sock.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}
break;

case "delbljpm-response": {
    if (!isOwner) return;
    if (!text) return;
    
    const blacklist = global.db.settings.autojpm.blacklist;
    
    if (text === "all") {
        global.db.settings.autojpm.blacklist = [];
        return m.reply("✅ Semua grup berhasil dihapus dari blacklist.");
    }
    
    if (text.includes("|")) {
        const [id, name] = text.split("|").map(s => s.trim());
        if (!blacklist.includes(id)) {
            return m.reply(`❌ Grup *${name}* tidak ada dalam blacklist.`);
        }
        
        global.db.settings.autojpm.blacklist = blacklist.filter(g => g !== id);
        return m.reply(`✅ Grup *${name}* berhasil dihapus dari blacklist.`);
    }
}
break;

// ================= FITUR AUTO JOIN GRUP =================
case "autojoingc": {
  if (!isOwner) return m.reply(mess.owner);
  const sub = args[0]?.toLowerCase();
  if (sub === 'on') {
    global.db.settings.autoJoinGC.enabled = true;
    m.reply('✅ Auto Join Grup diaktifkan');
  } else if (sub === 'off') {
    global.db.settings.autoJoinGC.enabled = false;
    m.reply('✅ Auto Join Grup dimatikan');
  } else if (sub === 'status') {
    m.reply(`*Status Auto Join Grup*\n\nEnabled: ${global.db.settings.autoJoinGC.enabled ? '✅' : '❌'}`);
  } else {
    m.reply(`*Penggunaan Auto Join Grup*\n\n• ${cmd} on\n• ${cmd} off\n• ${cmd} status`);
  }
}
break;

case "backupsc":
case "bck":
case "backup": {
    if (!isOwner) return m.reply(mess.owner);
    try {
        const tmpDir = "./sampah";
        if (fs.existsSync(tmpDir)) {
            const files = fs.readdirSync(tmpDir).filter(f => f !== "Fyxzpedia");
            for (let file of files) {
                fs.unlinkSync(`${tmpDir}/${file}`);
            }
        }
        await m.reply("Backup Script Bot, Tunggu sebentar...");
        
        const name = global.botName || "Backup"; // Nama file zip
        const exclude = [
            "node_modules",
            "config", 
            "Session",
            "session",
            "Fyxz",
            "package-lock.json",
            "yarn.lock",
            ".npm",
            ".cache",
            ".git",
            "sampah",
            "database.json" // opsional, jika ingin mengecualikan database
        ];
        
        const allItems = fs.readdirSync(".", { withFileTypes: true });
        const filesToZip = [];
        allItems.forEach((item) => {
            if (exclude.includes(item.name)) return;
            filesToZip.push(item.name);
        });

        if (!filesToZip.length) return m.reply("Tidak ada file yang dapat di-backup.");
        
        // Buat perintah zip dengan exclude pattern
        const excludeArgs = exclude.map(e => `-x "${e}/*"`).join(" ");
        execSync(`zip -r ${name}.zip ${filesToZip.join(" ")} ${excludeArgs}`);

        await sock.sendMessage(m.sender, {
            document: fs.readFileSync(`./${name}.zip`),
            fileName: `${name}.zip`,
            mimetype: "application/zip",
            caption: `Backup Script Bot - ${global.botName || "Backup"}`
        }, { quoted: m });

        fs.unlinkSync(`./${name}.zip`);

        if (m.chat !== m.sender) m.reply("✅ Script Bot berhasil dikirim ke Private Chat.");
    } catch (err) {
        console.error("Backup Error:", err);
        m.reply("❌ Terjadi kesalahan saat melakukan backup.");
    }
}
break;

// ================= FITUR STORY GRUP KE SEMUA GRUP =================
case "jpmswgc": {
    if (!isOwner) return m.reply(mess.owner);
    
    let storyText = "";
    let mediaBuffer = null;
    let mediaType = null;
    
    // Deteksi jika pesan yang dikirim adalah media (gambar/video)
    if (/image|video/.test(mime)) {
        mediaType = mime.includes('image') ? 'image' : 'video';
        mediaBuffer = await (m.quoted ? m.quoted.download() : m.download());
        storyText = text;
    } else {
        storyText = text;
    }
    
    if (!storyText && !mediaBuffer) {
        return m.reply(`❌ Masukkan teks atau kirim media dengan caption .jpmswgc`);
    }
    
    await m.reply("⏳ Mengirim story ke semua grup... Mohon tunggu.");
    
    try {
        const groups = await sock.groupFetchAllParticipating();
        const groupIds = Object.keys(groups);
        if (groupIds.length === 0) return m.reply("❌ Bot tidak bergabung di grup manapun.");
        
        // Daftar warna background untuk story teks
        const bgColors = [
            "#FF5733", "#33FF57", "#3357FF", "#F033FF", "#FF33F0",
            "#33FFF0", "#F0FF33", "#FF8333", "#8333FF", "#33FF83"
        ];
        
        let success = 0, failed = 0;
        
        for (const jid of groupIds) {
            try {
                let content;
                if (mediaBuffer) {
                    // Upload media ke server eksternal (CatBox) untuk mendapatkan URL
                    const mediaUrl = await global.CatBox(mediaBuffer);
                    if (!mediaUrl) throw new Error("Gagal upload media");
                    
                    content = {
                        [mediaType]: { url: mediaUrl },
                        caption: storyText || undefined
                    };
                } else {
                    const randomColor = bgColors[Math.floor(Math.random() * bgColors.length)];
                    content = {
                        text: storyText,
                        backgroundColor: randomColor,
                        font: Math.floor(Math.random() * 7) + 1
                    };
                }
                
                // Proses konten menjadi pesan yang sudah diupload medianya
                const inside = await generateWAMessageContent(content, {
                    upload: sock.waUploadToServer,
                    logger: sock.logger
                });
                
                // Buat messageSecret (32 byte acak)
                const messageSecret = crypto.randomBytes(32);
                
                // Bangun pesan dengan groupStatusMessageV2
                const msg = await generateWAMessageFromContent(jid, {
                    messageContextInfo: { messageSecret },
                    groupStatusMessageV2: {
                        message: {
                            ...inside,
                            messageContextInfo: { messageSecret }
                        }
                    }
                }, { userJid: m.sender });
                
                // Kirim via relayMessage
                await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
                
                success++;
                await sleep(2000); // jeda antar grup
            } catch (err) {
                console.error(`Gagal kirim story ke ${jid}:`, err);
                failed++;
            }
        }
        
        m.reply(`✅ Story selesai dikirim!\n📊 Total grup: ${groupIds.length}\n✅ Berhasil: ${success}\n❌ Gagal: ${failed}`);
        
    } catch (err) {
        console.error("Error:", err);
        m.reply("❌ Terjadi kesalahan: " + err.message);
    }
}
break;

  default:
if (m.body.toLowerCase().startsWith("xx ")) {
  if (!isOwner) return;
  try {
    const r = await eval(`(async()=>{${text}})()`);
    sock.sendMessage(m.chat, { text: util.format(typeof r === "string" ? r : util.inspect(r)) }, { quoted: m });
  } catch (e) {
    sock.sendMessage(m.chat, { text: util.format(e) }, { quoted: m });
  }
}

if (m.body.toLowerCase().startsWith("x ")) {
  if (!isOwner) return;
  try {
    let r = await eval(text);
    sock.sendMessage(m.chat, { text: util.format(typeof r === "string" ? r : util.inspect(r)) }, { quoted: m });
  } catch (e) {
    sock.sendMessage(m.chat, { text: util.format(e) }, { quoted: m });
  }
}

if (m.body.startsWith('$ ')) {
  if (!isOwner) return;
  exec(m.body.slice(2), (e, out) =>
    sock.sendMessage(m.chat, { text: util.format(e ? e : out) }, { quoted: m })
  );
}

  }

  // Auto Join Grup - Deteksi link di semua chat (tanpa balasan, hanya log)
  if (global.db.settings.autoJoinGC?.enabled && m.body) {
    const inviteRegex = /chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9_-]{22})/i;
    const match = m.body.match(inviteRegex);
    if (match && match[1]) {
      const inviteCode = match[1];
      try {
        await sock.groupAcceptInvite(inviteCode);
        console.log(`[AUTOJOIN] ✅ Berhasil join grup dengan kode: ${inviteCode} (dari chat: ${m.chat})`);
      } catch (e) {
        console.log(`[AUTOJOIN] ❌ Gagal join ${inviteCode} dari ${m.chat}: ${e.message}`);
      }
      await sleep(2000);
    }
  }
}; // <-- penutup untuk module.exports

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  delete require.cache[file];
  require(file);
});