/**
 * Auto Typing Command - Toggle typing indicator
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'autotyping',
  aliases: ['autotype', 'typing'],
  description: 'Toggle auto typing indicator when processing commands',
  category: 'owner',
  ownerOnly: true,
  
  async execute(sock, msg, args, extra) {
    try {
      const config = require('/root/pyBot/config');
      const currentState = config.autoTyping || false;
      const newState = !currentState;
      
      const configPath = '/root/pyBot/config.js';
      let configContent = fs.readFileSync(configPath, 'utf8');
      
      configContent = configContent.replace(
        /autoTyping:\s*process\.env\.AUTO_TYPING\s*===?\s*['"]true['"]\s*\|\|\s*false/,
        `autoTyping: ${newState}`
      );
      
      fs.writeFileSync(configPath, configContent);
      global.autoTyping = newState;
      
      const stateText = newState ? 'ON' : 'OFF';
      await extra.reply(`⌨️ Auto Typing ${stateText}!\n\nBot will show typing indicator while processing commands.`);
      
    } catch (error) {
      console.error('Error in autotyping command:', error);
      await extra.reply('❌ Failed to toggle Auto Typing: ' + error.message);
    }
  }
};