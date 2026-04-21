const path = require('path');
/**
 * Audio Editor Command
 */

const axios = require('axios');
const config = require(path.join(__dirname, '../../config'));

const processedMessages = new Set();

module.exports = {
  name: 'audio',
  aliases: ['audedit', 'aedit'],
  category: 'media',
  description: 'Edit audio (bass boost, nightcore, vaporware, 8D, etc.)',
  usage: '.audio <effect> (reply to audio)\n\nEffects: bassboost, nightcore, vaporware, 8d, lofi, flanger, reverse, slow, fast',
  
  async execute(sock, msg, args, extra) {
    try {
      if (processedMessages.has(msg.key.id)) return;
      processedMessages.add(msg.key.id);
      setTimeout(() => processedMessages.delete(msg.key.id), 5 * 60 * 1000);

      if (args.length === 0) {
        return extra.reply('❌ Usage: .audio <effect> (reply to audio)\n\nEffects: bassboost, nightcore, vaporware, 8d, lofi, flanger, reverse, slow, fast');
      }

      const effect = args[0].toLowerCase();
      const validEffects = ['bassboost', 'nightcore', 'vaporware', '8d', 'lofi', 'flanger', 'reverse', 'slow', 'fast'];
      
      if (!validEffects.includes(effect)) {
        return extra.reply(`❌ Invalid effect! Choose from: ${validEffects.join(', ')}`);
      }

      let audioUrl = null;

      // Check for audio
      if (msg.message.audioMessage) {
        audioUrl = msg.message.audioMessage.url;
      } 
      // Check quoted audio
      else if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage) {
        audioUrl = msg.message.extendedTextMessage.contextInfo.quotedMessage.audioMessage.url;
      }

      if (!audioUrl) return extra.reply('❌ Reply to an audio message!');

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '🎧', key: msg.key } });
      await extra.reply(`⏳ Applying ${effect} audio effect...`);

      try {
        const response = await axios.get(`https://api.siputzx.my.idapi/media/audioeditor`, {
          params: { 
            url: audioUrl,
            effect: effect
          }
        });

        const data = response.data;
        if (data.status && data.data) {
          await sock.sendMessage(msg.key.remoteJid, {
            audio: { url: data.data },
            mimetype: 'audio/mpeg',
            caption: `*Audio edited with ${effect} by ${config.botName.toUpperCase()}*`
          }, { quoted: msg });
        } else {
          await extra.reply(`❌ Failed to apply ${effect} effect!`);
        }
      } catch (err) {
        await extra.reply(`❌ Error applying ${effect} effect!`);
      }
    } catch (error) {
      console.error('Audio error:', error);
      await extra.reply('❌ An error occurred!');
    }
  }
};