/**
 * Classic Menu Command - Generate full menu with bot info and system status
 */

const { loadCommands } = require('../../utils/commandLoader');
const config = require('/root/pyBot/config');
const path = require('path');
const fs = require('fs');
const os = require('os');

module.exports = {
  name: 'menu',
  aliases: ['commands', 'list'],
  category: 'general',
  description: 'Show all bot commands',
  usage: '.menu',
  
  async execute(sock, msg, args, extra) {
    try {
      const commands = loadCommands();
      
      // Group by category - only count main commands (not aliases)
      const categories = {};
      let totalCommands = 0;
      
      commands.forEach((cmd, name) => {
        if (name === cmd.name) {
          const c = cmd.category || 'other';
          if (!categories[c]) categories[c] = [];
          categories[c].push({
            name: cmd.name,
            desc: cmd.description || '',
            alias: cmd.aliases || []
          });
          totalCommands++;
        }
      });
      
      // Get bot start time for uptime calculation
      const botUptime = process.uptime();
      const uptimeFormatted = formatUptime(botUptime);
      
      // Get memory usage
      const memUsage = process.memoryUsage();
      const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const ramPercent = Math.round((usedMB / totalMB) * 100);
      
      // Get more system stats
      const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024); // GB
      const freeMem = Math.round(os.freemem() / 1024 / 1024 / 1024); // GB
      const usedMem = totalMem - freeMem;
      
      // Get current time (Uganda/Kampala timezone)
      const now = new Date();
      const timeString = now.toLocaleString('en-UG', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        hour: 'numeric', 
        minute: '2-digit',
        timeZone: 'Africa/Kampala'
      });
      
      // Get sender info
      let senderName = msg.pushName || 'there';
      if (!senderName || senderName.length < 2) {
        senderName = msg.key.participant ? msg.key.participant.split('@')[0] : msg.key.remoteJid.split('@')[0];
      }
      
      // Get system info
      const platform = os.platform();
      const hostName = os.hostname() || 'Panel';
      
      // Ping/response time simulation
      const startTime = Date.now();
      
      // Build old style menu
      let text = `╭───────────────━⊷\n`;
      text += `┃ *${config.botName}*\n`;
      text += `╰───────────────━⊷\n`;
      text += `╭───────────────━⊷\n`;
      text += `┃ 🧑‍💻 *Owner:* @${config.ownerName[0] || 'Unknown'}\n`;
      text += `┃ 🛠️ *Prefix:* ${config.prefix}\n`;
      text += `┃ 👥 *User:* @${senderName}\n`;
      text += `┃ 💾 *Host:* ${hostName}\n`;
      text += `┃ ⚡ *Speed:* ${Date.now() - startTime}ms\n`;
      text += `┃ 💿 *Ram:* [${'█'.repeat(Math.floor(ramPercent/10))}${'░'.repeat(10-Math.floor(ramPercent/10))}] ${ramPercent}%\n`;
      text += `┃ 💻 *Version:* 1.0.0\n`;
      text += `┃ 🛡️ *Mode:* ${config.selfMode ? 'SELF' : 'PUBLIC'}\n`;
      text += `┃ 🕐 *Time:* ${timeString}\n`;
      text += `┃ ⏱️ *Uptime:* ${uptimeFormatted}\n`;
      text += `┃ 🧩 *Modules:* ${totalCommands}+\n`;
      
      // Add user count
      const database = require('/root/pyBot/database');
      const users = database.getAllUsers();
      const activeUsers = users.filter(u => u.commandsUsed >= 5).length;
      text += `┃ 👤 *Users:* ${activeUsers}+\n`;
      
      text += `┃ 🥤 *Developer:* pyLord\n`;
      text += `╰───────────────━⊷\n`;
      
      // Add quote if configured
      if (config.quote) {
        text += `╭───────────────━⊷\n`;
        text += `┃ 💬 *Quote:*\n`;
        text += `┃ _"${config.quote}"_\n`;
        text += `╰───────────────━⊷\n\n`;
      } else {
        text += `\n`;
      }
      
      // Define optimized category order for old look
      const categoryOrder = [
        { key: 'owner', name: '👑 OWNER', symbol: '╭─┴❍' },
        { key: 'admin', name: '🛡️ ADMIN', symbol: '╭─┴❍' },
        { key: 'general', name: '📋 GENERAL', symbol: '╭─┴❍' },
        { key: 'utility', name: '🔧 UTILITY', symbol: '╭─┴❍' },
        { key: 'ai', name: '🤖 AI', symbol: '╭─┴❍' },
        { key: 'media', name: '🎵 MEDIA', symbol: '╭─┴❍' },
        { key: 'fun', name: '🎭 FUN', symbol: '╭─┴❍' },
        { key: 'anime', name: '👾 ANIME', symbol: '╭─┴❍' },
        { key: 'economy', name: '💰 ECONOMY', symbol: '╭─┴❍' },
        { key: 'status', name: '📱 STATUS', symbol: '╭─┴❍' },
        { key: 'textmaker', name: '🖋️ TEXT', symbol: '╭─┴❍' },
        { key: 'engagement', name: '🎉 ENGAGE', symbol: '╭─┴❍' }
      ];
      
      // Add remaining categories
      const definedCategories = new Set(categoryOrder.map(c => c.key));
      const remaining = Object.keys(categories)
        .filter(cat => !definedCategories.has(cat))
        .sort()
        .map(cat => ({ key: cat, name: cat.toUpperCase(), symbol: '╭─┴❍' }));
      
      const allCats = [...categoryOrder, ...remaining];
      
      // Build command sections
      for (const catInfo of allCats) {
        const c = catInfo.key;
        if (!categories[c]) continue;
        
        const sortedCmds = categories[c].sort((a, b) => a.name.localeCompare(b.name));
        
        text += `${catInfo.symbol}「 ${catInfo.name} 」❍\n`;
        for (const cmd of sortedCmds) {
          text += `│ ➜ .${cmd.name}\n`;
        }
        text += `╰─┬────────❍\n`;
      }
      
      text += `\n> *${config.botName}* | Made With Love By pyLord`;
      
      // Try to send with image first
      const logoPath = path.join(__dirname, '../../utils/bot_image.jpg');
      let logoBuffer = null;
      if (fs.existsSync(logoPath)) {
        try {
          logoBuffer = fs.readFileSync(logoPath);
        } catch (e) {}
      }
      
      if (logoBuffer) {
        try {
          await sock.sendMessage(extra.from, {
            image: logoBuffer,
            caption: text
          }, { quoted: msg });
        } catch (imgErr) {
          console.log('Menu image failed, sending text:', imgErr.message);
          try {
            await sock.sendMessage(extra.from, { text }, { quoted: msg });
          } catch (textErr) {
            await extra.reply('❌ Error: ' + textErr.message);
          }
        }
      } else {
        await sock.sendMessage(extra.from, { text }, { quoted: msg });
      }
      
    } catch (err) {
      console.error('Menu error:', err);
      await extra.reply('❌ Error: ' + err.message);
    }
  }
};

// Helper to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${mins}m`;
  } else if (hours > 0) {
    return `${hours}h ${mins}m`;
  } else {
    return `${mins}m`;
  }
}