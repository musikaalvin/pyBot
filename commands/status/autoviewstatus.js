/**
 * Auto View Status Command
 */

const config = require('/root/pyBot/config');

module.exports = {
  name: 'autoviewstatus',
  aliases: ['avs'],
  description: 'Toggle auto view status in DMs/groups',
  category: 'status',
  
  async execute(sock, msg, args, extra) {
    try {
      const from = msg.key.remoteJid;
      const isGroup = from.endsWith('@g.us');
      
      if (!extra.isOwner) {
        return extra.reply('Only bot owner can use this!');
      }
      
      const setting = args[0]?.toLowerCase();
      
      if (isGroup) {
        const database = require('../../database');
        const settings = database.getGroupSettings(from);
        
        if (setting === 'on' || setting === 'off') {
          settings.autoViewStatus = (setting === 'on');
          database.updateGroupSettings(from, settings);
          extra.reply('Auto View Status ' + (setting === 'on' ? 'enabled' : 'disabled') + ' in this group!');
        } else {
          const status = settings.autoViewStatus ? 'enabled' : 'disabled';
          extra.reply('Status: ' + status + ' | Use .autoviewstatus on/off');
        }
      } else {
        if (setting === 'on' || setting === 'off') {
          const configPath = '/root/pyBot/config.js';
          const fs = require('fs');
          let c = fs.readFileSync(configPath, 'utf8');
          c = c.replace(
            /autoViewStatus:\s*process\.env\.AUTO_VIEW_STATUS\s*===?\s*['"]true['"]\s*\|\|\s*false/,
            'autoViewStatus: ' + (setting === 'on')
          );
          fs.writeFileSync(configPath, c);
          delete require.cache[require.resolve('/root/pyBot/config')];
          extra.reply('Auto View Status ' + (setting === 'on' ? 'enabled' : 'disabled') + ' globally!');
        } else {
          const cfg = require('/root/pyBot/config');
          extra.reply('Status: ' + (cfg.autoViewStatus ? 'enabled' : 'disabled') + ' | Use .autoviewstatus on/off');
        }
      }
    } catch (error) {
      extra.reply('Error: ' + error.message);
    }
  }
};