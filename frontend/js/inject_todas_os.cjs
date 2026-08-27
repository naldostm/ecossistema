const fs = require('fs');
let app = fs.readFileSync('c:/ecossistema arnaldo trentin/frontend/js/app.js', 'utf8');

const anchor = 'window.renderDailyProgram();';
const idx = app.indexOf(anchor);

if (idx > -1) {
    const nextBrace = app.indexOf('}', idx);
    if (nextBrace > -1) {
        let before = app.substring(0, nextBrace + 1);
        let after = app.substring(nextBrace + 1);
        
        const injectStr = '\n            if (typeof window.renderTodasOsTable === "function") { window.renderTodasOsTable(); }';
        
        if (!app.includes('window.renderTodasOsTable();')) {
            app = before + injectStr + after;
            fs.writeFileSync('c:/ecossistema arnaldo trentin/frontend/js/app.js', app);
            console.log('Injected renderTodasOsTable successfully!');
        } else {
            console.log('Already injected!');
        }
    }
} else {
    console.log('Anchor not found!');
}
