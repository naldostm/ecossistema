const fs = require('fs');
const d = JSON.parse(fs.readFileSync('conversations_dump.json', 'utf8'));

// Filtra só telefones que parecem ser clientes reais (não grupos, não nosso número)
const ourNumber = '5511947434455';
Object.entries(d).forEach(([phone, msgs]) => {
    if (phone === ourNumber) return;
    if (phone.includes('@g.us') || phone.length > 15 || phone.includes('-')) return;
    
    const allText = msgs.map(m => m.content).join('\n');
    
    // Procura por CPF/CNPJ no corpo da conversa
    const cpfMatch = allText.match(/\d{2,3}\.?\d{3}\.?\d{3}[\/\-]?\d{2,4}[\-]?\d{0,2}/);
    
    // Procura nome do cliente (a Maria confirma com "anotado" ou cita o nome)  
    const modelMsgs = msgs.filter(m => m.role === 'model').map(m => m.content).join('\n');
    const userMsgs = msgs.filter(m => m.role === 'user').map(m => m.content).join('\n');
    
    console.log(`\n=== ${phone} (${msgs.length} msgs) ===`);
    console.log('Últimas 5 msgs do cliente:');
    msgs.filter(m => m.role === 'user').slice(-5).forEach(m => {
        console.log(`  [USER] ${m.content.substring(0, 150)}`);
    });
    console.log('Últimas 3 respostas da Maria:');
    msgs.filter(m => m.role === 'model').slice(-3).forEach(m => {
        console.log(`  [MARIA] ${m.content.substring(0, 200)}`);
    });
    if (cpfMatch) console.log(`  >> CPF/CNPJ detectado: ${cpfMatch[0]}`);
});
