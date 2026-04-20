/**
 * Set Group Name Command
 */

module.exports = {
  name: 'setgcname',
  aliases: ['groupname', 'setname', 'gname'],
  category: 'admin',
  description: 'Set group name',
  usage: '.setgcname <new group name>',
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

      if (args.length === 0) {
        return extra.reply('❌ Usage: .setgcname <new group name>');
      }

      const newName = args.join(' ');
      await sock.groupUpdateSubject(msg.key.remoteJid, newName);
      
      await extra.reply(`✅ Group name changed to: *${newName}*`);
    } catch (error) {
      console.error('Set group name error:', error);
      await extra.reply('❌ Failed to change group name!');
    }
  }
};