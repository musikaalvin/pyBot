/**
 * Set Group Description Command
 */

module.exports = {
  name: 'setgcdesc',
  aliases: ['groupdesc', 'setdesc', 'gdesc'],
  category: 'admin',
  description: 'Set group description',
  usage: '.setgcdesc <new group description>',
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
        return extra.reply('❝ Usage: .setgcdesc <new group description>');
      }

      const newDesc = args.join(' ');
      await sock.groupUpdateDescription(msg.key.remoteJid, newDesc);
      
      await extra.reply(`✅ Group description updated.`);
    } catch (error) {
      console.error('Set group description error:', error);
      await extra.reply('❌ Failed to change group description!');
    }
  }
};