const fs = require("fs");

global.owner = "6282141101127"
global.namaOwner = "Zyne"
global.prefix = ".";
global.botName = "Zyne–JPM";
global.pairingNumber = "6282141101127"

global.idSaluran = "120363420301582934@newsletter";
global.namaSaluran = "Powered by Zyne";

global.paymentImage = "https://pixhost.to/show/7148/714639463_1001686256.png";
global.dana = "081335108831";  
global.gopay = "082141101127"; 
global.ovo = "_"; 

global.mess = {
  owner: "Fitur ini hanya bisa digunakan oleh *Owner Bot* Sayang.",
  premium: "Fitur ini hanya bisa digunakan oleh *User Premium* Sayang.",
  group: "Fitur ini hanya dapat digunakan di dalam grup.",
  private: "Fitur ini hanya dapat digunakan di private chat.",
  admin: "Fitur ini hanya bisa digunakan oleh admin grup.",
  botadmin: "Fitur ini hanya dapat digunakan jika bot adalah admin grup.",
};

let file = require.resolve(__filename) 
fs.watchFile(file, () => {
fs.unwatchFile(file)
delete require.cache[file]
require(file)
})