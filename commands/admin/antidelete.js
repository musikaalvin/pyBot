/**
 * Anti-Delete System
 */

const database = require('../../database');

module.exports = {
  name: 'antidelete',
  aliases: ['antidel', 'antideletemsg'],
  category: 'admin',
  description: 'Toggle anti-delete system',
  usage: '.antidelete <on/off>',
  
  async execute(sock, msg, args, extra) {
    try {
      if (!msg.key.remoteJid.endsWith('@g.us')) {
        return extra.reply('❌ This command can only be used in groups!');
      }

      const isAdmin = await extra.isAdmin;
      const isOwner = extra.isOwner;
      
      if (!isAdmin && !isOwner) {
        return extra.reply('🔒 This command is only for group admins!');
      }

      const groupId = msg.key.remoteJid;
      const setting = args[0]?.toLowerCase();
      
      if (setting === 'on' || setting === 'off') {
        const settings = database.getGroupSettings(groupId);
        settings.antidelete = (setting === 'on');
        database.updateGroupSettings(groupId, settings);
        
        await extra.reply(`✅ Anti-delete system ${setting === 'on' ? 'enabled' : 'disabled'} for this group.`);
      } else {
        const settings = database.getGroupSettings(groupId);
        const status = settings.antidelete ? 'enabled' : 'disabled';
        await extra.reply(`📊 Anti-delete system is currently ${status} for this group.\n\nUsage: .antidelete <on/off>`);
      }
    } catch (error) {
      console.error('Antidelete error:', error);
      await extra.reply('❌ Failed to update anti-delete setting!');
    }
  }
};