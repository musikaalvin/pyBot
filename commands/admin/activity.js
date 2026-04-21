const path = require('path');
/**
 * Activity Logger Command
 */

const database = require('../../database');
const config = require(path.join(__dirname, '../../config'));

module.exports = {
  name: 'activity',
  aliases: ['log', 'logs', 'history'],
  category: 'admin',
  description: 'View group activity log',
  usage: '.activity [number]',
  
  async execute(sock, msg, args, extra) {
    try {
      if (!msg.key.remoteJid.endsWith('@g.us')) {
        return extra.reply('❌ This command can only be used in groups!');
      }

      const isAdmin = await extra.isAdmin;
      const isOwner = extra.isOwner;
      
      if (!isAdmin && !isOwner) {
        return extra.reply('🔒 This command is only for group admins!');
      }

      const groupId = msg.key.remoteJid;
      const limit = args[0] ? Math.min(parseInt(args[0]), 50) : 10;
      
      const activities = database.getGroupActivity(groupId, limit);
      
      if (activities.length === 0) {
        return extra.reply('📝 No activity recorded for this group yet.');
      }

      let activityText = `*📊 GROUP ACTIVITY LOG* (Last ${activities.length} entries)\n\n`;
      
      activities.forEach((act, index) => {
        const time = new Date(act.timestamp);
        const timeString = time.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });
        const dateString = time.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: '2-digit'
        });
        
        const userId = act.userId.split('@')[0];
        const action = act.action.charAt(0).toUpperCase() + act.action.slice(1);
        const details = act.details ? ` - ${act.details}` : '';
        
        activityText += `${index + 1}. ${action} by @${userId}${details}\n`;
        activityText += `   🕐 ${timeString} • ${dateString}\n\n`;
      });

      await extra.reply(activityText);
    } catch (error) {
      console.error('Activity error:', error);
      await extra.reply('❌ Failed to get activity log!');
    }
  }
};