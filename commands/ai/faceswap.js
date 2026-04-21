const path = require('path');
/**
 * Face Swap
 */

const axios = require('axios');
const config = require(path.join(__dirname, '../../config'));

const processedMessages = new Set();

module.exports = {
  name: 'faceswap',
  aliases: ['swap', 'faceswap'],
  category: 'ai',
  description: 'Swap faces in images',
  usage: '.faceswap (reply to 2 images)',
  
  async execute(sock, msg, args, extra) {
    try {
      if (processedMessages.has(msg.key.id)) return;
      processedMessages.add(msg.key.id);
      setTimeout(() => processedMessages.delete(msg.key.id), 5 * 60 * 1000);

      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      let imageUrls = [];

      if (msg.message.imageMessage) {
        imageUrls.push(msg.message.imageMessage.url);
      }

      if (contextInfo?.quotedMessage?.imageMessage) {
        imageUrls.push(contextInfo.quotedMessage.imageMessage.url);
      }

      if (imageUrls.length < 2) {
        return extra.reply('❌ Reply to 2 images to swap faces!\n\nUsage: .faceswap (reply to image1, then reply to image2)');
      }

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '👤', key: msg.key } });
      await extra.reply('⏳ Swapping faces...');

      try {
        const response = await axios.get(`https://api.siputzx.my.id/api/ai/faceswap`, {
          params: { 
            url1: imageUrls[0],
            url2: imageUrls[1]
          }
        });

        const data = response.data;
        if (data.status && data.data) {
          await sock.sendMessage(msg.key.remoteJid, {
            image: { url: data.data },
            caption: `*Face swapped by ${config.botName.toUpperCase()}*`
          }, { quoted: msg });
        } else {
          await extra.reply('❌ Failed to swap faces!');
        }
      } catch (err) {
        await extra.reply('❌ Error swapping faces!');
      }
    } catch (error) {
      console.error('FaceSwap error:', error);
      await extra.reply('❌ An error occurred!');
    }
  }
};