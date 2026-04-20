/**
 * Kick All Non-Admins Command
 * DANGEROUS: Removes all non-admin members from group
 */

module.exports = {
  name: 'kickall',
  aliases: ['kickall', 'removeall'],
  category: 'admin',
  description: 'Kick all non-admin members from group (OWNER ONLY)',
  usage: '.kickall',
  groupOnly: true,
  adminOnly: true, // Will check for owner specifically in execute
  
  async execute(sock, msg, args, extra) {
    try {
      if (!msg.key.remoteJid.endsWith('@g.us')) {
        return extra.reply('❌ This command can only be used in groups!');
      }

      // Only owner can use this dangerous command
      if (!extra.isOwner) {
        return extra.reply('👑 This command is only for bot owner!');
      }

      const groupId = msg.key.remoteJid;
      
      // Get group metadata
      const groupMetadata = await extra.groupMetadata;
      if (!groupMetadata || !groupMetadata.participants) {
        return extra.reply('❌ Failed to get group information!');
      }

      // Get admins and owner
      const admins = groupMetadata.participants
        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
        .map(p => p.id);
      
      // Get all participants
      const allParticipants = groupMetadata.participants.map(p => p.id);
      
      // Filter out admins to get non-admins
      const nonAdmins = allParticipants.filter(id => !admins.includes(id));
      
      if (nonAdmins.length === 0) {
        return extra.reply('✅ All members are already admins! No one to kick.');
      }

      // Warning message
      await extra.reply(`⚠️ DANGEROUS OPERATION: About to kick ${nonAdmins.length} non-admin members from this group!\n\nThis action cannot be undone!\n\nReply with \`CONFIRM\` within 30 seconds to proceed.`);

      // Wait for confirmation
      const filter = (m) => m.key.remoteJid === msg.key.remoteJid && 
                         m.key.participant === msg.key.participant &&
                         m.message?.conversation === 'CONFIRM';
      
      try {
        const waitForConfirm = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new TimeoutError()), 30000);
          
          const updateHandler = async (update) => {
            if (update.messages && Array.isArray(update.messages)) {
              for (const msg of update.messages) {
                if (msg.key.remoteJid === msg.key.remoteJid && 
                    msg.key.participant === msg.key.participant &&
                    msg.message?.conversation === 'CONFIRM') {
                  clearTimeout(timeout);
                  resolve(true);
                }
              }
            }
          };
          
          sock.ev.on('messages.upsert', updateHandler);
          
          // Cleanup on promise resolution
          const cleanup = () => {
            sock.ev.off('messages.upsert', updateHandler);
          };
          
          return { promise: waitForConfirm, cleanup };
        });
        
        const result = await waitForConfirm.promise;
        result.cleanup();
        
        // Proceed with kicking
        await extra.reply(`🚨 Starting kick operation for ${nonAdmins.length} members...`);
        
        let kicked = 0;
        let failed = 0;
        
        // Kick members in batches to avoid rate limiting
        for (let i = 0; i < nonAdmins.length; i++) {
          try {
            await sock.groupParticipantsUpdate(groupId, [nonAdmins[i]], 'remove');
            kicked++;
            
            // Delay between kicks to avoid rate limiting
            if (i < nonAdmins.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }
          } catch (error) {
            console.error(`Failed to kick ${nonAdmins[i]}:`, error);
            failed++;
          }
        }
        
        await extra.reply(`✅ Kickall operation completed!\n\n👢 Kicked: ${kicked}\n❌ Failed: ${failed}\n\nGroup now has ${groupMetadata.participants.length - kicked} members.`);
        
      } catch (error) {
        if (error.name === 'TimeoutError') {
          await extra.reply('⏰ Confirmation timeout. Kickall operation cancelled.');
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Kickall error:', error);
      await extra.reply('❌ Failed to execute kickall command!');
    }
  }
};