/**
 * Spotify Downloader
 */

const axios = require('axios');
const config = require('/root/pyBot/config');

const processedMessages = new Set();

module.exports = {
  name: 'spotify',
  aliases: ['spotdl', 'spdl'],
  category: 'media',
  description: 'Download Spotify tracks',
  usage: '.spotify <Spotify URL>',
  
  async execute(sock, msg, args, extra) {
    try {
      if (processedMessages.has(msg.key.id)) return;
      processedMessages.add(msg.key.id);
      setTimeout(() => processedMessages.delete(msg.key.id), 5 * 60 * 1000);

      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || args.join(' ');
      const url = text.split(' ').slice(1).join(' ').trim();

      if (!url) return extra.reply('❌ Provide a Spotify track link!');

      const spotifyPattern = /https?:\/\/open\.spotify\.com\/track\/\w+/;
      if (!spotifyPattern.test(url)) return extra.reply('❌ Invalid Spotify track link!');

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '🎵', key: msg.key } });
      await extra.reply('⏳ Downloading Spotify track...');

      try {
        const response = await axios.get(`https://api.siputzx.my.id/api/d/spotify?url=${encodeURIComponent(url)}`);
        const data = response.data;

        if (data.status && data.data) {
          const track = data.data;
          
          await sock.sendMessage(msg.key.remoteJid, {
            audio: { url: track.download },
            mimetype: 'audio/mpeg',
            caption: `*DOWNLOADED BY ${config.botName.toUpperCase()}*\n\n🎵 ${track.title}\n👤 ${track.artist}`
          }, { quoted: msg });
        } else {
          await extra.reply('❌ Failed to download Spotify track!');
        }
      } catch (err) {
        await extra.reply('❌ Error downloading Spotify track!');
      }
    } catch (error) {
      console.error('Spotify error:', error);
      await extra.reply('❌ An error occurred!');
    }
  }
};