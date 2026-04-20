/**
 * ToViewOnce Command - Convert media to view-once
 * Uses viewOnceMessageV2 protocol
 */

module.exports = {
  name: 'toviewonce',
  aliases: ['tovo', 'viewoncemake'],
  category: 'general',
  description: 'Make media view-once (disappears after viewing)',
  usage: '.toviewonce - reply to media to make it view-once',
  
  async execute(sock, msg, args, extra) {
    const chatId = extra.from || msg.key.remoteJid;
    
    let targetMsg = null;
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    if (ctx?.quotedMessage) {
      targetMsg = ctx.quotedMessage;
    }
    
    if (!targetMsg) {
      return extra.reply('📎 *Usage:* Reply to an image/video with `.toviewonce`\n\nIt will be sent as view-once.');
    }
    
    const hasMedia = targetMsg.imageMessage || targetMsg.videoMessage;
    if (!hasMedia) {
      return extra.reply('❌ Reply to image or video to make it view-once.');
    }
    
    await extra.reply('⏳ Processing...');
    
    let mediaType = '';
    let mediaMsg = null;
    
    if (targetMsg.imageMessage) {
      mediaType = 'image';
      mediaMsg = targetMsg.imageMessage;
    } else if (targetMsg.videoMessage) {
      mediaType = 'video';
      mediaMsg = targetMsg.videoMessage;
    }
    
    if (!mediaMsg) {
      return extra.reply('❌ Unsupported media.');
    }
    
    // Download media
    let buffer = null;
    try {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys');
      const targetMessage = {
        key: {
          remoteJid: chatId,
          id: ctx.stanzaId,
          participant: ctx.participant,
        },
        message: {
          [mediaType + 'Message']: mediaMsg
        }
      };
      buffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { 
        logger: undefined, 
        reuploadRequest: sock.updateMediaMessage 
      });
    } catch (e) {
      console.log('Download error:', e.message);
    }
    
    if (!buffer || buffer.length < 100) {
      return extra.reply('❌ Could not process media.');
    }
    
    const caption = mediaMsg.caption || '';
    
    // Send as view-once using viewOnce property
    try {
      await sock.sendMessage(chatId, { 
        [mediaType]: buffer, 
        caption: caption,
        viewOnce: true
      }, { quoted: msg });
      await extra.reply('✅ Sent as view-once!');
    } catch (e) {
      console.log('VO error:', e.message);
      // Fallback: send without viewOnce
      await sock.sendMessage(chatId, { [mediaType]: buffer, caption }, { quoted: msg });
      await extra.reply('⚠️ Sent as regular media.');
    }
  }
};