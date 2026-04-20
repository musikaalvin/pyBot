/**
 * Rank Card Command
 */

let canvas;
try {
  canvas = require('canvas');
} catch (e) {
  // Canvas not available
}
const fs = require('fs');
const path = require('path');
const database = require('../../database');
const config = require('/root/pyBot/config');

module.exports = {
  name: 'rank',
  aliases: ['level', 'xp', 'rankcard'],
  category: 'utility',
  description: 'Check your or someone else\'s rank card',
  usage: '.rank [@user]',
  
  async execute(sock, msg, args, extra) {
    try {
      // Check if canvas is available
      if (!canvas) {
        return extra.reply('❌ Rank card feature is not available.\nCanvas module not installed.');
      }
      
      let targetId = msg.key.participant; // Default to sender
      
      // If mentioned user, use that instead
      if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
        const mentioned = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        if (mentioned) targetId = mentioned;
      } else if (args[0]) {
        // If argument provided, try to use it as user ID
        const arg = args[0].replace(/[@<>]/g, '');
        if (/^\d+$/.test(arg)) {
          targetId = `${arg}@s.whatsapp.net`;
        }
      }
      
      // Get user data
      const userData = database.getUser(targetId.split('@')[0]);
      const xpData = database.getXP(targetId.split('@')[0]);
      
      // Try to get user's name and profile picture
      let username = targetId.split('@')[0];
      let profilePic = null;
      
      try {
        // Try to get profile picture
        profilePic = await sock.profilePictureUrl(targetId, 'image');
      } catch (e) {
        // Use default if failed
        profilePic = 'https://i.ibb.co/L1XwwSv/default-pp.png';
      }
      
      // Try to get pushname from contacts if available
      try {
        if (sock.contacts && sock.contacts[targetId]) {
          username = sock.contacts[targetId].pushname || username;
        }
      } catch (e) {
        // Keep the number as username if pushname not available
      }
      
      // Create canvas
      const width = 900;
      const height = 300;
      const canvas = canvas.createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      // Background gradient
      const background = ctx.createLinearGradient(0, 0, width, 0);
      background.addColorStop(0, '#1a1a2e');
      background.addColorStop(1, '#16213e');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      
      // Left side - avatar and info
      const avatarSize = 180;
      const avatarX = 40;
      const avatarY = (height - avatarSize) / 2;
      
      // Avatar background circle
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2 + 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fill();
      
      // Avatar image
      if (profilePic) {
        try {
          const avatarImg = await canvas.loadImage(profilePic);
          ctx.save();
          ctx.beginPath();
          ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
          ctx.restore();
        } catch (e) {
          // Fallback to default avatar if image loading fails
          ctx.beginPath();
          ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
          ctx.fillStyle = '#4cc9f0';
          ctx.fill();
          ctx.font = 'bold 40px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'white';
          ctx.fillText(username[0].toUpperCase(), avatarX + avatarSize/2, avatarY + avatarSize/2 + 15);
        }
      } else {
        // Default avatar
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI * 2);
        ctx.fillStyle = '#4cc9f0';
        ctx.fill();
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        ctx.fillText(username[0].toUpperCase(), avatarX + avatarSize/2, avatarY + avatarSize/2 + 15);
      }
      
      // Right side - stats
      const statsX = avatarX + avatarSize + 40;
      const statsY = 50;
      
      // Username
      ctx.font = 'bold 36px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(username, statsX, statsY);
      
      // Level and XP
      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#4cc9f0';
      ctx.fillText(`Level ${xpData.level}`, statsX, statsY + 40);
      
      // XP Bar background
      const barWidth = 500;
      const barHeight = 30;
      const barX = statsX;
      const barY = statsY + 80;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      // XP Bar fill
      const xpForCurrentLevel = xpData.level * 100;
      const xpForNextLevel = (xpData.level + 1) * 100;
      const xpInLevel = xpData.xp - xpForCurrentLevel;
      const xpNeededForLevel = xpForNextLevel - xpForCurrentLevel;
      const xpPercentage = xpInLevel / xpNeededForLevel;
      
      const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth, barY);
      gradient.addColorStop(0, '#ff9a9e');
      gradient.addColorStop(0.5, '#fad0c4');
      gradient.addColorStop(1, '#fad0c4');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(barX, barY, barWidth * xpPercentage, barHeight);
      
      // XP Bar border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
      
      // XP Text
      ctx.fillStyle = '#ffffff';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${xpData.xp} XP`, barX + barWidth + 10, barY + 22);
      
      // Rank text
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`RANK #${Math.floor(Math.random() * 1000) + 1}`, statsX, barY + barHeight + 40);
      
      // Footer
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Powered by ${config.botName}`, width / 2, height - 20);
      
      // Send the image
      const buffer = canvas.toBuffer('image/png');
      
      await sock.sendMessage(msg.key.remoteJid, {
        image: buffer,
        caption: `*${username}'s Rank Card*`
      }, { quoted: msg });
      
    } catch (error) {
      console.error('Rank error:', error);
      await extra.reply('❌ Failed to generate rank card!');
    }
  }
};