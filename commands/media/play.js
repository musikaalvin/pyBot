/**
 * Play Command - Play audio/video from replied media
 */

const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: 'play',
  aliases: ['p'],
  category: 'media',
  description: 'Play audio/video from reply',
  usage: '.play - reply to video/audio to play it',
  
  async execute(sock, msg, args, extra) {
    try {
      const from = msg.key.remoteJid;
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      
      if (!ctx?.quotedMessage) {
        return extra.reply('❌ Reply to a video/audio with .play to play it');
      }
      
      const quoted = ctx.quotedMessage;
      let mediaType = '';
      let mediaMsg = null;
      
      // Check what media type
      if (quoted.videoMessage) {
        mediaType = 'video';
        mediaMsg = quoted.videoMessage;
      } else if (quoted.audioMessage) {
        mediaType = 'audio';
        mediaMsg = quoted.audioMessage;
      } else if (quoted.imageMessage) {
        mediaType = 'image';
        mediaMsg = quoted.imageMessage;
      } else if (quoted.stickerMessage) {
        mediaType = 'sticker';
        mediaMsg = quoted.stickerMessage;
      }
      
      if (!mediaMsg) {
        return extra.reply('❌ Reply to video/audio/image to play it');
      }
      
      await extra.reply('⬇️ Downloading...');
      
      // Build proper message object for download
      const msgObj = {
        key: {
          remoteJid: from,
          id: ctx.stanzaId,
          participant: ctx.participant,
        },
        message: {
          [mediaType + 'Message']: mediaMsg
        }
      };
      
      // Download media
      const buffer = await downloadMediaMessage(msgObj, 'buffer', {}, { 
        logger: undefined,
        reuploadRequest: sock.updateMediaMessage
      });
      
      if (!buffer || buffer.length < 100) {
        return extra.reply('❌ Failed to download media');
      }
      
      const caption = mediaMsg.caption || '';
      
      // Send back based on type
      if (mediaType === 'audio') {
        await sock.sendMessage(from, {
          audio: buffer,
          mimetype: 'audio/mpeg',
          ptt: false
        }, { quoted: msg });
      } else if (mediaType === 'video') {
        await sock.sendMessage(from, {
          video: buffer,
          mimetype: 'video/mp4',
          caption: caption || '▶️ Playback'
        }, { quoted: msg });
      } else if (mediaType === 'image') {
        await sock.sendMessage(from, {
          image: buffer,
          caption: caption || '🖼️ Image'
        }, { quoted: msg });
      }
      
    } catch (error) {
      console.error('Play error:', error.message);
      extra.reply('❌ Error: ' + error.message);
    }
  }
};
