/**
 * Anti-Badword Command - Toggle anti-badword for groups
 */

const database = require('../../database');

module.exports = {
  name: 'antibadword',
  aliases: ['antifoul', 'badwords', 'nobadwords'],
  category: 'admin',
  description: 'Toggle anti-badword mode',
  usage: '.antibadword <on/off>',
  
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
      const status = settings.antibadword ? 'enabled' : 'disabled';
      return extra.reply(`📊 Anti-badword system is currently ${status} for this group.\n\nUsage: .antibadword <on/off>`);
    }
    
    const setting = args[0].toLowerCase();
    if (setting !== 'on' && setting !== 'off') {
      return extra.reply('❌ Usage: .antibadword <on/off>');
    }
    
    const settings = database.getGroupSettings(from);
    settings.antibadword = (setting === 'on');
    database.updateGroupSettings(from, settings);
    
    const status = settings.antibadword ? 'enabled' : 'disabled';
    await extra.reply(`✅ Anti-badword has been ${status} for this group!`);
  }
};