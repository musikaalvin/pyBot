/**
 * List Command
 * Show all commands with descriptions
 */

const fs = require('fs');
const path = require('path');
const config = require(path.join(__dirname, '../../config'));
const { loadCommands } = require('../../utils/commandLoader');
const { sendButtons } = require('gifted-btns');

module.exports = {
  name: 'list',
  aliases: [],
  description: 'List all commands with descriptions',
  usage: '.list',
  category: 'general',
  
  async execute(sock, msg, args, extra) {
    try {
      const prefix = config.prefix;
      const commands = loadCommands();
      const categories = {};
      
      // Group commands by category
      commands.forEach((cmd, name) => {
        if (cmd.name === name) { // Only count main command names, not aliases
          const category = (cmd.category || 'other').toLowerCase();
          if (!categories[category]) {
            categories[category] = [];
          }
          categories[category].push({
            label: cmd.description || '',
            names: [cmd.name].concat(cmd.aliases || []),
          });
        }
      });
      
      let menu = `*${config.botName} - Commands List*\n`;
      menu += `Prefix: *${prefix}*\n\n`;
      
      const orderedCats = Object.keys(categories).sort();
      
      for (const cat of orderedCats) {
        menu += `*📂 ${cat.toUpperCase()}*\n`;
        for (const entry of categories[cat]) {
          const cmdList = entry.names.map((n) => `${prefix}${n}`).join(', ');
          const label = entry.label || '';
          menu += label ? `• \`${cmdList}\` - ${label}\n` : `• ${cmdList}\n`;
        }
        menu += '\n';
      }
      
      menu = menu.trimEnd();
      
      // Build buttons dynamically based on available social links
      const buttons = [];
      
      // Add YouTube button
      if (config.social?.youtube) {
        buttons.push({
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: 'Youtube',
            url: config.social.youtube
          })
        });
      }
      
      // Add GitHub button
      if (config.social?.github) {
        buttons.push({
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: 'Bot Repo',
            url: config.social.github
          })
        });
      }
      
      // Add Channel button if configured
      if (config.social?.channel) {
        buttons.push({
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '📺 My Channel',
            url: config.social.channel
          })
        });
      }
      
      // Add Community button
      if (config.social?.community) {
        buttons.push({
          name: 'cta_url',
          buttonParamsJson: JSON.stringify({
            display_text: '👥 Join Community',
            url: config.social.community
          })
        });
      }
      
      // Send message with buttons using gifted-btns
      if (buttons.length > 0) {
        await sendButtons(sock, extra.from, {
          title: '',
          text: menu,
          footer: `> *Powered by ${config.botName}*`,
          buttons
        }, { quoted: msg });
      } else {
        await extra.reply(menu);
      }
      
    } catch (err) {
      console.error('list.js error:', err);
      await extra.reply('❌ Failed to load commands list.');
    }
  }
};

