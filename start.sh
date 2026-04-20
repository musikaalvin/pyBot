pm2 restart index
pm2 kill
pm2 start index.js
pm2 logs --lines 100
