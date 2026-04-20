/**
 * Giveaway Command
 */

const config = require('/root/pyBot/config');

module.exports = {
  name: 'giveaway',
  aliases: ['gway', 'contest'],
  category: 'engagement',
  description: 'Start a giveaway',
  usage: '.giveaway <prize> | <time in minutes>',
  
  async execute(sock, msg, args, extra) {
    try {
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || args.join(' ');
      const content = text.split(' ').slice(1).join(' ');

      if (!content || !content.includes('|')) {
        return extra.reply(`❌ Usage: .giveaway <prize> | <time in minutes>\n\nExample: .giveaway 100 USD | 10`);
      }

      const parts = content.split('|').map(s => s.trim());
      const prize = parts[0];
      const duration = parseInt(parts[1]) || 5;

      if (duration > 60) {
        return extra.reply('❌ Maximum 60 minutes!');
      }

      const participants = new Set();
      const endTime = Date.now() + duration * 60 * 1000;

      await extra.reply(`*🎁 GIVEAWAY!*\n\n🏆 Prize: ${prize}\n⏱️ Duration: ${duration} minutes\n\nReact with 🎉 to enter!\n\nPowered by ${config.botName}`);

      const originalMsg = msg;

      const handler = async (sock, msg) => {
        if (msg.key.remoteJid !== originalMsg.key.remoteJid) return;
        if (msg.message?.reactionMessage?.text === '🎉') {
          const user = msg.key.participant;
          if (!participants.has(user)) {
            participants.add(user);
            await sock.sendMessage(originalMsg.key.remoteJid, { 
              react: { text: '✅', key: msg.key } 
            });
          }
        }
      };

      setTimeout(async () => {
        const winner = Array.from(participants)[Math.floor(Math.random() * participants.length)] || 'No one';
        await sock.sendMessage(originalMsg.key.remoteJid, {
          text: `*🎁 GIVEAWAY ENDED!*\n\n🏆 Winner: ${winner}\n\nCongratulations! 🎉`
        });
      }, duration * 60 * 1000);
    } catch (error) {
      await extra.reply('❌ Failed to create giveaway!');
    }
  }
};