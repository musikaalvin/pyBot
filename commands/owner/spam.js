const path = require('path');
/**
 * SPAM Command - Send repeated messages to a target
 * Safe version - only works in groups
 */

const config = require(path.join(__dirname, '../../config'));

module.exports = {
  name: 'spam',
  aliases: ['spamg'],
  category: 'owner',
  description: 'Send repeated messages to a group',
  usage: '.spam <count> <message>',
  ownerOnly: true,
  
  async execute(sock, msg, args, extra) {
    try {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedJid = msg.message?.extendedTextMessage?.contextInfo?.quotedRemoteJid;
      
      // Find count - look for a number in args
      let count = 10;
      let countIdx = -1;
      
      for (let i = 0; i < args.length; i++) {
        const n = parseInt(args[i]);
        if (!isNaN(n) && n > 0 && n <= 50) {
          count = n;
          countIdx = i;
          break;
        }
      }
      
      // Get message to repeat
      let spamMsg = '';
      
      if (q?.conversation) {
        spamMsg = q.conversation;
      } else if (q?.extendedTextMessage?.text) {
        spamMsg = q.extendedTextMessage.text;
      } else if (args.length > 0) {
        const msgParts = countIdx >= 0 ? args.slice(0, countIdx).concat(args.slice(countIdx + 1)) : args;
        spamMsg = msgParts.join(' ');
      }
      
      // Target: quoted message jid, current group, or DM (sender)
      let targetJid = quotedJid;
      
      if (!targetJid) {
        if (msg.key.remoteJid.endsWith('@g.us')) {
          targetJid = msg.key.remoteJid;
        } else {
          // In DM - just send to the chat
          targetJid = extra.from;
        }
      }
      
      if (!targetJid) {
        return extra.reply('❌ Provide message to spam.\n\nUsage: .spam 10 hi');
      }
      
      if (!spamMsg) {
        return extra.reply('❌ Provide message to spam.\n\nUsage: .spam 10 hi');
      }
      
      // Safety check
      const ownerGroup = config.ownerNumber[0] + '@g.us';
      if (targetJid === ownerGroup) {
        return extra.reply('❌ Cannot spam owner group!');
      }
      
      let sent = 0;
      for (let i = 0; i < count; i++) {
        try {
          await sock.sendMessage(targetJid, { text: spamMsg });
          sent++;
          if (i < count - 1) await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          break;
        }
      }
      
    } catch (e) {
      console.error('spam error:', e);
      extra.reply('❌ Error: ' + e.message);
    }
  }
};