/**
 * Restart Command - Restart bot (Owner Only)
 */

module.exports = {
  name: 'restart',
  aliases: ['reboot'],
  category: 'owner',
  description: 'Restart the bot',
  usage: '.restart',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    try {
      const config = require('/root/pyBot/config');
      const database = require('/root/pyBot/database');
      const os = require('os');
      
      const users = database.getAllUsers();
      const cmds = users.reduce((sum, u) => sum + u.commandsUsed, 0);
      const uptime = process.uptime();
      const uptimeStr = uptime >= 3600 
        ? `${Math.floor(uptime/3600)}h ${Math.floor((uptime%3600)/60)}m`
        : `${Math.floor(uptime/60)}m`;
      
      await extra.reply(`🔄 *Restarting ${config.botName}...*

📊 *Session Info:*
▸ 👥 Users: ${users.length}
▸ 💬 Commands: ${cmds}
▸ ⏱️ Uptime: ${uptimeStr}
▸ 💾 RAM: ${Math.round(process.memoryUsage().heapUsed/1024/1024)}MB

Please wait 3 seconds...`);
      
      setTimeout(() => {
        process.exit(1);
      }, 3000);
      
    } catch (error) {
      console.error('Restart error:', error);
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};