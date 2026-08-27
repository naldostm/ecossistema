const fs = require('fs');
const path = require('path');

const filePath = 'app.js';
const tailPath = 'rescue_tail.txt';

try {
    const original = fs.readFileSync(filePath, 'utf8');
    const tail = fs.readFileSync(tailPath, 'utf8');

    // Ponto de corte seguro
    const searchString = "alert('Formato JSON inválido. Salvando vazio.');";
    const index = original.indexOf(searchString);

    if (index === -1) {
        process.stdout.write('ERRO: searchString não encontrado!');
        process.exit(1);
    }

    const newContent = original.substring(0, index + searchString.length) + '\n' + tail;
    fs.writeFileSync(filePath, newContent, 'utf8');
    process.stdout.write('SUCESSO: app.js restaurado via script Node.js');
} catch (err) {
    process.stdout.write('ERRO FATAL: ' + err.message);
    process.exit(1);
}
