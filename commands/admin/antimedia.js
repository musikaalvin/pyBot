/**
 * Anti-Media Toggle Command
 */

const database = require('../../database');

module.exports = {
  name: 'antimedia',
  aliases: ['antimed', 'mediaoff'],
  category: 'admin',
  description: 'Toggle anti-media system with customizable options',
  usage: '.antimedia <on/off/action> [options]\n\nOptions:\n- image, video, sticker, audio, doc, all\n- action: delete, mute, warn\n- Example: .antimedia on video audio',
  
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
      const action = args[0]?.toLowerCase();
      const settings = database.getGroupSettings(groupId);
      
      if (!settings.antimediaSettings) {
        settings.antimediaSettings = {
          enabled: false,
          types: ['image', 'video', 'sticker', 'audio', 'document'],
          action: 'delete',
          exemptAdmins: true,
          exemptOwner: true
        };
      }
      
      if (action === 'on' || action === 'off') {
        settings.antimedia = (action === 'on');
        settings.antimediaSettings.enabled = (action === 'on');
        database.updateGroupSettings(groupId, settings);
        
        await extra.reply(`✅ Anti-media system ${action === 'on' ? 'enabled' : 'disabled'} for this group.\n\nCurrent blocked: ${settings.antimediaSettings.types.join(', ')}\nAction: ${settings.antimediaSettings.action}`);
      } else if (action === 'types') {
        const types = args.slice(1).map(t => t.toLowerCase()).filter(t => ['image', 'video', 'sticker', 'audio', 'document', 'all'].includes(t));
        if (types.length === 0) {
          return extra.reply(`📊 Current blocked types: ${settings.antimediaSettings.types.join(', ')}\n\nSet types: .antimedia types image video audio`);
        }
        if (types.includes('all')) {
          settings.antimediaSettings.types = ['image', 'video', 'sticker', 'audio', 'document'];
        } else {
          settings.antimediaSettings.types = types;
        }
        database.updateGroupSettings(groupId, settings);
        await extra.reply(`✅ Blocked media types updated: ${settings.antimediaSettings.types.join(', ')}`);
      } else if (action === 'action') {
        const act = args[1]?.toLowerCase();
        if (!['delete', 'mute', 'warn'].includes(act)) {
          return extra.reply(`📊 Current action: ${settings.antimediaSettings.action}\n\nAvailable: delete, mute, warn`);
        }
        settings.antimediaSettings.action = act;
        database.updateGroupSettings(groupId, settings);
        await extra.reply(`✅ Anti-media action set to: ${act}`);
      } else if (action === 'status') {
        await extra.reply(`📊 Anti-Media Status:\n\nEnabled: ${settings.antimedia ? '✅ Yes' : '❌ No'}\nBlocked: ${settings.antimediaSettings.types.join(', ')}\nAction: ${settings.antimediaSettings.action}\nExempt Admins: ${settings.antimediaSettings.exemptAdmins ? '✅' : '❌'}\nExempt Owner: ${settings.antimediaSettings.exemptOwner ? '✅' : '❌'}`);
      } else if (!action) {
        const status = settings.antimedia ? 'enabled' : 'disabled';
        await extra.reply(`📊 Anti-media is currently ${status} for this group.\n\nCurrent blocked: ${settings.antimediaSettings.types.join(', ')}\nAction: ${settings.antimediaSettings.action}\n\nUsage:\n.antimedia on/off - toggle\n.antimedia types <image video audio> - set types\n.antimedia action <delete/mute/warn> - set action\n.antimedia status - view status`);
      } else {
        await extra.reply(`❌ Unknown option. Use: on, off, types, action, or status`);
      }
    } catch (error) {
      console.error('Antimedia error:', error);
      await extra.reply('❌ Failed to update anti-media setting!');
    }
  }
};