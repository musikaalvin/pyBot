const path = require('path');
/**
 * TikTok Downloader - Download/search TikTok videos
 */

const { ttdl } = require('ruhend-scraper');
const axios = require('axios');
const APIs = require('../../utils/api');
const config = require(path.join(__dirname, '../../config'));

async function searchTikTok(query) {
  try {
    const res = await axios.get(`https://api.siputzx.my.id/api/d/tiktok?search=${encodeURIComponent(query)}`, { 
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (res.data?.data?.length) return res.data.data;
    if (res.data?.videos?.length) return res.data.videos;
    return [];
  } catch { return []; }
}

async function downloadTikTokAPI(url) {
  const apis = [
    `https://api.siputzx.my.id/api/d/tiktok?url=${encodeURIComponent(url)}`,
    `https://api.tikmate.io/api?url=${encodeURIComponent(url)}`,
  ];
  
  for (const apiUrl of apis) {
    try {
      console.log('Trying API:', apiUrl.split('?')[0]);
      const res = await axios.get(apiUrl, { timeout: 30000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      
      if (res.data?.data?.media?.length) {
        const media = res.data.data.media;
        const hd = media.find(m => m.quality === 'HD');
        const sd = media.find(m => m.quality === 'SD');
        const videoUrl = hd?.url || sd?.url;
        if (videoUrl) return { videoUrl, meta: res.data.data };
      }
      
      if (res.data?.download_url) {
        return { videoUrl: res.data.download_url, meta: res.data };
      }
    } catch (e) {
      console.log('API failed:', e.message);
      continue;
    }
  }
  throw new Error('All TikTok APIs failed');
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
}

module.exports = {
  name: 'tiktok',
  aliases: ['tt', 'ttdl', 'ttsearch'],
  category: 'media',
  description: 'Download/search TikTok videos',
  usage: '.tiktok <search/URL>',
  
  async execute(sock, msg, args, extra) {
    try {
      const raw = args.join(' ');
      if (!raw) {
        return extra.reply('Usage: .tiktok <search> or .tiktok <URL>');
      }
      
      const isUrl = /tiktok\.com/i.test(raw);
      
      if (isUrl) {
        await downloadTikTok(sock, msg, raw, extra);
        return;
      }
      
      await extra.reply('🔍 Searching...');
      
      const videos = await searchTikTok(raw);
      if (!videos.length) {
        return extra.reply('No results found!');
      }
      
      const results = videos.slice(0, 5).map((v, i) => 
        `${i + 1}. ${(v.title || 'Video').substring(0, 30)}\n${v.url}`
      ).join('\n\n');
      
      extra.reply(`Found ${videos.length} results:\n\n${results}\n\nReply with .tiktok <number>`);
    } catch (err) {
      console.error('TikTok error:', err.message);
      extra.reply('Error: ' + err.message);
    }
  }
};

async function downloadTikTok(sock, msg, url, extra) {
  try {
    extra.reply('⏳ *Downloading TikTok video...*');
    await sock.sendMessage(msg.key.remoteJid, { react: { text: '🔄', key: msg.key } });
    
    let videoUrl = null;
    let meta = null;
    
    try {
      const result = await downloadTikTokAPI(url);
      videoUrl = result.videoUrl;
      meta = result.meta;
    } catch (e) {
      console.log('API failed, trying ttdl...');
    }
    
    if (!videoUrl) {
      try {
        const data = await ttdl(url);
        if (data?.data?.length) {
          const vid = data.data.find(m => m.type === 'video' || m.url?.includes('.mp4'));
          if (vid) {
            videoUrl = vid.url;
            meta = { title: data.desc || 'TikTok Video' };
          }
        }
      } catch (e) {
        console.log('ttdl failed:', e.message);
      }
    }
    
    if (videoUrl) {
      const duration = 'N/A';
      const author = meta?.author || 'Unknown';
      const region = 'N/A';
      const likes = formatNumber(meta?.digg_count || 0);
      const comments = formatNumber(meta?.comment_count || 0);
      const shares = formatNumber(meta?.share_count || 0);
      const views = formatNumber(meta?.play_count || 0);
      const sound = 'original sound';
      const caption = meta?.title || '';
      
      const infoText = `╭───────────────━⊷
┃ 🎵 *TIKTOK*
╰───────────────━⊷
╭───────────────━⊷
┃ 👤 *User:* ${author}
┃ 🌍 *Region:* ${region}
┃ ⏱️ *Duration:* ${duration}
┃
┃ ❤️ *Likes:* ${likes}
┃ 💬 *Comments:* ${comments}
┃ 🔁 *Shares:* ${shares}
┃ 👀 *Views:* ${views}
┃
┃ 🎧 *Sound:* ${sound}
${caption ? `┃ 📝 *Caption:*\n┃ ${caption.substring(0, 100)}${caption.length > 100 ? '...' : ''}` : ''}
╰───────────────━⊷
> _Powered by ${config.botName}_ 🔥`;
      
      await sock.sendMessage(msg.key.remoteJid, {
        video: { url: videoUrl },
        caption: infoText
      }, { quoted: msg });
    } else {
      extra.reply('❌ Download failed. Try again later.');
    }
  } catch (e) {
    console.error('Download error:', e.message);
    extra.reply('Error: ' + e.message);
  }
}