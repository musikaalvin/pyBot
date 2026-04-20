/**
 * Twitter/X Downloader
 */

const axios = require('axios');
const APIs = require('../../utils/api');
const config = require('/root/pyBot/config');

const processedMessages = new Set();

module.exports = {
  name: 'twitter',
  aliases: ['x', 'tw', 'twdl', 'xdl', 'twitterdl'],
  category: 'media',
  description: 'Download Twitter/X videos & images',
  usage: '.twitter <Twitter/X URL>',
  
  async execute(sock, msg, args) {
    try {
      if (processedMessages.has(msg.key.id)) return;
      processedMessages.add(msg.key.id);
      setTimeout(() => processedMessages.delete(msg.key.id), 5 * 60 * 1000);

      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || args.join(' ');
      const url = text.split(' ').slice(1).join(' ').trim();

      if (!url) return extra.reply('❌ Provide a Twitter/X link!');

      const twitterPattern = /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/\d+/;
      if (!twitterPattern.test(url)) return extra.reply('❌ Invalid Twitter/X link!');

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '⬇️', key: msg.key } });

      try {
        const response = await axios.get(`https://api.siputzx.my.id/api/d/twitter?url=${encodeURIComponent(url)}`);
        const data = response.data;

        if (data.status && data.data) {
          const media = data.data;
          
          if (media.video) {
            await sock.sendMessage(msg.key.remoteJid, {
              video: { url: media.video },
              caption: `*DOWNLOADED BY ${config.botName.toUpperCase()}*\n\n📝 ${media.text || ''}`
            }, { quoted: msg });
          } else if (media.image) {
            const images = Array.isArray(media.image) ? media.image : [media.image];
            await sock.sendMessage(msg.key.remoteJid, {
              image: { url: images[0] },
              caption: `*DOWNLOADED BY ${config.botName.toUpperCase()}*\n\n📝 ${media.text || ''}`
            }, { quoted: msg });
          } else {
            await extra.reply('❌ No media found!');
          }
        } else {
          await extra.reply('❌ Failed to download!');
        }
      } catch (err) {
        await extra.reply('❌ Error downloading Twitter media!');
      }
    } catch (error) {
      console.error('Twitter error:', error);
      await extra.reply('❌ An error occurred!');
    }
  }
};