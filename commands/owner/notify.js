/**
 * Notify Command - Enable or disable new user welcome DM
 */

module.exports = {
  name: 'notify',
  category: 'owner',
  ownerOnly: true,
  description: 'Enable or disable new user welcome DM',
  usage: '.notify on/off/status',

  async execute(sock, msg, args, extra) {
    if (!args[0]) {
      return extra.reply('Usage: .notify on/off/status');
    }

    const option = args[0].toLowerCase();

    if (option === 'status') {
      const config = require('/root/pyBot/config');
      return extra.reply(
        config.welcomeDM ? '📢 Notify: ✅ ON' : '📢 Notify: ❌ OFF'
      );
    }

    if (!['on', 'off'].includes(option)) {
      return extra.reply('Usage: .notify on/off/status');
    }

    const enabled = option === 'on';

    const fs = require('fs');
    const configPath = '/root/pyBot/config.js';
    
    try {
      let configFile = fs.readFileSync(configPath, 'utf8');
      
      configFile = configFile.replace(
        /welcomeDM:\s*(true|false)/,
        `welcomeDM: ${enabled}`
      );
      
      fs.writeFileSync(configPath, configFile);
      delete require.cache[require.resolve('/root/pyBot/config')];
      
      await extra.reply(
        enabled
          ? '✅ Notify enabled. New users will receive welcome DM.'
          : '❌ Notify disabled.'
      );
    } catch (err) {
      console.error('[notify cmd] error:', err);
      extra.reply('❌ Error updating notify setting: ' + err.message);
    }
  }
};