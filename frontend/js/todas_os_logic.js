// ==========================================
// 100. PÁGINA "TODAS AS OS" (CONTROLE GERAL)
// ==========================================
window.renderTodasOsTable = function() {
    const tbody = document.querySelector('#table-todas-os tbody');
    if (!tbody) return;

    // Criar cópia reversa do cache (Mais recentes primeiro)
    const ordens = [...(window.ordensCache || [])].sort((a,b) => b.id_os - a.id_os);
    
    if (ordens.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhuma Ordem de Serviço encontrada.</td></tr>';
        return;
    }

    let html = '';
    ordens.forEach(os => {
        // Obter Cliente Principal
        const nmCliente = os.clientes ? os.clientes.nome_cliente : '<span style="color:#666;">Cliente não vinculado</span>';
        
        // Obter Técnico
        const nmTecnico = os.tecnicos ? os.tecnicos.nome_completo : 'Sem atribuição';

        // Cores de Status
        let stColor = 'var(--text-muted)';
        const lw = (os.status_ia || '').toLowerCase();
        if (lw.includes('aberto')) stColor = '#F44336';
        if (lw.includes('em campo') || lw.includes('deslocamento')) stColor = '#FF9800';
        if (lw.includes('validado') || lw.includes('finalizado')) stColor = '#4CAF50';
        if (lw.includes('faturamento') || lw.includes('cancelado')) stColor = '#9E9E9E';

        // Formatação da Data de Agendamento
        let dtStr = 'Sem Agendamento';
        if (os.data_hora) {
            const dt = new Date(os.data_hora);
            dtStr = dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        }

        html += `
        <tr>
            <td><strong style="color:var(--text-primary);">OS-${String(os.id_os).padStart(4, '0')}</strong></td>
            <td><span style="font-size: 0.85rem; background:rgba(255,255,255,0.05); padding: 4px 8px; border-radius:4px;"><i class="fa-solid fa-clock"></i> ${dtStr}</span></td>
            <td>
                <div style="font-weight: 800; color: var(--accent-orange); margin-bottom: 2px;">${nmCliente}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${os.servico_tipo || 'Nenhum serviço mapeado'}</div>
            </td>
            <td><div class="tech-tag" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px;"><i class="fa-solid fa-user-helmet-safety"></i> ${nmTecnico}</div></td>
            <td><span class="status-badge" style="background: ${stColor}20; color: ${stColor}; border: 1px solid ${stColor}; padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight:800; text-transform: uppercase;">${os.status_ia || 'ABERTO'}</span></td>
            <td>
                <button class="action-btn" onclick="window.openSuperOS('${os.id_os}')" title="Inspecionar OS"><i class="fa-solid fa-eye"></i></button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html;
};
