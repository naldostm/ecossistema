const fs = require('fs');
let content = fs.existsSync('v5/.env.local') ? fs.readFileSync('v5/.env.local', 'utf8') : '';
if (!content && fs.existsSync('.env')) content = fs.readFileSync('.env', 'utf8');
const lines = content.split('\n').filter(l => l.includes('DATABASE_URL'));
console.log(lines.join('\n'));
