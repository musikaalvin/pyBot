/**
 * Simple JSON-based Database for Group Settings
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

const DB_PATH = path.join(__dirname, 'database');
const GROUPS_DB = path.join(DB_PATH, 'groups.json');
const USERS_DB = path.join(DB_PATH, 'users.json');
const WARNINGS_DB = path.join(DB_PATH, 'warnings.json');
const MODS_DB = path.join(DB_PATH, 'mods.json');
const XP_DB = path.join(DB_PATH, 'xp.json');
const ACTIVITY_DB = path.join(DB_PATH, 'activity.json');
const DELETED_MESSAGES_DB = path.join(DB_PATH, 'deleted_messages.json');
const ECONOMY_DB = path.join(DB_PATH, 'economy.json');

// Initialize database directory
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

// Initialize database files
const initDB = (filePath, defaultData = {}) => {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
};

initDB(GROUPS_DB, {});
initDB(USERS_DB, {});
initDB(WARNINGS_DB, {});
initDB(MODS_DB, { moderators: [] });
initDB(XP_DB, {});
initDB(ACTIVITY_DB, {});
initDB(DELETED_MESSAGES_DB, {});
initDB(ECONOMY_DB, {}); // For economy system
initDB(DELETED_MESSAGES_DB, {}); // For anti-delete feature

// Spy settings (groups & DMs to spy on)
const SPY_DB = path.join(DB_PATH, 'spy.json');
initDB(SPY_DB, { groups: [], dms: [] });

// Read database
const readDB = (filePath) => {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading database: ${error.message}`);
    return {};
  }
};

// Write database
const writeDB = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Error writing database: ${error.message}`);
    return false;
  }
};

// Group Settings
const getGroupSettings = (groupId) => {
  const groups = readDB(GROUPS_DB);
  if (!groups[groupId]) {
    groups[groupId] = { ...config.defaultGroupSettings };
    writeDB(GROUPS_DB, groups);
  }
  return groups[groupId];
};

const updateGroupSettings = (groupId, settings) => {
  const groups = readDB(GROUPS_DB);
  groups[groupId] = { ...groups[groupId], ...settings };
  return writeDB(GROUPS_DB, groups);
};

// User Data
const getUser = (userId) => {
  const users = readDB(USERS_DB);
  if (!users[userId]) {
    users[userId] = {
      registered: Date.now(),
      premium: false,
      banned: false
    };
    writeDB(USERS_DB, users);
  }
  return users[userId];
};

const updateUser = (userId, data) => {
  const users = readDB(USERS_DB);
  users[userId] = { ...users[userId], ...data };
  return writeDB(USERS_DB, users);
};

// Warnings System
const getWarnings = (groupId, userId) => {
  const warnings = readDB(WARNINGS_DB);
  const key = `${groupId}_${userId}`;
  return warnings[key] || { count: 0, warnings: [] };
};

const addWarning = (groupId, userId, reason) => {
  const warnings = readDB(WARNINGS_DB);
  const key = `${groupId}_${userId}`;
  
  if (!warnings[key]) {
    warnings[key] = { count: 0, warnings: [] };
  }
  
  warnings[key].count++;
  warnings[key].warnings.push({
    reason,
    date: Date.now()
  });
  
  writeDB(WARNINGS_DB, warnings);
  return warnings[key];
};

const removeWarning = (groupId, userId) => {
  const warnings = readDB(WARNINGS_DB);
  const key = `${groupId}_${userId}`;
  
  if (warnings[key] && warnings[key].count > 0) {
    warnings[key].count--;
    warnings[key].warnings.pop();
    writeDB(WARNINGS_DB, warnings);
    return true;
  }
  return false;
};

const clearWarnings = (groupId, userId) => {
  const warnings = readDB(WARNINGS_DB);
  const key = `${groupId}_${userId}`;
  delete warnings[key];
  return writeDB(WARNINGS_DB, warnings);
};

// Activity Logger
const logActivity = (groupId, userId, action, details = '') => {
  const activities = readDB(ACTIVITY_DB);
  const timestamp = Date.now();
  
  if (!activities[groupId]) {
    activities[groupId] = [];
  }
  
  activities[groupId].push({
    userId,
    action,
    details,
    timestamp,
    date: new Date(timestamp).toISOString()
  });
  
  // Keep only last 100 activities per group to prevent database bloat
  if (activities[groupId].length > 100) {
    activities[groupId] = activities[groupId].slice(-100);
  }
  
  writeDB(ACTIVITY_DB, activities);
  return true;
};

const getGroupActivity = (groupId, limit = 20) => {
  const activities = readDB(ACTIVITY_DB);
  const groupActivities = activities[groupId] || [];
  return groupActivities.slice(-limit).reverse(); // Most recent first
};

const clearGroupActivity = (groupId) => {
  const activities = readDB(ACTIVITY_DB);
  if (activities[groupId]) {
    delete activities[groupId];
    return writeDB(ACTIVITY_DB, activities);
  }
  return false;
};

// Deleted Messages Storage (for anti-delete)
const storeDeletedMessage = (groupId, messageData) => {
  const deletedMsgs = readDB(DELETED_MESSAGES_DB);
  const timestamp = Date.now();
  
  if (!deletedMsgs[groupId]) {
    deletedMsgs[groupId] = [];
  }
  
  deletedMsgs[groupId].push({
    ...messageData,
    timestamp,
    storedAt: timestamp
  });
  
  // Keep only last 50 deleted messages per group
  if (deletedMsgs[groupId].length > 50) {
    deletedMsgs[groupId] = deletedMsgs[groupId].slice(-50);
  }
  
  writeDB(DELETED_MESSAGES_DB, deletedMsgs);
  return true;
};

const getDeletedMessages = (groupId, limit = 10) => {
  const deletedMsgs = readDB(DELETED_MESSAGES_DB);
  const groupDeleted = deletedMsgs[groupId] || [];
  return groupDeleted.slice(-limit).reverse(); // Most recent first
};

const clearDeletedMessages = (groupId) => {
  const deletedMsgs = readDB(DELETED_MESSAGES_DB);
  if (deletedMsgs[groupId]) {
    delete deletedMsgs[groupId];
    return writeDB(DELETED_MESSAGES_DB, deletedMsgs);
  }
  return false;
};

// Moderators System
const getModerators = () => {
  const mods = readDB(MODS_DB);
  return mods.moderators || [];
};

const addModerator = (userId) => {
  const mods = readDB(MODS_DB);
  if (!mods.moderators) mods.moderators = [];
  if (!mods.moderators.includes(userId)) {
    mods.moderators.push(userId);
    return writeDB(MODS_DB, mods);
  }
  return false;
};

const removeModerator = (userId) => {
  const mods = readDB(MODS_DB);
  if (mods.moderators) {
    mods.moderators = mods.moderators.filter(id => id !== userId);
    return writeDB(MODS_DB, mods);
  }
  return false;
};

const isModerator = (userId) => {
  const mods = getModerators();
  return mods.includes(userId);
};

// XP System
const getXP = (userId) => {
  const xpData = readDB(XP_DB);
  return xpData[userId] || { xp: 0, level: 0, lastClaim: 0 };
};

const addXP = (userId, amount) => {
  const xpData = readDB(XP_DB);
  if (!xpData[userId]) {
    xpData[userId] = { xp: 0, level: 0, lastClaim: 0 };
  }
  
  xpData[userId].xp += amount;
  
  // Level up calculation: every 100 XP = 1 level
  const newLevel = Math.floor(xpData[userId].xp / 100);
  if (newLevel > xpData[userId].level) {
    xpData[userId].level = newLevel;
  }
  
  writeDB(XP_DB, xpData);
  return xpData[userId];
};

const resetXP = (userId) => {
  const xpData = readDB(XP_DB);
  if (xpData[userId]) {
    xpData[userId] = { xp: 0, level: 0, lastClaim: 0 };
    writeDB(XP_DB, xpData);
    return true;
  }
  return false;
};

// Economy System
const getEconomy = (userId) => {
  const economyData = readDB(ECONOMY_DB);
  return economyData[userId] || { 
    balance: 0, 
    bank: 0, 
    lastDaily: 0,
    lastWork: 0,
    totalEarned: 0,
    totalLost: 0,
    robCooldown: 0
  };
};

const updateEconomy = (userId, data) => {
  const economyData = readDB(ECONOMY_DB);
  if (!economyData[userId]) {
    economyData[userId] = { 
      balance: 0, 
      bank: 0, 
      lastDaily: 0,
      lastWork: 0,
      totalEarned: 0,
      totalLost: 0,
      robCooldown: 0
    };
  }
  
  economyData[userId] = { ...economyData[userId], ...data };
  writeDB(ECONOMY_DB, economyData);
  return economyData[userId];
};

const addBalance = (userId, amount) => {
  const economy = getEconomy(userId);
  economy.balance += amount;
  if (amount > 0) economy.totalEarned += amount;
  else economy.totalLost += Math.abs(amount);
  return updateEconomy(userId, { balance: economy.balance, totalEarned: economy.totalEarned, totalLost: economy.totalLost });
};

const removeBalance = (userId, amount) => {
  const economy = getEconomy(userId);
  if (economy.balance >= amount) {
    economy.balance -= amount;
    economy.totalLost += amount;
    return updateEconomy(userId, { balance: economy.balance, totalLost: economy.totalLost });
  }
  return false;
};

const addBank = (userId, amount) => {
  const economy = getEconomy(userId);
  if (economy.balance >= amount) {
    economy.balance -= amount;
    economy.bank += amount;
    return updateEconomy(userId, { balance: economy.balance, bank: economy.bank });
  }
  return false;
};

const withdrawBank = (userId, amount) => {
  const economy = getEconomy(userId);
  if (economy.bank >= amount) {
    economy.bank -= amount;
    economy.balance += amount;
    return updateEconomy(userId, { balance: economy.balance, bank: economy.bank });
  }
  return false;
};

const canDaily = (userId) => {
  const economy = getEconomy(userId);
  const now = Date.now();
  return now - economy.lastDaily > 24 * 60 * 60 * 1000; // 24 hours
};

const setDaily = (userId) => {
  const economy = getEconomy(userId);
  economy.lastDaily = Date.now();
  return updateEconomy(userId, { lastDaily: economy.lastDaily });
};

const canWork = (userId) => {
  const economy = getEconomy(userId);
  const now = Date.now();
  return now - economy.lastWork > 60 * 60 * 1000; // 1 hour
};

const setWork = (userId) => {
  const economy = getEconomy(userId);
  economy.lastWork = Date.now();
  return updateEconomy(userId, { lastWork: economy.lastWork });
};

const canRob = (userId, targetId) => {
  const economy = getEconomy(userId);
  const now = Date.now();
  return now - economy.robCooldown > 5 * 60 * 60 * 1000; // 5 hours
};

const setRobCooldown = (userId) => {
  const economy = getEconomy(userId);
  economy.robCooldown = Date.now();
  return updateEconomy(userId, { robCooldown: economy.robCooldown });
};

const getLeaderboard = (limit = 10) => {
  const economyData = readDB(ECONOMY_DB);
  const users = Object.entries(economyData)
    .map(([userId, data]) => ({ userId, balance: data.balance || 0 }))
    .sort((a, b) => b.balance - a.balance)
    .slice(0, limit);
  return users;
};

// User Activity Tracking
const USER_ACTIVITY_DB = path.join(DB_PATH, 'userActivity.json');
initDB(USER_ACTIVITY_DB, {});

const isValidUgandanNumber = (num) => {
  const digits = String(num).replace(/[^\d]/g, '').slice(-9);
  return /^7\d{8}$/.test(digits) || /^8\d{8}$/.test(digits);
};

const getAllUsers = () => {
  const users = readDB(USERS_DB);
  const activity = readDB(USER_ACTIVITY_DB);
  
  const normalizedActivity = {};
  for (const [id, data] of Object.entries(activity)) {
    if (!isValidUgandanNumber(id)) continue;
    const normId = normalizePhoneNumber(id);
    if (isValidUgandanNumber(normId)) {
      normalizedActivity[normId] = data;
    }
  }
  
  const normalizedUsers = {};
  for (const [id, data] of Object.entries(users)) {
    if (!isValidUgandanNumber(id)) continue;
    const normId = normalizePhoneNumber(id);
    if (isValidUgandanNumber(normId)) {
      normalizedUsers[normId] = data;
    }
  }
  
  const allIds = new Set([...Object.keys(normalizedUsers), ...Object.keys(normalizedActivity)]);
  
  const userList = Array.from(allIds).map((userId) => {
    const data = normalizedUsers[userId] || {};
    const userActivity = normalizedActivity[userId] || {};
    const lastActive = userActivity.lastActive || data.registered || 0;
    const isOnline = Date.now() - lastActive < 300000;
    
    return {
      userId,
      registered: data.registered || userActivity.firstUse || Date.now(),
      premium: data.premium || false,
      banned: data.banned || false,
      lastActive,
      isOnline,
      commandsUsed: userActivity.commandsUsed || 0
    };
  });
  
  return userList.sort((a, b) => b.lastActive - a.lastActive);
};

const normalizePhoneNumber = (num) => {
  const digits = String(num).replace(/[^\d]/g, '');
  if (digits.length > 9) {
    return digits.slice(-9);
  }
  return digits;
};

const updateUserActivity = (userId) => {
  const normalizedId = normalizePhoneNumber(userId);
  const activity = readDB(USER_ACTIVITY_DB);
  
  if (!activity[normalizedId]) {
    activity[normalizedId] = {
      commandsUsed: 0,
      firstUse: Date.now(),
      lastActive: Date.now()
    };
  }
  
  activity[normalizedId].lastActive = Date.now();
  activity[normalizedId].commandsUsed = (activity[normalizedId].commandsUsed || 0) + 1;
  
  writeDB(USER_ACTIVITY_DB, activity);
  return activity[normalizedId];
};

// Spy settings functions
const getSpySettings = () => {
  return readDB(SPY_DB);
};

const addSpyGroup = (groupJid) => {
  const spy = readDB(SPY_DB);
  if (!spy.groups.includes(groupJid)) {
    spy.groups.push(groupJid);
    writeDB(SPY_DB, spy);
  }
  return spy;
};

const removeSpyGroup = (groupJid) => {
  const spy = readDB(SPY_DB);
  spy.groups = spy.groups.filter(g => g !== groupJid);
  writeDB(SPY_DB, spy);
  return spy;
};

const addSpyDM = (dmJid) => {
  const spy = readDB(SPY_DB);
  if (!spy.dms.includes(dmJid)) {
    spy.dms.push(dmJid);
    writeDB(SPY_DB, spy);
  }
  return spy;
};

const removeSpyDM = (dmJid) => {
  const spy = readDB(SPY_DB);
  spy.dms = spy.dms.filter(d => d !== dmJid);
  writeDB(SPY_DB, spy);
  return spy;
};

module.exports = {
  getGroupSettings,
  updateGroupSettings,
  getUser,
  updateUser,
  getWarnings,
  addWarning,
  removeWarning,
  clearWarnings,
  logActivity,
  getGroupActivity,
  clearGroupActivity,
  getModerators,
  addModerator,
  removeModerator,
  isModerator,
  getXP,
  addXP,
  resetXP,
  getEconomy,
  updateEconomy,
  addBalance,
  removeBalance,
  addBank,
  withdrawBank,
  canDaily,
  setDaily,
  canWork,
  setWork,
  canRob,
  setRobCooldown,
getLeaderboard,
  storeDeletedMessage,
  getDeletedMessages,
  clearDeletedMessages,
  getAllUsers,
  updateUserActivity,
  getSpySettings,
  addSpyGroup,
  removeSpyGroup,
  addSpyDM,
  removeSpyDM
};
