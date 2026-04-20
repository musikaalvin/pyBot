/**
 * Anti-Bot Command - Enhanced anti-bot system
 */

const database = require('../../database');
const config = require('/root/pyBot/config');

module.exports = {
  name: 'antibot',
  aliases: ['nobot', 'blockbot'],
category: 'owner',
  description: 'Advanced anti-bot system with multiple detection methods',
  usage: '.antibot on/off | action <delete/kick/warn> | mode <strict/normal/soft> | add <number> | remove <number> | whitelist <number> | unwhitelist <number> | list | scan | stats | reset',
  ownerOnly: true,
  
  async execute(sock, msg, args, extra) {
    const from = msg.key.remoteJid;
    
    if (!from.endsWith('@g.us')) {
      return extra.reply('❌ This command only works in groups!');
    }
    
    const isAdmin = await extra.isAdmin;
    if (!isAdmin && !extra.isOwner) {
      return extra.reply('❌ Only admins can use this command!');
    }
    
    let settings = database.getGroupSettings(from);
    
    // Initialize antibot settings
    if (!settings.antibotSettings) {
      settings.antibotSettings = {
        enabled: false,
        action: 'delete',
        mode: 'normal',
        blockedBots: [],
        whitelist: [],
        stats: { detected: 0, kicked: 0, deleted: 0 }
      };
    }
    
    const subCmd = args[0]?.toLowerCase();
    const s = settings.antibotSettings;
    
    // Show status
    if (!subCmd || subCmd === 'status') {
      const modeEmoji = s.mode === 'strict' ? '🔴' : s.mode === 'soft' ? '🟢' : '🟡';
      const actionEmoji = s.action === 'kick' ? '👢' : s.action === 'warn' ? '⚠️' : '🗑️';
      return extra.reply(`🤖 *Anti-Bot Status*\n\n` +
        `Enabled: ${s.enabled ? '✅ ON' : '❌ OFF'}\n` +
        `${modeEmoji} Mode: ${s.mode}\n` +
        `${actionEmoji} Action: ${s.action}\n` +
        `🚫 Blocked: ${s.blockedBots.length}\n` +
        `⭐ Whitelist: ${s.whitelist.length}\n` +
        `📊 Stats: ${s.stats.detected} detected, ${s.stats.kicked} kicked, ${s.stats.deleted} deleted\n\n` +
        `Usage:\n` +
        `.antibot on/off - toggle\n` +
        `.antibot action <delete/kick/warn>\n` +
        `.antibot mode <strict/normal/soft>\n` +
        `.antibot scan - detect bots`);
    }
    
    // Toggle on/off
    if (subCmd === 'on' || subCmd === 'off') {
      s.enabled = (subCmd === 'on');
      settings.antibot = s.enabled;
      database.updateGroupSettings(from, settings);
      return extra.reply(`✅ Anti-Bot ${subCmd === 'on' ? 'enabled' : 'disabled'}!\n\nMode: ${s.mode}\nAction: ${s.action}`);
    }
    
    // Set action
    if (subCmd === 'action') {
      const act = args[1]?.toLowerCase();
      if (!['delete', 'kick', 'warn'].includes(act)) {
        return extra.reply(`📊 Current: ${s.action}\n\nOptions: delete, kick, warn`);
      }
      s.action = act;
      settings.antibotAction = act;
      database.updateGroupSettings(from, settings);
      return extra.reply(`✅ Action set to: ${act}`);
    }
    
    // Set mode
    if (subCmd === 'mode') {
      const mode = args[1]?.toLowerCase();
      if (!['strict', 'normal', 'soft'].includes(mode)) {
        return extra.reply(`📊 Current: ${s.mode}\n\nModes:\n• strict - catches all bots, may flag humans\n• normal - balanced detection\n• soft - only obvious bots`);
      }
      s.mode = mode;
      database.updateGroupSettings(from, settings);
      return extra.reply(`✅ Mode set to: ${mode}`);
    }
    
    // Add to blocklist
    if (subCmd === 'add' || subCmd === 'block') {
      const num = args[1]?.replace(/\D/g, '');
      if (!num) return extra.reply('Usage: .antibot add <number>');
      if (!s.blockedBots.includes(num)) {
        s.blockedBots.push(num);
        database.updateGroupSettings(from, settings);
        return extra.reply(`✅ Added ${num} to blocklist`);
      }
      return extra.reply('ℹ️ Already blocked');
    }
    
    // Remove from blocklist
    if (subCmd === 'remove' || subCmd === 'unblock') {
      const num = args[1]?.replace(/\D/g, '');
      if (!num) return extra.reply('Usage: .antibot remove <number>');
      const idx = s.blockedBots.indexOf(num);
      if (idx > -1) {
        s.blockedBots.splice(idx, 1);
        database.updateGroupSettings(from, settings);
        return extra.reply(`✅ Removed ${num} from blocklist`);
      }
      return extra.reply('ℹ️ Not in blocklist');
    }
    
    // Show blocklist
    if (subCmd === 'list') {
      if (s.blockedBots.length === 0) return extra.reply('🚫 Blocklist empty');
      return extra.reply(`🚫 Blocked (${s.blockedBots.length}):\n${s.blockedBots.map(n => `• ${n}`).join('\n')}`);
    }
    
    // Add whitelist
    if (subCmd === 'whitelist') {
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.participant;
      
      if (args[1]?.toLowerCase() === 'add') {
        const num = args[2]?.replace(/\D/g, '');
        if (!num) return extra.reply('Usage: .antibot whitelist add <number>');
        if (!s.whitelist.includes(num)) {
          s.whitelist.push(num);
          database.updateGroupSettings(from, settings);
          return extra.reply(`✅ Added ${num} to whitelist`);
        }
        return extra.reply('ℹ️ Already whitelisted');
      }
      
      if (mentioned?.length) {
        for (const jid of mentioned) {
          const num = jid.split('@')[0];
          if (!s.whitelist.includes(num)) s.whitelist.push(num);
        }
        database.updateGroupSettings(from, settings);
        return extra.reply(`✅ Added ${mentioned.length} to whitelist`);
      }
      
      if (quoted) {
        const num = quoted.split('@')[0];
        if (!s.whitelist.includes(num)) {
          s.whitelist.push(num);
          database.updateGroupSettings(from, settings);
        }
        return extra.reply(`✅ Added ${num} to whitelist`);
      }
      
      if (s.whitelist.length === 0) return extra.reply('⭐ Whitelist empty\nUsage: .antibot whitelist add <number>');
      return extra.reply(`⭐ Whitelist (${s.whitelist.length}):\n${s.whitelist.map(n => `• ${n}`).join('\n')}`);
    }
    
    // Remove from whitelist
    if (subCmd === 'unwhitelist') {
      const num = args[1]?.replace(/\D/g, '');
      if (!num) return extra.reply('Usage: .antibot unwhitelist <number>');
      const idx = s.whitelist.indexOf(num);
      if (idx > -1) {
        s.whitelist.splice(idx, 1);
        database.updateGroupSettings(from, settings);
        return extra.reply(`✅ Removed ${num} from whitelist`);
      }
      return extra.reply('ℹ️ Not in whitelist');
    }
    
    // Show whitelist
    if (subCmd === 'whitelist') {
      if (s.whitelist.length === 0) return extra.reply('⭐ Whitelist empty');
      return extra.reply(`⭐ Whitelist (${s.whitelist.length}):\n${s.whitelist.map(n => `• ${n}`).join('\n')}`);
    }
    
    // Scan for bots
    if (subCmd === 'scan') {
      await extra.reply('🔍 Scanning for bots...');
      
      if (!extra.groupMetadata?.participants) {
        return extra.reply('❌ Could not get group members');
      }
      
      const botPrefixes = ['BAE5', '3EB0', 'B24E', 'WAWE', 'BAAF', 'BAAE', 'BAAD', 'BAEF'];
      const foundBots = [];
      const strictMode = s.mode === 'strict';
      
      for (const p of extra.groupMetadata.participants) {
        const pJid = p.id;
        const pNum = pJid.split('@')[0];
        
        if (config.ownerNumber.some(o => pNum.includes(o))) continue;
        if (p.admin === 'admin' || p.admin === 'superadmin') continue;
        if (s.whitelist.includes(pNum)) continue;
        
        const contact = sock.store?.contacts?.[pJid] || {};
        const hasPp = !!(contact.imgUrl || contact.thumbnail);
        const hasStatus = !!contact.status;
        const hasName = contact.notify && !/^\d+$/.test(contact.notify);
        const isLid = pJid.includes('@lid.');
        
        let score = 0;
        let reasons = [];
        
        if (!hasPp) { score += strictMode ? 3 : 2; reasons.push('no PP'); }
        if (!hasStatus) { score += 1; reasons.push('no status'); }
        if (!hasName) { score += 1; reasons.push('no name'); }
        if (isLid) { score += 2; reasons.push('LID account'); }
        
        const threshold = s.mode === 'strict' ? 2 : s.mode === 'soft' ? 5 : 3;
        
        if (score >= threshold) {
          foundBots.push({ num: pNum, reasons: reasons.join(', ') });
        }
      }
      
      if (foundBots.length === 0) {
        return extra.reply('✅ No bots detected!');
      }
      
      const botList = foundBots.map(b => `• ${b.num}\n   └ ${b.reasons}`).join('\n');
      await extra.reply(`🚫 Found ${foundBots.length} potential bot(s):\n\n${botList}`);
      
      for (const bot of foundBots) {
        if (!s.blockedBots.includes(bot.num)) {
          s.blockedBots.push(bot.num);
        }
      }
      database.updateGroupSettings(from, settings);
      return extra.reply(`✅ Added ${foundBots.length} to blocklist`);
    }
    
    // Stats
    if (subCmd === 'stats') {
      return extra.reply(`📊 Anti-Bot Stats:\n\nDetected: ${s.stats.detected}\nKicked: ${s.stats.kicked}\nDeleted: ${s.stats.deleted}\n\nBlocked: ${s.blockedBots.length}\nWhitelist: ${s.whitelist.length}`);
    }
    
    // Reset
    if (subCmd === 'reset') {
      s.blockedBots = [];
      s.whitelist = [];
      s.stats = { detected: 0, kicked: 0, deleted: 0 };
      database.updateGroupSettings(from, settings);
      return extra.reply('✅ Anti-Bot data reset!');
    }
    
    return extra.reply('❌ Unknown command. Use .antibot for status');
  }
};