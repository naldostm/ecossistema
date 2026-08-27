const fs = require('fs');

const logPath = 'C:/Users/naldo/.gemini/antigravity/brain/addb1d88-f35b-4fc1-a009-23b6dddaec2c/.system_generated/logs/overview.txt';

if (fs.existsSync(logPath)) {
    console.log('Log exists, reading...');
    const txt = fs.readFileSync(logPath, 'utf8');
    
    // Procura o último bloco do multi_replace_file_content e o respectivo TargetContent
    const identifier = '"TargetContent":"            // 1. Traz Ordem';
    const lastIdx = txt.lastIndexOf(identifier);
    
    if (lastIdx !== -1) {
        console.log('Found block!');
        const start = lastIdx + 17; // Pula "TargetContent":"
        const endIndicator = '","StartLine"';
        let end = txt.indexOf(endIndicator, start);
        if(end === -1) {
             end = txt.indexOf('"}', start);
        }
        
        let content = txt.substring(start, end);
        console.log('Raw content size:', content.length);
        
        // Fix string escape characters JSON encoded inside log
        content = content.replace(/\\n/g, '\n').replace(/\\"/g, '"');
        
        fs.writeFileSync('C:/ecossistema arnaldo trentin/frontend/js/app.js.recovered', content);
        console.log('RECOVERED OK! Length:', content.length);
    } else {
        console.log('Target block not found!');
        
        // Fallback: search just for "TargetContent" and log surrounding text
        const tIdx = txt.lastIndexOf('TargetContent');
        if (tIdx > -1) console.log(txt.substring(tIdx - 50, tIdx + 100));
    }
} else {
    console.error('File not found:', logPath);
}
