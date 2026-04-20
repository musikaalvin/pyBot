/**
 * Meme Search Command - Search and get memes
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { getTempDir, deleteTempFile } = require('../../utils/tempManager');

const BASE = 'https://api.shizo.top/tools/meme-search';

module.exports = {
  name: 'memesearch',
  aliases: ['memes', 'sm', 'smeme', 'gifsearch', 'gif'],
  category: 'fun',
  desc: 'Search and get memes',
  usage: 'memesearch <query>',
  
  execute: async (sock, msg, args, extra) => {
    try {
      const query = args.join(' ').trim();
      
      if (!query) {
        return await extra.reply(
          '🔍 *Meme Search*\n\nUsage: .memesearch <query>\n\nExample: .memesearch hello'
        );
      }
      
      extra.react('⏳');
      
      // Fetch meme from API
      const url = `${BASE}?apikey=shizo&query=${encodeURIComponent(query)}`;
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const mediaBuffer = Buffer.from(response.data);
      
      // Verify buffer is valid
      if (!mediaBuffer || mediaBuffer.length === 0) {
        throw new Error('Empty response from API');
      }
      
      // Check content type from headers
      const contentType = (response.headers['content-type'] || '').toLowerCase();
      
      // Also check magic bytes for better detection
      const magicBytes = mediaBuffer.slice(0, 6).toString('hex');
      const isGif = magicBytes.startsWith('47494638') || contentType.includes('gif');
      const isPng = magicBytes.startsWith('89504e47') || contentType.includes('png');
      const isJpg = magicBytes.startsWith('ffd8ff') || contentType.includes('jpeg') || contentType.includes('jpg');
      const isVideo = contentType.includes('video') || contentType.includes('mp4');
      
      const maxSize = 16 * 1024 * 1024; // 16MB
      
      if (mediaBuffer.length > maxSize) {
        throw new Error(`File too large: ${(mediaBuffer.length / 1024 / 1024).toFixed(2)}MB`);
      }
      
      // Send as image for GIFs, PNGs, JPGs
      if (isGif || isPng || isJpg || contentType.includes('image')) {
        try {
          // Try sending as image first (displays inline)
          await sock.sendMessage(extra.from, {
            image: mediaBuffer,
            caption: `🔍 *${query}*`
          }, { quoted: msg });
          return extra.react('✅');
        } catch (imgErr) {
          // Fallback to document if image fails
          try {
            await sock.sendMessage(extra.from, {
              document: mediaBuffer,
              mimetype: isGif ? 'image/gif' : (isPng ? 'image/png' : 'image/jpeg'),
              fileName: `meme_${query.replace(/\s+/g, '_')}.${isGif ? 'gif' : (isPng ? 'png' : 'jpg')}`
            }, { quoted: msg });
            return extra.react('✅');
          } catch (docErr) {
            throw new Error(`Failed to send: ${docErr.message}`);
          }
        }
      }
      
      // Send as video for videos
      if (isVideo || contentType.includes('video')) {
        try {
          await sock.sendMessage(extra.from, {
            video: mediaBuffer,
            mimetype: 'video/mp4',
            caption: `🔍 *${query}*`
          }, { quoted: msg });
          return extra.react('✅');
        } catch (vidErr) {
          throw new Error(`Failed to send video: ${vidErr.message}`);
        }
      }
      
      // Default: try as document
      await sock.sendMessage(extra.from, {
        document: mediaBuffer,
        mimetype: contentType || 'application/octet-stream',
        fileName: `meme_${query.replace(/\s+/g, '_')}.gif`
      }, { quoted: msg });
      extra.react('✅');
      
    } catch (error) {
      extra.react('❌');
      await extra.reply(`❌ Error: ${error.message}`);
    }
  }
};