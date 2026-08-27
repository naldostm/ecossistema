const fs = require('fs');
const original = fs.readFileSync('app.js', 'utf8');
const tail = fs.readFileSync('rescue_tail_v2.txt', 'utf8');

const searchString = "alert('Formato JSON inválido. Salvando vazio.');";
const index = original.indexOf(searchString);

if (index !== -1) {
    const finalContent = original.substring(0, index + searchString.length) + '\n' + tail;
    fs.writeFileSync('app.js', finalContent, 'utf8');
    process.stdout.write('SUCESSO TOTAL: Arquivo recomposto.');
} else {
    process.stdout.write('ERRO: Ponto de busca não localizado.');
}
