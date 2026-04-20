/**
 * Anti-Sticker Command - Toggle anti-sticker for groups
 */

const database = require('../../database');

module.exports = {
  name: 'antisticker',
  aliases: ['antistick', 'nosticker'],
  category: 'admin',
  description: 'Toggle anti-sticker mode',
  usage: '.antisticker <on/off>',
  
  async execute(sock, msg, args, extra) {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    
    if (!from.endsWith('@g.us')) {
      return extra.reply('❌ This command only works in groups!');
    }
    
    const isAdmin = await extra.isAdmin;
    if (!isAdmin && !extra.isOwner) {
      return extra.reply('❌ Only admins can use this command!');
    }
    
    if (args.length === 0) {
      const settings = database.getGroupSettings(from);
      const status = settings.antisticker ? 'enabled' : 'disabled';
      return extra.reply(`📊 Anti-sticker system is currently ${status} for this group.\n\nUsage: .antisticker <on/off>`);
    }
    
    const setting = args[0].toLowerCase();
    if (setting !== 'on' && setting !== 'off') {
      return extra.reply('❌ Usage: .antisticker <on/off>');
    }
    
    const settings = database.getGroupSettings(from);
    settings.antisticker = (setting === 'on');
    database.updateGroupSettings(from, settings);
    
    const status = settings.antisticker ? 'enabled' : 'disabled';
    await extra.reply(`✅ Anti-sticker has been ${status} for this group!`);
  }
};