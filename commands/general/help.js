const path = require('path');
/**
 * Help Command - Show detailed help for specific commands
 */

const config = require(path.join(__dirname, '../../config'));
const { loadCommands } = require('../../utils/commandLoader');

module.exports = {
  name: 'help',
  aliases: ['h', 'aid', 'cmdinfo'],
  category: 'general',
  description: 'Show help for a specific command',
  usage: '.help <command_name>',
  
  async execute(sock, msg, args, extra) {
    try {
      const commands = loadCommands();
      
      // If no specific command requested, show general help
      if (args.length === 0) {
        let helpText = `╭━━『 *${config.botName} Help* 』━━╮\n\n`;
        helpText += `📖 How to use help:\n`;
        helpText += `• ${config.prefix}help - Show this message\n`;
        helpText += `• ${config.prefix}help <command> - Show help for specific command\n\n`;
        helpText += `📋 Example:\n`;
        helpText += `• ${config.prefix}help ping\n`;
        helpText += `• ${config.prefix}help spam\n`;
        helpText += `• ${config.prefix}help sticker\n\n`;
        helpText += `💡 Tip: Use ${config.prefix}menu to see all commands\n`;
        helpText += `╰━━━━━━━━━━━━━━━━━╯`;
        
        return extra.reply(helpText);
      }
      
      // Look for the requested command
      const searchTerm = args[0].toLowerCase();
      let foundCmd = null;
      
      // Check by name or alias
      for (const [name, cmd] of commands.entries()) {
        if (name === searchTerm || (cmd.aliases && cmd.aliases.includes(searchTerm))) {
          foundCmd = cmd;
          foundCmd.mainName = name;
          break;
        }
      }
      
      if (!foundCmd) {
        return extra.reply(`❌ Command "${args[0]}" not found!\n\nUse ${config.prefix}menu to see all available commands.`);
      }
      
      // Build detailed help for the command
      let helpText = `╭━━『 *Help: ${foundCmd.mainName}* 』━━╮\n\n`;
      helpText += `📝 *Description:*\n${foundCmd.description || 'No description'}\n\n`;
      
      // Usage
      helpText += `📌 *Usage:*\n${foundCmd.usage || `${config.prefix}${foundCmd.mainName}`}\n\n`;
      
      // Aliases
      if (foundCmd.aliases && foundCmd.aliases.length > 0) {
        helpText += `🔄 *Aliases:* ${foundCmd.aliases.map(a => `${config.prefix}${a}`).join(', ')}\n\n`;
      }
      
      // Category
      helpText += `📂 *Category:* ${foundCmd.category || 'general'}\n\n`;
      
      // Permissions
      let perms = [];
      if (foundCmd.ownerOnly) perms.push('👑 Owner Only');
      if (foundCmd.adminOnly) perms.push('🛡️ Admin Only');
      if (foundCmd.groupOnly) perms.push('👥 Group Only');
      if (foundCmd.privateOnly) perms.push('💬 Private Only');
      
      if (perms.length > 0) {
        helpText += `🔒 *Permissions:* ${perms.join(', ')}\n\n`;
      } else {
        helpText += `🔓 *Permissions:* Everyone\n\n`;
      }
      
      // Example
      if (foundCmd.example) {
        helpText += `💡 *Example:*\n${foundCmd.example}\n\n`;
      }
      
      helpText += `╰━━━━━━━━━━━━━━━━━╯`;
      
      return extra.reply(helpText);
      
    } catch (error) {
      console.error('Help command error:', error);
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};