/**
 * Simi Simi Chatbot
 */

const axios = require('axios');
const config = require('/root/pyBot/config');

// Store active chat sessions (groupId/userId -> last activity time)
const chatSessions = new Map();
const SESSION_TIMEOUT = 10 * 60 * 1000; // 10 minutes

module.exports = {
  name: 'simi',
  aliases: ['chatbot', 'cleverbot'],
  category: 'ai',
  description: 'Chat with Simi Simi AI',
  usage: '.simi <message>\n\nOr enable auto-reply mode: .simi on | off',
  
  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .simi <message>\n\nExample: .simi Hello how are you?\n\nTo toggle auto-reply: .simi on | off');
      }

      // Handle on/off commands for auto-reply mode
      if (args[0] === 'on' || args[0] === 'off') {
        const mode = args[0];
        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        const chatId = isGroup ? msg.key.remoteJid : msg.key.participant || msg.key.remoteJid;
        
        if (mode === 'on') {
          chatSessions.set(chatId, Date.now());
          await extra.reply(`✅ Simi Simi chatbot enabled for ${isGroup ? 'this group' : 'this chat'}\n\nThe bot will now automatically reply to messages!`);
        } else {
          chatSessions.delete(chatId);
          await extra.reply(`❌ Simi Simi chatbot disabled for ${isGroup ? 'this group' : 'this chat'}`);
        }
        return;
      }

      const isGroup = msg.key.remoteJid.endsWith('@g.us');
      const chatId = isGroup ? msg.key.remoteJid : msg.key.participant || msg.key.remoteJid;
      const senderId = msg.key.participant || msg.key.remoteJid;
      
      // Update session timestamp
      chatSessions.set(chatId, Date.now());
      
      // Clean expired sessions periodically
      if (Math.random() < 0.1) { // 10% chance to clean
        const now = Date.now();
        for (const [id, timestamp] of chatSessions.entries()) {
          if (now - timestamp > SESSION_TIMEOUT) {
            chatSessions.delete(id);
          }
        }
      }
      
      const message = args.join(' ');
      if (!message.trim()) {
        return extra.reply('❌ Please provide a message to chat with Simi Simi!');
      }

      await sock.sendMessage(msg.key.remoteJid, { react: { text: '💬', key: msg.key } });
      await extra.reply('⏳ Simi Simi is thinking...');

      try {
        const response = await axios.get(`https://api.siputzx.my.id/api/ai/simi`, {
          params: { 
            message: message,
            user_id: senderId.split('@')[0]
          }
        });

        const data = response.data;
        if (data.status && data.data && data.data.message) {
          await extra.reply(data.data.message);
        } else {
          await extra.reply('❌ Simi Simi is having trouble responding. Try again later!');
        }
      } catch (err) {
        await extra.reply('❌ Error communicating with Simi Simi!');
      }
    } catch (error) {
      console.error('Simi Simi error:', error);
      await extra.reply('❌ An error occurred!');
    }
  }
};