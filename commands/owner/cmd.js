const path = require('path');
/**
 * CMD/Console Command - Run terminal commands
 */

const { exec } = require('child_process');
const config = require(path.join(__dirname, '../../config'));

module.exports = {
  name: 'cmd',
  aliases: ['console', 'terminal', 'sh', 'exec', 'bash'],
  category: 'owner',
  description: 'Run terminal commands',
  usage: '.cmd <command>',
  ownerOnly: false,
  
  async execute(sock, msg, args, extra) {
    try {
      const from = msg.key.remoteJid;
      const sender = msg.key.participant || from;
      const senderNum = sender.split('@')[0];
      const isOwner = config.ownerNumber.some(n => senderNum === n || n === senderNum);
      
      if (!args.length) {
        return extra.reply('Usage: .cmd <command>\n.cmd date\n.cmd ls\n.cmd npm -v\n\nOwner: all commands allowed');
      }
      
      const command = args.join(' ');
      
      // Block dangerous commands for Everyone
      const blockedEveryone = ['rm -rf /', 'dd if=', ':(){:|:&};:', '/etc/passwd', '/etc/shadow', 'mkfs', 'chmod 777 /'];
      for (const b of blockedEveryone) {
        if (command.includes(b)) {
          return extra.reply('❌ That command is blocked!');
        }
      }
      
      // Owner-only commands
      const ownerOnlyCmds = ['npm', 'node', 'git', 'curl', 'wget', 'apt', 'yum', 'pip', 'yarn', 'pm2', 'bash', 'sh', 'zsh'];
      const cmdFirst = command.split(' ')[0].toLowerCase();
      const isRestricted = ownerOnlyCmds.includes(cmdFirst);
      
      if (isRestricted && !isOwner) {
        return extra.reply('🔒 Owner-only: ' + cmdFirst);
      }
      
      // Run command
      const run = (cmd) => new Promise((resolve, reject) => {
        exec(cmd, { timeout: 20000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) reject(err);
          else resolve(stdout + stderr);
        });
      });
      
      const output = await run(command);
      const trimmed = output.length > 2000 ? output.slice(0, 2000) + '\n...(truncated)' : output || '(empty)';
      
      await extra.reply(`📟 $ ${command}\n\`\`\`\n${trimmed}\n\`\`\``);
    } catch (err) {
      await extra.reply(`❌ ${err.message}`);
    }
  }
};