/**
 * ToImage Command - Convert sticker to image using sharp
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { getTempDir, deleteTempFile } = require('../../utils/tempManager');

module.exports = {
  name: 'toimage',
  aliases: ['toimg', 'unsticker', 'unwebp'],
  description: 'Convert sticker to image',
  usage: '.toimage (reply to sticker)',
  category: 'general',
  
  async execute(sock, msg, args, extra) {
    const chatId = extra.from;
    let targetMessage = msg;
    let stickerMessage = msg.message?.stickerMessage;
    
    const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (!stickerMessage && ctxInfo?.quotedMessage) {
      targetMessage = {
        key: { remoteJid: chatId, id: ctxInfo.stanzaId, participant: ctxInfo.participant },
        message: ctxInfo.quotedMessage,
      };
      stickerMessage = targetMessage.message?.stickerMessage;
    }
    
    if (!stickerMessage) {
      return extra.reply('❌ Reply to a *sticker* with .toimage');
    }
    
    const tempDir = getTempDir();
    const timestamp = Date.now();
    const tempInput = path.join(tempDir, `sticker_${timestamp}.webp`);
    const tempOutput = path.join(tempDir, `img_${timestamp}.png`);
    let tempFiles = [tempInput, tempOutput];
    
    try {
      const mediaBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, { logger: undefined, reuploadRequest: sock.updateMediaMessage });
      
      if (!mediaBuffer) {
        await extra.reply('❌ Failed to download sticker.');
        return;
      }
      
      // Try sharp to convert webp to png
      try {
        await sharp(mediaBuffer)
          .png()
          .toFile(tempOutput);
        
        if (fs.existsSync(tempOutput) && fs.statSync(tempOutput).size > 100) {
          const imgBuffer = fs.readFileSync(tempOutput);
          await sock.sendMessage(extra.from, { image: imgBuffer }, { quoted: msg });
          return;
        }
      } catch (e) {
        console.log('sharp failed:', e.message);
      }
      
      // Fallback: try treating webp body as raw image
      try {
        // Get webp metadata to find the image data
        const meta = await sharp(mediaBuffer).metadata();
        if (meta.width && meta.height) {
          await sharp(mediaBuffer)
            .resize(512, 512, { fit: 'inside' })
            .png()
            .toFile(tempOutput);
          
          if (fs.existsSync(tempOutput)) {
            const imgBuffer = fs.readFileSync(tempOutput);
            await sock.sendMessage(extra.from, { image: imgBuffer }, { quoted: msg });
            return;
          }
        }
      } catch (e2) {
        console.log('sharp fallback:', e2.message);
      }
      
      await extra.reply('❌ Cannot convert animated stickers. Try a static sticker.');
      
    } catch (error) {
      console.error('ToImage error:', error.message);
      await extra.reply('❌ Error: ' + error.message.slice(0, 100));
    } finally {
      tempFiles.forEach(file => deleteTempFile(file));
    }
  }
};