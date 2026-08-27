const fs = require('fs');
const content = fs.readFileSync('index.html');
let str = content.toString('utf8');
if (str.charCodeAt(0) === 0xFEFF) str = str.substring(1);
fs.writeFileSync('index.html', str, 'utf8');
