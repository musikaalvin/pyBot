/**
 * ToSticker Command - Convert image/video to sticker
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const webp = require('node-webpmux');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const config = require(path.join(__dirname, '../../config'));
const { getTempDir, deleteTempFile } = require('../../utils/tempManager');

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const FFMPEG = '/usr/bin/ffmpeg';

module.exports = {
  name: 'tosticker',
  aliases: ['tostick', 'img2sticker'],
  description: 'Convert image/video to sticker',
  usage: '.tosticker (reply to image/video)',
  category: 'general',
  
  async execute(sock, msg, args, extra) {
    const chatId = extra.from;
    let targetMessage = msg;
    let mediaMessage = msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage;
    
    // Check for quoted image/video
    const ctxInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (!mediaMessage && ctxInfo?.quotedMessage) {
      targetMessage = {
        key: {
          remoteJid: chatId,
          id: ctxInfo.stanzaId,
          participant: ctxInfo.participant,
        },
        message: ctxInfo.quotedMessage,
      };
      mediaMessage = targetMessage.message?.imageMessage || targetMessage.message?.videoMessage || targetMessage.message?.documentMessage;
    }
    
    if (!mediaMessage) {
      return extra.reply('❌ Reply to an *image* / *video* with .tosticker');
    }
    
    const tempDir = getTempDir();
    const timestamp = Date.now();
    const tempInput = path.join(tempDir, `in_${timestamp}`);
    const tempOutput = path.join(tempDir, `out_${timestamp}.webp`);
    let tempFiles = [tempInput, tempOutput];
    
    try {
      const mediaBuffer = await downloadMediaMessage(
        targetMessage,
        'buffer',
        {},
        { logger: undefined, reuploadRequest: sock.updateMediaMessage },
      );
      
      if (!mediaBuffer) {
        await extra.reply('❌ Failed to download media.');
        return;
      }
      
      if (mediaBuffer.length > MAX_FILE_SIZE) {
        await extra.reply(`❌ File too large: ${(mediaBuffer.length / 1024 / 1024).toFixed(2)}MB (max: ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
        return;
      }
      
      fs.writeFileSync(tempInput, mediaBuffer);
      
      const isAnimated =
        mediaMessage.mimetype?.includes('gif') ||
        mediaMessage.mimetype?.includes('video') ||
        (mediaMessage.seconds || 0) > 0;
      
      const cmd = isAnimated
        ? `${FFMPEG} -i "${tempInput}" -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`
        : `${FFMPEG} -i "${tempInput}" -vf "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`;
      
      const execPromise = (cmd) =>
        new Promise((resolve, reject) => exec(cmd, (err) => (err ? reject(err) : resolve())));
      
      await execPromise(cmd);
      
      let webpBuffer = fs.readFileSync(tempOutput);
      
      // Add EXIF metadata
      const img = new webp.Image();
      await img.load(webpBuffer);
      
      const json = {
        'sticker-pack-id': crypto.randomBytes(32).toString('hex'),
        'sticker-pack-name': config.packname || 'Made by',
        emojis: ['🤖'],
      };
      
      const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
      ]);
      
      const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
      const exif = Buffer.concat([exifAttr, jsonBuffer]);
      exif.writeUIntLE(jsonBuffer.length, 14, 4);
      
      img.exif = exif;
      const finalBuffer = await img.save(null);
      
      await sock.sendMessage(extra.from, { sticker: finalBuffer }, { quoted: msg });
      
    } catch (error) {
      console.error('ToSticker error:', error.message);
      await extra.reply('❌ Error: ' + error.message);
    } finally {
      tempFiles.forEach(file => deleteTempFile(file));
    }
  }
};