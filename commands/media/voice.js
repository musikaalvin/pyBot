const path = require('path');
/**
 * Voice Changer Command
 */

const axios = require('axios');
const config = require(path.join(__dirname, '../../config'));

const processedMessages = new Set();

module.exports = {
  name: 'voice',
  aliases: ['vc', 'voicemod'],
  category: 'media',
  description: 'Change voice in audio/video',
  usage: '.voice <effect> (reply to audio/video)\n\nEffects: robot, chipmunk, demon, echo, reverb, bassboost, nightcore, vaporwave',
  
  async execute(sock, msg, args, extra) {
    try {
      if (processedMessages.has(msg.key.id)) return;
      processedMessages.add(msg.key.id);
      setTimeout(() => processedMessages.delete(msg.key.id), 5 * 60 * 1000);

      if (args.length === 0) {
        return extra.reply('❌ Usage: .voice <effect> (reply to audio/video)\n\nEffects: robot, chipmunk, demon, echo, reverb, bassboost, nightcore, vaporwave');
      }

      const effect = args[0].toLowerCase();
      const validEffects = ['robot', 'chipmunk', 'demon', 'echo', 'reverb', 'bassboost', 'nightcore', 'vaporwave'];
      
      if (!validEffects.includes(effect)) {
        return extra.reply(`❌ Invalid effect! Choose from: ${validEffects.join(', ')}`);
      }

      let mediaUrl = null;
      let mediaType = null;

      // Check for audio
      if (msg.message.audioMessage) {
        mediaUrl = msg.message.audioMessage.url;
        mediaType = 'audio';
      } 
      // Check for video
      else if (msg.message.videoMessage) {
        mediaUrl = msg.message.videoMessage.url;
        mediaType = 'video';
      }
      // Check quoted audio/video
      else if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage) {
        mediaUrl = msg.message.extendedTextMessage.contextInfo.quotedMessage.audioMessage.url;
        mediaType = 'audio';
      } else if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage) {
        mediaUrl = msg.message.extendedTextMessage.contextInfo.quotedMessage.videoMessage.url;
        mediaType = 'video';
      }

      if (!mediaUrl) return extra.reply('❌ Reply to an audio or video message!');

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '🔊', key: msg.key } });
      await extra.reply(`⏳ Applying ${effect} voice effect...`);

      try {
        const response = await axios.get(`https://api.siputzx.my.id/api/media/voicechanger`, {
          params: { 
            url: mediaUrl,
            effect: effect,
            type: mediaType
          }
        });

        const data = response.data;
        if (data.status && data.data) {
          const result = data.data;
          
          if (mediaType === 'audio') {
            await sock.sendMessage(msg.key.remoteJid, {
              audio: { url: result },
              mimetype: 'audio/mpeg',
              caption: `*Voice changed to ${effect} by ${config.botName.toUpperCase()}*`
            }, { quoted: msg });
          } else {
            await sock.sendMessage(msg.key.remoteJid, {
              video: { url: result },
              caption: `*Voice changed to ${effect} by ${config.botName.toUpperCase()}*`
            }, { quoted: msg });
          }
        } else {
          await extra.reply(`❌ Failed to apply ${effect} effect!`);
        }
      } catch (err) {
        await extra.reply(`❌ Error applying ${effect} effect!`);
      }
    } catch (error) {
      console.error('Voice error:', error);
      await extra.reply('❌ An error occurred!');
    }
  }
};