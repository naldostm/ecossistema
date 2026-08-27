const { checkSyntax } = require('node:internal/main/check_syntax');
const fs = require('fs');
const content = fs.readFileSync('app.js', 'utf8');
try {
    new Function(content);
    console.log('SYNTAX OK');
} catch (e) {
    console.log('SYNTAX ERROR:', e.message);
    console.log('AT LINE:', e.lineNumber || 'unknown');
}
