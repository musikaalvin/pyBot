/**
 * Spy Mode Command
 * Forward messages from groups/DMs to owner (persistent)
 */

const config = require('/root/pyBot/config');

module.exports = {
    name: 'spymode',
    aliases: ['spy', 'monitor'],
    description: 'Toggle spy mode for groups or DMs',
    category: 'owner',
    isOwnerOnly: true,
    
    async execute(sock, msg, args, extra) {
        try {
            const database = require('/root/pyBot/database');
            const input = args[0]?.toLowerCase();
            const jid = msg.key.remoteJid;
            const isGroup = jid.endsWith('@g.us');
            const spy = database.getSpySettings();
            
            if (input === 'on') {
                if (isGroup) {
                    database.addSpyGroup(jid);
                    extra.reply(`🕵️ *Spy Mode ON!*\n\nMessages in this group will be forwarded.\n\nUse .spy off to disable.`);
                } else {
                    // Don't spy on yourself - compare full numbers with country code
                    let senderNum = jid.split('@')[0].replace(/[^\d]/g, '');
                    if (!senderNum.startsWith('256')) senderNum = '256' + senderNum;
                    const ownerNum = String(config.ownerNumber[0]).replace(/[^\d]/g, '');
                    if (senderNum === ownerNum || senderNum === '256' + ownerNum || senderNum.endsWith(ownerNum)) {
                        return extra.reply('❌ Cannot spy on yourself!');
                    }
                    const jidFull = senderNum + '@s.whatsapp.net';
                    const contact = sock.contacts?.[jidFull];
                    const name = contact?.name || contact?.notify || msg.pushName || senderNum.slice(-9);
                    database.addSpyDM(jidFull);
                    extra.reply(`🕵️ Spy ON! Monitoring: ${name}`);
                }
            } else if (input === 'off') {
                if (isGroup) {
                    database.removeSpyGroup(jid);
                    extra.reply('👀 Spy OFF');
                } else {
                    let num = '256' + jid.split('@')[0].replace(/[^\d]/g, '').slice(-9);
                    database.removeSpyDM(num + '@s.whatsapp.net');
                    extra.reply('👀 Spy OFF');
                }
            } else if (input === 'status') {
                let status = 'OFF';
                if (isGroup) status = spy.groups.includes(jid) ? 'ON' : 'OFF';
                else status = spy.dms.includes(jid) ? 'ON' : 'OFF';
                extra.reply(`🕵️ Spy: ${status}`);
            } else if (input === 'list') {
                let listText = '📋 *Spy List*\n\n';
                
                if (spy.groups.length > 0) {
                    listText += `Groups: ${spy.groups.length}\n`;
                    for (const g of spy.groups) {
                        const name = g.split('@')[0].slice(0,12);
                        listText += `• ${name}\n`;
                    }
                }
                
                if (spy.dms.length > 0) {
                    listText += `\nDMs: ${spy.dms.length}\n`;
                    for (const d of spy.dms) {
                        const jid = d;
                        const contact = sock.contacts?.[jid];
                        const num = jid.split('@')[0];
                        const name = contact?.name || contact?.notify || 'Unknown';
                        const display = name === 'Unknown' ? '+'+num.slice(-9) : name;
                        listText += `• ${display}\n`;
                    }
                }
                
                if (spy.groups.length === 0 && spy.dms.length === 0) {
                    listText = '📋 No spy targets';
                }
                if (spy.dms.length === 0) listText += `None\n`;
                if (spy.groups.length === 0 && spy.dms.length === 0) {
                    listText = '📋 No spy targets configured.';
                }
                extra.reply(listText);
            } else {
                // Toggle
                if (isGroup) {
                    if (spy.groups.includes(jid)) {
                        database.removeSpyGroup(jid);
                        extra.reply('👀 *Spy Mode OFF!* for this group.');
                    } else {
                        database.addSpyGroup(jid);
                        extra.reply('🕵️ *Spy Mode ON!* for this group.');
                    }
                } else {
                    if (spy.dms.includes(jid)) {
                        database.removeSpyDM(jid);
                        extra.reply('👀 *Spy Mode OFF!* for this DM.');
                    } else {
                        database.addSpyDM(jid);
                        extra.reply('🕵️ *Spy Mode ON!* for this DM.');
                    }
                }
            }
            
        } catch (error) {
            console.error('Error in spymode command:', error);
            extra.reply('❌ Error: ' + error.message);
        }
    }
}