/**
 * Set Prefix Command - Change bot command prefix
 */

const path = require('path');
const config = require(path.join(__dirname, '../../config'));
const fs = require('fs');

module.exports = {
  name: 'setprefix',
  aliases: ['prefix'],
  category: 'general',
  description: 'Change bot command prefix',
  usage: '.setprefix <new prefix>',
  
  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply(`📌 Current prefix: ${config.prefix}\n\nUsage: .setprefix <new prefix>`);
      }
      
      const newPrefix = args[0];
      
      if (newPrefix.length > 3) {
        return extra.reply('❌ Prefix must be 1-3 characters long!');
      }
      
      config.prefix = newPrefix;
      
      const configPath = path.join(__dirname, '../../config.js');
      let configContent = fs.readFileSync(configPath, 'utf8');
      configContent = configContent.replace(
        /prefix:\s*process\.env\.PREFIX\s*\|\|\s*['"][^'"]+['"]/,
        `prefix: '${newPrefix}'`
      );
      fs.writeFileSync(configPath, configContent);
      
      await extra.reply(`✅ Prefix changed to: ${newPrefix}\n\nNew command format: ${newPrefix}command`);
      
    } catch (error) {
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};
