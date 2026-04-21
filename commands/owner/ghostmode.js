/**
 * Ghost Mode Command
 * Controls whether the bot shows blue ticks (reads messages) or stays hidden
 * No restart needed!
 */

module.exports = {
  name: 'ghostmode',
  aliases: ['ghost', 'noblue'],
  description: 'Toggle ghost mode (no blue ticks)',
  category: 'owner',
  
  async execute(sock, msg, args, extra) {
    try {
      const setting = args[0]?.toLowerCase();
      
      if (setting === 'on') {
        global.ghostMode = true;
        global.fakeOnline = false;
        
        console.log('[Ghost] Set global.ghostMode = true, global.fakeOnline = false');
        
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, '../../config.js');
        let configContent = fs.readFileSync(configPath, 'utf8');
        configContent = configContent.replace(/ghostMode: (true|false)/, 'ghostMode: true');
        fs.writeFileSync(configPath, configContent);
        
        await extra.reply('👻 *Ghost Mode ON!* \n\nBlue ticks hidden + Offline status.\n\nUse .ghost off to disable.');
      } else if (setting === 'off') {
        global.ghostMode = false;
        
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, '../../config.js');
        let configContent = fs.readFileSync(configPath, 'utf8');
        configContent = configContent.replace(/ghostMode: (true|false)/, 'ghostMode: false');
        fs.writeFileSync(configPath, configContent);
        
        console.log('[Ghost] Set global.ghostMode = false');
        await extra.reply('👁️ *Ghost Mode OFF!* \n\nBlue ticks shown.\n\nUse .ghost on to hide.');
      } else {
        const current = global.ghostMode;
        await extra.reply('👻 *Ghost Mode:* ' + (current ? 'ON' : 'OFF') + '\n\nUse .ghost on/off');
      }
        
    } catch (error) {
      console.error('ghostmode error:', error);
      extra.reply('Error: ' + error.message);
    }
  }
};