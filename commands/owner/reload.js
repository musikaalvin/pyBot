/**
 * Reload Command - Hot reload modules
 */

module.exports = {
  name: 'reload',
  aliases: ['r'],
  category: 'owner',
  description: 'Reload bot modules',
  usage: '.reload [api|handler|all]',
  ownerOnly: true,
  
  async execute(sock, msg, args, extra) {
    try {
      const target = args[0]?.toLowerCase() || 'all';
      const base = __dirname + '/..';
      
      if (target === 'handler' || target === 'all') {
        try { delete require.cache[require.resolve(base + '/handler')]; } catch {}
        extra.reply('✅ Reloaded handler');
      }
      
      if (target === 'api' || target === 'all') {
        try { delete require.cache[require.resolve(base + '/utils/api')]; } catch {}
        extra.reply('✅ Reloaded API');
      }
      
      if (target === 'db' || target === 'all') {
        try { delete require.cache[require.resolve(base + '/database')]; } catch {}
        extra.reply('✅ Reloaded DB');
      }
      
      extra.reply('🔄 Done!');
    } catch (e) {
      extra.reply('❌ ' + e.message);
    }
  }
};