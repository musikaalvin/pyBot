/**
 * Transfer Command
 */

const database = require('../../database');
const config = require('/root/pyBot/config');

module.exports = {
  name: 'transfer',
  aliases: ['send', 'pay', 'give'],
  category: 'economy',
  description: 'Transfer money to another user',
  usage: '.transfer @user <amount>',
  
  async execute(sock, msg, args, extra) {
    try {
      if (args.length < 2) {
        return extra.reply('❌ Usage: .transfer @user <amount>\n\nExample: .transfer @1234567890 100');
      }

      // Get target user ID from mention
      let targetId = null;
      if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
        targetId = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
      } else if (args[0]) {
        const arg = args[0].replace(/[@<>]/g, '');
        if (/^\d+$/.test(arg)) {
          targetId = `${arg}@s.whatsapp.net`;
        }
      }

      if (!targetId) {
        return extra.reply('❌ Please mention a valid user to transfer to!\n\nUsage: .transfer @user <amount>');
      }

      const amount = parseInt(args[1]);
      if (isNaN(amount) || amount <= 0) {
        return extra.reply('❌ Please provide a valid positive amount to transfer!');
      }

      const userId = msg.key.participant.split('@')[0];
      const targetUserId = targetId.split('@')[0];

      // Prevent self-transfer
      if (userId === targetUserId) {
        return extra.reply('❌ You cannot transfer money to yourself!');
      }

      // Check if user has enough balance
      const userEconomy = database.getEconomy(userId);
      if (userEconomy.balance < amount) {
        return extra.reply(`❌ Insufficient funds!\n\n` +
          `💰 Your balance: $${userEconomy.balance.toLocaleString()}\n` +
          `💸 Amount to transfer: $${amount.toLocaleString()}`);
      }

      // Transfer money
      database.removeBalance(userId, amount);
      database.addBalance(targetUserId, amount);
      
      await extra.reply(`✅ Transfer successful!\n\n` +
        `📤 Sent: $${amount.toLocaleString()} to ${targetId.split('@')[0]}\n` +
        `📥 Your new balance: $${(userEconomy.balance - amount).toLocaleString()}\n\n` +
        `_Powered by ${config.botName}_`);
    } catch (error) {
      console.error('Transfer error:', error);
      await extra.reply('❌ Failed to process transfer command!');
    }
  }
};