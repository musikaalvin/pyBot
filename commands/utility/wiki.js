const path = require('path');
/**
 * Wikipedia Search
 */

const APIs = require('../../utils/api');
const config = require(path.join(__dirname, '../../config'));

module.exports = {
  name: 'wiki',
  aliases: ['wikipedia', 'wikisearch'],
  category: 'utility',
  description: 'Search Wikipedia',
  usage: '.wiki <query>',
  
  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .wiki <query>\n\nExample: .wiki Uganda');
      }

      const query = args.join(' ');
      await sock.sendMessage(msg.key.remoteJid, { react: { text: '📚', key: msg.key } });

      const result = await APIs.wikiSearch(query);
      
      if (result) {
        const extract = result.extract ? result.extract.substring(0, 1000) : 'No description available';
        await extra.reply(`*📚 ${result.title}*\n\n${extract}\n\n🔗 ${result.content_urls?.desktop?.page || ''}\n\n_Powered by ${config.botName}_`);
      } else {
        await extra.reply('❌ No results found!');
      }
    } catch (error) {
      await extra.reply('❌ Failed to search Wikipedia!');
    }
  }
};