const path = require('path');
/**
 * Daily Reward Command
 */

const database = require('../../database');
const config = require(path.join(__dirname, '../../config'));

module.exports = {
  name: 'daily',
  aliases: ['dailyreward', 'claim'],
  category: 'economy',
  description: 'Claim your daily reward',
  usage: '.daily',
  
  async execute(sock, msg, args, extra) {
    try {
      const userId = msg.key.participant.split('@')[0];
      
      if (!database.canDaily(userId)) {
        const economy = database.getEconomy(userId);
        const lastDaily = new Date(economy.lastDaily);
        const nextDaily = new Date(lastDaily.getTime() + 24 * 60 * 60 * 1000);
        const now = new Date();
        const diffMs = nextDaily - now;
        const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
        const diffMinutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
        
        return extra.reply(`⏰ You already claimed your daily reward!\n\n` +
          `⏳ Next daily available in: ${diffHours}h ${diffMinutes}m\n\n` +
          `💡 Tip: Use .work to earn money while waiting!`);
      }

      // Random daily reward between 100-500
      const reward = Math.floor(Math.random() * 401) + 100;
      
      database.addBalance(userId, reward);
      database.setDaily(userId);
      
      await extra.reply(`🎉 Daily reward claimed!\n\n` +
        `💰 You received: $${reward.toLocaleString()}\n\n` +
        `📅 Come back in 24 hours for your next reward!\n\n` +
        `_Powered by ${config.botName}_`);
    } catch (error) {
      console.error('Daily error:', error);
      await extra.reply('❌ Failed to claim daily reward!');
    }
  }
};