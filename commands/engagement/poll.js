/**
 * Poll Command - WhatsApp native poll
 */

const config = require('/root/pyBot/config');

module.exports = {
  name: 'poll',
  aliases: ['vote', 'polling'],
  category: 'engagement',
  description: 'Create a poll',
  usage: '.poll <question> | <option1> | <option2> | ...',
  
  async execute(sock, msg, args, extra) {
    try {
      const content = args.join(' ');

      if (!content || !content.includes('|')) {
        return extra.reply(`❌ Usage: .poll <question> | <option1> | <option2> | ...\n\nExample: .poll What color? | Red | Blue | Green`);
      }

      const parts = content.split('|').map(s => s.trim());
      const question = parts[0];
      const options = parts.slice(1);

      if (options.length < 2) {
        return extra.reply('❌ Provide at least 2 options!');
      }
      
      if (options.length > 10) {
        return extra.reply('❌ Maximum 10 options!');
      }
      
      await sock.sendMessage(msg.key.remoteJid, {
        poll: { name: question, values: options }
      }, { quoted: msg });
      
    } catch (error) {
      await extra.reply('❌ Failed to create poll!');
    }
  }
};