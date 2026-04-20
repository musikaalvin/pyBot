/**
 * Auto Recording Command
 * Toggle automatic sending of voice messages (fake recording)
 */

module.exports = {
    name: 'autorecording',
    aliases: ['ar'],
    description: 'Toggle automatic sending of voice messages',
    category: 'status',
    isGroupOnly: false,
    isAdminOnly: false,
    isOwnerOnly: false,
    execute: async (sock, msg, args, { from, sender, isGroup, groupMetadata, isOwner, isAdmin, isBotAdmin, isMod, reply, react }) => {
        try {
            const config = require('/root/pyBot/config');
            const currentState = config.autoRecording || false;
            const newState = !currentState;
            
            const configPath = '/root/pyBot/config.js';
            const fs = require('fs');
            let configContent = fs.readFileSync(configPath, 'utf8');
            
            configContent = configContent.replace(
                /autoRecording:\s*process\.env\.AUTO_RECORDING\s*===?\s*['"]true['"]\s*\|\|\s*false/,
                `autoRecording: ${newState}`
            );
            
            fs.writeFileSync(configPath, configContent);
            delete require.cache[require.resolve('/root/pyBot/config')];
            
            const stateText = newState ? 'ON' : 'OFF';
            await reply(`✅ Auto Recording is now ${stateText}.`);
            
        } catch (error) {
            console.error('Error in autorecording command:', error);
            await reply('❌ Failed to toggle Auto Recording: ' + error.message);
        }
    }
}