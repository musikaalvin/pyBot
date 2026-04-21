const path = require('path');
/**
 * AI Image Upscale/Enhance
 */

const axios = require('axios');
const config = require(path.join(__dirname, '../../config'));

const processedMessages = new Set();

module.exports = {
  name: 'upscale',
  aliases: ['enhance', 'hd', 'remini'],
  category: 'ai',
  description: 'Upscale/enhance image quality',
  usage: '.upscale (reply to image)',
  
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

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '🖼️', key: msg.key } });
      await extra.reply('⏳ Enhancing image...');

      try {
        const response = await axios.get(`https://api.siputzx.my.id/api/ai/remini`, {
          params: { url: imageUrl }
        });

        const data = response.data;
        if (data.status && data.data) {
          await sock.sendMessage(msg.key.remoteJid, {
            image: { url: data.data },
            caption: `*Enhanced by ${config.botName.toUpperCase()}*`
          }, { quoted: msg });
        } else {
          await extra.reply('❌ Failed to enhance image!');
        }
      } catch (err) {
        await extra.reply('❌ Error enhancing image!');
      }
    } catch (error) {
      console.error('Upscale error:', error);
      await extra.reply('❌ An error occurred!');
    }
  }
};