async function LoadDataBase(conn, m) {
  try {
    if (typeof global.db.users !== 'object') global.db.users = {};
    if (typeof global.db.groups !== 'object') global.db.groups = {};
    if (typeof global.db.settings !== 'object') global.db.settings = {};

    const defaultSettings = { owner: [], list: {} };
    for (let key in defaultSettings) {
      if (!(key in global.db.settings)) global.db.settings[key] = defaultSettings[key];
    }

    // Default autojpm
    if (typeof global.db.settings.autojpm !== 'object') global.db.settings.autojpm = {};
    const defaultAutoJpm = {
      enabled: false,
      message: 'Halo ini pesan otomatis',
      media: null,
      interval: 60,
      lastRun: 0,
      blacklist: []
    };
    for (let key in defaultAutoJpm) {
      if (!(key in global.db.settings.autojpm)) global.db.settings.autojpm[key] = defaultAutoJpm[key];
    }

    // Default autoJoinGC
    if (typeof global.db.settings.autoJoinGC !== 'object') global.db.settings.autoJoinGC = {};
    const defaultAutoJoin = { enabled: false };
    for (let key in defaultAutoJoin) {
      if (!(key in global.db.settings.autoJoinGC)) global.db.settings.autoJoinGC[key] = defaultAutoJoin[key];
    }
   // Default autojpmswgc (story grup otomatis)
if (typeof global.db.settings.autojpmswgc !== 'object') global.db.settings.autojpmswgc = {};
const defaultAutoSwgc = {
  enabled: false,
  message: 'Halo ini story otomatis',
  media: null,
  interval: 60,
  lastRun: 0,
  blacklist: [] // opsional, untuk mengecualikan grup tertentu
};
for (let key in defaultAutoSwgc) {
  if (!(key in global.db.settings.autojpmswgc)) global.db.settings.autojpmswgc[key] = defaultAutoSwgc[key];
}

    if (typeof global.db.users[m.sender] !== 'object') global.db.users[m.sender] = {};
    const defaultUser = { premium: false };
    for (let key in defaultUser) {
      if (!(key in global.db.users[m.sender])) global.db.users[m.sender][key] = defaultUser[key];
    }

    if (m.isGroup) {
      if (typeof global.db.groups[m.chat] !== 'object') global.db.groups[m.chat] = {};
      const defaultGroup = { antilink: false, antilink2: false, autopromosi: false, welcome: false };
      for (let key in defaultGroup) {
        if (!(key in global.db.groups[m.chat])) global.db.groups[m.chat][key] = defaultGroup[key];
      }
    }
  } catch (e) {
    throw e;
  }
}

module.exports = LoadDataBase;