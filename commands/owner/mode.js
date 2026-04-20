/**
 * Bot Mode Command
 * Switch between Public, Private, and Self modes
 */

const config = require('/root/pyBot/config');

module.exports = {
  name: 'mode',
  aliases: ['modes', 'botmode'],
  category: 'owner',
  description: 'Set bot mode (Public/Private/Self)',
  usage: '.mode <public/private/self>',
  
  async execute(sock, msg, args, extra) {
    try {
      // Only owner can change bot mode
      if (!extra.isOwner) {
        return extra.reply('👑 This command is only for bot owner!');
      }

      if (args.length === 0) {
        const modeMap = {
          false: 'Public (everyone can use)',
          true: 'Self (only owner can use)'
        };
        const currentMode = config.selfMode ? 'Self' : (config.publicMode ? 'Public' : 'Private');
        return extra.reply(`Current bot mode: *${currentMode}*\n\nUsage: .mode <public/private/self>\n\n- public: Everyone can use the bot\n- private: Only admins/owners can use in groups, everyone in private\n- self: Only the bot owner can use`);
      }

      const mode = args[0].toLowerCase();
      let newSelfMode = false;
      let newPublicMode = false;
      
      switch (mode) {
        case 'public':
          newSelfMode = false;
          newPublicMode = true;
          break;
        case 'private':
          newSelfMode = false;
          newPublicMode = false;
          break;
        case 'self':
          newSelfMode = true;
          newPublicMode = false;
          break;
        default:
          return extra.reply('❌ Invalid mode! Choose from: public, private, self');
      }

      // Update config (in a real implementation, you'd write to config file)
      // For now, we'll just update the runtime config
      config.selfMode = newSelfMode;
      config.publicMode = newPublicMode;
      
      const modeNames = {
        'public': 'Public',
        'private': 'Private', 
        'self': 'Self'
      };
      
      await extra.reply(`✅ Bot mode set to: *${modeNames[mode]}*\n\n${mode === 'public' ? 'Everyone can use the bot' : mode === 'private' ? 'Only admins/owners can use in groups' : 'Only the bot owner can use the bot'}`);
    } catch (error) {
      console.error('Mode error:', error);
      await extra.reply('❌ Failed to change bot mode!');
    }
  }
};