/**
 * Ignore Add Command
 * Add a user to the ignore list
 */

module.exports = {
    name: 'ignoreadd',
    alias: ['ignoreadd', 'igadd'],
    description: 'Add a user to the ignore list',
    category: 'owner',
    isGroupOnly: false,
    isAdminOnly: false,
    isOwnerOnly: true,
    execute: async (sock, msg, args, { from, sender, isGroup, groupMetadata, isOwner, isAdmin, isBotAdmin, isMod, reply, react }) => {
        try {
            // Check if a user was mentioned or provided
            let targetUserId = null;
            
            // Check if mentioned
            if (msg.message && msg.message.extendedTextMessage && 
                msg.message.extendedTextMessage.contextInfo && 
                msg.message.extendedTextMessage.contextInfo.mentionedJid) {
                const mentioned = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
                if (mentioned) {
                    targetUserId = mentioned.split('@')[0];
                }
            }
            
            // If not mentioned, check args
            if (!targetUserId && args[0]) {
                targetUserId = args[0].replace(/[^\d]/g, ''); // Extract numbers only
            }
            
            // If still no target, use sender (for self-ignore)
            if (!targetUserId) {
                targetUserId = sender.split('@')[0];
            }
            
            // Validate user ID
            if (!targetUserId || targetUserId.length < 10) {
                return reply('❌ Please provide a valid user ID or mention a user.');
            }
            
            // Add to ignore list in database
            const database = require('../../database');
            const user = database.getUser(targetUserId);
            
            // Add to ignore list in group settings (for now, we'll store in a global ignore list)
            // Since we need a global ignore list, we'll store it in a separate file or in config
            // For simplicity, let's add it to the user's data as ignored: true
            database.updateUser(targetUserId, { ignored: true });
            
            // Get user info for response
            let userInfo = targetUserId;
            try {
                // Try to get the user's name from contacts
                const contact = await sock.contacts[targetUserId + '@s.whatsapp.net'];
                if (contact && contact.notify) {
                    userInfo = contact.notify;
                }
            } catch (e) {
                // If we can't get contact info, just use the ID
            }
            
            await reply(`✅ Added @${targetUserId} (${userInfo}) to the ignore list.`, { mentions: [targetUserId + '@s.whatsapp.net'] });
            
        } catch (error) {
            console.error('Error in ignoreadd command:', error);
            await reply('❌ Failed to add user to ignore list.');
        }
    }
}