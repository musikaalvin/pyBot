/**
 * Group Open/Close Commands
 */

module.exports = {
  name: 'groupopen',
  aliases: ['open', 'ungroupclose', 'unlock'],
  category: 'admin',
  description: 'Open group for all members to send messages',
  usage: '.groupopen',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,
  
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

      // Update group setting to allow all members to send messages
      // In Baileys, this is typically done by changing group restriction
      await sock.groupSettingUpdate(msg.key.remoteJid, 'announcement', false);
      
      await extra.reply('✅ Group opened! All members can now send messages.');
    } catch (error) {
      console.error('Group open error:', error);
      await extra.reply('❌ Failed to open group!');
    }
  }
};

// Close command (admins only can send)
module.exports = {
  name: 'groupclose',
  aliases: ['close', 'lock', 'lockdown'],
  category: 'admin',
  description: 'Close group so only admins can send messages',
  usage: '.groupclose',
  groupOnly: true,
  adminOnly: true,
  botAdminNeeded: true,
  
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

      // Update group setting to restrict messaging to admins only
      await sock.groupSettingUpdate(msg.key.remoteJid, 'announcement', true);
      
      await extra.reply('✅ Group closed! Only admins can now send messages.');
    } catch (error) {
      console.error('Group close error:', error);
      await extra.reply('❌ Failed to close group!');
    }
  }
};