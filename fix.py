import sys
file_path = r'C:\ecossistema arnaldo trentin\frontend\index.html'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if 'id="eq-serial"' in line:
        start_idx = i - 1
    if 'id="eq-fotos"' in line:
        end_idx = i

if start_idx != -1 and end_idx != -1:
    replacement = """                        <label>Número de Série / Controle</label>
                        <input type="text" id="eq-serial" class="modal-input" placeholder="Deixe vazio para gerar automático (AT-...)">
                    </div>
                    <div class="input-group" style="flex: 1;">
                        <label>QR Code / TAG Física</label>
                        <input type="text" id="eq-tag" class="modal-input" placeholder="Tag ID">
                    </div>
                </div>

                <div class="form-row" style="display: flex; gap: 15px; margin-top: 10px;">
                    <div class="input-group" style="flex: 1;">
                        <label>Data de Instalação</label>
                        <input type="date" id="eq-data-inst" class="modal-input">
                    </div>
                    <div class="input-group" style="flex: 1;">
                        <label>Última Preventiva (Manual)</label>
                        <input type="date" id="eq-data-prev" class="modal-input">
                    </div>
                </div>

                <div class="input-group" style="margin-top: 10px;">
                    <label>Status Operacional</label>
                    <select id="eq-status" class="auth-select">
                        <option value="Em Operação">Em Operação</option>
                        <option value="Em Manutenção">Em Manutenção</option>
                        <option value="Condenado">Condenado</option>
                        <option value="Desativado">Desativado</option>
                    </select>
                </div>

                <div class="input-group" style="margin-top: 10px;">
                    <label><i class="fa-solid fa-camera"></i> Fotos do Equipamento</label>
                    <input type="file" id="eq-fotos" class="modal-input" multiple accept="image/*" style="padding: 10px; background: rgba(255,255,255,0.05); cursor: pointer;">\n"""
    lines[start_idx:end_idx+1] = [replacement]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print('Script aplicado com sucesso!')
else:
    print('Indices não encontrados!')
