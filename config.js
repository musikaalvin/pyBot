/**
 * Global Configuration for WhatsApp MD Bot
 */
 
// Load environment variables from .env file if it exists
try {
    require('dotenv').config();
} catch (e) {
    // dotenv not installed or .env file not found, continue without it
}

module.exports = {
    // Bot Owner Configuration
    ownerNumber: [(process.env.OWNER_NUMBERS || '256748675846').split(',').map(num => num.trim())],
    ownerName: [(process.env.OWNER_NAMES || 'pyLord').split(',').map(name => name.trim())],
    
    // Bot Configuration
    botName: process.env.BOT_NAME || 'pyBot',
    botDescription: 'Advanced WhatsApp Bot by pyLord',
    prefix: process.env.PREFIX || '.',
    sessionName: process.env.SESSION_NAME || 'session',
    sessionID: process.env.SESSION_ID || '',
    newsletterJid: process.env.NEWSLETTER_JID || '120363161513685998@newsletter', // Newsletter JID for menu forwarding
    updateZipUrl: process.env.UPDATE_ZIP_URL || 'https://github.com/musikaalvin/pyBot/archive/refs/heads/main.zip', // URL to latest code zip for .update command
    
    // Author Info
    author: 'pyLord',
    github: 'https://github.com/musikaalvin/pyBot',
    origin: 'Uganda',
    botLogo: '⚡', // Lightning bolt icon as requested
    
    // Sticker Configuration
    packname: process.env.PACK_NAME || 'pyBot',
    
    // Bot Behavior
    selfMode: process.env.SELF_MODE === 'true' || false, // Private mode - only owner can use commands
    autoRead: process.env.AUTO_READ === 'true' || false,
    autoTyping: true,
    autoBio: process.env.AUTO_BIO === 'true' || false,
    autoSticker: process.env.AUTO_STICKER === 'true' || false,
    autoReact: process.env.AUTO_REACT === 'true' || false,
    autoReactMode: process.env.AUTO_REACT_MODE || 'bot', // set bot or all via cmd
    autoDownload: process.env.AUTO_DOWNLOAD === 'true' || false,
    autoViewStatus: process.env.AUTO_VIEW_STATUS === 'true' || false,
    autoReactStatus: process.env.AUTO_REACT_STATUS === 'true' || false,
    autoSaveStatus: process.env.AUTO_SAVE_STATUS === 'true' || false,
    autoRecording: true,
    ghostMode: true,
    spyMode: true,
    welcomeDM: true,
    fakeOnline: false,
    fakeLastSeen: null, // Custom fake last seen text
    fakeStatus: null, // Custom fake status text
    quote: 'Made with love by pyLord', // Random quote for menu
    stealthStatus: true,
    
    // Group Settings Defaults
    defaultGroupSettings: {
      antilink: false,
      antilinkAction: 'delete', // 'delete', 'kick', 'warn'
      antitag: false,
      antitagAction: 'delete',
      antiall: false, // Owner only - blocks all messages from non-admins
      antiviewonce: false,
      antibot: false,
      antibotAction: 'delete', // 'delete', 'kick'
      anticall: false, // Anti-call feature
      antigroupmention: false, // Anti-group mention feature
      antigroupmentionAction: 'delete', // 'delete', 'kick'
      welcome: false,
      welcomeMessage: '╭╼━≪•𝙽𝙴𝚆 𝙼𝙴𝙼𝙱𝙴𝚁•≫━╾╮\n┃𝚆𝙴𝙻𝙲𝙾𝙼𝙴: @user 👋\n┃Member count: #memberCount\n┃𝚃𝙸𝙼𝙴: time⏰\n╰━━━━━━━━━━━━━━━╯\n\n*@user* Welcome to *@group*! 🎉\n*Group 𝙳𝙴𝚂𝙲𝚁𝙸𝙿𝚃𝙸𝙾𝙽*\ngroupDesc\n\n> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ botName*',
      goodbye: false,
      goodbyeMessage: 'Goodbye @user 👋 We will never miss you!',
      antiSpam: false,
      antidelete: false,
      nsfw: false,
      detect: false,
      chatbot: false,
      autosticker: false, // Auto-convert images/videos to stickers
      antimedium: false, // Block images/videos from non-admins
      antisticker: false, // Block stickers from non-admins
      antibadword: false, // Block bad words from non-admins
      antivirus: false, // Block potentially harmful files
      // Status Tools
      autoViewStatus: false, // Automatically view status updates
      autoReactStatus: false, // Automatically react to status updates
      autoSaveStatus: false, // Automatically save status updates
      autoRecording: false, // Automatically send fake voice recordings
    autoRecording: false, // Automatically send fake voice recordings
    // Privacy & Control
    ignoreList: [], // List of ignored user IDs
    },
    
    // API Keys (add your own)
    apiKeys: {
      // Add API keys here if needed
      openai: '',
      deepai: '',
      remove_bg: ''
    },
    
    // Message Configuration
    messages: {
      wait: '⏳ Please wait...',
      success: '✅ Success!',
      error: '❌ Error occurred!',
      ownerOnly: '👑 This command is only for bot owner!',
      adminOnly: '🛡️ This command is only for group admins!',
      groupOnly: '👥 This command can only be used in groups!',
      privateOnly: '💬 This command can only be used in private chat!',
      botAdminNeeded: '🤖 Bot needs to be admin to execute this command!',
      invalidCommand: '❓ Invalid command! Type .menu for help'
    },
    
    // Timezone
    timezone: 'Asia/Kolkata',
    
    // Limits
    maxWarnings: 3,
    
// AI Configuration (reads from .env)
    ai: {
      apiKey: process.env.AI_API_KEY || '',
      model: process.env.AI_MODEL || 'meta-llama/llama-3.1-70b-instruct',
      endpoint: process.env.AI_ENDPOINT || 'https://openrouter.ai/api/v1/chat/completions'
    },
    
    // Social Links (optional)
    social: {
      github: process.env.GITHUB_URL || 'https://github.com/musikaalvin/pyBot',
      instagram: process.env.INSTAGRAM_URL || 'https://instagram.com/pylord',
      youtube: process.env.YOUTUBE_URL || 'http://youtube.com/@pyLord2003',
      community: 'https://chat.whatsapp.com/DX7ut87rxPjJftkJzv0mvJ',
      channel: 'https://whatsapp.com/channel/0029VbCl7fQCHDyiFOl5vq0S'
    }
};
  