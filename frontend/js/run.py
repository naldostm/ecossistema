lines = []
with open('app.js', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        if 'form-ferramenta' in line or 'saveToDatabase' in line or 'openModal' in line:
            lines.append(f"{i+1}: {line.strip()}")

with open('debug_forms.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
