/**
 * Anti-Call Command - Enable or disable anti-call system
 */

module.exports = {
  name: 'anticall',
  category: 'owner',
  ownerOnly: true,
  description: 'Enable or disable anti-call system',
  usage: '.anticall on/off',

  async execute(sock, msg, args, extra) {
    if (!args[0]) {
      return extra.reply('Usage: .anticall on/off');
    }

    const option = args[0].toLowerCase();

    if (!['on', 'off'].includes(option)) {
      return extra.reply('Usage: .anticall on/off');
    }

    const enabled = option === 'on';

    const fs = require('fs');
    const path = require('path');
    const configPath = path.join(__dirname, '../../config.js');
    
    try {
      let configFile = fs.readFileSync(configPath, 'utf8');
      
      configFile = configFile.replace(
        /anticall:\s*process\.env\.ANTICALL\s*===?\s*['"]true['"]\s*\|\|\s*false/,
        `anticall: ${enabled}`
      );
      
      fs.writeFileSync(configPath, configFile);
      delete require.cache[require.resolve(path.join(__dirname, '../../config'))];
      
      await extra.reply(
        enabled
          ? '✅ Anti-call enabled. Calls will be auto-rejected & blocked.'
          : '❌ Anti-call disabled.'
      );
    } catch (err) {
      console.error('[anticall cmd] error:', err);
      extra.reply('❌ Error updating anti-call setting: ' + err.message);
    }
  }
};