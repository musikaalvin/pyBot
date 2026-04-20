/**
 * Song Downloader - Download audio from YouTube using working APIs
 */

const yts = require('yt-search');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'song',
  aliases: ['music', 'yta'],
  category: 'media',
  description: 'Download audio from YouTube',
  usage: '.song <song name or YouTube link>',
  
  async execute(sock, msg, args, extra) {
    try {
      const text = args.join(' ');
      const from = msg.key.remoteJid;
      
      if (!text) {
        return extra.reply('❌ Usage: .song <song name or YouTube link>');
      }
      
      let videoUrl = text;
      let title = text;
      
      if (!text.includes('youtube.com') && !text.includes('youtu.be')) {
        await extra.reply('🔍 Searching...');
        const search = await yts(text);
        if (!search?.videos?.length) {
          return extra.reply('❌ No results found!');
        }
        const video = search.videos[0];
        videoUrl = video.url;
        title = video.title;
        
        await sock.sendMessage(from, {
          image: { url: video.thumbnail },
          caption: `🎵 *${video.title}*\n⏱ ${video.timestamp}\n\n⬇️ Downloading...`
        }, { quoted: msg });
      } else {
        await extra.reply('⬇️ Downloading audio...');
      }
      
      // EliteProTech API (tested and working)
      try {
        console.log('Trying eliteprotech...');
        const res = await axios.get(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(videoUrl)}&format=mp3`, { timeout: 30000 });
        
        if (res.data?.downloadURL) {
          const dlUrl = res.data.downloadURL;
          title = res.data.title || title;
          console.log('Got URL, downloading...');
          
          const bufferRes = await axios.get(dlUrl, { 
            responseType: 'arraybuffer', 
            timeout: 120000,
            maxContentLength: 25 * 1024 * 1024
          });
          
          audioBuffer = Buffer.from(bufferRes.data);
          console.log('Downloaded:', audioBuffer.length);
        }
      } catch (e) {
        console.log('eliteprotech failed:', e.message);
      }
      
      // Fallback: try other APIs
      if (!audioBuffer || audioBuffer.length < 5000) {
        const apis = [
          { name: 'ytdl', url: `https://api.theytdl.com/convert?url=${encodeURIComponent(videoUrl)}` },
          { name: 'cdn', url: `https://api.cdn.sed.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}` }
        ];
        
        for (const api of apis) {
          try {
            console.log('Trying:', api.name);
            const res = await axios.get(api.url, { timeout: 30000 });
            
            let dlUrl = null;
            const data = res.data;
            
            if (data?.download?.url) dlUrl = data.download.url;
            else if (data?.result?.download?.url) dlUrl = data.result.download.url;
            else if (data?.url) dlUrl = data.url;
            else if (data?.link) dlUrl = data.link;
            else if (data?.mp3) dlUrl = data.mp3;
            
            if (dlUrl && dlUrl.startsWith('http')) {
              const bufferRes = await axios.get(dlUrl, { 
                responseType: 'arraybuffer', 
                timeout: 120000,
                maxContentLength: 25 * 1024 * 1024
              });
              
              audioBuffer = Buffer.from(bufferRes.data);
              console.log('Downloaded:', audioBuffer.length);
              break;
            }
          } catch (e) {
            console.log(api.name, 'failed:', e.message);
          }
        }
      }
      
      if (!audioBuffer || audioBuffer.length < 5000) {
        const search = await yts(text);
        const video = search.videos?.[0];
        if (video) {
          return sock.sendMessage(from, {
            image: { url: video.thumbnail },
            caption: `🎵 *${video.title}*\n⏱ ${video.duration}\n\n❌ Download failed.\n\nLink: ${video.url}`
          }, { quoted: msg });
        }
        return extra.reply('❌ Download failed. Try again later.');
      }
      
      if (audioBuffer.length > 20 * 1024 * 1024) {
        return extra.reply('❌ File too large for WhatsApp.');
      }
      
      // Detect format and set mimetype
      const isM4A = audioBuffer.slice(0, 8).toString().includes('ftyp');
      
      await sock.sendMessage(from, {
        audio: audioBuffer,
        mimetype: isM4A ? 'audio/mp4' : 'audio/mpeg',
        fileName: `${title.substring(0, 40)}${isM4A ? '.m4a' : '.mp3'}`,
        caption: `🎵 ${title}`
      }, { quoted: msg });
      
    } catch (error) {
      console.error('Song error:', error.message);
      extra.reply('❌ Error: ' + error.message);
    }
  }
};