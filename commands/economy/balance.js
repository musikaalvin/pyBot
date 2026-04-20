/**
 * Balance Command
 */

const database = require('../../database');
const config = require('/root/pyBot/config');

module.exports = {
  name: 'balance',
  aliases: ['bal', 'money', '$'],
  category: 'economy',
  description: 'Check your or someone else\'s balance',
  usage: '.balance [@user]',
  
  async execute(sock, msg, args, extra) {
    try {
      let targetId = msg.key.participant; // Default to sender
      
      // If mentioned user, use that instead
      if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
        const mentioned = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        if (mentioned) targetId = mentioned;
      } else if (args[0]) {
        // If argument provided, try to use it as user ID
        const arg = args[0].replace(/[@<>]/g, '');
        if (/^\d+$/.test(arg)) {
          targetId = `${arg}@s.whatsapp.net`;
        }
      }
      
      // Get user data
      const economy = database.getEconomy(targetId.split('@')[0]);
      
      // Try to get user's name
      let username = targetId.split('@')[0];
      
      try {
        // Try to get pushname from contacts if available
        if (sock.contacts && sock.contacts[targetId]) {
          username = sock.contacts[targetId].pushname || username;
        }
      } catch (e) {
        // Keep the number as username if pushname not available
      }
      
      const balanceFormatted = economy.balance.toLocaleString();
      const bankFormatted = economy.bank.toLocaleString();
      const totalFormatted = (economy.balance + economy.bank).toLocaleString();
      
      await extra.reply(`*💰 ${username}'s Balance*\n\n` +
        `💵 Cash: $${balanceFormatted}\n` +
        `🏦 Bank: $${bankFormatted}\n` +
        `💎 Total: $${totalFormatted}\n\n` +
        `📊 Stats:\n` +
        `• Earned: $${economy.totalEarned.toLocaleString()}\n` +
        `• Lost: $${economy.totalLost.toLocaleString()}\n\n` +
        `_Powered by ${config.botName}_`);
    } catch (error) {
      console.error('Balance error:', error);
      await extra.reply('❌ Failed to get balance!');
    }
  }
};