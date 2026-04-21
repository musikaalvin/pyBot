const path = require('path');
/**
 * Users Command - List active bot users
 */

module.exports = {
  name: 'users',
  category: 'general',
  description: 'List active bot users',
  usage: '.users',

  async execute(sock, msg, args, extra) {
    const database = require(path.join(__dirname, '../../database'));
    const config = require(path.join(__dirname, '../../config'));
    
    let users = database.getAllUsers();
    
    // Show users with 10+ commands OR the owner
    const ownerNum = String(config.ownerNumber?.[0] || '').replace(/[^\d]/g, '');
    users = users.filter(u => {
      if (u.commandsUsed >= 10) return true;
      // Include owner even with few commands
      const uId = String(u.userId || '').replace(/[^\d]/g, '');
      return uId === ownerNum || uId === ownerNum.slice(-9);
    });
    
    if (users.length === 0) {
      return extra.reply('You are the only user so far!');
    }
    
    const now = Date.now();
    const ownerNumber = String(config.ownerNumber?.[0] || '').replace(/[^\d]/g, '');
    
    // Show users sorted by activity
    users.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
    
    const userList = users.slice(0, 10);
    
    let text = `👥 *ACTIVE USERS*\n\n`;
    text += `Total: ${users.length} users\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    userList.forEach((u, i) => {
      const isOwner = u.userId === ownerNumber || u.userId === ownerNumber.slice(-9);
      const label = isOwner ? '👑 Owner' : '👤 User';
      const timeAgo = getTimeAgo(now - (u.lastActive || 0));
      const name = `@${u.userId}`;
      text += `${i + 1}. ${name} ${label}\n`;
      text += `   💬 ${u.commandsUsed} cmds • ${timeAgo}\n`;
    });
    
    if (users.length > 10) {
      text += `\n...and ${users.length - 10} more`;
    }
    
    await sock.sendMessage(extra.from, { text }, { quoted: msg });
  }
};

function getTimeAgo(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}