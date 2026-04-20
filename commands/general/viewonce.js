/**
 * ViewOnce Command - Reveal view-once messages
 */

const { downloadContentFromMessage, downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'viewonce',
  aliases: ['vv', 'readviewonce', 'readonce'],
  category: 'general',
  description: 'Reveal view-once messages',
  usage: '.viewonce - reply to a view-once message',
  
  async execute(sock, msg, args, extra) {
    try {
      const chatId = extra.from || msg.key.remoteJid;
      
      let targetMsg = null;
      
      // Check if this is a reply to a view-once message
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      if (ctx?.quotedMessage) {
        targetMsg = ctx.quotedMessage;
      }
      
      // Also check for imageMessage/videoMessage context from view-once
      if (!targetMsg && ctx?.quotedMessage?.viewOnceMessageV2) {
        targetMsg = ctx.quotedMessage;
      }
      if (!targetMsg && ctx?.quotedMessage?.viewOnceMessage) {
        targetMsg = ctx.quotedMessage;
      }
      
      // Also check if current message is view-once
      if (!targetMsg) {
        const current = msg.message;
        if (current?.viewOnceMessageV2?.message || 
            current?.viewOnceMessage?.message ||
            current?.viewOnceMessageV2Extension?.message) {
          targetMsg = current;
        } else if (current?.imageMessage?.viewOnce || 
                 current?.videoMessage?.viewOnce || 
                 current?.audioMessage?.viewOnce) {
          targetMsg = current;
        }
      }
      
      if (!targetMsg) {
        // Check if media already expired/placeholder
        const curr = msg.message;
        const hasPlaceholder = curr?.conversation?.includes('expired') || 
                         curr?.extendedTextMessage?.text?.includes('expired') ||
                         curr?.imageMessage?.caption?.includes('expired') ||
                         curr?.videoMessage?.caption?.includes('expired');
        if (hasPlaceholder) {
          return extra.reply('❌ This view-once media has already been viewed and expired.\n\nWhatsApp deletes view-once media after it\'s viewed once. There\'s no way to recover it.');
        }
        return extra.reply('🗑️ *Usage:* Reply to a view-once message with `.viewonce`\n\nThe message will be revealed!');
      }
      
      await extra.reply('⏳ Processing view-once media...');
      
      let mediaContent = null;
      let mediaType = '';
      
      // Extract media from view-once wrapper
      if (targetMsg.viewOnceMessageV2?.message) {
        mediaContent = targetMsg.viewOnceMessageV2.message;
      } else if (targetMsg.viewOnceMessage?.message) {
        mediaContent = targetMsg.viewOnceMessage.message;
      } else if (targetMsg.viewOnceMessageV2Extension?.message) {
        mediaContent = targetMsg.viewOnceMessageV2Extension.message;
      }
      
      // Check for viewOnce on media messages directly
      if (!mediaContent) {
        if (targetMsg.imageMessage) {
          mediaContent = targetMsg;
          mediaType = targetMsg.imageMessage.viewOnce ? 'image' : '';
        } else if (targetMsg.videoMessage) {
          mediaContent = targetMsg;
          mediaType = targetMsg.videoMessage.viewOnce ? 'video' : '';
        } else if (targetMsg.audioMessage) {
          mediaContent = targetMsg;
          mediaType = targetMsg.audioMessage.viewOnce ? 'audio' : '';
        }
      }
      
      if (!mediaContent) {
        return extra.reply('❌ No view-once media found.');
      }
      
      // Determine media type
      if (!mediaType) {
        const keys = Object.keys(mediaContent);
        for (const key of keys) {
          if (key.includes('Message') && key !== 'contextInfo') {
            mediaType = key.replace('Message', '').toLowerCase();
            break;
          }
        }
      }
      
      // Get the actual media object for download
      let mediaObj = null;
      if (mediaType === 'image') mediaObj = mediaContent.imageMessage;
      else if (mediaType === 'video') mediaObj = mediaContent.videoMessage;
      else if (mediaType === 'audio') mediaObj = mediaContent.audioMessage;
      
      if (!mediaObj) {
        mediaObj = mediaContent;
      }
      
      await extra.reply('⏳ Downloading...');
      
      let buffer = null;
      
      // Try downloadMediaMessage first (simpler approach)
      try {
        buffer = await downloadMediaMessage(targetMsg, 'buffer', {}, { 
          logger: undefined, 
          reuploadRequest: sock.updateMediaMessage 
        });
      } catch (e) {
        console.log('VM1:', e.message);
      }
      
      // Fallback: downloadContentFromMessage
      if (!buffer || buffer.length < 100) {
        try {
          const stream = await downloadContentFromMessage(mediaObj, mediaType || 'image');
          const chunks = [];
          for await (const chunk of stream) {
            chunks.push(chunk);
          }
          if (chunks.length > 0) {
            buffer = Buffer.concat(chunks);
          }
        } catch (e) {
          console.log('VC1:', e.message);
        }
      }
      
      // Try with downloadMediaMessage on inner content
      if (!buffer || buffer.length < 100) {
        try {
          const innerForDownload = {
            key: msg.key,
            message: mediaContent || targetMsg
          };
          buffer = await downloadMediaMessage(innerForDownload, 'buffer', {}, {
            logger: undefined,
            reuploadRequest: sock.updateMediaMessage
          });
        } catch (e) {
          console.log('VM2:', e.message);
        }
      }
      
      if (!buffer || buffer.length < 100) {
        // Check if it's a placeholder/expired message
        const hasExpired = msg.message?.imageMessage?.caption?.includes('viewed once') ||
                        msg.message?.videoMessage?.caption?.includes('viewed once') ||
                        msg.message?.conversation?.includes('viewed once');
        if (hasExpired) {
          return extra.reply('❌ This view-once media has already been viewed.\n\nWhatsApp deletes view-once media after it\'s viewed once. There\'s no way to recover it.');
        }
        return extra.reply('❌ Cannot access view-once media.\n\nThis might mean:\n• The media already expired\n• WhatsApp removed access\n• The media was already viewed');
      }
      
      const caption = mediaObj?.caption || '';
      
      // Send as regular media
      if (mediaType === 'image' || !mediaType) {
        await sock.sendMessage(chatId, { 
          image: buffer, 
          caption: caption || '👁️ View-once revealed!' 
        }, { quoted: msg });
      } else if (mediaType === 'video') {
        await sock.sendMessage(chatId, { 
          video: buffer, 
          caption: caption || '👁️ View-once revealed!',
          mimetype: 'video/mp4'
        }, { quoted: msg });
      } else if (mediaType === 'audio') {
        await sock.sendMessage(chatId, { 
          audio: buffer, 
          mimetype: 'audio/mp4'
        }, { quoted: msg });
      } else {
        await sock.sendMessage(chatId, { 
          image: buffer, 
          caption: '👁️ View-once revealed!' 
        }, { quoted: msg });
      }
      
      await extra.reply('✅ Revealed!');
      
    } catch (error) {
      console.error('ViewOnce error:', error);
      extra.reply('❌ Error: ' + error.message);
    }
  }
};