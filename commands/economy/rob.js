/**
 * Rob Command
 */

const database = require('../../database');
const config = require('/root/pyBot/config');

module.exports = {
  name: 'rob',
  aliases: ['steal', 'mug'],
  category: 'economy',
  description: 'Rob another user (chance to succeed or fail)',
  usage: '.rob @user',
  
  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .rob @user\n\nExample: .rob @1234567890');
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
        return extra.reply('❌ Please mention a valid user to rob!\n\nUsage: .rob @user');
      }

      const userId = msg.key.participant.split('@')[0];
      const targetUserId = targetId.split('@')[0];

      // Prevent self-robbing
      if (userId === targetUserId) {
        return extra.reply('❌ You cannot rob yourself!');
      }

      // Check rob cooldown
      if (!database.canRob(userId)) {
        const economy = database.getEconomy(userId);
        const lastRob = new Date(economy.robCooldown);
        const nextRob = new Date(lastRob.getTime() + 5 * 60 * 60 * 1000); // 5 hours
        const now = new Date();
        const diffMs = nextRob - now;
        const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
        const diffMinutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
        
        return extra.reply(`⏰ You recently robbed someone!\n\n` +
          `⏳ Next rob available in: ${diffHours}h ${diffMinutes}m\n\n` +
          `💡 Tip: Try .work or .daily to earn money instead!`);
      }

      // Get target's balance
      const targetEconomy = database.getEconomy(targetUserId);
      
      if (targetEconomy.balance < 100) {
        return extra.reply(`💸 ${targetId.split('@')[0]} doesn't have enough money to rob (minimum $100)!\n\n` +
          `💰 Their balance: $${targetEconomy.balance.toLocaleString()}`);
      }

      // 60% chance to succeed
      const success = Math.random() < 0.6;
      
      if (success) {
        // Successful rob: steal 5-15% of target's balance (min 100, max 500)
        const maxSteal = Math.min(targetEconomy.balance * 0.15, 500);
        const minSteal = Math.max(targetEconomy.balance * 0.05, 100);
        const stolen = Math.floor(Math.random() * (maxSteal - minSteal + 1)) + minSteal;
        
        // Ensure we don't steal more than they have
        const actualStolen = Math.min(stolen, targetEconomy.balance);
        
        // Transfer money
        database.removeBalance(targetUserId, actualStolen);
        database.addBalance(userId, actualStolen);
        
        // Set rob cooldown
        database.setRobCooldown(userId);
        
        await extra.reply(`💥 Successful robbery!\n\n` +
          `👤 You robbed ${targetId.split('@')[0]}\n` +
          `💰 You stole: $${actualStolen.toLocaleString()}\n\n` +
          `⚠️ Rob cooldown: 5 hours\n\n` +
          `_Powered by ${config.botName}_`);
      } else {
        // Failed rob: pay a fine (5-10% of your balance, min 50)
        const userEconomy = database.getEconomy(userId);
        const fine = Math.max(Math.floor(userEconomy.balance * 0.075), 50);
        const actualFine = Math.min(fine, userEconomy.balance);
        
        // Pay fine
        if (actualFine > 0) {
          database.removeBalance(userId, actualFine);
          database.addBalance(targetUserId, actualFine); // Fine goes to target
        }
        
        // Set rob cooldown anyway
        database.setRobCooldown(userId);
        
        await extra.reply(`🚨 Robbery failed!\n\n` +
          `👮 You were caught trying to rob ${targetId.split('@')[0]}\n` +
          `💸 You paid a fine: $${actualFine.toLocaleString()}\n\n` +
          `⚠️ Rob cooldown: 5 hours\n\n` +
          `_Powered by ${config.botName}_`);
      }
    } catch (error) {
      console.error('Rob error:', error);
      await extra.reply('❌ Failed to process rob command!');
    }
  }
};