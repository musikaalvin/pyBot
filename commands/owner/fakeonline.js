/**
 * Fake Online / Last Seen Command
 * Control fake online status and custom last seen
 */

const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'fakeonline',
    aliases: ['fakeon', 'appearonline', 'lastseen', 'seen'],
    description: 'Toggle custom fake last seen / online status',
    category: 'owner',
    isGroupOnly: false,
    isAdminOnly: false,
    isOwnerOnly: true,
    usage: '.fakeonline <on/off/status/set/custom text>',
    
    execute: async (sock, msg, args, extra) => {
        try {
            const configPath = path.join(__dirname, '../../config.js');
            let configContent = fs.readFileSync(configPath, 'utf8');
            
            const subCmd = args[0]?.toLowerCase() || 'status';
            const config = require(path.join(__dirname, '../../config'));
            
            if (subCmd === 'status' || !args[0]) {
                const isEnabled = config.fakeOnline || false;
                const customSeen = config.fakeLastSeen || 'null';
                const customStatus = config.fakeStatus || 'null';
                
                let status = `🎭 *Fake Online Status*\n\n`;
                status += `Fake Online: ${isEnabled ? '✅ ON' : '❌ OFF'}\n`;
                status += `Custom Last Seen: ${customSeen === 'null' ? 'Default' : customSeen}\n`;
                status += `Custom Status: ${customStatus === 'null' ? 'Default' : customStatus}\n\n`;
                status += `*Usage:*\n`;
                status += `• .fakeonline on/off - Toggle fake online\n`;
                status += `• .fakeonline set <text> - Set custom last seen (e.g., "2 minutes ago")\n`;
                status += `• .fakeonline status <text> - Set custom status message\n`;
                status += `• .fakeonline clear - Reset to default\n`;
                status += `• .fakeonline status - Show this status`;
                
                return extra.reply(status);
            }
            
            if (subCmd === 'on') {
                configContent = configContent.replace(
                    /fakeOnline:\s*(true|false)/,
                    'fakeOnline: true'
                );
                fs.writeFileSync(configPath, configContent);
                delete require.cache[require.resolve(path.join(__dirname, '../../config'))];
                global.fakeOnline = true;
                return extra.reply(`✅ Fake Online enabled!\n\nBot will appear online to others.`);
            }
            
            if (subCmd === 'off') {
                configContent = configContent.replace(
                    /fakeOnline:\s*(true|false)/,
                    'fakeOnline: false'
                );
                fs.writeFileSync(configPath, configContent);
                delete require.cache[require.resolve(path.join(__dirname, '../../config'))];
                global.fakeOnline = false;
                return extra.reply(`❌ Fake Online disabled.`);
            }
            
            if (subCmd === 'set') {
                const customText = args.slice(1).join(' ').trim();
                if (!customText) {
                    return extra.reply(`❌ Usage: .fakeonline set <text>\n\nExample: .fakeonline set 2 minutes ago`);
                }
                
                configContent = configContent.replace(
                    /fakeLastSeen:\s*'[^']*'|fakeLastSeen:\s*null/,
                    `fakeLastSeen: '${customText}'`
                );
                fs.writeFileSync(configPath, configContent);
                delete require.cache[require.resolve(path.join(__dirname, '../../config'))];
                
                return extra.reply(`✅ Custom last seen set!\n\nNow showing: "last seen ${customText}"`);
            }
            
            if (subCmd === 'status' && args[1]) {
                const customText = args.slice(1).join(' ').trim();
                if (!customText) {
                    return extra.reply(`❌ Usage: .fakeonline status <text>`);
                }
                
                configContent = configContent.replace(
                    /fakeStatus:\s*'[^']*'|fakeStatus:\s*null/,
                    `fakeStatus: '${customText}'`
                );
                fs.writeFileSync(configPath, configContent);
                delete require.cache[require.resolve(path.join(__dirname, '../../config'))];
                
                return extra.reply(`✅ Custom status set!\n\nStatus: ${customText}`);
            }
            
            if (subCmd === 'clear') {
                configContent = configContent.replace(
                    /fakeLastSeen:\s*'[^']*'/,
                    `fakeLastSeen: null`
                );
                configContent = configContent.replace(
                    /fakeStatus:\s*'[^']*'/,
                    `fakeStatus: null`
                );
                fs.writeFileSync(configPath, configContent);
                delete require.cache[require.resolve(path.join(__dirname, '../../config'))];
                
                return extra.reply(`✅ Fake online settings cleared!`);
            }
            
            // Default help
            extra.reply(`❓ Invalid option.\n\n*Usage:*\n• .fakeonline on/off - Toggle\n• .fakeonline set <text> - Set last seen\n• .fakeonline status <text> - Set status\n• .fakeonline clear - Reset\n• .fakeonline status - View status`);
            
        } catch (error) {
            console.error('Error in fakeonline command:', error);
            extra.reply('❌ Error: ' + error.message);
        }
    }
}