/**
 * Work Command
 */

const database = require('../../database');
const config = require('/root/pyBot/config');

const jobs = [
  { min: 10, max: 50, name: 'freelance coding' },
  { min: 20, max: 80, name: 'food delivery' },
  { min: 15, max: 60, name: 'dog walking' },
  { min: 25, max: 100, name: 'yard work' },
  { min: 30, max: 120, name: 'office temp work' },
  { min: 5, max: 30, name: 'online surveys' },
  { min: 40, max: 150, name: 'construction work' },
  { min: 12, max: 45, name: 'tutoring' },
  { min: 18, max: 70, name: 'ride sharing' },
  { min: 35, max: 140, name: 'event staffing' }
];

module.exports = {
  name: 'work',
  aliases: ['job', 'earn'],
  category: 'economy',
  description: 'Work to earn money',
  usage: '.work',
  
  async execute(sock, msg, args, extra) {
    try {
      const userId = msg.key.participant.split('@')[0];
      
      if (!database.canWork(userId)) {
        const economy = database.getEconomy(userId);
        const lastWork = new Date(economy.lastWork);
        const nextWork = new Date(lastWork.getTime() + 60 * 60 * 1000);
        const now = new Date();
        const diffMs = nextWork - now;
        const diffMinutes = Math.floor(diffMs / (60 * 1000));
        const diffSeconds = Math.floor((diffMs % (60 * 1000)) / 1000);
        
        return extra.reply(`⏰ You recently worked!\n\n` +
          `⏳ Next work available in: ${diffMinutes}m ${diffSeconds}s\n\n` +
          `💡 Tip: Use .daily for a larger reward every 24 hours!`);
      }

      // Pick a random job
      const job = jobs[Math.floor(Math.random() * jobs.length)];
      const earnings = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
      
      database.addBalance(userId, earnings);
      database.setWork(userId);
      
      await extra.reply(`💼 You worked as a ${job.name} and earned: $${earnings.toLocaleString()}\n\n` +
        `💰 Use .balance to see your total!\n\n` +
        `_Powered by ${config.botName}_`);
    } catch (error) {
      console.error('Work error:', error);
      await extra.reply('❌ Failed to process work command!');
    }
  }
};