// Archivo de funciones compartidas que se cargan en todas las páginas

// Muestra mensajes emergentes en vez de los alert() del navegador
function showToast(message, type = 'info', duration = 4000) {
    let container = document.getElementById('sm-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'sm-toast-container';
        document.body.appendChild(container);
    }
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle',
        export: 'fa-download',
        upload: 'fa-cloud-upload-alt',
        ai: 'fa-robot',
        delete: 'fa-trash'
    };
    const toast = document.createElement('div');
    toast.className = `sm-toast sm-toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info} sm-toast-icon"></i>
        <span class="sm-toast-msg">${message}</span>
        <button class="sm-toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('sm-toast-show'));
    setTimeout(() => {
        toast.classList.remove('sm-toast-show');
        setTimeout(() => toast.remove(), 350);
    }, duration);
}
window.showToast = showToast;

// Gestiona las notificaciones de la campanita (guardar, mostrar, borrar)
const notifService = {
    _key: 'sm_notifications',

    add(message, type = 'info') {
        const all = this.getAll();
        all.unshift({ id: Date.now(), message, type, time: new Date().toISOString(), read: false });
        if (all.length > 50) all.pop();
        localStorage.setItem(this._key, JSON.stringify(all));
        this._updateBadge();
        this._renderPanel();
    },

    getAll() {
        try { return JSON.parse(localStorage.getItem(this._key) || '[]'); } catch { return []; }
    },

    getUnreadCount() { return this.getAll().filter(n => !n.read).length; },

    markAllRead() {
        localStorage.setItem(this._key, JSON.stringify(this.getAll().map(n => ({ ...n, read: true }))));
        this._updateBadge();
        this._renderPanel();
    },

    clear() {
        localStorage.removeItem(this._key);
        this._updateBadge();
        this._renderPanel();
    },

    _updateBadge() {
        const badge = document.getElementById('bell-badge');
        if (!badge) return;
        const count = this.getUnreadCount();
        badge.style.display = count > 0 ? 'flex' : 'none';
    },

    _renderPanel() {
        const body = document.getElementById('bell-panel-body');
        if (!body) return;
        const all = this.getAll();
        if (all.length === 0) {
            body.innerHTML = `<div class="bell-empty"><i class="fas fa-bell-slash"></i><p>Sin notificaciones</p></div>`;
            return;
        }
        const ICONS = {
            success: 'fa-check-circle', error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle', info: 'fa-info-circle',
            upload: 'fa-cloud-upload-alt', export: 'fa-download',
            ai: 'fa-robot', delete: 'fa-trash',
            rename: 'fa-edit'
        };
        const COLORS = {
            success: 'var(--green)', error: 'var(--red)',
            warning: 'var(--amber)', info: 'var(--accent-light)',
            upload: 'var(--blue)', export: 'var(--green)',
            ai: 'var(--accent-light)', delete: 'var(--red)',
            rename: 'var(--amber)'
        };
        body.innerHTML = all.map(n => {
            const d = new Date(n.time);
            const t = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                + ' · ' + d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
            return `<div class="bell-notif ${n.read ? '' : 'bell-notif-unread'}">
                <i class="fas ${ICONS[n.type] || ICONS.info}" style="color:${COLORS[n.type] || COLORS.info};font-size:14px;flex-shrink:0;margin-top:2px;"></i>
                <div style="flex:1;min-width:0;">
                    <div class="bell-notif-msg">${n.message}</div>
                    <div class="bell-notif-time">${t}</div>
                </div>
            </div>`;
        }).join('');
    }
};
window.notifService = notifService;

// Genera y descarga un informe con los datos del análisis en el formato elegido (html / pdf / excel)
async function exportReport(format = 'html') {
    // Cerrar el menú desplegable si está abierto
    const exportMenuEl = document.getElementById('export-menu');
    if (exportMenuEl) exportMenuEl.style.display = 'none';

    const data = await window.appStorage.getCurrentAnalysis();
    if (!data) {
        showToast('No hay datos para exportar. Sube un dataset primero.', 'warning');
        return;
    }

    const segCounts = {};
    (data.rfm_segments || []).forEach(r => {
        const s = r.Segment_Label || 'Unknown';
        segCounts[s] = (segCounts[s] || 0) + 1;
    });
    const totalSeg = Object.values(segCounts).reduce((a, b) => a + b, 0) || 1;
    const highChurn = (data.rfm_segments || []).filter(r => parseFloat(r.Churn_Probability || 0) > 0.5).length;
    const churnRate = ((highChurn / totalSeg) * 100).toFixed(1);

    const fmtVal = v => {
        const n = parseFloat(v);
        if (isNaN(n)) return v || '—';
        if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
        return n.toLocaleString();
    };

    // Exportación Excel gestionada por función separada
    if (format === 'excel') {
        await exportToExcel(data, segCounts, totalSeg);
        return;
    }

    showToast('Generando informe con IA...', 'ai', 5000);

    // Llamada a Mistral AI para generar el contenido estratégico del informe
    let aiSummaryHTML = '';
    let mistralRawText = '';
    try {
        const apiKey = localStorage.getItem('mistral_api_key') || 'N6FmFC6LJS7P66UAPOxJYnPmjEmy38fZ';
        if (apiKey) {
            const contextSummary = `Dataset: ${data.filename}, ${data.rows} registros, ${totalSeg} clientes únicos. Tasa de abandono: ${churnRate}%. Segmentos: ${Object.entries(segCounts).map(([s, n]) => `${s}: ${n} (${((n / totalSeg) * 100).toFixed(1)}%)`).join(', ')}. KPIs: ${Object.entries(data.kpis || {}).slice(0, 5).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(', ')}.`;
            const resp = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'mistral-small-latest',
                    messages: [{ role: 'user', content: `Eres un consultor experto en retail y supermercados. Analiza estos datos reales y genera recomendaciones estratégicas en español: máximo 5 puntos concisos, accionables y específicos basados en los datos proporcionados. Sin emojis, formato profesional:\n\n${contextSummary}` }],
                    max_tokens: 600
                })
            });
            if (resp.ok) {
                const rd = await resp.json();
                const summaryText = rd.choices?.[0]?.message?.content || '';
                if (summaryText) {
                    mistralRawText = summaryText.trim();
                    aiSummaryHTML = `<div style="background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(79,70,229,0.05));border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:22px 26px;margin-top:20px;"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><div style="width:28px;height:28px;background:#6366f1;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.09-3.43A3 3 0 0 1 2 13V9a3 3 0 0 1 3-3h.5A2.5 2.5 0 0 1 8 4.5V4a2 2 0 0 1 1.5-2ZM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.09-3.43A3 3 0 0 0 22 13V9a3 3 0 0 0-3-3h-.5A2.5 2.5 0 0 0 16 4.5V4a2 2 0 0 0-1.5-2Z" fill="white"/></svg></div><div><div style="font-size:13px;font-weight:700;color:#6366f1;">Análisis generado por Mistral AI</div><div style="font-size:11px;color:#9ca3af;margin-top:1px;">Recomendaciones estratégicas basadas en tus datos reales</div></div></div><div style="font-size:13px;line-height:1.9;color:#374151;white-space:pre-wrap;">${mistralRawText}</div></div>`;
                }
            }
        }
    } catch(e) {
        console.warn('Mistral AI summary failed (silently):', e);
    }

    const kpiRows = Object.entries(data.kpis || {}).map(([k, v]) =>
        `<tr><td>${k.replace(/_/g, ' ')}</td><td><strong>${fmtVal(v)}</strong></td></tr>`
    ).join('');

    const SEG_COLORS = { 'Champions': '#10b981', 'Promising': '#3b82f6', 'At Risk': '#f59e0b', 'Hibernating': '#ef4444' };
    const segRows = Object.entries(segCounts).map(([seg, cnt]) =>
        `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${SEG_COLORS[seg] || '#888'};margin-right:8px;vertical-align:middle;"></span>${seg}</td><td>${cnt.toLocaleString()}</td><td>${((cnt / totalSeg) * 100).toFixed(1)}%</td></tr>`
    ).join('');

    const churnRows = (data.top_churn_risk || []).slice(0, 10).map(r => {
        const p = parseFloat(r.Churn_Probability || 0);
        const col = p > 0.6 ? '#ef4444' : p > 0.3 ? '#f59e0b' : '#10b981';
        return `<tr><td>${r.customer_id}</td><td>${r.Recency}</td><td>${r.Frequency}</td><td>$${parseFloat(r.Monetary || 0).toFixed(2)}</td><td style="color:${col};font-weight:600;">${(p * 100).toFixed(1)}%</td><td>${r.Segment_Label || '—'}</td></tr>`;
    }).join('');

    const catRows = (data.categories || []).map(c => {
        const s = parseFloat(c.total_sales || 0), pr = parseFloat(c.profit || 0);
        return `<tr><td>${c.product_category || 'N/A'}</td><td>${fmtVal(s)}</td><td style="color:${pr < 0 ? '#ef4444' : '#10b981'}">${fmtVal(pr)}</td></tr>`;
    }).join('');

    // Lista de recomendaciones según los datos del análisis (para export HTML)
    const recs = [];
    if (highChurn / totalSeg > 0.3) recs.push('<strong>Alta tasa de abandono:</strong> Más del 30% de clientes está en riesgo de churn. Implementa campañas de reactivación urgentes con descuentos personalizados.');
    if ((segCounts['Champions'] || 0) / totalSeg < 0.2) recs.push('<strong>Potencia a tus Champions:</strong> Menos del 20% son clientes top. Crea programas de fidelización exclusivos (acceso anticipado, ofertas VIP) para retenerlos.');
    if ((segCounts['Hibernating'] || 0) / totalSeg > 0.25) recs.push('<strong>Clientes dormidos:</strong> El segmento Hibernating supera el 25%. Lanza una campaña de win-back con incentivos atractivos antes de perderlos definitivamente.');
    if ((segCounts['At Risk'] || 0) / totalSeg > 0.2) recs.push('<strong>Riesgo medio elevado:</strong> El segmento "At Risk" supera el 20%. Actúa rápido con descuentos personalizados antes de que migren a Hibernating.');
    if ((segCounts['Promising'] || 0) / totalSeg > 0.3) recs.push('<strong>Nurturing de Promising:</strong> Tienes una base sólida de clientes "Promising". Aumenta su frecuencia de compra con cross-selling y bundles estratégicos.');
    recs.push('<strong>Monitoreo continuo:</strong> Analiza la evolución RFM mensualmente para detectar cambios de comportamiento temprano y ajustar estrategias.');
    recs.push('<strong>AI Advisor:</strong> Usa el módulo AI Advisor de la plataforma para recomendaciones específicas y personalizadas basadas en tu dataset.');

    // Cargar marked.js para renderizar el markdown de Mistral de forma elegante
    await new Promise(resolve => {
        if (window.marked) { resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
        s.onload = resolve;
        s.onerror = resolve; // fallo silencioso
        document.head.appendChild(s);
    });

    // Si Mistral respondió, sus recomendaciones sustituyen a las estáticas en todos los formatos
    // Si no hay respuesta de IA, se usan las recomendaciones de análisis estático como respaldo
    let recsHTML;
    if (mistralRawText) {
        const parsedMD = window.marked ? window.marked.parse(mistralRawText) : `<p style="white-space:pre-wrap;">${mistralRawText}</p>`;
        recsHTML = `<div class="ai-recs-wrap"><div class="ai-recs-header"><div class="ai-recs-badge"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.09-3.43A3 3 0 0 1 2 13V9a3 3 0 0 1 3-3h.5A2.5 2.5 0 0 1 8 4.5V4a2 2 0 0 1 1.5-2ZM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.09-3.43A3 3 0 0 0 22 13V9a3 3 0 0 0-3-3h-.5A2.5 2.5 0 0 0 16 4.5V4a2 2 0 0 0-1.5-2Z" fill="white"/></svg></div><div><div class="ai-recs-title">Análisis Estratégico — Mistral AI</div><div class="ai-recs-sub">Recomendaciones personalizadas generadas a partir de los datos reales del informe</div></div></div><div class="ai-recs-body">${parsedMD}</div></div>`;
    } else {
        recsHTML = recs.map(r => `<div class="rec">${r}</div>`).join('');
    }

    const now = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Informe — ${data.filename}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a2e;background:#f8f9fa;font-size:14px;}
.cover{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);color:white;padding:60px 80px;page-break-after:avoid;}
.cover h1{font-size:38px;font-weight:800;margin-bottom:8px;letter-spacing:-0.5px;}
.cover .sub{font-size:15px;opacity:0.65;margin-bottom:40px;}
.cover .meta{display:flex;gap:48px;flex-wrap:wrap;}
.cover .mi strong{display:block;font-size:28px;font-weight:800;margin-bottom:2px;}
.cover .mi span{font-size:12px;opacity:0.7;text-transform:uppercase;letter-spacing:1px;}
.container{max-width:940px;margin:0 auto;padding:48px 32px;}
.section{margin-bottom:44px;}
.section-title{font-size:17px;font-weight:700;color:#1a1a2e;border-left:4px solid #6366f1;padding-left:14px;margin-bottom:20px;}
table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07);}
th{background:#f1f2f6;padding:12px 18px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#6b7280;}
td{padding:12px 18px;font-size:13px;border-bottom:1px solid #f3f4f6;}
tr:last-child td{border-bottom:none;}
tr:hover td{background:#fafafa;}
.rec{background:white;border-radius:12px;padding:18px 22px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);font-size:14px;line-height:1.7;border-left:4px solid #6366f1;}
.footer{text-align:center;color:#9ca3af;font-size:12px;padding:32px 20px;border-top:1px solid #e5e7eb;margin-top:20px;}
/* Estilos para recomendaciones generadas por Mistral AI */
.ai-recs-wrap{background:linear-gradient(135deg,#f8f7ff 0%,#f0f0ff 100%);border:1px solid rgba(99,102,241,0.2);border-radius:14px;padding:28px 32px;overflow:hidden;}
.ai-recs-header{display:flex;align-items:flex-start;gap:12px;margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid rgba(99,102,241,0.15);}
.ai-recs-badge{width:30px;height:30px;background:linear-gradient(135deg,#6366f1,#4f46e5);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
.ai-recs-title{font-size:14px;font-weight:700;color:#4338ca;}
.ai-recs-sub{font-size:11px;color:#6b7280;margin-top:3px;}
.ai-recs-body ol{list-style:none;padding:0;margin:0;counter-reset:ai-item;}
.ai-recs-body ol>li{counter-increment:ai-item;position:relative;padding:16px 20px 16px 56px;background:white;border-radius:10px;margin-bottom:10px;box-shadow:0 2px 10px rgba(99,102,241,0.08);border-left:3px solid #6366f1;}
.ai-recs-body ol>li::before{content:counter(ai-item);position:absolute;left:16px;top:16px;width:22px;height:22px;background:#6366f1;color:white;border-radius:50%;font-size:11px;font-weight:800;text-align:center;line-height:22px;}
.ai-recs-body ol>li p{margin:0;font-size:13.5px;line-height:1.7;color:#374151;}
.ai-recs-body ol>li p strong:first-child{display:block;font-size:14px;font-weight:700;color:#1e2030;margin-bottom:8px;}
.ai-recs-body ol>li ul{list-style:none;padding:0;margin:8px 0 0 0;}
.ai-recs-body ol>li ul>li{padding-left:16px;position:relative;color:#4b5563;font-size:13px;margin-bottom:5px;line-height:1.65;}
.ai-recs-body ol>li ul>li::before{content:"–";position:absolute;left:0;color:#6366f1;font-weight:700;}
.ai-recs-body p{font-size:13.5px;line-height:1.75;color:#374151;margin-bottom:8px;}
.ai-recs-body strong{color:#3730a3;font-weight:700;}
.ai-recs-body em{color:#6366f1;font-style:normal;font-weight:600;}
@media print{body{background:white;}.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.ai-recs-wrap{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style>
</head>
<body>
<div class="cover">
  <h1>Informe de Análisis</h1>
  <div class="sub">${data.filename} &nbsp;·&nbsp; Generado el ${now}</div>
  <div class="meta">
    <div class="mi"><strong>${(data.rows || 0).toLocaleString()}</strong><span>Registros</span></div>
    <div class="mi"><strong>${totalSeg.toLocaleString()}</strong><span>Clientes únicos</span></div>
    <div class="mi"><strong>${churnRate}%</strong><span>Tasa churn</span></div>
    <div class="mi"><strong>${Object.keys(segCounts).length}</strong><span>Segmentos</span></div>
  </div>
</div>
<div class="container">
  <div class="section">
    <div class="section-title">Métricas Clave (KPIs)</div>
    <table><thead><tr><th>Indicador</th><th>Valor</th></tr></thead><tbody>${kpiRows}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Distribución de Segmentos RFM</div>
    <table><thead><tr><th>Segmento</th><th>Clientes</th><th>% del Total</th></tr></thead><tbody>${segRows}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Top 10 Clientes con Mayor Riesgo de Abandono</div>
    <table><thead><tr><th>Cliente</th><th>Recencia (días)</th><th>Frecuencia</th><th>Valor</th><th>Riesgo Churn</th><th>Segmento</th></tr></thead><tbody>${churnRows}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Análisis por Categoría</div>
    <table><thead><tr><th>Categoría</th><th>Ventas</th><th>Beneficio</th></tr></thead><tbody>${catRows}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Recomendaciones Estratégicas</div>
    ${recsHTML}
  </div>
</div>
<div class="footer">Generado por <strong>ShopMetrics AI</strong> &nbsp;·&nbsp; ${now}${format === 'pdf' ? '' : '<br><small>Abre este archivo en el navegador y usa Ctrl+P para guardar como PDF</small>'}</div>
</body></html>`;

    if (format === 'pdf') {
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            win.onload = () => { setTimeout(() => win.print(), 600); };
        }
        notifService.add('Informe PDF abierto para imprimir', 'export');
        showToast('En el diálogo de impresión selecciona "Guardar como PDF"', 'info', 6000);
    } else {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `informe_${(data.filename || 'reporte').replace('.csv', '')}.html`;
        a.click();
        URL.revokeObjectURL(url);
        notifService.add('Informe HTML exportado correctamente', 'export');
        showToast('Informe descargado. Ábrelo en el navegador para imprimir como PDF.', 'success', 5000);
    }
}
window.exportReport = exportReport;

// Exporta los datos del análisis a un archivo Excel con múltiples hojas
async function exportToExcel(data, segCounts, totalSeg) {
    showToast('Generando Excel...', 'export', 3000);
    try {
        // Cargamos SheetJS dinámicamente si no está disponible
        await new Promise((resolve, reject) => {
            if (window.XLSX) { resolve(); return; }
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });

        const wb = XLSX.utils.book_new();

        // Hoja 1: KPIs
        const kpiData = [['Indicador', 'Valor'], ...Object.entries(data.kpis || {}).map(([k, v]) => [k.replace(/_/g, ' '), v])];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiData), 'KPIs');

        // Hoja 2: Segmentos RFM
        const segData = [['Segmento', 'Clientes', '% Total'], ...Object.entries(segCounts).map(([s, n]) => [s, n, ((n / totalSeg) * 100).toFixed(1) + '%'])];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(segData), 'Segmentos RFM');

        // Hoja 3: Riesgo de Churn
        const churnHeaders = ['Cliente ID', 'Recencia', 'Frecuencia', 'Valor Monetario', 'Riesgo Churn %', 'Segmento'];
        const churnData = [churnHeaders, ...(data.top_churn_risk || []).map(r => [
            r.customer_id, r.Recency, r.Frequency,
            parseFloat(r.Monetary || 0).toFixed(2),
            (parseFloat(r.Churn_Probability || 0) * 100).toFixed(1) + '%',
            r.Segment_Label || '—'
        ])];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(churnData), 'Riesgo Churn');

        // Hoja 4: Categorías
        const catHeaders = ['Categoría', 'Ventas Totales', 'Beneficio'];
        const catData = [catHeaders, ...(data.categories || []).map(c => [
            c.product_category || 'N/A',
            parseFloat(c.total_sales || 0).toFixed(2),
            parseFloat(c.profit || 0).toFixed(2)
        ])];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catData), 'Categorías');

        // Hoja 5: Inventario (si hay datos)
        if (data.inventory && data.inventory.length > 0) {
            const invHeaders = ['Producto', 'Categoría', 'Ventas', 'Margen %', 'Pedidos', 'Estado'];
            const invData = [invHeaders, ...data.inventory.map(i => [
                i.product_name, i.product_category,
                parseFloat(i.total_sales || 0).toFixed(2),
                i.margin_pct, i.order_count, i.status
            ])];
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(invData), 'Inventario');
        }

        XLSX.writeFile(wb, `shopmetrics_${(data.filename || 'datos').replace('.csv', '')}.xlsx`);
        notifService.add('Excel exportado correctamente', 'export');
        showToast('Excel descargado correctamente', 'success', 4000);
    } catch(e) {
        console.error('Excel export error:', e);
        showToast('Error al generar el Excel: ' + e.message, 'error');
    }
}
window.exportToExcel = exportToExcel;

// Muestra/oculta el menú desplegable de formatos de exportación
function toggleExportMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('export-menu');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}
window.toggleExportMenu = toggleExportMenu;

// Convierte los bloques de interpretación en secciones desplegables
function initCollapsibles() {
    document.querySelectorAll('.insight-box').forEach(box => {
        // Sacamos el título del bloque para usarlo en el botón
        const boldEl = box.querySelector('b');
        const titleText = boldEl ? boldEl.textContent : 'Ver interpretación';
        const icon = box.querySelector('i.fas, i.far');
        const iconHTML = icon ? icon.outerHTML : '<i class="fas fa-info-circle"></i>';

        // Guardamos el contenido antes de reemplazarlo
        const originalContent = box.innerHTML;

        // Montamos el HTML con el botón de expandir/contraer
        box.classList.add('insight-collapsible');
        box.setAttribute('data-open', 'false');
        box.innerHTML = `
            <div class="insight-toggle">
                ${iconHTML}
                <span>${titleText}</span>
                <i class="fas fa-chevron-down insight-chevron"></i>
            </div>
            <div class="insight-body" style="display:none;">
                ${originalContent}
            </div>
        `;

        box.querySelector('.insight-toggle').addEventListener('click', () => {
            const isOpen = box.getAttribute('data-open') === 'true';
            const body = box.querySelector('.insight-body');
            const chevron = box.querySelector('.insight-chevron');
            if (isOpen) {
                body.style.display = 'none';
                chevron.style.transform = 'rotate(0deg)';
                box.setAttribute('data-open', 'false');
            } else {
                body.style.display = 'block';
                chevron.style.transform = 'rotate(180deg)';
                box.setAttribute('data-open', 'true');
            }
        });
    });
}

// Genera y pinta la barra lateral de navegación
function renderSidebar() {
    const activePage = window.location.pathname.split('/').pop().split('.')[0] || 'index';
    const isOverview = activePage === 'overview';
    const isCustomers = activePage === 'customers';
    const isAnalytics = activePage === 'analytics';
    const isInventory = activePage === 'inventory';
    const isTransactions = activePage === 'transactions';
    const isHistory = activePage === 'history';
    const isSettings = activePage === 'settings';

    const sidebarHTML = `
        <aside class="sidebar">
            <div class="sidebar-brand">
                <div class="brand-icon" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#818cf8,#4338ca);border-radius:8px;width:32px;height:32px;flex-shrink:0;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 32 32" style="display:block;">
                        <rect x="3" y="19" width="5" height="7" rx="1.5" fill="rgba(255,255,255,0.5)"/>
                        <rect x="11" y="13" width="5" height="13" rx="1.5" fill="rgba(255,255,255,0.78)"/>
                        <rect x="19" y="7" width="5" height="19" rx="1.5" fill="white"/>
                        <path d="M5.5 19.5 L13.5 13.5 L21.5 7.5" stroke="rgba(196,181,253,0.9)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="21.5" cy="7.5" r="2.2" fill="#c4b5fd"/>
                    </svg>
                </div>
                <div>
                    <div class="brand-text">ShopMetrics AI</div>
                    <div class="brand-sub">Analytics Platform v2.5</div>
                </div>
            </div>
            <nav class="sidebar-nav">
                <div class="nav-section-label">General</div>
                <a href="/index.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${activePage === 'index' || activePage === '' ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-upload"></i></span> New Upload
                    </div>
                </a>
                <a href="/pages/history.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${isHistory ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-history"></i></span> History
                    </div>
                </a>
                <a href="/pages/settings.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${isSettings ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-sliders-h"></i></span> Settings
                    </div>
                </a>

                <div class="nav-section-label">Dashboard View</div>
                <a href="/pages/overview.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${isOverview ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-th-large"></i></span> Overview
                    </div>
                </a>
                <a href="/pages/customers.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${isCustomers ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-users"></i></span> Customers
                        <span class="badge" id="nav-badge-customers" style="display:none">—</span>
                    </div>
                </a>
                <a href="/pages/analytics.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${isAnalytics ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-chart-line"></i></span> Analytics
                    </div>
                </a>
                <a href="/pages/ai.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${activePage === 'ai' ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-robot"></i></span> AI Advisor
                    </div>
                </a>
                <a href="/pages/inventory.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${isInventory ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-box"></i></span> Inventory
                        <span class="badge" id="nav-badge-inventory" style="display:none">—</span>
                    </div>
                </a>
                <a href="/pages/transactions.html" class="nav-item-link" style="text-decoration:none;">
                    <div class="nav-item ${isTransactions ? 'active' : ''}">
                        <span class="nav-icon"><i class="fas fa-receipt"></i></span> Transactions
                    </div>
                </a>
            </nav>
            <div class="sidebar-user" id="sidebar-user-block" style="cursor:pointer;" onclick="toggleUserMenu()" title="Opciones de cuenta">
                <div class="user-avatar" id="sidebar-avatar">?</div>
                <div style="flex:1;min-width:0;">
                    <div class="user-name" id="sidebar-username" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Usuario</div>
                    <div class="user-role" id="sidebar-role">Jefe</div>
                </div>
                <i class="fas fa-chevron-up" id="sidebar-chevron" style="font-size:10px;color:var(--text-muted);transition:transform 0.2s;"></i>
            </div>
            <div id="sidebar-user-menu" style="display:none;border-top:1px solid var(--border);padding:8px 12px;background:var(--bg-sidebar);">
                <a href="/pages/settings.html" style="text-decoration:none;">
                    <div style="display:flex;align-items:center;gap:8px;padding:8px 8px;border-radius:7px;color:var(--text-secondary);font-size:12px;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-cog" style="width:14px;text-align:center;"></i> Configuración
                    </div>
                </a>
                <div onclick="logout()" style="display:flex;align-items:center;gap:8px;padding:8px 8px;border-radius:7px;color:var(--red-light,#f87171);font-size:12px;cursor:pointer;transition:all 0.15s;" onmouseover="this.style.background='rgba(239,68,68,0.08)'" onmouseout="this.style.background='transparent'">
                    <i class="fas fa-sign-out-alt" style="width:14px;text-align:center;"></i> Cerrar sesión
                </div>
            </div>
        </aside>
    `;
    document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

    // Mostramos el nombre e iniciales del usuario que ha iniciado sesión
    try {
        const user = getCurrentUser();
        if (user) {
            document.getElementById('sidebar-username').textContent = user.name;
            const initials = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            document.getElementById('sidebar-avatar').textContent = initials;
        }
        // Si el usuario guardó su rol en settings, lo mostramos
        const settings = JSON.parse(localStorage.getItem('sm_settings') || '{}');
        if (settings.userRole) document.getElementById('sidebar-role').textContent = settings.userRole;
    } catch (e) { }
}

function toggleUserMenu() {
    const menu = document.getElementById('sidebar-user-menu');
    const chevron = document.getElementById('sidebar-chevron');
    const isOpen = menu.style.display !== 'none';
    menu.style.display = isOpen ? 'none' : 'block';
    chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}
window.toggleUserMenu = toggleUserMenu;

// Genera y pinta la barra superior con título, campanita y botón de exportar
function renderTopbar(title, subtitle = '') {
    const topbarHTML = `
        <header class="topbar">
            <div class="topbar-title">
                ${title}
                <span class="topbar-sub" id="topbar-filename">${subtitle}</span>
            </div>
            <div class="topbar-actions">

                <!-- CAMPANITA -->
                <div class="icon-btn bell-btn" id="bell-btn" title="Notificaciones">
                    <i class="fas fa-bell"></i>
                    <span class="bell-badge" id="bell-badge" style="display:none"></span>
                </div>

                <!-- PANEL NOTIFICACIONES -->
                <div class="bell-panel" id="bell-panel">
                    <div class="bell-panel-header">
                        <span style="font-weight:700;font-size:13px;">Notificaciones</span>
                        <div style="display:flex;gap:8px;">
                            <button class="bell-panel-btn" onclick="notifService.markAllRead()" title="Marcar todo como leído"><i class="fas fa-check-double"></i></button>
                            <button class="bell-panel-btn" onclick="notifService.clear()" title="Limpiar todo"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="bell-panel-body" id="bell-panel-body">
                        <div class="bell-empty"><i class="fas fa-bell-slash"></i><p>Sin notificaciones</p></div>
                    </div>
                </div>

                <!-- SETTINGS -->
                <a href="/pages/settings.html" style="text-decoration:none;">
                    <div class="icon-btn" title="Settings"><i class="fas fa-cog"></i></div>
                </a>

                <!-- EXPORT -->
                <div style="position:relative;" id="export-wrap">
                    <button class="btn-primary btn-export" onclick="toggleExportMenu(event)" title="Exportar informe">
                        <i class="fas fa-download"></i> Export <i class="fas fa-chevron-down" style="font-size:9px;margin-left:3px;opacity:0.75;"></i>
                    </button>
                    <div id="export-menu" style="display:none;position:absolute;right:0;top:calc(100% + 6px);background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:5px;min-width:148px;z-index:1000;box-shadow:0 8px 28px rgba(0,0,0,0.35);">
                        <div onclick="exportReport('html')" style="display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:7px;cursor:pointer;font-size:13px;color:var(--text-secondary);transition:background 0.12s;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">
                            <i class="fas fa-code" style="color:#6366f1;width:14px;text-align:center;"></i> HTML
                        </div>
                        <div onclick="exportReport('pdf')" style="display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:7px;cursor:pointer;font-size:13px;color:var(--text-secondary);transition:background 0.12s;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">
                            <i class="fas fa-file-pdf" style="color:#ef4444;width:14px;text-align:center;"></i> PDF
                        </div>
                        <div onclick="exportReport('excel')" style="display:flex;align-items:center;gap:9px;padding:8px 12px;border-radius:7px;cursor:pointer;font-size:13px;color:var(--text-secondary);transition:background 0.12s;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">
                            <i class="fas fa-file-excel" style="color:#10b981;width:14px;text-align:center;"></i> Excel
                        </div>
                    </div>
                </div>
            </div>
        </header>
    `;

    const mainEl = document.querySelector('main.main');
    if (mainEl) mainEl.insertAdjacentHTML('afterbegin', topbarHTML);

    // Abre y cierra el panel de notificaciones al hacer clic en la campanita
    const bellBtn = document.getElementById('bell-btn');
    const bellPanel = document.getElementById('bell-panel');

    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = bellPanel.classList.toggle('bell-panel-open');
        if (isOpen) notifService.markAllRead();
    });
    document.addEventListener('click', (e) => {
        if (!bellPanel.contains(e.target) && !bellBtn.contains(e.target)) {
            bellPanel.classList.remove('bell-panel-open');
        }
        const exportMenuEl2 = document.getElementById('export-menu');
        const exportWrapEl = document.getElementById('export-wrap');
        if (exportMenuEl2 && exportWrapEl && !exportWrapEl.contains(e.target)) {
            exportMenuEl2.style.display = 'none';
        }
    });

    // Actualizamos el punto rojo y el contenido del panel al cargar
    notifService._updateBadge();
    notifService._renderPanel();
}

// Comprueba si hay sesión activa y redirige al login si no la hay
function checkAuth() {
    const publicPages = ['login.html', 'register.html'];
    const currentPage = window.location.pathname.split('/').pop();
    if (publicPages.includes(currentPage)) return; // login y register no necesitan sesión

    const user = getCurrentUser();
    if (!user) {
        window.location.href = '/pages/login.html';
    }
}

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('sm_user') || 'null');
    } catch { return null; }
}

function logout() {
    localStorage.removeItem('sm_user');
    localStorage.removeItem('currentAnalysisId');
    window.location.href = '/pages/login.html';
}
window.logout = logout;

// Aplica el tema guardado (oscuro/claro) al cargar cualquier página
function applyThemeGlobal() {
    try {
        const s = JSON.parse(localStorage.getItem('sm_settings') || '{}');
        if (s.theme === 'light') document.body.classList.add('light-mode');
        else document.body.classList.remove('light-mode');
        // Si el usuario eligió un color personalizado, lo aplicamos
        if (s.accentColor) {
            document.documentElement.style.setProperty('--accent', s.accentColor);
            document.documentElement.style.setProperty('--accent-light', s.accentColor + 'cc');
            document.documentElement.style.setProperty('--accent-glow', s.accentColor + '26');
            document.documentElement.style.setProperty('--border-accent', s.accentColor + '66');
        }
    } catch (e) { }
}

document.addEventListener('DOMContentLoaded', () => {
    applyThemeGlobal();
    checkAuth();
    if (!document.querySelector('.sidebar')) renderSidebar();
    // Los bloques desplegables se activan desde cada página después de cargar los datos
});

// Funciones pequeñas de ayuda que se usan en varias páginas
const SEGMENT_COLORS = {
    'Champions': '#10b981',
    'Promising': '#3b82f6',
    'At Risk': '#f59e0b',
    'Hibernating': '#ef4444'
};
const SEGMENT_CLASS = {
    'Champions': 'seg-champions',
    'Promising': 'seg-promising',
    'At Risk': 'seg-risk',
    'Hibernating': 'seg-hibernating'
};

function fmt(num) {
    if (num == null || num === undefined || num === '' || isNaN(num)) return '0';
    const n = parseFloat(num);
    if (isNaN(n) || !isFinite(n)) return '0';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return n.toLocaleString();
}
function pct(n) {
    const p = parseFloat(n);
    return (isNaN(p) ? 0 : p * 100).toFixed(1) + '%';
}
function segTag(label) {
    const cls = SEGMENT_CLASS[label] || 'accent';
    return `<span class="pill ${cls}">${label || 'N/A'}</span>`;
}
function churnColor(prob) {
    const p = parseFloat(prob);
    if (p > 0.6) return '#ef4444';
    if (p > 0.3) return '#f59e0b';
    return '#10b981';
}
function invStatusClass(status) {
    if (status === 'Star') return 'inv-status-star';
    if (status === 'Underperformer') return 'inv-status-under';
    return 'inv-status-stable';
}
