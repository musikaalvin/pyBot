/**
 * Weather Command
 */

const APIs = require('../../utils/api');
const config = require('/root/pyBot/config');

module.exports = {
  name: 'weather',
  aliases: ['wea', 'forecast'],
  category: 'utility',
  description: 'Get weather info for a city',
  usage: '.weather <city>',
  
  async execute(sock, msg, args, extra) {
    try {
      if (args.length === 0) {
        return extra.reply('❌ Usage: .weather <city>\n\nExample: .weather Kampala');
      }

      const city = args.join(' ');
      const weather = await APIs.getWeather(city);
      
      if (weather.status) {
        const w = weather.data;
        await sock.sendMessage(msg.key.remoteJid, { react: { text: '🌤️', key: msg.key } });
        await extra.reply(`*🌍 Weather: ${city}*\n\n` +
          `📍 Location: ${w.location}\n` +
          `🌡️ Temperature: ${w.temperature}\n` +
          `💧 Humidity: ${w.humidity}\n` +
          `🌬️ Wind: ${w.wind_speed}\n` +
          `☁️ Condition: ${w.weather}\n\n` +
          `_Powered by ${config.botName}_`);
      } else {
        await extra.reply('❌ City not found!');
      }
    } catch (error) {
      console.error('Weather error:', error.message);
      await extra.reply('❌ Failed to get weather! ' + error.message);
    }
  }
};