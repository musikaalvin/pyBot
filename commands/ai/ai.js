/**
 * AI Chat Command - ChatGPT-style responses
 */

const APIs = require('../../utils/api');

module.exports = {
  name: 'ai',
  aliases: ['gpt', 'chatgpt', 'ask'],
  category: 'ai',
  description: 'Chat with AI (ChatGPT-style)',
  usage: '.ai <question>',
  
  async execute(sock, msg, args, extra) {
    try {
      const ctx = msg.message?.extendedTextMessage?.contextInfo;
      let question = '';
      
      // Check if user replied to a message
      if (ctx?.quotedMessage) {
        const quoted = ctx.quotedMessage;
        question = quoted.conversation || quoted.extendedTextMessage?.text || quoted.imageMessage?.caption || '';
        
        if (args.length > 0) {
          question += ' ' + args.join(' ');
        }
      } else {
        question = args.join(' ');
      }
      
      // Repetition: ONLY triggers on explicit patterns
      const hasRepeatIntent = args[0] && /^(print|say|repeat|write|type)$/i.test(args[0]);
      const hasCount = args.length >= 2 && !isNaN(parseInt(args[args.length - 1].replace(/times?$/i, '').replace(/x$/i, '')));
      
      if (hasRepeatIntent && hasCount) {
        const lastArg = args[args.length - 1].replace(/times?$/i, '').replace(/x$/i, '');
        const count = parseInt(lastArg);
        const word = args.length >= 2 ? args[1] : args[0];
        if (count >= 2 && count <= 100 && word) {
          const result = (word + ' ').repeat(count).trim();
          await extra.reply(result);
          return;
        }
      }
      
      if (!question.trim()) {
        return extra.reply('❌ Usage: .ai <question> or reply to a message with .ai\n\nExample: .ai What is the capital of France?');
      }
      
      const response = await APIs.chatAI(question);
      
      // Send only the answer without labels
      const answer = response.response || response.msg || response.data?.msg || response;
      await extra.reply(answer);
      
    } catch (error) {
      await extra.reply(`❌ AI Error: ${error.message}`);
    }
  }
};
