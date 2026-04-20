/**
 * URL Shortener
 */

const APIs = require('../../utils/api');

module.exports = {
  name: 'short',
  aliases: ['shorten', 'tiny', 'shrink'],
  category: 'utility',
  description: 'Shorten a URL',
  usage: '.short <URL>',
  
  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .short <URL>\n\nExample: .short https://google.com');
      }

      const url = args[0].startsWith('http') ? args[0] : `https://${args[0]}`;
      
      await sock.sendMessage(msg.key.remoteJid, { react: { text: '🔗', key: msg.key } });

      const result = await APIs.shortenUrl(url);
      await extra.reply(`*URL Shortened!*\n\n🔗 Original: ${url}\n✨ Short: ${result}`);
    } catch (error) {
      await extra.reply('❌ Failed to shorten URL!');
    }
  }
};