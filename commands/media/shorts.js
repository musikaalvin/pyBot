const path = require('path');
/**
 * YouTube Shorts Downloader
 */

const axios = require('axios');
const config = require(path.join(__dirname, '../../config'));

const processedMessages = new Set();

module.exports = {
  name: 'shorts',
  aliases: ['yt shorts', 'ys'],
  category: 'media',
  description: 'Download YouTube Shorts',
  usage: '.shorts <YouTube Shorts URL>',
  
  async execute(sock, msg, args, extra) {
    try {
      if (processedMessages.has(msg.key.id)) return;
      processedMessages.add(msg.key.id);
      setTimeout(() => processedMessages.delete(msg.key.id), 5 * 60 * 1000);

      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || args.join(' ');
      const url = text.split(' ').slice(1).join(' ').trim();

      if (!url) return extra.reply('❌ Provide a YouTube Shorts link!');

      const shortsPattern = /https?:\/\/(?:www\.)?youtube\.com\/shorts\/\w+/;
      if (!shortsPattern.test(url)) return extra.reply('❌ Invalid YouTube Shorts link!');

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '⬇️', key: msg.key } });
      await extra.reply('⏳ Downloading YouTube Shorts...');

      try {
        const response = await axios.get(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`);
        const data = response.data;

        if (data.status && data.data) {
          const video = data.data;
          
          await sock.sendMessage(msg.key.remoteJid, {
            video: { url: video.download },
            caption: `*DOWNLOADED BY ${config.botName.toUpperCase()}*\n\n📝 ${video.title || 'YouTube Shorts'}`
          }, { quoted: msg });
        } else {
          await extra.reply('❌ Failed to download YouTube Shorts!');
        }
      } catch (err) {
        await extra.reply('❌ Error downloading YouTube Shorts!');
      }
    } catch (error) {
      console.error('Shorts error:', error);
      await extra.reply('❌ An error occurred!');
    }
  }
};