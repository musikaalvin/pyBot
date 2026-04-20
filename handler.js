/**
 * Message Handler - Processes incoming messages and executes commands
 */

const config = require('./config');
const database = require('./database');
const { loadCommands } = require('./utils/commandLoader');
const { addMessage } = require('./utils/groupstats');
const { jidDecode, jidEncode } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Group metadata cache to prevent rate limiting
const groupMetadataCache = new Map();
const CACHE_TTL = 60000; // 1 minute cache

// Load all commands
const commands = loadCommands();

// Unwrap WhatsApp containers (ephemeral, view once, etc.)
const getMessageContent = (msg) => {
  if (!msg || !msg.message) return null;
  
  let m = msg.message;
  
  // Common wrappers in modern WhatsApp
  if (m.ephemeralMessage) m = m.ephemeralMessage.message;
  if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
  if (m.viewOnceMessage) m = m.viewOnceMessage.message;
  if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message;
  
  // You can add more wrappers if needed later
  return m;
};

// Cached group metadata getter with rate limit handling (for non-admin checks)
const getCachedGroupMetadata = async (sock, groupId) => {
  try {
    // Validate group JID before attempting to fetch
    if (!groupId || !groupId.endsWith('@g.us')) {
      return null;
    }
    
    // Check cache first
    const cached = groupMetadataCache.get(groupId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data; // Return cached data (even if null for forbidden groups)
    }
    
    // Fetch from API
    const metadata = await sock.groupMetadata(groupId);
    
    // Cache it
    groupMetadataCache.set(groupId, {
      data: metadata,
      timestamp: Date.now()
    });
    
    return metadata;
  } catch (error) {
    // Handle forbidden (403) errors - cache null to prevent retry storms
    if (error.message && (
      error.message.includes('forbidden') || 
      error.message.includes('403') ||
      error.statusCode === 403 ||
      error.output?.statusCode === 403 ||
      error.data === 403
    )) {
      // Cache null for forbidden groups to prevent repeated attempts
      groupMetadataCache.set(groupId, {
        data: null,
        timestamp: Date.now()
      });
      return null; // Silently return null for forbidden groups
    }
    
    // Handle rate limit errors
    if (error.message && error.message.includes('rate-overlimit')) {
      const cached = groupMetadataCache.get(groupId);
      if (cached) {
        return cached.data;
      }
      return null;
    }
    
    // For other errors, try cached data as fallback
    const cached = groupMetadataCache.get(groupId);
    if (cached) {
      return cached.data;
    }
    
    // Return null instead of throwing to prevent crashes
    return null;
  }
};

// Live group metadata getter (always fresh, no cache) - for admin checks
const getLiveGroupMetadata = async (sock, groupId) => {
  try {
    // Always fetch fresh metadata, bypass cache
    const metadata = await sock.groupMetadata(groupId);
    
    // Some APIs return partial data, try to get full list via participants
    if (!metadata?.participants?.length && sock.groupFetchingById) {
      const full = await sock.groupFetchingById(groupId);
      if (full?.participants) {
        metadata.participants = full.participants;
      }
    }
    
    // Update cache
    groupMetadataCache.set(groupId, {
      data: metadata,
      timestamp: Date.now()
    });
    
    return metadata;
  } catch (error) {
    const cached = groupMetadataCache.get(groupId);
    if (cached) {
      return cached.data;
    }
    return null;
  }
};

// Alias for backward compatibility (non-admin features use cached)
const getGroupMetadata = getCachedGroupMetadata;

// Auto Recording Interval - simulates typing/recording presence
let autoRecordingInterval = null;

const startAutoRecording = (sock) => {
  // Clear any existing interval
  if (autoRecordingInterval) {
    clearInterval(autoRecordingInterval);
  }
  
  // Set up new interval for auto recording simulation
  autoRecordingInterval = setInterval(async () => {
    try {
      // Reload config to get fresh settings
      delete require.cache[require.resolve('./config')];
      const config = require('./config');
      
      if (!config.defaultGroupSettings.autoRecording) {
        // Stop interval if feature is disabled
        clearInterval(autoRecordingInterval);
        autoRecordingInterval = null;
        return;
      }
      
      // Set presence to recording to simulate "recording voice message"
      // This affects all chats since we don't have a specific JID here
      // In a more advanced implementation, we could track active chats
      await sock.sendPresenceUpdate('recording');
    } catch (error) {
      // Silently ignore errors to prevent interval crashes
      console.error('[AutoRecording Error]', error.message);
    }
  }, 5000); // Update every 5 seconds to maintain "recording" status
};

const stopAutoRecording = () => {
  if (autoRecordingInterval) {
    clearInterval(autoRecordingInterval);
    autoRecordingInterval = null;
  }
};

// Helper functions
const isOwner = (sender) => {
  if (!sender) return false;
  
  // Normalize sender JID to handle LID
  const normalizedSender = normalizeJidWithLid(sender);
  const senderNumber = normalizeJid(normalizedSender);
  
  // Check against owner numbers
  return config.ownerNumber.some(owner => {
    const normalizedOwner = normalizeJidWithLid(owner.includes('@') ? owner : `${owner}@s.whatsapp.net`);
    const ownerNumber = normalizeJid(normalizedOwner);
    return ownerNumber === senderNumber;
  });
};

const isMod = (sender) => {
  const number = sender.split('@')[0];
  return database.isModerator(number);
};

// LID mapping cache
const lidMappingCache = new Map();

// Helper to normalize JID to just the number part
const normalizeJid = (jid) => {
  if (!jid) return null;
  if (typeof jid !== 'string') return null;
  
  // Remove device ID if present (e.g., "1234567890:0@s.whatsapp.net" -> "1234567890")
  if (jid.includes(':')) {
    return jid.split(':')[0];
  }
  // Remove domain if present (e.g., "1234567890@s.whatsapp.net" -> "1234567890")
  if (jid.includes('@')) {
    return jid.split('@')[0];
  }
  return jid;
};

// Get LID mapping value from session files
const getLidMappingValue = (user, direction) => {
  if (!user) return null;
  
  const cacheKey = `${direction}:${user}`;
  if (lidMappingCache.has(cacheKey)) {
    return lidMappingCache.get(cacheKey);
  }
  
  const sessionPath = path.join(__dirname, config.sessionName || 'session');
  const suffix = direction === 'pnToLid' ? '.json' : '_reverse.json';
  const filePath = path.join(sessionPath, `lid-mapping-${user}${suffix}`);
  
  if (!fs.existsSync(filePath)) {
    lidMappingCache.set(cacheKey, null);
    return null;
  }
  
  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    const value = raw ? JSON.parse(raw) : null;
    lidMappingCache.set(cacheKey, value || null);
    return value || null;
  } catch (error) {
    lidMappingCache.set(cacheKey, null);
    return null;
  }
};

// Normalize JID handling LID conversion
const normalizeJidWithLid = (jid) => {
  if (!jid) return jid;
  
  try {
    const decoded = jidDecode(jid);
    if (!decoded?.user) {
      return `${jid.split(':')[0].split('@')[0]}@s.whatsapp.net`;
    }
    
    let user = decoded.user;
    let server = decoded.server === 'c.us' ? 's.whatsapp.net' : decoded.server;
    
    const mapToPn = () => {
      const pnUser = getLidMappingValue(user, 'lidToPn');
      if (pnUser) {
        user = pnUser;
        server = server === 'hosted.lid' ? 'hosted' : 's.whatsapp.net';
        return true;
      }
      return false;
    };
    
    if (server === 'lid' || server === 'hosted.lid') {
      mapToPn();
    } else if (server === 's.whatsapp.net' || server === 'hosted') {
      mapToPn();
    }
    
    if (server === 'hosted') {
      return jidEncode(user, 'hosted');
    }
    return jidEncode(user, 's.whatsapp.net');
  } catch (error) {
    return jid;
  }
};

// Build comparable JID variants (PN + LID) for matching
const buildComparableIds = (jid) => {
  if (!jid) return [];
  
  try {
    const decoded = jidDecode(jid);
    if (!decoded?.user) {
      return [normalizeJidWithLid(jid)].filter(Boolean);
    }
    
    const variants = new Set();
    const normalizedServer = decoded.server === 'c.us' ? 's.whatsapp.net' : decoded.server;
    
    variants.add(jidEncode(decoded.user, normalizedServer));
    
    const isPnServer = normalizedServer === 's.whatsapp.net' || normalizedServer === 'hosted';
    const isLidServer = normalizedServer === 'lid' || normalizedServer === 'hosted.lid';
    
    if (isPnServer) {
      const lidUser = getLidMappingValue(decoded.user, 'pnToLid');
      if (lidUser) {
        const lidServer = normalizedServer === 'hosted' ? 'hosted.lid' : 'lid';
        variants.add(jidEncode(lidUser, lidServer));
      }
    } else if (isLidServer) {
      const pnUser = getLidMappingValue(decoded.user, 'lidToPn');
      if (pnUser) {
        const pnServer = normalizedServer === 'hosted.lid' ? 'hosted' : 's.whatsapp.net';
        variants.add(jidEncode(pnUser, pnServer));
      }
    }
    
    return Array.from(variants);
  } catch (error) {
    return [jid];
  }
};

// Find participant by either PN JID or LID JID
const findParticipant = (participants = [], userIds) => {
  const targets = (Array.isArray(userIds) ? userIds : [userIds])
    .filter(Boolean)
    .flatMap(id => buildComparableIds(id));
  
  if (!targets.length) return null;
  
  return participants.find(participant => {
    if (!participant) return false;
    
    const participantIds = [
      participant.id,
      participant.lid,
      participant.userJid
    ]
      .filter(Boolean)
      .flatMap(id => buildComparableIds(id));
    
    return participantIds.some(id => targets.includes(id));
  }) || null;
};

const isAdmin = async (sock, participant, groupId, groupMetadata = null) => {
  if (!participant) return false;
  
  // Early return for non-group JIDs (DMs) - prevents slow sock.groupMetadata() call
  if (!groupId || !groupId.endsWith('@g.us')) {
    return false;
  }
  
  // Always fetch live metadata for admin checks
  let liveMetadata = groupMetadata;
  if (!liveMetadata || !liveMetadata.participants) {
    if (groupId) {
      liveMetadata = await getLiveGroupMetadata(sock, groupId);
    } else {
      return false;
    }
  }
  
  if (!liveMetadata || !liveMetadata.participants) return false;
  
  // Use findParticipant to handle LID matching
  const foundParticipant = findParticipant(liveMetadata.participants, participant);
  if (!foundParticipant) return false;
  
  return foundParticipant.admin === 'admin' || foundParticipant.admin === 'superadmin';
};

const isBotAdmin = async (sock, groupId, groupMetadata = null) => {
  if (!sock.user || !groupId) return false;
  
  // Early return for non-group JIDs (DMs) - prevents slow sock.groupMetadata() call
  if (!groupId.endsWith('@g.us')) {
    return false;
  }
  
  try {
    // Get bot's JID - Baileys stores it in sock.user.id
    const botId = sock.user.id;
    const botLid = sock.user.lid;
    
    if (!botId) return false;
    
    // Prepare bot JIDs to check - findParticipant will normalize them via buildComparableIds
    const botJids = [botId];
    if (botLid) {
      botJids.push(botLid);
    }
    
    // ALWAYS fetch live metadata for bot admin checks (never use cached)
    const liveMetadata = await getLiveGroupMetadata(sock, groupId);
    
    if (!liveMetadata || !liveMetadata.participants) return false;
    
    const participant = findParticipant(liveMetadata.participants, botJids);
    if (!participant) return false;
    
    return participant.admin === 'admin' || participant.admin === 'superadmin';
  } catch (error) {
    return false;
  }
};

const isUrl = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  return urlRegex.test(text);
};

const hasGroupLink = (text) => {
  const linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i;
  return linkRegex.test(text);
};

// System JID filter - checks if JID is from broadcast/status/newsletter
const isSystemJid = (jid) => {
  if (!jid) return true;
  return jid.includes('@broadcast') || 
         jid.includes('status.broadcast') || 
         jid.includes('@newsletter') ||
         jid.includes('@newsletter.');
};

// Main message handler
const handleMessage = async (sock, msg) => {
  try {
    // Debug logging to see all messages
    // Debug log removed
    
    if (!msg.message) return;
    
    const from = msg.key.remoteJid;
    
    // System message filter - ignore broadcast/status/newsletter messages
    if (isSystemJid(from)) {
      return; // Silently ignore system messages
    }
    
    // Auto-React System
    try {
      // Clear cache to get fresh config values
      delete require.cache[require.resolve('./config')];
      const config = require('./config');

      if (config.autoReact && msg.message && !msg.key.fromMe) {
        const content = msg.message.ephemeralMessage?.message || msg.message;
        const text =
          content.conversation ||
          content.extendedTextMessage?.text ||
          '';

        const jid = msg.key.remoteJid;
        const emojis = ['❤️','🔥','👌','💀','😁','✨','👍','🤨','😎','😂','🤝','💫'];
        
        const mode = config.autoReactMode || 'bot';

        if (mode === 'bot') {
          const prefixList = ['.', '/', '#'];
          if (prefixList.includes(text?.trim()[0])) {
            await sock.sendMessage(jid, {
              react: { text: '⏳', key: msg.key }
            });
          }
        }

        if (mode === 'all') {
          const rand = emojis[Math.floor(Math.random() * emojis.length)];
          await sock.sendMessage(jid, {
            react: { text: rand, key: msg.key }
          });
        }
      }
    } catch (e) {
      console.error('[AutoReact Error]', e.message);
    }
    
    // Status Tools Handlers (called periodically or based on events)
    try {
      await handleAutoViewStatus(sock);
      await handleAutoReactStatus(sock);
      await handleAutoSaveStatus(sock);
      await handleAutoRecording(sock);
    } catch (e) {
      console.error('[Status Tools Error]', e.message);
    }
    
    // Unwrap containers first
    const content = getMessageContent(msg);
    // Note: We don't return early if content is null because forwarded status messages might not have content
    
    // Still check for actual message content for regular processing
    let actualMessageTypes = [];
    if (content) {
      const allKeys = Object.keys(content);
      // Filter out protocol/system messages and find actual message content
      const protocolMessages = ['protocolMessage', 'senderKeyDistributionMessage', 'messageContextInfo'];
      actualMessageTypes = allKeys.filter(key => !protocolMessages.includes(key));
    }
    
    // We'll check for empty content later after we've processed group messages
    
    // Use the first actual message type (conversation, extendedTextMessage, etc.)
    const messageType = actualMessageTypes[0];
    
    // from already defined above in DM block check
    const sender = msg.key.fromMe ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : msg.key.participant || msg.key.remoteJid;
    const isGroup = from.endsWith('@g.us'); // Should always be true now due to DM block above
    
    // Track user activity on every message (for online status)
    try {
      const rawId = sender.split('@')[0];
      const userId = rawId.replace(/[^\d]/g, '');
      if (userId && userId.length >= 9 && !userId.includes(':')) {
        const last9 = userId.slice(-9);
        const validPrefixes = /^(70|71|72|74|75|77|78|79|80|81|82)\d{7}$/;
        if (validPrefixes.test(last9)) {
          database.updateUserActivity(last9);
        }
      }
    } catch (e) {}
    

    
    // Fetch group metadata immediately if it's a group
    const groupMetadata = isGroup ? await getGroupMetadata(sock, from) : null;
    
    // Anti-group mention protection (check BEFORE prefix check, as these are non-command messages)
    if (isGroup) {
      // Debug logging to confirm we're trying to call the handler
      const groupSettings = database.getGroupSettings(from);
      // Debug log removed
      if (groupSettings.antigroupmention) {
        // Debug log removed
      }
      try {
        await handleAntigroupmention(sock, msg, groupMetadata);
      } catch (error) {
        console.error('Error in antigroupmention handler:', error);
      }
    }
    
    // Track group message statistics
    if (isGroup) {
      addMessage(from, sender);
    }
    
    // Store message content for anti-delete (both groups and DMs)
    const groupSettings = isGroup ? database.getGroupSettings(from) : null;
    // Always store in groups - restore only when enabled
    let shouldStore = true;
    
    if (shouldStore && content && actualMessageTypes.length > 0) {
      try {
        const messageStore = {
          id: msg.key.id,
          content: content,
          timestamp: Date.now(),
          sender: sender
        };
        database.storeDeletedMessage(from, messageStore);
      } catch (storeErr) {
        console.log('[ANTIDELETE] Store error:', storeErr.message);
      }
    }
    
    // Return early for non-group messages with no recognizable content
    if (!content || actualMessageTypes.length === 0) return;
    
    // 🔹 Button response should also check unwrapped content
    const btn = content.buttonsResponseMessage || msg.message?.buttonsResponseMessage;
    if (btn) {
      const buttonId = btn.selectedButtonId;
      const displayText = btn.selectedDisplayText;
      
      // Handle button clicks by routing to commands
      if (buttonId === 'btn_menu') {
        // Execute menu command
        const menuCmd = commands.get('menu');
        if (menuCmd) {
          await menuCmd.execute(sock, msg, [], {
            from,
            sender,
            isGroup,
            groupMetadata,
            isOwner: isOwner(sender),
            isAdmin: await isAdmin(sock, sender, from, groupMetadata),
            isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
            isMod: isMod(sender),
            reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
            react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
          });
        }
        return;
      } else if (buttonId === 'btn_ping') {
        // Execute ping command
        const pingCmd = commands.get('ping');
        if (pingCmd) {
          await pingCmd.execute(sock, msg, [], {
            from,
            sender,
            isGroup,
            groupMetadata,
            isOwner: isOwner(sender),
            isAdmin: await isAdmin(sock, sender, from, groupMetadata),
            isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
            isMod: isMod(sender),
            reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
            react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
          });
        }
        return;
      } else if (buttonId === 'btn_help') {
        // Execute list command again (help)
        const listCmd = commands.get('list');
        if (listCmd) {
          await listCmd.execute(sock, msg, [], {
            from,
            sender,
            isGroup,
            groupMetadata,
            isOwner: isOwner(sender),
            isAdmin: await isAdmin(sock, sender, from, groupMetadata),
            isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
            isMod: isMod(sender),
            reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
            react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
          });
        }
        return;
      }
    }
    
    // Get message body from unwrapped content
    let body = '';
    if (content.conversation) {
      body = content.conversation;
    } else if (content.extendedTextMessage) {
      body = content.extendedTextMessage.text || '';
    } else if (content.imageMessage) {
      body = content.imageMessage.caption || '';
    } else if (content.videoMessage) {
      body = content.videoMessage.caption || '';
    }
    
    body = (body || '').trim();
    
    // DM Welcome - Only for new users who use a command
    if (config.welcomeDM && !isGroup && !msg.key.fromMe && body && body.startsWith('.')) {
      const database = require('./database');
      const contactKey = from.split('@')[0];
      
      // Check if truly new from database (not just memory)
      const allUsers = database.getAllUsers();
      const existingUser = allUsers.find(u => u.userId.includes(contactKey) || u.userId === contactKey);
      
      if (!existingUser || existingUser.commandsUsed < 1) {
        
        // Register user in database
        try {
          database.updateUser(contactKey, { registered: Date.now() });
          database.updateUserActivity(contactKey);
        } catch (e) {}
        
        // Notify owner
        try {
          const ownerJid = config.ownerNumber[0] + '@s.whatsapp.net';
          const allUsers = database.getAllUsers();
          const timeString = new Date().toLocaleString('en-UG', { 
            timeZone: 'Africa/Kampala',
            day: 'numeric', 
            month: 'short', 
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          });
          await sock.sendMessage(ownerJid, {
            text: `╭━━━━━━━━━━━━━━━⊷\n┃ 🆕 *NEW USER ALERT*\n╰━━━━━━━━━━━━━━━⊷\n\n👤 *Name:* ${msg.pushName || contactKey}\n📱 *Number:* ${contactKey}\n⏰ *Time:* ${timeString}\n🌍 *Total Users:* ${allUsers.length}`
          });
        } catch (e) {}
        
        // Send welcome to user
        try {
          const fs = require('fs');
          const path = require('path');
          const imgPath = path.join(__dirname, 'utils', 'bot_image.jpg');
          const pushName = msg.pushName || contactKey;
          
          const welcomeMsg = `⚡ *${config.botName}*\n\n👋 Hello ${pushName}!\n\nWelcome to ${config.botName}! 🎉\nType .menu for all commands`;
          
          if (fs.existsSync(imgPath)) {
            await sock.sendMessage(from, {
              image: fs.readFileSync(imgPath),
              caption: welcomeMsg
            });
          } else {
            await sock.sendMessage(from, { text: welcomeMsg });
          }
        } catch (e) {}
      }
    }
    
    // Check antiall protection (owner only feature)
    if (isGroup) {
      const groupSettings = database.getGroupSettings(from);
      if (groupSettings.antiall) {
        const senderIsAdmin = await isAdmin(sock, sender, from, groupMetadata);
        const senderIsOwner = isOwner(sender);
        
        if (!senderIsAdmin && !senderIsOwner) {
          const botIsAdmin = await isBotAdmin(sock, from, groupMetadata);
          if (botIsAdmin) {
            await sock.sendMessage(from, { delete: msg.key });
            return;
          }
        }
      }
      
      // Anti-tag protection (check BEFORE text check, as tagall can have no text)
      if (groupSettings.antitag && !msg.key.fromMe) {
        const ctx = content.extendedTextMessage?.contextInfo;
        const mentionedJids = ctx?.mentionedJid || [];
        
        const messageText = (
          body ||
          content.imageMessage?.caption ||
          content.videoMessage?.caption ||
          ''
        );
        
        const textMentions = messageText.match(/@[\d+\s\-()~.]+/g) || [];
        const numericMentions = messageText.match(/@\d{10,}/g) || [];
        
        const uniqueNumericMentions = new Set();
        numericMentions.forEach((mention) => {
          const numMatch = mention.match(/@(\d+)/);
          if (numMatch) uniqueNumericMentions.add(numMatch[1]);
        });
        
        const mentionedJidCount = mentionedJids.length;
        const numericMentionCount = uniqueNumericMentions.size;
        const totalMentions = Math.max(mentionedJidCount, numericMentionCount);
        
        if (totalMentions >= 3) {
          try {
            const participants = groupMetadata.participants || [];
            const mentionThreshold = Math.max(3, Math.ceil(participants.length * 0.5));
            const hasManyNumericMentions = numericMentionCount >= 10 ||
              (numericMentionCount >= 5 && numericMentionCount >= mentionThreshold);
            
            if (totalMentions >= mentionThreshold || hasManyNumericMentions) {
              const senderIsAdmin = await isAdmin(sock, sender, from, groupMetadata);
              const senderIsOwner = isOwner(sender);
              
              if (!senderIsAdmin && !senderIsOwner) {
                const action = (groupSettings.antitagAction || 'delete').toLowerCase();
                
                if (action === 'delete') {
                  try {
                    await sock.sendMessage(from, { delete: msg.key });
                    await sock.sendMessage(from, { 
                      text: '⚠️ *Tagall Detected!*',
                      mentions: [sender]
                    }, { quoted: msg });
                  } catch (e) {
                    console.error('Failed to delete tagall message:', e);
                  }
                } else if (action === 'kick') {
                  try {
                    await sock.sendMessage(from, { delete: msg.key });
                  } catch (e) {
                    console.error('Failed to delete tagall message:', e);
                  }
                  
                  const botIsAdmin = await isBotAdmin(sock, from, groupMetadata);
                  if (botIsAdmin) {
                    try {
                      await sock.groupParticipantsUpdate(from, [sender], 'remove');
                    } catch (e) {
                      console.error('Failed to kick for antitag:', e);
                    }
                    const usernames = [`@${sender.split('@')[0]}`];
                    await sock.sendMessage(from, {
                      text: `🚫 *Antitag Detected!*\n\n${usernames.join(', ')} has been kicked for tagging all members.`,
                      mentions: [sender],
                    }, { quoted: msg });
                  }
                }
                return;
              }
            }
          } catch (e) {
            console.error('Error during anti-tag enforcement:', e);
          }
        }
      }
    }
    
    // Anti-group mention protection (check BEFORE prefix check, as these are non-command messages)
    if (isGroup) {
      // Debug logging to confirm we're trying to call the handler
      const groupSettings = database.getGroupSettings(from);
      if (groupSettings.antigroupmention) {
        // Debug log removed
      }
      try {
        await handleAntigroupmention(sock, msg, groupMetadata);
      } catch (error) {
        console.error('Error in antigroupmention handler:', error);
      }
    }
    
    // AutoSticker feature - convert images/videos to stickers automatically
    if (isGroup) { // Process all messages in groups (including bot's own messages)
      const groupSettings = database.getGroupSettings(from);
      if (groupSettings.autosticker) {
        const mediaMessage = content?.imageMessage || content?.videoMessage;
        
        // Only process if it's an image or video (not documents)
        if (mediaMessage) {
          // Skip if message has a command prefix (let command handle it)
          if (!body.startsWith(config.prefix)) {
            try {
              // Import sticker command logic
              const stickerCmd = commands.get('sticker');
              if (stickerCmd) {
                // Execute sticker conversion silently
                await stickerCmd.execute(sock, msg, [], {
                  from,
                  sender,
                  isGroup,
                  groupMetadata,
                  isOwner: isOwner(sender),
                  isAdmin: await isAdmin(sock, sender, from, groupMetadata),
                  isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
                  isMod: isMod(sender),
                  reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
                  react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
                });
                return; // Don't process as command after auto-converting
              }
            } catch (error) {
              console.error('[AutoSticker Error]:', error);
              // Continue to normal processing if autosticker fails
            }
          }
        }
      }
    }

     // Check for active bomb games (before prefix check)
    try {
      const bombModule = require('./commands/fun/bomb');
      if (bombModule.gameState && bombModule.gameState.has(sender)) {
        const bombCommand = commands.get('bomb');
        if (bombCommand && bombCommand.execute) {
          // User has active game, process input
          await bombCommand.execute(sock, msg, [], {
            from,
            sender,
            isGroup,
            groupMetadata,
            isOwner: isOwner(sender),
            isAdmin: await isAdmin(sock, sender, from, groupMetadata),
            isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
            isMod: isMod(sender),
            reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
            react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
          });
          return; // Don't process as command
        }
      }
    } catch (e) {
      // Silently ignore if bomb command doesn't exist or has errors
    }
    
    // Check for active tictactoe games (before prefix check)
    try {
      const tictactoeModule = require('./commands/fun/tictactoe');
      if (tictactoeModule.handleTicTacToeMove) {
        // Check if user is in an active game
        const isInGame = Object.values(tictactoeModule.games || {}).some(room => 
          room.id.startsWith('tictactoe') && 
          [room.game.playerX, room.game.playerO].includes(sender) && 
          room.state === 'PLAYING'
        );
        
        if (isInGame) {
          // User has active game, process input
          const handled = await tictactoeModule.handleTicTacToeMove(sock, msg, {
            from,
            sender,
            isGroup,
            groupMetadata,
            isOwner: isOwner(sender),
            isAdmin: await isAdmin(sock, sender, from, groupMetadata),
            isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
            isMod: isMod(sender),
            reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
            react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
          });
          if (handled) return; // Don't process as command if move was handled
        }
      }
    } catch (e) {
      // Silently ignore if tictactoe command doesn't exist or has errors
    }
    
    
    // Check for poll votes (non-command replies)
    if (!body.startsWith(config.prefix)) return;
    
    // Parse command
    const args = body.slice(config.prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    
    // Get command
    const command = commands.get(commandName);
    if (!command) return;
    
    // Check self mode (private mode) - only owner can use commands
    if (config.selfMode && !isOwner(sender)) {
      return;
    }
    
    // Permission checks
    if (command.ownerOnly && !isOwner(sender)) {
      return sock.sendMessage(from, { text: config.messages.ownerOnly }, { quoted: msg });
    }
    
    if (command.modOnly && !isMod(sender) && !isOwner(sender)) {
      return sock.sendMessage(from, { text: '🔒 This command is only for moderators!' }, { quoted: msg });
    }
    
    if (command.groupOnly && !isGroup) {
      return sock.sendMessage(from, { text: config.messages.groupOnly }, { quoted: msg });
    }
    
    if (command.privateOnly && isGroup) {
      return sock.sendMessage(from, { text: config.messages.privateOnly }, { quoted: msg });
    }
    
    if (command.adminOnly && !(await isAdmin(sock, sender, from, groupMetadata)) && !isOwner(sender)) {
      return sock.sendMessage(from, { text: config.messages.adminOnly }, { quoted: msg });
    }
    
    if (command.botAdminNeeded) {
      const botIsAdmin = await isBotAdmin(sock, from, groupMetadata);
      if (!botIsAdmin) {
        return sock.sendMessage(from, { text: config.messages.botAdminNeeded }, { quoted: msg });
      }
    }
    
    // Auto-typing
    if (config.autoTyping) {
      await sock.sendPresenceUpdate('composing', from);
    }
    
    // Execute command
    console.log(`Executing command: ${commandName} from ${sender}`);
    
    await command.execute(sock, msg, args, {
      from,
      sender,
      isGroup,
      groupMetadata,
      isOwner: isOwner(sender),
      isAdmin: await isAdmin(sock, sender, from, groupMetadata),
      isBotAdmin: await isBotAdmin(sock, from, groupMetadata),
      isMod: isMod(sender),
      reply: (text) => sock.sendMessage(from, { text }, { quoted: msg }),
      react: (emoji) => sock.sendMessage(from, { react: { text: emoji, key: msg.key } })
    });
    
    // Track user activity
    const userId = sender.split('@')[0];
    database.updateUserActivity(userId);
    
  } catch (error) {
    console.error('Error in message handler:', error);
    
    // Don't send error messages for rate limit errors
    if (error.message && error.message.includes('rate-overlimit')) {
      console.warn('⚠️ Rate limit reached. Skipping error message.');
      return;
    }
    
    try {
      await sock.sendMessage(msg.key.remoteJid, { 
        text: `${config.messages.error}\n\n${error.message}` 
      }, { quoted: msg });
    } catch (e) {
      // Don't log rate limit errors when sending error messages
      if (!e.message || !e.message.includes('rate-overlimit')) {
        console.error('Error sending error message:', e);
      }
    }
  }
};

// Group participant update handler
const handleGroupUpdate = async (sock, update) => {
  try {
    const { id, participants, action } = update;
    
    // Validate group JID before processing
    if (!id || !id.endsWith('@g.us')) {
      return;
    }
    
    const groupSettings = database.getGroupSettings(id);
    
    if (!groupSettings.welcome && !groupSettings.goodbye) return;
    
    const groupMetadata = await getGroupMetadata(sock, id);
    if (!groupMetadata) return; // Skip if metadata unavailable (forbidden or error)
    
    // Helper to extract participant JID
    const getParticipantJid = (participant) => {
      if (typeof participant === 'string') {
        return participant;
      }
      if (participant && participant.id) {
        return participant.id;
      }
      if (participant && typeof participant === 'object') {
        // Try to find JID in object
        return participant.jid || participant.participant || null;
      }
      return null;
    };
    
    for (const participant of participants) {
      const participantJid = getParticipantJid(participant);
      if (!participantJid) {
        console.warn('Could not extract participant JID:', participant);
        continue;
      }
      
      const participantNumber = participantJid.split('@')[0];
      
      if (action === 'add' && groupSettings.welcome) {
        try {
          // Get user's display name - find participant using phoneNumber or JID
          let displayName = participantNumber;
          
          // Try to find participant in group metadata
          const participantInfo = groupMetadata.participants.find(p => {
            const pId = p.id || p.jid || p.participant;
            const pPhone = p.phoneNumber;
            // Match by JID or phoneNumber
            return pId === participantJid || 
                   pId?.split('@')[0] === participantNumber ||
                   pPhone === participantJid ||
                   pPhone?.split('@')[0] === participantNumber;
          });
          
          // Get phoneNumber JID to fetch contact name
          let phoneJid = null;
          if (participantInfo && participantInfo.phoneNumber) {
            phoneJid = participantInfo.phoneNumber;
          } else {
            // Try to normalize participantJid to phoneNumber format
            // If it's a LID, try to convert to phoneNumber
            try {
              const normalized = normalizeJidWithLid(participantJid);
              if (normalized && normalized.includes('@s.whatsapp.net')) {
                phoneJid = normalized;
              }
            } catch (e) {
              // If normalization fails, try using participantJid directly if it's a valid JID
              if (participantJid.includes('@s.whatsapp.net')) {
                phoneJid = participantJid;
              }
            }
          }
          
          // Try to get contact name from phoneNumber JID
          if (phoneJid) {
            try {
              // Method 1: Try to get from contact store if available
              if (sock.store && sock.store.contacts && sock.store.contacts[phoneJid]) {
                const contact = sock.store.contacts[phoneJid];
                if (contact.notify && contact.notify.trim() && !contact.notify.match(/^\d+$/)) {
                  displayName = contact.notify.trim();
                } else if (contact.name && contact.name.trim() && !contact.name.match(/^\d+$/)) {
                  displayName = contact.name.trim();
                }
              }
              
              // Method 2: Try to fetch contact using onWhatsApp and then check store
              if (displayName === participantNumber) {
                try {
                  await sock.onWhatsApp(phoneJid);
                  
                  // After onWhatsApp, check store again (might populate after check)
                  if (sock.store && sock.store.contacts && sock.store.contacts[phoneJid]) {
                    const contact = sock.store.contacts[phoneJid];
                    if (contact.notify && contact.notify.trim() && !contact.notify.match(/^\d+$/)) {
                      displayName = contact.notify.trim();
                    }
                  }
                } catch (fetchError) {
                  // Silently handle fetch errors
                }
              }
            } catch (contactError) {
              // Silently handle contact errors
            }
          }
          
          // Final fallback: use participantInfo.notify or name if available
          if (displayName === participantNumber && participantInfo) {
            if (participantInfo.notify && participantInfo.notify.trim() && !participantInfo.notify.match(/^\d+$/)) {
              displayName = participantInfo.notify.trim();
            } else if (participantInfo.name && participantInfo.name.trim() && !participantInfo.name.match(/^\d+$/)) {
              displayName = participantInfo.name.trim();
            }
          }
          
          // Get user's profile picture URL
          let profilePicUrl = '';
          try {
            profilePicUrl = await sock.profilePictureUrl(participantJid, 'image');
          } catch (ppError) {
            // If profile picture not available, use default avatar
            profilePicUrl = 'https://img.pyrocdn.com/dbKUgahg.png';
          }
          
          // Get group name and description
          const groupName = groupMetadata.subject || 'the group';
          const groupDesc = groupMetadata.desc || 'No description';
          
          // Get current time string with proper timezone
          const now = new Date();
          const timezone = 'Africa/Kampala'; // Uganda timezone (EAT)
          const timeString = now.toLocaleString('en-US', { 
            timeZone: timezone,
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          });
          
          // Create formatted welcome message
          const welcomeMsg = `╭╼━≪•𝙽𝙴𝚆 𝙼𝙴𝙼𝙱𝙴𝚁•≫━╾╮\n┃𝚆𝙴𝙻𝙲𝙾𝙼𝙴: @${displayName} 👋\n┃Member count: #${groupMetadata.participants.length}\n┃Time: ${timeString}⏰\n╰━━━━━━━━━━━━━━━╯\n\n*@${displayName}* Welcome to *${groupName}*! 🎉\n*Group Description*\n${groupDesc}\n\n> *Powered by ${config.botName}*`;
          
          // Construct API URL for welcome image
          const apiUrl = `https://api.some-random-api.com/welcome/img/7/gaming4?type=join&textcolor=white&username=${encodeURIComponent(displayName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${groupMetadata.participants.length}&avatar=${encodeURIComponent(profilePicUrl)}`;
          
          // Download the welcome image
          const imageResponse = await axios.get(apiUrl, { responseType: 'arraybuffer' });
          const imageBuffer = Buffer.from(imageResponse.data);
          
          // Send the welcome image with formatted caption
          await sock.sendMessage(id, { 
            image: imageBuffer,
            caption: welcomeMsg,
            mentions: [participantJid] 
          });
        } catch (welcomeError) {
          // Fallback to text message if image generation fails
          console.error('Welcome image error:', welcomeError);
          let message = groupSettings.welcomeMessage || 'Welcome @user to @group! 👋\nEnjoy your stay!';
          message = message.replace('@user', `@${participantNumber}`);
          message = message.replace('@group', groupMetadata.subject || 'the group');
          
          await sock.sendMessage(id, { 
            text: message, 
            mentions: [participantJid] 
          });
        }
      } else if (action === 'remove' && groupSettings.goodbye) {
        try {
          // Get user's display name - find participant using phoneNumber or JID
          let displayName = participantNumber;
          
          // Try to find participant in group metadata (before they left)
          const participantInfo = groupMetadata.participants.find(p => {
            const pId = p.id || p.jid || p.participant;
            const pPhone = p.phoneNumber;
            // Match by JID or phoneNumber
            return pId === participantJid || 
                   pId?.split('@')[0] === participantNumber ||
                   pPhone === participantJid ||
                   pPhone?.split('@')[0] === participantNumber;
          });
          
          // Get phoneNumber JID to fetch contact name
          let phoneJid = null;
          if (participantInfo && participantInfo.phoneNumber) {
            phoneJid = participantInfo.phoneNumber;
          } else {
            // Try to normalize participantJid to phoneNumber format
            try {
              const normalized = normalizeJidWithLid(participantJid);
              if (normalized && normalized.includes('@s.whatsapp.net')) {
                phoneJid = normalized;
              }
            } catch (e) {
              if (participantJid.includes('@s.whatsapp.net')) {
                phoneJid = participantJid;
              }
            }
          }
          
          // Try to get contact name from phoneNumber JID
          if (phoneJid) {
            try {
              // Method 1: Try to get from contact store if available
              if (sock.store && sock.store.contacts && sock.store.contacts[phoneJid]) {
                const contact = sock.store.contacts[phoneJid];
                if (contact.notify && contact.notify.trim() && !contact.notify.match(/^\d+$/)) {
                  displayName = contact.notify.trim();
                } else if (contact.name && contact.name.trim() && !contact.name.match(/^\d+$/)) {
                  displayName = contact.name.trim();
                }
              }
              
              // Method 2: Try to fetch contact using onWhatsApp and then check store
              if (displayName === participantNumber) {
                try {
                  await sock.onWhatsApp(phoneJid);
                  
                  // After onWhatsApp, check store again
                  if (sock.store && sock.store.contacts && sock.store.contacts[phoneJid]) {
                    const contact = sock.store.contacts[phoneJid];
                    if (contact.notify && contact.notify.trim() && !contact.notify.match(/^\d+$/)) {
                      displayName = contact.notify.trim();
                    }
                  }
                } catch (fetchError) {
                  // Silently handle fetch errors
                }
              }
            } catch (contactError) {
              // Silently handle contact errors
            }
          }
          
          // Final fallback: use participantInfo.notify or name if available
          if (displayName === participantNumber && participantInfo) {
            if (participantInfo.notify && participantInfo.notify.trim() && !participantInfo.notify.match(/^\d+$/)) {
              displayName = participantInfo.notify.trim();
            } else if (participantInfo.name && participantInfo.name.trim() && !participantInfo.name.match(/^\d+$/)) {
              displayName = participantInfo.name.trim();
            }
          }
          
          // Get user's profile picture URL
          let profilePicUrl = '';
          try {
            profilePicUrl = await sock.profilePictureUrl(participantJid, 'image');
          } catch (ppError) {
            // If profile picture not available, use default avatar
            profilePicUrl = 'https://img.pyrocdn.com/dbKUgahg.png';
          }
          
          // Get group name and description
          const groupName = groupMetadata.subject || 'the group';
          const groupDesc = groupMetadata.desc || 'No description';
          
          // Get current time string
          const now = new Date();
          const timeString = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          });
          
          // Create simple goodbye message
          const goodbyeMsg = `Goodbye @${displayName} 👋 We will never miss you!`;
          
          // Construct API URL for goodbye image (using leave type)
          const apiUrl = `https://api.some-random-api.com/welcome/img/7/gaming4?type=leave&textcolor=white&username=${encodeURIComponent(displayName)}&guildName=${encodeURIComponent(groupName)}&memberCount=${groupMetadata.participants.length}&avatar=${encodeURIComponent(profilePicUrl)}`;
          
          // Download the goodbye image
          const imageResponse = await axios.get(apiUrl, { responseType: 'arraybuffer' });
          const imageBuffer = Buffer.from(imageResponse.data);
          
          // Send the goodbye image with caption
          await sock.sendMessage(id, { 
            image: imageBuffer,
            caption: goodbyeMsg,
            mentions: [participantJid] 
          });
        } catch (goodbyeError) {
          // Fallback to simple goodbye message
          console.error('Goodbye error:', goodbyeError);
          const goodbyeMsg = `Goodbye @${participantNumber} 👋 We will never miss you! 💀`;
          
          await sock.sendMessage(id, { 
            text: goodbyeMsg, 
            mentions: [participantJid] 
          });
        }
      }
    }
  } catch (error) {
    // Silently handle forbidden errors and other group metadata errors
    if (error.message && (
      error.message.includes('forbidden') || 
      error.message.includes('403') ||
      error.statusCode === 403 ||
      error.output?.statusCode === 403 ||
      error.data === 403
    )) {
      // Silently skip forbidden groups
      return;
    }
    // Only log non-forbidden errors
    if (!error.message || !error.message.includes('forbidden')) {
      console.error('Error handling group update:', error);
    }
  }
};

// Antidelete handler - checks for deleted messages and restores them
const handleAntidelete = async (sock, update) => {
  try {
    // Check if this is a message delete event - Baileys provides keys array
    if (!update || !update.keys || !Array.isArray(update.keys)) return;
    
    // Debug log
    console.log('[ANTIDELETE] Delete event received, keys:', update.keys.length);
    
    // Process each deleted message key
    for (const key of update.keys) {
      const remoteJid = key.remoteJid;
      const messageId = key.id;
      
      // Skip if no remoteJid
      if (!remoteJid) continue;
      
      console.log('[ANTIDELETE] Processing delete for:', remoteJid, 'msgId:', messageId);
      
      // Check if anti-delete is enabled for this chat
      // For groups: check group settings, for DMs: use global setting
      let antideleteEnabled = false;
      if (remoteJid.endsWith('@g.us')) {
        const groupSettings = database.getGroupSettings(remoteJid);
        antideleteEnabled = groupSettings?.antidelete || false;
        console.log('[ANTIDELETE] Group settings antidelete:', antideleteEnabled);
      } else {
        // DM messages - always track
        antideleteEnabled = true;
      }
      
      if (!antideleteEnabled) {
        console.log('[ANTIDELETE] Not enabled, skipping');
        continue;
      }
      
      // Get stored message content - try both exact match and partial match
      const deletedMessages = database.getDeletedMessages(remoteJid, 50);
      
      // Try to find the message by ID
      let storedMsg = deletedMessages.find(msg => msg.id === messageId);
      
      // If not found, try partial match (sometimes IDs have prefixes)
      if (!storedMsg) {
        storedMsg = deletedMessages.find(msg => 
          messageId.includes(msg.id) || msg.id.includes(messageId)
        );
      }
      
      console.log('[ANTIDELETE] Found stored msg:', storedMsg ? 'yes' : 'no');
      
      if (storedMsg && storedMsg.content) {
        try {
          const content = storedMsg.content;
          const chatType = remoteJid.endsWith('@g.us') ? 'Group' : 'DM';
          const sender = storedMsg.sender || 'Unknown';
          
          console.log('[ANTIDELETE] Restoring message, type:', Object.keys(content)[0] || 'unknown');
          
          // Helper to build restore message
          const buildRestoreMsg = (text, caption = '') => {
            const label = caption ? caption : text;
            return `[${chatType} ANTI-DELETED]\n👤 From: @${sender.split('@')[0]}\n💬 ${label}`;
          };
          
          // Handle different message types
          if (content.conversation) {
            await sock.sendMessage(remoteJid, {
              text: buildRestoreMsg(content.conversation),
              mentions: [sender]
            });
          } else if (content.extendedTextMessage?.text) {
            await sock.sendMessage(remoteJid, {
              text: buildRestoreMsg(content.extendedTextMessage.text),
              mentions: [sender]
            });
          } else if (content.imageMessage) {
            await sock.sendMessage(remoteJid, {
              image: { url: content.imageMessage.url },
              caption: buildRestoreMsg(content.imageMessage.caption || '', content.imageMessage.caption),
              mentions: [sender]
            });
          } else if (content.videoMessage) {
            await sock.sendMessage(remoteJid, {
              video: { url: content.videoMessage.url },
              caption: buildRestoreMsg(content.videoMessage.caption || '', content.videoMessage.caption),
              mentions: [sender]
            });
          } else if (content.audioMessage) {
            await sock.sendMessage(remoteJid, {
              audio: { url: content.audioMessage.url },
              mimetype: 'audio/mp4',
              ptt: content.audioMessage.ptt || false
            }, { 
              text: buildRestoreMsg('[Voice/Audio Message]'),
              mentions: [sender]
            });
          } else if (content.stickerMessage) {
            await sock.sendMessage(remoteJid, {
              sticker: { url: content.stickerMessage.url }
            }, { 
              text: buildRestoreMsg('[Sticker]'),
              mentions: [sender]
            });
          } else if (content.documentMessage) {
            await sock.sendMessage(remoteJid, {
              document: { url: content.documentMessage.url },
              fileName: content.documentMessage.fileName || 'document',
              mimetype: content.documentMessage.mimetype || 'application/octet-stream'
            }, { 
              caption: buildRestoreMsg(content.documentMessage.caption || '[Document]'),
              mentions: [sender]
            });
          } else if (content.contactsArrayMessage || content.contactMessage) {
            await sock.sendMessage(remoteJid, {
              text: buildRestoreMsg('[Contact/Contact List]'),
              mentions: [sender]
            });
          } else if (content.locationMessage) {
            const loc = content.locationMessage;
            await sock.sendMessage(remoteJid, {
              text: buildRestoreMsg(`[Location] ${loc.degreesLatitude || ''}, ${loc.degreesLongitude || ''}`),
              mentions: [sender]
            });
          } else if (content.liveLocationMessage) {
            await sock.sendMessage(remoteJid, {
              text: buildRestoreMsg('[Live Location]'),
              mentions: [sender]
            });
          } else if (content.listMessage) {
            await sock.sendMessage(remoteJid, {
              text: buildRestoreMsg('[Interactive List]'),
              mentions: [sender]
            });
          } else if (content.buttonsMessage) {
            await sock.sendMessage(remoteJid, {
              text: buildRestoreMsg('[Buttons Message]'),
              mentions: [sender]
            });
          } else if (content.listResponseMessage) {
            await sock.sendMessage(remoteJid, {
              text: buildRestoreMsg('[Poll/Quiz Response]'),
              mentions: [sender]
            });
          }
          
          console.log('[ANTIDELETE] Message restored successfully');
        } catch (restoreError) {
          console.error('[ANTIDELETE] Failed to restore:', restoreError.message);
          await sock.sendMessage(remoteJid, {
            text: `🗑️ A message was deleted but could not be restored.`
          });
        }
      } else {
        console.log('[ANTIDELETE] No stored message found for ID:', messageId);
      }
    }
  } catch (error) {
    console.error('[ANTIDELETE] Error:', error.message);
  }
};

// Anti-Media handler - blocks images/videos/stickers from non-admins
const handleAntimedia = async (sock, msg, groupMetadata) => {
  try {
    if (!msg.key.remoteJid.endsWith('@g.us')) return;
    
    const groupSettings = database.getGroupSettings(msg.key.remoteJid);
    const settings = groupSettings.antimediaSettings || { enabled: false, types: ['image', 'video', 'sticker', 'audio', 'document'], action: 'delete', exemptAdmins: true, exemptOwner: true };
    
    if (!groupSettings.antimedia && !settings.enabled) return;
    
    const sender = msg.key.participant || msg.key.remoteJid;
    
    // Check exempts
    if (settings.exemptAdmins) {
      let isAdminUser = false;
      if (groupMetadata?.participants) {
        const participant = groupMetadata.participants.find(p => p.id === sender);
        if (participant?.admin) isAdminUser = true;
      }
      if (isAdminUser) return;
    }
    
    if (settings.exemptOwner) {
      const senderNum = sender.split('@')[0];
      const isOwnerUser = config.ownerNumber.some(o => o.includes(senderNum) || senderNum.includes(o));
      if (isOwnerUser) return;
    }
    
    const content = getMessageContent(msg);
    if (!content) return;
    
    const mediaTypes = settings.types;
    let hasBlockedMedia = false;
    
    if (mediaTypes.includes('image') && content.imageMessage) hasBlockedMedia = true;
    if (mediaTypes.includes('video') && content.videoMessage) hasBlockedMedia = true;
    if (mediaTypes.includes('sticker') && content.stickerMessage) hasBlockedMedia = true;
    if (mediaTypes.includes('audio') && content.audioMessage) hasBlockedMedia = true;
    if (mediaTypes.includes('document') && content.documentMessage) hasBlockedMedia = true;
    
    if (!hasBlockedMedia) return;
    
    const action = settings.action || 'delete';
    const senderNum = sender.split('@')[0];
    
    try {
      await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
      
      if (action === 'mute') {
        await sock.groupParticipantsUpdate(msg.key.remoteJid, [senderNum], 'mute');
        await sock.sendMessage(msg.key.remoteJid, {
          text: `🚫 Media not allowed! ${senderNum} has been muted.`,
          mentions: [sender]
        }, { quoted: msg });
      } else if (action === 'warn') {
        await sock.sendMessage(msg.key.remoteJid, {
          text: `⚠️ @${senderNum} media not allowed!`,
          mentions: [sender]
        }, { quoted: msg });
      } else {
        await sock.sendMessage(msg.key.remoteJid, {
          text: `🚫 Media not allowed!`,
          mentions: [sender]
        }, { quoted: msg });
      }
    } catch (e) {}
  } catch (error) {}
};

// Anti-Sticker handler
const handleAntisticker = async (sock, msg, groupMetadata) => {
  try {
    if (!msg.key.remoteJid.endsWith('@g.us')) return;
    
    const groupSettings = database.getGroupSettings(msg.key.remoteJid);
    if (!groupSettings.antisticker) return;
    
    const sender = msg.key.participant || msg.key.remoteJid;
    
    let isAdminUser = false;
    if (groupMetadata?.participants) {
      const participant = groupMetadata.participants.find(p => p.id === sender);
      if (participant?.admin) isAdminUser = true;
    }
    
    const senderNum = sender.split('@')[0];
    const isOwnerUser = config.ownerNumber.some(o => o.includes(senderNum) || senderNum.includes(o));
    
    if (isAdminUser || isOwnerUser) return;
    
    const content = getMessageContent(msg);
    if (!content?.stickerMessage) return;
    
    try {
      await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
      await sock.sendMessage(msg.key.remoteJid, {
        text: '🚫 Stickers not allowed!',
        mentions: [sender]
      }, { quoted: msg });
    } catch (e) {}
  } catch (error) {}
};

// Anti-Badword handler
const handleAntibadword = async (sock, msg, groupMetadata) => {
  try {
    if (!msg.key.remoteJid.endsWith('@g.us')) return;
    
    const groupSettings = database.getGroupSettings(msg.key.remoteJid);
    if (!groupSettings.antibadword) return;
    
    const sender = msg.key.participant || msg.key.remoteJid;
    
    let isAdminUser = false;
    if (groupMetadata?.participants) {
      const participant = groupMetadata.participants.find(p => p.id === sender);
      if (participant?.admin) isAdminUser = true;
    }
    
    const senderNum = sender.split('@')[0];
    const isOwnerUser = config.ownerNumber.some(o => o.includes(senderNum) || senderNum.includes(o));
    
    if (isAdminUser || isOwnerUser) return;
    
    const content = getMessageContent(msg);
    if (!content) return;
    
    let text = '';
    if (content.conversation) text = content.conversation;
    else if (content.extendedTextMessage?.text) text = content.extendedTextMessage.text;
    else if (content.imageMessage?.caption) text = content.imageMessage.caption;
    else if (content.videoMessage?.caption) text = content.videoMessage.caption;
    
    if (!text) return;
    
    const badWords = ['fuck', 'shit', 'ass', 'bitch', 'damn', 'hell', 'crap'];
    const lowerText = text.toLowerCase();
    const found = badWords.some(w => lowerText.includes(w));
    
    if (found) {
      try {
        await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
        await sock.sendMessage(msg.key.remoteJid, {
          text: '🚫 Bad language not allowed!',
          mentions: [sender]
        }, { quoted: msg });
      } catch (e) {}
    }
  } catch (error) {}
};

// Anti-Virus handler - blocks potentially harmful files
const handleAntivirus = async (sock, msg, groupMetadata) => {
  try {
    if (!msg.key.remoteJid.endsWith('@g.us')) return;
    
    const groupSettings = database.getGroupSettings(msg.key.remoteJid);
    if (!groupSettings.antivirus) return;
    
    const sender = msg.key.participant || msg.key.remoteJid;
    
    let isAdminUser = false;
    if (groupMetadata?.participants) {
      const participant = groupMetadata.participants.find(p => p.id === sender);
      if (participant?.admin) isAdminUser = true;
    }
    
    const senderNum = sender.split('@')[0];
    const isOwnerUser = config.ownerNumber.some(o => o.includes(senderNum) || senderNum.includes(o));
    
    if (isAdminUser || isOwnerUser) return;
    
    // Check if message contains a document (potential virus)
    const content = getMessageContent(msg);
    if (!content) return;
    
    const hasDocument = content.documentMessage;
    
    if (hasDocument) {
      try {
        await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
        await sock.sendMessage(msg.key.remoteJid, {
          text: '🛡️ Files not allowed! Only admins can send documents.',
          mentions: [sender]
        }, { quoted: msg });
      } catch (error) {
        console.error('Error in antivirus handler:', error);
      }
    }
  } catch (error) {
    console.error('Error in antivirus handler:', error);
  }
};

// Anti-Bot handler - blocks/kicks other bots
const handleAntibot = async (sock, msg, groupMetadata) => {
  try {
    if (!msg.key.remoteJid.endsWith('@g.us')) return;
    
    const groupSettings = database.getGroupSettings(msg.key.remoteJid);
    const antibotSettings = groupSettings?.antibotSettings || { enabled: false, action: 'delete', mode: 'normal', blockedBots: [], whitelist: [], stats: { detected: 0, kicked: 0, deleted: 0 } };
    
    if (!groupSettings?.antibot && !antibotSettings.enabled) return;
    
    const sender = msg.key.participant || msg.key.remoteJid;
    const senderNum = sender.split('@')[0];
    const isLidOnly = sender.includes('@lid.');
    
    // Get participant info
    let participant = null;
    if (groupMetadata?.participants) {
      participant = groupMetadata.participants.find(p => p.id === sender);
    }
    
    let isAdminUser = participant?.admin === 'admin' || participant?.admin === 'superadmin';
    const isOwnerUser = config.ownerNumber.some(o => o.includes(senderNum) || senderNum.includes(o));
    
    // Skip owner and bot itself
    if (isOwnerUser) return;
    const botJid = sock.user?.id;
    if (botJid && botJid.split(':')[0] === senderNum) return;
    
    // Check whitelist
    if (antibotSettings.whitelist?.includes(senderNum)) return;
    
    // Check if is newsletter/broadcast
    const isNewsletter = sender.endsWith('@newsletter');
    const isBroadcast = sender.endsWith('@broadcast');
    const content = getMessageContent(msg);
    const msgContextInfo = content?.contextInfo;
    const isForwardedFromNewsletter = msgContextInfo?.newsletterMessage?.isNewsletterInvitationLinkForwarded;
    
    let isBot = false;
    let botReason = '';
    const mode = antibotSettings.mode || 'normal';
    const strictMode = mode === 'strict';
    const softMode = mode === 'soft';
    
    // Known bot library prefixes
    const botPrefixes = ['BAE5', '3EB0', 'B24E', 'WAWE', 'BAAF', 'BAAE', 'BAAD', 'BAEF'];
    const msgId = msg.key.id;
    const msgIdLower = msgId?.toLowerCase() || '';
    
    // Detection 1: Message ID prefix (strict + normal)
    if (!softMode && botPrefixes.some(prefix => msgIdLower.startsWith(prefix))) {
      isBot = true;
      botReason = 'Bot library prefix';
    }
    
    // Detection 2: Message ID length (strict only)
    if (!isBot && strictMode && (msgId?.length === 20 || msgId?.length === 22)) {
      isBot = true;
      botReason = 'Bot-length Message ID';
    }
    
    // Detection 3: Command prefix + bot ID (normal)
    if (!isBot && !softMode) {
      const text = content?.conversation || content?.extendedTextMessage?.text || content?.imageMessage?.caption || '';
      if (/^[!\.\/\#][a-zA-Z]/.test(text)) {
        if (msgId?.length === 20 || msgId?.length === 22 || botPrefixes.some(prefix => msgIdLower.startsWith(prefix))) {
          isBot = true;
          botReason = 'Command with bot ID';
        }
      }
    }
    
    // Detection 4: LID account (strict + normal)
    if (!isBot && !softMode && isLidOnly) {
      isBot = true;
      botReason = 'LID account';
    }
    
    // Detection 5: Profile-based scoring
    const contact = sock.store?.contacts?.[sender] || {};
    const hasPp = !!(contact.imgUrl || contact.thumbnail);
    const hasStatus = !!contact.status;
    const hasName = contact.notify && !/^\d+$/.test(contact.notify);
    
    let botScore = 0;
    if (!hasPp) botScore += strictMode ? 3 : 2;
    if (!hasStatus) botScore += 1;
    if (!hasName) botScore += 1;
    if (isLidOnly) botScore += 2;
    
    const scoreThreshold = strictMode ? 2 : softMode ? 6 : 3;
    if (!isBot && botScore >= scoreThreshold) {
      isBot = true;
      botReason = `Score: ${botScore} (${!hasPp ? 'no PP ' : ''}${!hasStatus ? 'no status ' : ''}${!hasName ? 'no name' : ''})`;
    }
    
    // Detection 6: Blocked list
    const blockedBots = antibotSettings.blockedBots || [];
    if (!isBot && blockedBots.some(botNum => senderNum.includes(botNum) || botNum.includes(senderNum))) {
      isBot = true;
      botReason = 'Blocked number';
    }
    
    // Handle detected bot
    if (isBot || isNewsletter || isForwardedFromNewsletter) {
      try {
        // Update stats
        antibotSettings.stats = antibotSettings.stats || { detected: 0, kicked: 0, deleted: 0 };
        antibotSettings.stats.detected++;
        
        await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
        antibotSettings.stats.deleted++;
        
        const action = antibotSettings.action || 'delete';
        const displayNum = senderNum;
        const reasonText = botReason ? `\n└ ${botReason}` : '';
        
        if (action === 'kick') {
          try {
            await sock.groupParticipantsUpdate(msg.key.remoteJid, [sender], 'remove');
            antibotSettings.stats.kicked++;
            await sock.sendMessage(msg.key.remoteJid, {
              text: `🚫 Bot detected & removed! @${displayNum}${reasonText}`,
              mentions: [sender]
            });
          } catch (e) {
            await sock.sendMessage(msg.key.remoteJid, {
              text: `🚫 Bot detected! @${displayNum}${reasonText}\n(Could not remove)`,
              mentions: [sender]
            });
          }
        } else if (action === 'warn') {
          await sock.sendMessage(msg.key.remoteJid, {
            text: `⚠️ Bot warning! @${displayNum}\nOnly humans allowed.🤖${reasonText}`,
            mentions: [sender]
          }, { quoted: msg });
        } else {
          await sock.sendMessage(msg.key.remoteJid, {
            text: `🚫 Bot detected & removed! @${displayNum}${reasonText}`,
            mentions: [sender]
          }, { quoted: msg });
        }
        
        database.updateGroupSettings(msg.key.remoteJid, groupSettings);
      } catch (error) {
        console.error('Antibot error:', error);
      }
    }
  } catch (error) {
    console.error('Error in antibot handler:', error);
  }
};

// Status Tools Handlers

// Auto View Status Handler
const handleAutoViewStatus = async (sock, update) => {
    try {
        // Status viewing in WhatsApp Web is limited
        // This would require special API access from WhatsApp Business API
        // For now, we log that it's enabled
        console.log('[Status] Auto view status handler loaded');
        
        // Check if there are any status updates in the update
        if (update && update.statusUpdates) {
            console.log('[Status] Status updates received:', update.statusUpdates.length);
        }
    } catch (error) {
        console.error('Error in auto view status handler:', error);
    }
};

// Auto React Status Handler - automatically reacts to status updates
const handleAutoReactStatus = async (sock) => {
    try {
        // Reload config to get fresh settings
        delete require.cache[require.resolve('./config')];
        const config = require('./config');
        
        if (!config.defaultGroupSettings.autoReactStatus) return;
        
        // This would typically involve reacting to new status updates with emojis
        // Implementation depends on how Baileys handles status updates
        // For now, we'll log that the feature is enabled
    } catch (error) {
        console.error('Error in auto react status handler:', error);
    }
};

// Auto Save Status Handler - automatically saves/downloads status updates
const handleAutoSaveStatus = async (sock) => {
    try {
        // Reload config to get fresh settings
        delete require.cache[require.resolve('./config')];
        const config = require('./config');
        
        if (!config.defaultGroupSettings.autoSaveStatus) return;
        
        // This would typically involve downloading/saving new status updates
        // Implementation depends on how Baileys handles status updates
        // For now, we'll log that the feature is enabled
    } catch (error) {
        console.error('Error in auto save status handler:', error);
    }
};

// Auto Recording Handler - automatically sends fake voice recordings (typing simulation)
const handleAutoRecording = async (sock) => {
    try {
        // Reload config to get fresh settings
        delete require.cache[require.resolve('./config')];
        const config = require('./config');
        
        if (!config.defaultGroupSettings.autoRecording) return;
        
        // For continuous typing simulation, we'll set presence to recording periodically
        // This creates the "always typing" effect in chats
        // We implement this by setting presence to 'recording' every few seconds
        // Note: This runs continuously in the background via setInterval in the main handler
    } catch (error) {
        console.error('Error in auto recording handler:', error);
    }
};
 
// Anti-link handler - blocks links from non-admins
const handleAntilink = async (sock, msg, groupMetadata) => {
   try {
     const from = msg.key.remoteJid;
     const sender = msg.key.participant || msg.key.remoteJid;
     
     const senderNum = sender.split('@')[0];
     const isOwnerUser = config.ownerNumber.some(o => o.includes(senderNum) || senderNum.includes(o));
     
     let isAdminUser = false;
     if (groupMetadata?.participants) {
       const participant = groupMetadata.participants.find(p => p.id === sender);
       if (participant?.admin) isAdminUser = true;
     }
     
     if (isAdminUser || isOwnerUser) return;
     
     const groupSettings = database.getGroupSettings(from);
     if (!groupSettings.antilink) return;
    
    const body = msg.message?.conversation || 
                  msg.message?.extendedTextMessage?.text || 
                  msg.message?.imageMessage?.caption || 
                  msg.message?.videoMessage?.caption || '';
    
    const linkPattern = /(https?:\/\/)?([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.)+[a-zA-Z]{2,}(\/[^\s]*)?/i;
    
    if (linkPattern.test(body)) {
      const botIsAdmin = await isBotAdmin(sock, from, groupMetadata);
      const action = (groupSettings.antilinkAction || 'delete').toLowerCase();
      
      if (action === 'kick' && botIsAdmin) {
        try {
          await sock.sendMessage(from, { delete: msg.key });
          await sock.groupParticipantsUpdate(from, [sender], 'remove');
          await sock.sendMessage(from, { 
            text: `🔗 Anti-link triggered. Link removed.`,
            mentions: [sender]
          }, { quoted: msg });
        } catch (e) {
          console.error('Failed to kick for antilink:', e);
        }
      } else {
        // Default: delete message
        try {
          await sock.sendMessage(from, { delete: msg.key });
          await sock.sendMessage(from, { 
            text: `🔗 Anti-link triggered. Link removed.`,
            mentions: [sender]
          }, { quoted: msg });
        } catch (e) {
          console.error('Failed to delete message for antilink:', e);
        }
      }
    }
  } catch (error) {
    console.error('Error in antilink handler:', error);
  }
};


// Anti-group mention handler
const handleAntigroupmention = async (sock, msg, groupMetadata) => {
  try {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    
    const groupSettings = database.getGroupSettings(from);
    
    // Debug logging to confirm handler is being called
    if (groupSettings.antigroupmention) {
      // Debug log removed
      // Log simplified message info instead of full structure to avoid huge logs
      // Debug log removed
    }
    
    if (!groupSettings.antigroupmention) return;
    
    // Check if this is a forwarded status message that mentions the group
    // Comprehensive detection for various status mention message types
    let isForwardedStatus = false;
    
    if (msg.message) {
      // Direct checks for known status mention message types
      isForwardedStatus = isForwardedStatus || !!msg.message.groupStatusMentionMessage;
      isForwardedStatus = isForwardedStatus || 
        (msg.message.protocolMessage && msg.message.protocolMessage.type === 25); // STATUS_MENTION_MESSAGE
      
      // Check for forwarded newsletter info in various message types
      isForwardedStatus = isForwardedStatus || 
        (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && 
         msg.message.extendedTextMessage.contextInfo.forwardedNewsletterMessageInfo);
      isForwardedStatus = isForwardedStatus || 
        (msg.message.conversation && msg.message.contextInfo && 
         msg.message.contextInfo.forwardedNewsletterMessageInfo);
      isForwardedStatus = isForwardedStatus || 
        (msg.message.imageMessage && msg.message.imageMessage.contextInfo && 
         msg.message.imageMessage.contextInfo.forwardedNewsletterMessageInfo);
      isForwardedStatus = isForwardedStatus || 
        (msg.message.videoMessage && msg.message.videoMessage.contextInfo && 
         msg.message.videoMessage.contextInfo.forwardedNewsletterMessageInfo);
      isForwardedStatus = isForwardedStatus || 
        (msg.message.contextInfo && msg.message.contextInfo.forwardedNewsletterMessageInfo);
      
      // Generic check for any forwarded message
      if (msg.message.contextInfo) {
        const ctx = msg.message.contextInfo;
        isForwardedStatus = isForwardedStatus || !!ctx.isForwarded;
        isForwardedStatus = isForwardedStatus || !!ctx.forwardingScore;
        // Additional check for forwarded status specifically
        isForwardedStatus = isForwardedStatus || !!ctx.quotedMessageTimestamp;
      }
      
      // Additional checks for forwarded messages
      if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo) {
        const extCtx = msg.message.extendedTextMessage.contextInfo;
        isForwardedStatus = isForwardedStatus || !!extCtx.isForwarded;
        isForwardedStatus = isForwardedStatus || !!extCtx.forwardingScore;
      }
    }
    
    // Additional debug logging for detection
    if (groupSettings.antigroupmention) {
      // Debug log removed
    }
    
    // Additional debug logging to help identify message structure
    if (groupSettings.antigroupmention) {
      // Debug log removed
      // Debug log removed
      if (msg.message) {
        // Debug log removed
        // Log specific message types that might indicate a forwarded status
        if (msg.message.protocolMessage) {
          // Debug log removed
        }
        if (msg.message.contextInfo) {
          // Debug log removed
        }
        if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo) {
          // Debug log removed
        }
      }
    }
    
    // Debug logging for detection
    if (groupSettings.antigroupmention) {
      // Debug log removed
    }
    
    if (isForwardedStatus) {
      if (groupSettings.antigroupmention) {
        // Process forwarded status message
      }
      
      const senderIsAdmin = await isAdmin(sock, sender, from, groupMetadata);
      const senderIsOwner = isOwner(sender);
      
      if (groupSettings.antigroupmention) {
        // Debug log removed
      }
      
      // Don't act on admins or owners
      if (senderIsAdmin || senderIsOwner) return;
      
      const botIsAdmin = await isBotAdmin(sock, from, groupMetadata);
      const action = (groupSettings.antigroupmentionAction || 'delete').toLowerCase();
      
      if (groupSettings.antigroupmention) {
        // Debug log removed
      }
      
      if (action === 'kick' && botIsAdmin) {
        try {
          if (groupSettings.antigroupmention) {
            // Delete and kick user
          }
          await sock.sendMessage(from, { delete: msg.key });
          await sock.groupParticipantsUpdate(from, [sender], 'remove');
          // Silent removal
        } catch (e) {
          console.error('Failed to kick for antigroupmention:', e);
        }
      } else {
        // Default: delete message
        try {
          if (groupSettings.antigroupmention) {
            // Delete message
          }
          await sock.sendMessage(from, { delete: msg.key });
          // Silent deletion
        } catch (e) {
          console.error('Failed to delete message for antigroupmention:', e);
        }
      }
    } else if (groupSettings.antigroupmention) {
      // Debug log removed
    }
  } catch (error) {
    console.error('Error in antigroupmention handler:', error);
  }
};


// Anti-call feature initializer
const initializeAntiCall = (sock) => {
  // Anti-call feature - reject and block incoming calls
  sock.ev.on('call', async (calls) => {
    try {
      // Reload config to get fresh settings
      delete require.cache[require.resolve('./config')];
      const config = require('./config');
      
      if (!config.defaultGroupSettings.anticall) return;

      for (const call of calls) {
        if (call.status === 'offer') {
          // Reject the call
          await sock.rejectCall(call.id, call.from);

          // Block the caller
          await sock.updateBlockStatus(call.from, 'block');

          // Notify user
          await sock.sendMessage(call.from, {
            text: '🚫 Calls are not allowed. You have been blocked.'
          });
        }
      }
    } catch (err) {
      console.error('[ANTICALL ERROR]', err);
    }
  });
};

module.exports = {
  handleMessage,
  handleGroupUpdate,
  handleAntilink,
  handleAntidelete,
  handleAntisticker,
  handleAntimedia,
  handleAntibadword,
  handleAntivirus,
  handleAntibot,
  handleAntigroupmention,
  initializeAntiCall,
  handleAutoViewStatus,
  handleAutoReactStatus,
  handleAutoSaveStatus,
  handleAutoRecording,
  startAutoRecording,
  stopAutoRecording,
  isOwner,
  isAdmin,
  isBotAdmin,
  isMod,
  getGroupMetadata,
  findParticipant
};
