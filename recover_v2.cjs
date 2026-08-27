const fs = require('fs');
const path = require('path');

const logPath = 'C:/Users/naldo/.gemini/antigravity/brain/addb1d88-f35b-4fc1-a009-23b6dddaec2c/.system_generated/logs/overview.txt';

try {
    const txt = fs.readFileSync(logPath, 'utf8');
    
    // Procura block
    // A string única no código deletado que inicia o diff era:
    // "TargetContent":"            // 1. Traz Ordem de Serviço (Aprimorado com Obras e Pagamento V5)\n            const { data: ordens, error: errOrdens } = await supabase"
    
    const searchString = '"TargetContent":"            // 1. Traz Ordem de Serviço';
    const lastIdx = txt.lastIndexOf(searchString);
    
    if (lastIdx > -1) {
        console.log('Block encontrado!');
        const start = lastIdx + 17; // Pular "TargetContent":"
        
        let end = txt.indexOf('","StartLine"', start);
        if (end === -1) end = txt.indexOf('","TargetFile"', start);
        if (end === -1) end = txt.indexOf('"}', start);
        
        if (end > start) {
            let extracted = txt.substring(start, end);
            console.log('Tamanho extraído:', extracted.length);
            
            // Decodificar JSON escape
            extracted = extracted.replace(/\\n/g, '\n')
                                 .replace(/\\r/g, '\r')
                                 .replace(/\\"/g, '"')
                                 .replace(/\\\\/g, '\\');
                                 
            const outFile = 'C:/ecossistema arnaldo trentin/frontend/js/recovered_chunk.js';
            fs.writeFileSync(outFile, extracted, 'utf8');
            console.log('Salvo com sucesso no chunk!');
        } else {
            console.log('Fim não encontrado.');
        }
    } else {
        console.log('Bloco TargetContent não encontrado.');
        // Vamos checar tudo que termina com `// 1. Traz Ordem de Serviço`
        const idxAlt = txt.lastIndexOf('// 1. Traz Ordem de Serviço');
        console.log('Existe esse texto no log? Index:', idxAlt);
    }
} catch (e) {
    console.error('Erro na extração:', e.message);
}
