// graficos.js
let chartResumo = null;
let chartRadar = null;
let chartLinha = null;

export function renderizarGrafico(dados) {
    let valorEmDia = 0; let valorAtrasado = 0; let valorQuitado = 0;
    let capitalGlobal = 0; let lucroGlobal = 0; let devGlobal = 0;
    const mapaMeses = {};

    dados.forEach(reg => {
        valorQuitado += (reg.valor_pago || 0);
        capitalGlobal += reg.valor;
        lucroGlobal += ((reg.dividaTotal || reg.valor) - reg.valor);
        devGlobal += reg.saldoDevedor;

        if (!reg.isQuitado) {
            if (reg.diasAtraso > 0) valorAtrasado += reg.saldoDevedor;
            else valorEmDia += reg.saldoDevedor;
        }

        const chaveMes = reg.mesAnoSort; 
        if (!mapaMeses[chaveMes]) {
            mapaMeses[chaveMes] = { label: reg.mesAnoLabel, previsto: 0, amortizado: 0 };
        }
        mapaMeses[chaveMes].amortizado += (reg.valor_pago || 0);
        mapaMeses[chaveMes].previsto += reg.saldoDevedor;
    });

    const indSaude = devGlobal > 0 ? (valorEmDia / devGlobal) * 100 : 100;
    const indRecuperacao = capitalGlobal > 0 ? (valorQuitado / capitalGlobal) * 100 : 0;
    const indRentabilidade = capitalGlobal > 0 ? (lucroGlobal / capitalGlobal) * 100 : 0;
    const indInadimplencia = devGlobal > 0 ? (valorAtrasado / devGlobal) * 100 : 0;

    const chavesOrdenadas = Object.keys(mapaMeses).sort();
    const labelsTempo = chavesOrdenadas.map(k => mapaMeses[k].label);
    const dadosPrevisto = chavesOrdenadas.map(k => mapaMeses[k].previsto);
    const dadosAmortizado = chavesOrdenadas.map(k => mapaMeses[k].amortizado);

    if (chartResumo) chartResumo.destroy();
    if (chartRadar) chartRadar.destroy();
    if (chartLinha) chartLinha.destroy();

    const colorPrimary = '#1a2a4f';
    const colorSuccess = '#10b981';
    const colorDanger = '#ef4444';
    const colorGold = '#c9a03d';

    const ctxResumo = document.getElementById('graficoResumo');
    if (ctxResumo) {
        chartResumo = new Chart(ctxResumo.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Em Dia', 'Dívida Ativa', 'Amortizado'],
                datasets: [{
                    data: [valorEmDia, valorAtrasado, valorQuitado],
                    backgroundColor: [colorPrimary, colorDanger, colorSuccess],
                    borderWidth: 0, hoverOffset: 5
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '70%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11, family: "'Inter', sans-serif" } } } }
            }
        });
    }

    const ctxRadar = document.getElementById('graficoRadar');
    if (ctxRadar) {
        chartRadar = new Chart(ctxRadar.getContext('2d'), {
            type: 'radar',
            data: {
                labels: ['Saúde da Carteira', 'Recuperação', 'Rentabilidade', 'Inadimplência'],
                datasets: [{
                    label: 'Métricas (%)',
                    data: [indSaude, indRecuperacao, indRentabilidade, indInadimplencia],
                    backgroundColor: 'rgba(201, 160, 61, 0.2)',
                    borderColor: colorGold,
                    pointBackgroundColor: colorPrimary,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: colorGold,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(0,0,0,0.1)' },
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        pointLabels: { font: { size: 10, family: "'Inter', sans-serif", weight: '600' } },
                        ticks: { display: false, min: 0, max: 100 }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    const ctxLinha = document.getElementById('graficoLinha');
    if (ctxLinha) {
        chartLinha = new Chart(ctxLinha.getContext('2d'), {
            type: 'line',
            data: {
                labels: labelsTempo.length > 0 ? labelsTempo : ['Sem dados'],
                datasets: [
                    {
                        label: 'Realizado (Amortizado)',
                        data: dadosAmortizado.length > 0 ? dadosAmortizado : [0],
                        borderColor: colorSuccess,
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2, tension: 0.4, fill: true, pointRadius: 3
                    },
                    {
                        label: 'Previsto (A Receber)',
                        data: dadosPrevisto.length > 0 ? dadosPrevisto : [0],
                        borderColor: colorPrimary,
                        backgroundColor: 'transparent',
                        borderWidth: 2, tension: 0.4, fill: false, borderDash: [5, 5], pointRadius: 3
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                    y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 10 }, callback: function(value) { return 'R$ ' + value; } } }
                },
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11, family: "'Inter', sans-serif" } } },
                    tooltip: { callbacks: { label: function(context) { return context.dataset.label + ': R$ ' + context.parsed.y.toFixed(2); } } }
                }
            }
        });
    }
}