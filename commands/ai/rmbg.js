/**
 * Remove Image Background
 */

const axios = require('axios');
const config = require('/root/pyBot/config');

const processedMessages = new Set();

module.exports = {
  name: 'rmbg',
  aliases: ['removebg', 'cutout'],
  category: 'ai',
  description: 'Remove image background',
  usage: '.rmbg (reply to image)',
  
  async execute(sock, msg, args, extra) {
    try {
      if (processedMessages.has(msg.key.id)) return;
      processedMessages.add(msg.key.id);
      setTimeout(() => processedMessages.delete(msg.key.id), 5 * 60 * 1000);

      let imageUrl = null;

      if (msg.message.imageMessage) {
        imageUrl = msg.message.imageMessage.url;
      } else if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
        imageUrl = msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage.url;
      } else if (args[0]?.startsWith('http')) {
        imageUrl = args[0];
      }

      if (!imageUrl) return extra.reply('❌ Reply to an image or provide an image URL!');

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '✂️', key: msg.key } });
      await extra.reply('⏳ Removing background...');

      try {
        const response = await axios.get(`https://api.siputzx.my.id/api/ai/removebg`, {
          params: { url: imageUrl }
        });

        const data = response.data;
        if (data.status && data.data) {
          await sock.sendMessage(msg.key.remoteJid, {
            image: { url: data.data },
            caption: `*Background removed by ${config.botName.toUpperCase()}*`
          }, { quoted: msg });
        } else {
          await extra.reply('❌ Failed to remove background!');
        }
      } catch (err) {
        await extra.reply('❌ Error removing background!');
      }
    } catch (error) {
      console.error('RemoveBG error:', error);
      await extra.reply('❌ An error occurred!');
    }
  }
};