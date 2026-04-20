/**
 * Search Command - Search the web for information
 */

const axios = require('axios');

module.exports = {
  name: 'search',
  aliases: ['google', 'find', 'look'],
  category: 'utility',
  description: 'Search the web for information',
  usage: '.search <query>',
  
  async execute(sock, msg, args, extra) {
    try {
      const query = args.join(' ');
      
      if (!query) {
        return extra.reply('🔍 *Usage:* .search <query>\n\nExample: .search WhatsApp API');
      }
      
      await extra.reply('🔍 Searching...');
      
      // Using DuckDuckGo instant answer API (free, no key needed)
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      
      const response = await axios.get(url, { timeout: 15000 });
      const data = response.data;
      
      let result = '';
      
      // Try to get abstract/answer
      if (data.Abstract && data.Abstract.length > 50) {
        result = data.Abstract;
      } else if (data.Definition && data.Definition.length > 50) {
        result = data.Definition;
      } else if (data.Answer && data.Answer.length > 20) {
        result = data.Answer;
      } else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        // Get first related topic
        const first = data.RelatedTopics.find(t => t.Text && t.Text.length > 50);
        if (first) {
          result = first.Text;
        } else {
          result = data.RelatedTopics[0]?.Text || 'No detailed results found.';
        }
      } else {
        result = 'No specific answer found. Try a different search term.';
      }
      
      // Clean up result
      result = result.replace(/\\/g, '').replace(/\n/g, ' ');
      
      // Limit length
      if (result.length > 800) {
        result = result.substring(0, 800) + '...';
      }
      
      const reply = `🔍 *Search Results for:* ${query}\n\n${result}\n\n💡 Tip: Use .search <more specific> for better results`;
      
      await extra.reply(reply);
      
    } catch (error) {
      console.error('Search error:', error.message);
      extra.reply('❌ Search failed. Try again later or check your connection.');
    }
  }
};