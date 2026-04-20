/**
 * System Info Command - Display bot system information
 */

const os = require('os');
const fs = require('fs');
const config = require('/root/pyBot/config');

const getDiskInfo = () => {
  try {
    if (process.platform === 'win32') {
      return null;
    }
    const stdout = require('child_process').execSync('df -h / | tail -1', { encoding: 'utf8' });
    const parts = stdout.trim().split(/\s+/);
    return {
      total: parts[1],
      used: parts[2],
      available: parts[3],
      percent: parts[4]
    };
  } catch (e) {
    return null;
  }
};

module.exports = {
  name: 'systeminfo',
  aliases: ['sysinfo', 'specs', 'server', 'host'],
  category: 'utility',
  description: 'Show system information',
  usage: '.systeminfo',
  
  async execute(sock, msg, args, extra) {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = ((usedMem / totalMem) * 100).toFixed(1);
    
    const cpuCount = os.cpus().length;
    const cpuModel = os.cpus()[0]?.model || 'Unknown';
    const nodeVersion = process.version;
    
    const platform = os.platform();
    const arch = os.arch();
    
    const diskInfo = getDiskInfo();
    
    let infoText = `╭━━━『 *SYSTEM INFO* 』━━━╮\n\n`;
    infoText += `┏━━━━━━━━━━━━━━━━━━━━━━\n`;
    infoText += `┃ ⚙️ *BOT INFO*\n`;
    infoText += `┗━━━━━━━━━━━━━━━━━━━━\n`;
    infoText += `│ 👑 Owner: ${config.ownerName}\n`;
    infoText += `│ ⚡ Bot: ${config.botName}\n`;
    infoText += `│ 🏷️ Version: ${config.botVersion || '1.0.0'}\n`;
    infoText += `│ ⏱️ Uptime: ${days}d ${hours}h ${minutes}m\n\n`;
    
    infoText += `┏━━━━━━━━━━━━━━━━━━━━━━\n`;
    infoText += `┃ 🖥️ *SYSTEM*\n`;
    infoText += `┗━━━━━━━━━━━━━━━━━━━━\n`;
    infoText += `│ 🖱️ OS: ${platform} (${arch})\n`;
    infoText += `│ 🟢 Node: ${nodeVersion}\n`;
    infoText += `│ 💻 CPUs: ${cpuCount} cores\n`;
    infoText += `│   └ ${cpuModel.substring(0, 28)}...\n\n`;
    
    infoText += `┏━━━━━━━━━━━━━━━━━━━━━━\n`;
    infoText += `┃ 💾 *MEMORY*\n`;
    infoText += `┗━━━━━━━━━━━━━━━━━━━━\n`;
    infoText += `│ 📊 Used: ${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
    infoText += `│ 📦 Total: ${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
    infoText += `│ 🟢 Free: ${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
    infoText += `│ 📈 Usage: ${memPercent}%\n\n`;
    
    if (diskInfo) {
      infoText += `┏━━━━━━━━━━━━━━━━━━━━━━\n`;
      infoText += `┃ 💿 *DISK*\n`;
      infoText += `┗━━━━━━━━━━━━━━━━━━━━\n`;
      infoText += `│ 📊 Used: ${diskInfo.used}\n`;
      infoText += `│ 📦 Total: ${diskInfo.total}\n`;
      infoText += `│ 🟢 Free: ${diskInfo.available}\n`;
      infoText += `│ 📈 Usage: ${diskInfo.percent}\n\n`;
    }
    
    infoText += `┏━━━━━━━━━━━━━━━━━━━━━━\n`;
    infoText += `┃ ⏰ *TIMESTAMP*\n`;
    infoText += `┗━━━━━━━━━━━━━━━━━━━━\n`;
    infoText += `│ 🕒 ${new Date().toLocaleString()}\n`;
    infoText += `╰━━━━━━━━━━━━━━━━━━━━━━╯\n`;
    
    await extra.reply(infoText);
  }
};