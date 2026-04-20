/**
 * Ignore Remove Command
 * Remove a user from the ignore list
 */

module.exports = {
    name: 'ignoreremove',
    alias: ['ignoreremove', 'igrm'],
    description: 'Remove a user from the ignore list',
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
            
            // If still no target, use sender (for self-unignore)
            if (!targetUserId) {
                targetUserId = sender.split('@')[0];
            }
            
            // Validate user ID
            if (!targetUserId || targetUserId.length < 10) {
                return reply('❌ Please provide a valid user ID or mention a user.');
            }
            
            // Remove from ignore list in database
            const database = require('../../database');
            
            // Remove ignored flag from user data
            const user = database.getUser(targetUserId);
            if (user && user.ignored) {
                // Remove the ignored property
                delete user.ignored;
                database.updateUser(targetUserId, user);
            }
            
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
            
            await reply(`✅ Removed @${targetUserId} (${userInfo}) from the ignore list.`, { mentions: [targetUserId + '@s.whatsapp.net'] });
            
        } catch (error) {
            console.error('Error in ignoreremove command:', error);
            await reply('❌ Failed to remove user from ignore list.');
        }
    }
}