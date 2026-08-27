const fs = require('fs');
let app = fs.readFileSync('c:/ecossistema arnaldo trentin/frontend/js/app.js', 'utf8');

const oldCode = `if (typeof window.renderTechAgenda === 'function') {
                window.renderTechAgenda();        
            }`;

const newCode = `if (typeof window.renderTechAgenda === 'function') {
                window.renderTechAgenda();        
            }
            if (typeof window.renderDualCalendar === 'function') {
                window.renderDualCalendar();
                window.renderDailyProgram();
            }`;

if (app.includes(oldCode)) {
    app = app.replace(oldCode, newCode);
    fs.writeFileSync('c:/ecossistema arnaldo trentin/frontend/js/app.js', app);
    console.log('Injected safely!');
} else {
    console.log('Old code not found EXACTLY. Trying fallback...');
    // Fallback: search for renderTechAgenda(); and append if not already there
    const idx = app.indexOf('window.renderTechAgenda();');
    if (idx > -1) {
        if (!app.includes('window.renderDualCalendar();')) {
            const before = app.substring(0, idx + 26);
            const after = app.substring(idx + 26);
            app = before + '\n            if(typeof window.renderDualCalendar==="function"){ window.renderDualCalendar(); window.renderDailyProgram(); }' + after;
            fs.writeFileSync('c:/ecossistema arnaldo trentin/frontend/js/app.js', app);
            console.log('Injected via fallback!');
        } else {
            console.log('Calls already exist!');
        }
    } else {
        console.log('Could not find renderTechAgenda call manually');
    }
}
