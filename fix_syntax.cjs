const fs = require('fs');

const file = 'c:/ecossistema arnaldo trentin/frontend/js/app.js';
let app = fs.readFileSync(file, 'utf8');

const anchor = '// 99. MINICALENDAR';
const idx = app.indexOf(anchor);

if (idx > -1) {
    let top = app.substring(0, idx);
    let bottom = app.substring(idx);
    
    // Replace escaped \` with `
    bottom = bottom.replace(/\\\`/g, '`');
    
    // Replace escaped \$ with $
    bottom = bottom.replace(/\\\$/g, '$');
    
    fs.writeFileSync(file, top + bottom);
    console.log('Fix applied correctly!');
} else {
    console.log('Anchor not found');
}
