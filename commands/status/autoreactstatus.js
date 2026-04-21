const path = require('path');
/**
 * Auto React Status Command
 * Toggle automatic reacting to status updates
 */

module.exports = {
    name: 'autoreactstatus',
    aliases: ['ars'],
    description: 'Toggle automatic reacting to status updates',
    category: 'status',
    isGroupOnly: false,
    isAdminOnly: false,
    isOwnerOnly: false,
    execute: async (sock, msg, args, { from, sender, isGroup, groupMetadata, isOwner, isAdmin, isBotAdmin, isMod, reply, react }) => {
        try {
            const config = require(path.join(__dirname, '../../config'));
            const currentState = config.autoReactStatus || false;
            const newState = !currentState;
            
            const configPath = path.join(__dirname, '../../config.js');
            const fs = require('fs');
            let configContent = fs.readFileSync(configPath, 'utf8');
            
            configContent = configContent.replace(
                /autoReactStatus:\s*process\.env\.AUTO_REACT_STATUS\s*===?\s*['"]true['"]\s*\|\|\s*false/,
                `autoReactStatus: ${newState}`
            );
            
            fs.writeFileSync(configPath, configContent);
            delete require.cache[require.resolve(path.join(__dirname, '../../config'))];
            
            const stateText = newState ? 'ON' : 'OFF';
            await reply(`✅ Auto React Status is now ${stateText}.`);
            
        } catch (error) {
            console.error('Error in autoreactstatus command:', error);
            await reply('❌ Failed to toggle Auto React Status: ' + error.message);
        }
    }
}