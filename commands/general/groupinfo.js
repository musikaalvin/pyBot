/**
 * Group Info Command - Display group information with member list and bot detection
 */

module.exports = {
    name: 'groupinfo',
    aliases: ['info', 'ginfo', 'members'],
    category: 'general',
    description: 'Show group information',
    usage: '.groupinfo [all]',
    groupOnly: true,
    
    async execute(sock, msg, args, extra) {
      try {
        const from = msg.key.remoteJid;
        const showAll = args[0]?.toLowerCase() === 'all';
        
        let metadata;
        try {
          const h = require('../handler');
          metadata = await h.getLiveGroupMetadata?.(sock, from) || extra.groupMetadata;
        } catch (e) {
          metadata = extra.groupMetadata;
        }
        
        if (!metadata?.participants?.length) {
          metadata = extra.groupMetadata;
        }
        
        if (!metadata?.participants?.length) {
          return extra.reply('❌ Could not get participants');
        }
        
        const admins = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
        const members = metadata.participants.filter(p => !p.admin);
        
        // Detect potential bots based on LID-only accounts (no phone number JID)
        const lidOnlyUsers = [];
        const normalUsers = [];
        
        for (const p of metadata.participants) {
          const pnJid = p.id?.split('@')[0]; // Phone number JID
          const lid = p.lid?.split('@')[0]; // LID (Legacy ID) - bots often use LID only
          
          if (!pnJid || !p.id) {
            // LID-only user - likely a bot
            lidOnlyUsers.push({
              ...p,
              lid: lid || 'unknown',
              isAdmin: p.admin === 'admin' || p.admin === 'superadmin'
            });
          } else {
            normalUsers.push({
              ...p,
              pnJid,
              lid,
              isAdmin: p.admin === 'admin' || p.admin === 'superadmin'
            });
          }
        }
        
        let text = `╭━━『 *GROUP INFO* 』━━╮\n\n`;
        text += `🏷️ *Name:* ${metadata.subject}\n`;
        text += `👥 *Members:* ${metadata.participants.length}\n`;
        text += `👑 *Admins:* ${admins.length}\n`;
        text += `🤖 *LID Accounts:* ${lidOnlyUsers.length} (potential bots)\n\n`;
        text += `📝 *Description:*\n${metadata.desc || 'None'}\n\n`;
        
        if (showAll) {
          // Show LID-only users first (likely bots)
          if (lidOnlyUsers.length > 0) {
            text += `┏━━━━━━━━━━━━━━━━━\n`;
            text += `┃ 🤖 *LID ACCOUNTS (BOTS)*\n`;
            text += `┗━━━━━━━━━━━━━━━━━\n`;
            for (const p of lidOnlyUsers) {
              const role = p.isAdmin ? '👑' : '🤖';
              text += `│ ${role} @${p.lid}${p.isAdmin ? ' (Admin)' : ''}\n`;
            }
            text += '\n';
          }
          
          // Show admins
          if (admins.length > 0) {
            text += `┏━━━━━━━━━━━━━━━━━\n`;
            text += `┃ 👑 *ADMINS*\n`;
            text += `┗━━━━━━━━━━━━━━━━━\n`;
            admins.forEach((admin, index) => {
              text += `│ 👑 @${admin.id.split('@')[0]}\n`;
            });
            text += '\n';
          }
          
          // Show normal members
          text += `┏━━━━━━━━━━━━━━━━━\n`;
          text += `┃ 👥 *MEMBERS*\n`;
          text += `┗━━���━━━━━━━━━━━━━━\n`;
          for (const p of normalUsers) {
            const role = p.isAdmin ? '👑' : '👤';
            text += `│ ${role} @${p.pnJid}`;
            if (p.lid && p.lid !== p.pnJid) text += ` (LID: ${p.lid})`;
            text += '\n';
          }
        } else {
          text += `┏━━━━━━━━━━━━━━━━━\n`;
          text += `┃ 👑 *ADMINS*\n`;
          text += `┗━━━━━━━━━━━━━━━━━\n`;
          admins.forEach((admin, index) => {
            text += `│ 👑 @${admin.id.split('@')[0]}\n`;
          });
        }
        
        const mentions = showAll 
          ? metadata.participants.map(a => a.id).filter(Boolean)
          : admins.map(a => a.id);
        
        if (lidOnlyUsers.length > 0 && !showAll) {
          text += `\n⚠️ *Note:* ${lidOnlyUsers.length} LID-only accounts detected.\n`;
          text += `Use .groupinfo all to see them.`;
        }
        
        await sock.sendMessage(extra.from, {
          text,
          mentions
        }, { quoted: msg });
        
      } catch (error) {
        await extra.reply(`❌ Error: ${error.message}`);
      }
    }
  };