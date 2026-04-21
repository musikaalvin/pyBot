const path = require('path');
/**
 * Auto Save Status Command
 * Toggle automatic saving of status updates
 */

module.exports = {
    name: 'autosavestatus',
    aliases: ['ass'],
    description: 'Toggle automatic saving of status updates',
    category: 'status',
    isGroupOnly: false,
    isAdminOnly: false,
    isOwnerOnly: false,
    execute: async (sock, msg, args, { from, sender, isGroup, groupMetadata, isOwner, isAdmin, isBotAdmin, isMod, reply, react }) => {
        try {
            const config = require(path.join(__dirname, '../../config'));
            const currentState = config.autoSaveStatus || false;
            const newState = !currentState;
            
            const configPath = path.join(__dirname, '../../config.js');
            const fs = require('fs');
            let configContent = fs.readFileSync(configPath, 'utf8');
            
            configContent = configContent.replace(
                /autoSaveStatus:\s*process\.env\.AUTO_SAVE_STATUS\s*===?\s*['"]true['"]\s*\|\|\s*false/,
                `autoSaveStatus: ${newState}`
            );
            
            fs.writeFileSync(configPath, configContent);
            delete require.cache[require.resolve(path.join(__dirname, '../../config'))];
            
            const stateText = newState ? 'ON' : 'OFF';
            await reply(`✅ Auto Save Status is now ${stateText}.`);
            
        } catch (error) {
            console.error('Error in autosavestatus command:', error);
            await reply('❌ Failed to toggle Auto Save Status: ' + error.message);
        }
    }
};