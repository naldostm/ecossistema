    // ==========================================
    // 99. MINICALENDAR (CHRONOS) E PROGRAMACAO
    // ==========================================
    window.chronosDate = new Date();

    function getOsStatusColor(status) {
        if (!status) return 'var(--text-muted)';
        const lw = status.toLowerCase();
        if (lw.includes('aberto')) return '#F44336';
        if (lw.includes('em campo') || lw.includes('deslocamento')) return '#FF9800';
        if (lw.includes('validado') || lw.includes('finalizado')) return '#4CAF50';
        if (lw.includes('cancelado') || lw.includes('faturamento')) return '#9E9E9E';
        return 'var(--accent-blue)';
    }

    window.renderDailyProgram = function() {
        const dToday = document.querySelector('#group-today .os-group-list');
        const dTomorrow = document.querySelector('#group-tomorrow .os-group-list');
        const dUpcoming = document.querySelector('#group-upcoming .os-group-list');
        if (!dToday || !dTomorrow || !dUpcoming) return;

        dToday.innerHTML = '';
        dTomorrow.innerHTML = '';
        dUpcoming.innerHTML = '';

        const ordens = (window.ordensCache || []).filter(o => {
            const st = (o.status_ia || '').toLowerCase();
            return !st.includes('cancelado') && !st.includes('finalizado') && !st.includes('faturamento');
        });

        const today = new Date();
        today.setHours(0,0,0,0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const limitUpcoming = new Date(today);
        limitUpcoming.setDate(limitUpcoming.getDate() + 7);

        let cToday = 0, cTomorrow = 0, cUpcoming = 0;

        ordens.forEach(os => {
            if (!os.data_hora) return;
            const osDate = new Date(os.data_hora);
            const osD = new Date(osDate);
            osD.setHours(0,0,0,0);

            const stColor = getOsStatusColor(os.status_ia);
            const hourStr = osDate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            
            const cardHtml = \`
                <div class="agenda-card-mini" style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid \${stColor}; cursor: pointer; display:flex; flex-direction:column; gap:6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;" onclick="window.openSuperOS('\${os.id_os}')">
                    <div style="display:flex; justify-content: space-between; align-items:flex-start;">
                        <span style="font-size:0.75rem; color:var(--text-muted); font-family:monospace;">OS-\${String(os.id_os).padStart(4, '0')}</span>
                        <span style="font-size:0.75rem; color:\${stColor}; font-weight:800; background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px;">\${hourStr} \${os.status_ia || 'N/A'}</span>
                    </div>
                    <div style="font-size:0.85rem; font-weight:600; color:var(--text-primary); line-height: 1.2;">
                        \${os.servico_tipo || 'Sem Descrição'}
                    </div>
                    \${os.clientes ? \`<div style="font-size:0.75rem; color:var(--accent-orange);"><i class="fa-solid fa-user"></i> \${os.clientes.nome_cliente.split(' ')[0]}</div>\` : ''}
                </div>\`;

            if (osD.getTime() === today.getTime()) {
                dToday.innerHTML += cardHtml;
                cToday++;
            } else if (osD.getTime() === tomorrow.getTime()) {
                dTomorrow.innerHTML += cardHtml;
                cTomorrow++;
            } else if (osD.getTime() > tomorrow.getTime() && osD.getTime() <= limitUpcoming.getTime()) {
                dUpcoming.innerHTML += cardHtml;
                cUpcoming++;
            }
        });

        if(cToday === 0) dToday.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding: 10px;">Livre</div>';
        if(cTomorrow === 0) dTomorrow.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding: 10px;">Livre</div>';
        if(cUpcoming === 0) dUpcoming.innerHTML = '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding: 10px;">Nenhum agendamento</div>';
    };

    function renderCalGrid(dateObj, gridId, titleId) {
        const grid = document.getElementById(gridId);
        const title = document.getElementById(titleId);
        const tooltip = document.getElementById('os-tooltip');
        if (!grid || !title) return;

        const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
        const year = dateObj.getFullYear();
        title.innerHTML = monthName.charAt(0).toUpperCase() + monthName.slice(1) + ' ' + year;

        const firstDay = new Date(year, dateObj.getMonth(), 1).getDay();
        const daysInMonth = new Date(year, dateObj.getMonth() + 1, 0).getDate();

        const ordens = window.ordensCache || [];
        const monthFilter = ordens.filter(o => {
            if(!o.data_hora) return false;
            const d = new Date(o.data_hora);
            return d.getFullYear() === year && d.getMonth() === dateObj.getMonth();
        });

        let html = '';
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="cal-day empty"></div>';
        }

        const today = new Date();
        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = (today.getDate() === d && today.getMonth() === dateObj.getMonth() && today.getFullYear() === year);
            const classToday = isToday ? 'cal-day-today' : '';

            // Find OSs for this specific day
            const osForDay = monthFilter.filter(o => new Date(o.data_hora).getDate() === d);
            
            let dotsHtml = '';
            let tooltext = '';
            if (osForDay.length > 0) {
                dotsHtml = '<div class="cal-dots" style="display:flex; gap:2px; justify-content:center; margin-top:2px;">';
                osForDay.forEach(o => {
                    const cl = getOsStatusColor(o.status_ia);
                    dotsHtml += \`<div style="width:5px; height:5px; border-radius:50%; background:\${cl};"></div>\`;
                    const hh = new Date(o.data_hora).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
                    tooltext += \`\${hh} - OS-\${String(o.id_os).padStart(4,'0')} - \${o.status_ia}<br>\`;
                });
                dotsHtml += '</div>';
            }

            html += \`<div class="cal-day \${classToday}" data-tooltip="\${tooltext}">\${d}\${dotsHtml}</div>\`;
        }
        grid.innerHTML = html;

        grid.querySelectorAll('.cal-day').forEach(el => {
            el.addEventListener('mouseenter', e => {
                const tt = e.target.getAttribute('data-tooltip');
                if(tt && tooltip) {
                    tooltip.innerHTML = tt;
                    tooltip.style.display = 'block';
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                }
            });
            el.addEventListener('mouseleave', () => {
                if(tooltip) tooltip.style.display = 'none';
            });
            el.addEventListener('mousemove', e => {
                if(tooltip && tooltip.style.display === 'block') {
                    tooltip.style.left = e.pageX + 10 + 'px';
                    tooltip.style.top = e.pageY + 10 + 'px';
                }
            });
        });
    }

    window.renderDualCalendar = function() {
        const cur = window.chronosDate;
        const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        renderCalGrid(cur, 'calendar-grid-current', 'cal-title-current');
        renderCalGrid(next, 'calendar-grid-next', 'cal-title-next');
    };

    document.getElementById('prev-month')?.addEventListener('click', () => {
        window.chronosDate.setMonth(window.chronosDate.getMonth() - 1);
        window.renderDualCalendar();
    });
    document.getElementById('next-month')?.addEventListener('click', () => {
        window.chronosDate.setMonth(window.chronosDate.getMonth() + 1);
        window.renderDualCalendar();
    });
