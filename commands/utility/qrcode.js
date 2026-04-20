/**
 * QR Code Generator
 */

const axios = require('axios');
const config = require('/root/pyBot/config');

module.exports = {
  name: 'qr',
  aliases: ['qrcode', 'makeqr'],
  category: 'utility',
  description: 'Generate QR code from text',
  usage: '.qr <text>',
  
  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .qr <text>\n\nExample: .qr Hello World');
      }

      const text = args.join(' ');
      await sock.sendMessage(msg.key.remoteJid, { react: { text: '📱', key: msg.key } });

      const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(text)}`;
      
      await sock.sendMessage(msg.key.remoteJid, {
        image: { url: qrApi },
        caption: `*QR Code by ${config.botName.toUpperCase()}*\n\n📝 ${text}`
      }, { quoted: msg });
    } catch (error) {
      await extra.reply('❌ Failed to generate QR code!');
    }
  }
};