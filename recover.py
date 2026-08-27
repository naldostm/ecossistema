import json, sys

log_path = r'C:\Users\naldo\.gemini\antigravity\brain\addb1d88-f35b-4fc1-a009-23b6dddaec2c\.system_generated\logs\overview.txt'

with open(log_path, 'r', encoding='utf-8') as f:
    text = f.read()

# Ache todas as chamadas "multi_replace_file_content" na conversa
idx = text.rfind('multi_replace_file_content')
if idx == -1:
    print('Block not found!')
    sys.exit(1)

# Encontre a chamada contendo "1725" (linhas deletadas na interface) ou TargetContent no formSuperOS
try:
    # A string do TargetContent está entre as chamadas tool... vamos varrer as chaves json "TargetContent"
    # Mas overview.txt não contém JSON perfeitamente formatado para json.loads, é dump da conversa.
    # Vamos buscar por substring exata: '"TargetContent":"            // 1. Traz Ordem de Serviço'
    
    start_str = '"TargetContent":"            // 1. Traz Ordem'
    start = text.rfind(start_str)
    if start == -1:
        start_str = r'"TargetContent":"            // 1. Traz Ordem'
        start = text.rfind(start_str)
        if start == -1:
            print("Target content string not found")
            sys.exit(1)

    end_str = '"}'
    end = text.find(end_str, start)
    
    val_str = text[start+17:end]
    
    # Eval para traduzir os escapes \n
    import ast
    content = ast.literal_eval('"' + val_str.replace('"', '\\"') + '"')
    
    with open('RECOVERED.js', 'w', encoding='utf-8') as out:
        out.write(content)
        
    print(f'Recovered {len(content)} characters!')
except Exception as e:
    print(e)
