const path = require('path');
/**
 * Post Status Command - reply to media to post to status
 */

const config = require(path.join(__dirname, '../../config'));
const axios = require('axios');

async function downloadMedia(mediaMsg, mediaType, chatId, ctxInfo, sock) {
  try {
    if (!mediaMsg) return null;
    
    let buffer = null;
    
    // Construct proper message object for downloadMediaMessage
    const msgObj = {
      key: {
        remoteJid: chatId,
        id: ctxInfo?.stanzaId,
        participant: ctxInfo?.participant,
      },
      message: {
        [mediaType + 'Message']: mediaMsg
      }
    };
    
    // Method 1: Use Baileys downloadMediaMessage
    try {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys');
      buffer = await downloadMediaMessage(msgObj, 'buffer', {}, { 
        logger: undefined,
        reuploadRequest: sock.updateMediaMessage
      });
      if (buffer && buffer.length > 100) return buffer;
    } catch (e) {
      console.log('downloadMediaMessage:', e.message);
    }
    
    // Method 2: Try URL download
    if (mediaMsg.url) {
      try {
        const res = await axios.get(mediaMsg.url, { 
          responseType: 'arraybuffer', 
          timeout: 60000,
          headers: { 'User-Agent': 'WhatsApp/2.23.10' }
        });
        buffer = Buffer.from(res.data);
        if (buffer && buffer.length > 100) return buffer;
      } catch (e) {
        console.log('URL download failed:', e.message);
      }
    }
    
    // Method 3: downloadContentFromMessage
    try {
      const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
      const stream = await downloadContentFromMessage(mediaMsg, mediaType);
      let chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      if (chunks.length > 0) {
        buffer = Buffer.concat(chunks);
        if (buffer && buffer.length > 100) return buffer;
      }
    } catch (e) {
      console.log('downloadContentFromMessage:', e.message);
    }
    
    return buffer && buffer.length > 100 ? buffer : null;
  } catch (e) {
    console.log('downloadMedia error:', e.message);
    return null;
  }
}

module.exports = {
  name: 'poststatus',
  aliases: ['post', 'story'],
  category: 'owner',
  description: 'Post media to WhatsApp status',
  usage: '.poststatus - reply to media',
  ownerOnly: true,
  
  async execute(sock, msg, args, extra) {
    try {
      // Get quoted message or direct media
      const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quotedMsg = ctxInfo?.quotedMessage;
      
      let mediaMsg = null;
      let mediaType = '';
      
      // Try quoted message first
      if (quotedMsg) {
        if (quotedMsg.imageMessage) {
          mediaMsg = quotedMsg.imageMessage;
          mediaType = 'image';
        } else if (quotedMsg.videoMessage) {
          mediaMsg = quotedMsg.videoMessage;
          mediaType = 'video';
        } else if (quotedMsg.audioMessage) {
          mediaMsg = quotedMsg.audioMessage;
          mediaType = 'audio';
        } else if (quotedMsg.stickerMessage) {
          mediaMsg = quotedMsg.stickerMessage;
          mediaType = 'sticker';
        }
      }
      
      // Try direct message if no quoted media
      if (!mediaMsg) {
        if (msg.message?.imageMessage) {
          mediaMsg = msg.message.imageMessage;
          mediaType = 'image';
        } else if (msg.message?.videoMessage) {
          mediaMsg = msg.message.videoMessage;
          mediaType = 'video';
        } else if (msg.message?.audioMessage) {
          mediaMsg = msg.message.audioMessage;
          mediaType = 'audio';
        } else if (msg.message?.stickerMessage) {
          mediaMsg = msg.message.stickerMessage;
          mediaType = 'sticker';
        }
      }
      
if (!mediaMsg) {
        return extra.reply('❌ Reply to image/video/audio with .poststatus');
      }
      
      await extra.reply('⏳ Downloading...');
      
      const buffer = await downloadMedia(mediaMsg, mediaType, extra.from, ctxInfo, sock);
      
      if (!buffer || buffer.length < 100) {
        return extra.reply('❌ Could not download. Try forwarding the media instead.');
      }
      
      const caption = mediaMsg.caption || '';
      const statusJid = 'status@broadcast';
      
      // Send to status broadcast
      try {
        await sock.sendMessage(statusJid, { 
          [mediaType]: buffer,
          caption: caption
        }, { statusMention: [caption] });
      } catch (statusErr) {
        console.log('Status send error:', statusErr.message);
        try {
          await sock.sendMessage(statusJid, { 
            [mediaType]: buffer,
            caption: caption
          });
        } catch (e2) {
          return extra.reply('❌ Failed to post: ' + e2.message);
        }
      }
      
      const statusText = mediaType === 'image' ? 'image' : mediaType === 'video' ? 'video' : mediaType === 'audio' ? 'audio' : 'sticker';
      await extra.reply(`✅ Posted ${statusText} to status!`);
    } catch (e) {
      console.error('poststatus error:', e);
      extra.reply('❌ Failed: ' + e.message);
    }
  }
};