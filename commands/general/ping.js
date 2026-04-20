/**
 * Ping Command - Check real bot response time and system stats
 */

const os = require('os');

module.exports = {
    name: 'ping',
    aliases: ['p', 'stats'],
    category: 'general',
    description: 'Check bot uptime and system stats',
    usage: '.ping',
    
    async execute(sock, msg, args, extra) {
      try {
        const config = require('/root/pyBot/config');
        const start = Date.now();
        
        // Test actual send time
        const testMsg = await sock.sendMessage(extra.from, { text: '⚡' }, { quoted: msg });
        const responseTime = Date.now() - start;
        
        // Real system memory (RSS = actual physical memory)
        const usedMem = process.memoryUsage();
        const rss = Math.round(usedMem.rss / 1024 / 1024);
        const heapUsed = Math.round(usedMem.heapUsed / 1024 / 1024);
        const heapTotal = Math.round(usedMem.heapTotal / 1024 / 1024);
        
        // System load
        const load = os.loadavg();
        
        // Get bot's own JID to show
        const botJid = sock.user?.id || 'unknown';
        const botNum = botJid.split('@')[0].split(':')[0];
        
        const txt = `*${config.botName}*\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `⚡ Response: ${responseTime}ms\n` +
          `💾 Memory: ${rss}MB (heap ${heapUsed}/${heapTotal}MB)\n` +
          `📡 Bot: ${botNum}\n` +
          `🖥️ ${os.hostname()} | ${os.platform()} ${os.arch()}`;
        
        await extra.reply(txt);
        
      } catch (error) {
        await extra.reply(`❌ Error: ${error.message}`);
      }
    }
  };
  