/**
 * Create Pastebin
 */

const axios = require('axios');

module.exports = {
  name: 'paste',
  aliases: ['pastebin', 'pastetext'],
  category: 'utility',
  description: 'Create a Pastebin',
  usage: '.paste <text>',
  
  async execute(sock, msg, args, extra) {
    try {
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || args.join(' ');
      const content = text.split(' ').slice(1).join(' ');

      if (!content) {
        return extra.reply('❌ Usage: .paste <text>\n\nExample: .paste Hello world');
      }

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '📝', key: msg.key } });

      try {
        const response = await axios.post('https://hastebin.com/documents', content);
        const key = response.data.key;
        await extra.reply(`*Text Pasted!*\n\n🔗 https://hastebin.com/share/${key}`);
      } catch (err) {
        await extra.reply('❌ Failed to create paste!');
      }
    } catch (error) {
      await extra.reply('❌ An error occurred!');
    }
  }
};