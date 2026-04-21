const path = require('path');
/**
 * Stealth Status Command
 * View status updates without being seen (no notification)
 */

module.exports = {
    name: 'stealthstatus',
    aliases: ['ss', 'hidestatusview'],
    description: 'Toggle stealth status viewing - view stories without sender knowing',
    category: 'owner',
    isGroupOnly: false,
    isAdminOnly: false,
    isOwnerOnly: true,
    execute: async (sock, msg, args, { from, sender, isGroup, groupMetadata, isOwner, isAdmin, isBotAdmin, isMod, reply, react }) => {
        try {
            const config = require(path.join(__dirname, '../../config'));
            const currentState = config.stealthStatus || false;
            const newState = !currentState;
            
            const configPath = path.join(__dirname, '../../config.js');
            const fs = require('fs');
            let configContent = fs.readFileSync(configPath, 'utf8');
            
            configContent = configContent.replace(
                /stealthStatus:\s*process\.env\.STEALTH_STATUS\s*===?\s*['"]true['"]\s*\|\|\s*false/,
                `stealthStatus: ${newState}`
            );
            
            fs.writeFileSync(configPath, configContent);
            delete require.cache[require.resolve(path.join(__dirname, '../../config'))];
            
            const stateText = newState ? 'ON' : 'OFF';
            await reply(`👁️ Stealth Status ${stateText}!\n\nStatus views will not be shown to the sender.`);
            
        } catch (error) {
            console.error('Error in stealthstatus command:', error);
            await reply('❌ Failed to toggle Stealth Status: ' + error.message);
        }
    }
}