import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, updateDoc, doc, increment, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Configurações da base de dados centralizada na nuvem
const firebaseConfig = {
    apiKey: "AIzaSyCrNmckgyxPHWY2F_mIACKxVnrtidqJOXA",
    authDomain: "financeiro-brunno.firebaseapp.com",
    projectId: "financeiro-brunno",
    storageBucket: "financeiro-brunno.firebasestorage.app",
    messagingSenderId: "831004577494",
    appId: "1:831004577494:web:6792d8a23c76dff0010377",
    measurementId: "G-8YVF2MRYW1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let idEditando = null;
let listaRegistrosProcessados = [];

// Variáveis de Instância dos 3 Gráficos
let chartResumo = null;
let chartRadar = null;
let chartLinha = null;

// ==========================================
// FUNÇÕES DE CONTROLE DE MODAIS
// ==========================================
function fecharModal() { document.getElementById('meuModal').style.display = 'none'; }
function fecharModalDetalhes() { document.getElementById('modalDetalhes').style.display = 'none'; }

function abrirModal(titulo, texto, corBotao, acaoConfirmar, precisaInput = true) {
    document.getElementById('modal-titulo').innerText = titulo;
    document.getElementById('modal-texto').innerText = texto;
    const inputValor = document.getElementById('modal-input-valor');
    inputValor.value = '';
    
    const inputWrapper = document.querySelector('.modal-input-wrapper');
    if(inputWrapper) inputWrapper.style.display = precisaInput ? 'block' : 'none';
    
    document.getElementById('modal-erro').style.display = 'none';
    
    const btnConfirmar = document.getElementById('modal-btn-confirmar');
    btnConfirmar.style.backgroundColor = corBotao;
    btnConfirmar.disabled = false; 
    btnConfirmar.innerHTML = '<i class="fas fa-check"></i> Confirmar'; 
    
    btnConfirmar.onclick = async () => {
        if (!btnConfirmar.disabled) {
            await acaoConfirmar();
        }
    };

    document.getElementById('meuModal').style.display = 'flex';
    if(precisaInput) inputValor.focus();
}

// ==========================================
// AUDITORIA E RELATÓRIO DE TRANSAÇÕES
// ==========================================
async function verDetalhes(id, nome) {
    try {
        const docRef = doc(db, "registros", id);
        const docSnap = await getDoc(docRef); 
        
        if (!docSnap.exists()) {
            alert("Erro: Operação ativa não localizada no servidor.");
            return;
        }
        
        const registro = { id: docSnap.id, ...docSnap.data() };
        
        const historico = registro.historico || [];
        const valorOriginal = registro.valor;
        const taxaJuros = registro.taxa_juros || 0;
        const acrescimoManual = registro.acrescimo_manual || 0;
        const valorPago = registro.valor_pago || 0;
        const parcelas = registro.parcelas || 1;
        
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const partesData = registro.data_vencimento.split('-');
        const dataVencimento = new Date(partesData[0], partesData[1] - 1, partesData[2]);
        dataVencimento.setHours(0, 0, 0, 0);

        let dividaOriginalTotal = valorOriginal + acrescimoManual;
        let valorParcelaBase = dividaOriginalTotal / parcelas;
        
        let parcelasPagas = 0;
        if (parcelas > 1 && valorPago > 0) {
            parcelasPagas = Math.floor((valorPago + 0.01) / valorParcelaBase);
            if (parcelasPagas > parcelas) parcelasPagas = parcelas;
        }

        let dataVencimentoEfetiva = new Date(dataVencimento.getTime());
        dataVencimentoEfetiva.setMonth(dataVencimentoEfetiva.getMonth() + parcelasPagas);
        
        let valorComJuros = valorOriginal;
        let diasAtraso = 0;
        
        if (valorPago < dividaOriginalTotal - 0.01) {
            const diffTempo = hoje - dataVencimentoEfetiva;
            if (diffTempo > 0) {
                diasAtraso = Math.floor(diffTempo / (1000 * 60 * 60 * 24));
                const mesesAtraso = Math.floor(diasAtraso / 30);
                if (mesesAtraso > 0 && taxaJuros > 0) {
                    valorComJuros = valorOriginal * Math.pow((1 + (taxaJuros / 100)), mesesAtraso);
                }
            }
        }
        
        const dividaTotal = valorComJuros + acrescimoManual;
        const saldoDevedor = dividaTotal - valorPago;

        const diaV = String(dataVencimentoEfetiva.getDate()).padStart(2, '0');
        const mesV = String(dataVencimentoEfetiva.getMonth() + 1).padStart(2, '0');
        const anoV = dataVencimentoEfetiva.getFullYear();
        const proximoVencimentoStr = parcelasPagas >= parcelas ? "Quitado" : `${diaV}/${mesV}/${anoV}`;
        
        let html = `
            <div class="resumo-detalhes">
                <p><strong><i class="fas fa-user"></i> Devedor:</strong> <span>${registro.descricao}</span></p>
                <p><strong><i class="fas fa-tag"></i> Alocação:</strong> <span>${registro.tipo}</span></p>
                <p><strong><i class="fas fa-calendar"></i> Próximo Venc.:</strong> <span>${proximoVencimentoStr}</span></p>
                <p><strong><i class="fas fa-list-ol"></i> Progresso:</strong> <span>${parcelasPagas} de ${parcelas} parcelas pagas</span></p>
                <p><strong><i class="fas fa-money-bill"></i> Capital Original:</strong> <span>R$ ${valorOriginal.toFixed(2)}</span></p>
                <p><strong><i class="fas fa-percent"></i> Indexador Juros:</strong> <span>${taxaJuros}% /mês</span></p>
                <p><strong><i class="fas fa-plus-circle"></i> Taxas Adicionais:</strong> <span>R$ ${acrescimoManual.toFixed(2)}</span></p>
                <p><strong><i class="fas fa-chart-line"></i> Lucro de Mora:</strong> <span>R$ ${(valorComJuros - valorOriginal).toFixed(2)}</span></p>
                <hr style="border: 0; border-top: 1px solid var(--border-light); margin: 15px 0;">
                <p><strong><i class="fas fa-file-invoice-dollar"></i> Balanço Nominal:</strong> <span>R$ ${dividaTotal.toFixed(2)}</span></p>
                <p style="color: var(--success-dark);"><strong><i class="fas fa-check-circle"></i> Total Amortizado:</strong> <span>R$ ${valorPago.toFixed(2)}</span></p>
                <p style="color: var(--danger-dark); font-size: 16px;"><strong><i class="fas fa-exclamation-circle"></i> Saldo Devedor Atual:</strong> <span>R$ ${Math.max(0, saldoDevedor).toFixed(2)}</span></p>
            </div>
        `;
        
        if (historico.length > 0) {
            html += `<h4 style="margin: 20px 0 10px 0; color: var(--primary); font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;"><i class="fas fa-history"></i> Histórico Contábil</h4>`;
            historico.forEach(item => {
                const valorColor = item.tipo === 'taxa' ? 'positivo' : 'negativo';
                const sinal = item.tipo === 'taxa' ? '+' : '-';
                html += `
                    <div class="historico-item">
                        <div>
                            <div class="historico-descricao">${item.descricao}</div>
                            <div class="historico-data"><i class="far fa-clock"></i> ${item.data}</div>
                        </div>
                        <div class="historico-valor ${valorColor}">${sinal} R$ ${item.valor.toFixed(2)}</div>
                    </div>
                `;
            });
        } else {
            html += `<p style="text-align: center; padding: 25px; color: var(--text-muted); background: var(--bg-surface); border-radius: 12px; border: 1px dashed var(--border-light);"><i class="fas fa-inbox" style="font-size: 28px; display: block; margin-bottom: 10px; color: var(--border-light);"></i> Nenhuma movimentação financeira registrada neste ativo.</p>`;
        }
        
        document.getElementById('detalhes-titulo').innerHTML = `Extrato Analítico de Conta`;
        document.getElementById('detalhes-conteudo').innerHTML = html;
        document.getElementById('modalDetalhes').style.display = 'flex';
        
    } catch (erro) {
        console.error("Erro na leitura analítica:", erro);
    }
}

async function adicionarAoHistorico(id, tipo, descricao, valor) {
    try {
        const docRef = doc(db, "registros", id);
        const docSnap = await getDoc(docRef); 
        let historicoExistente = [];
        if (docSnap.exists()) {
            historicoExistente = docSnap.data().historico || [];
        }
        const novoHistorico = [...historicoExistente, {
            tipo: tipo, descricao: descricao, valor: valor,
            data: new Date().toLocaleString('pt-BR')
        }];
        await updateDoc(docRef, { historico: novoHistorico });
    } catch (erro) { console.error("Erro contábil:", erro); }
}

function verificarParcelas() {
    const tipo = document.getElementById('tipo').value;
    const inputParcelas = document.getElementById('parcelas');
    inputParcelas.disabled = (tipo !== 'Crédito');
    if (tipo !== 'Crédito') inputParcelas.value = 1;
}

// ==========================================
// PROCESSAMENTO DO FLUXO DE CAIXA E DADOS
// ==========================================
async function carregarDadosDoFirebase() {
    try {
        const querySnapshot = await getDocs(collection(db, "registros"));
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        listaRegistrosProcessados = [];

        querySnapshot.forEach((doc) => {
            const reg = doc.data();
            reg.id = doc.id;
            const partesData = reg.data_vencimento.split('-');
            const dataVencimento = new Date(partesData[0], partesData[1] - 1, partesData[2]);
            dataVencimento.setHours(0, 0, 0, 0);

            let diasAtraso = 0;
            let valorBase = reg.valor;
            let dividaOriginal = valorBase + (reg.acrescimo_manual || 0);
            let valorPago = reg.valor_pago || 0;
            let parcelas = reg.parcelas || 1;
            let valorParcelaOriginal = dividaOriginal / parcelas;

            const isQuitado = valorPago >= (dividaOriginal - 0.01);

            let parcelasPagas = 0;
            if (!isQuitado && parcelas > 1 && valorPago > 0) {
                parcelasPagas = Math.floor((valorPago + 0.01) / valorParcelaOriginal);
                if (parcelasPagas > parcelas) parcelasPagas = parcelas;
            }

            let dataVencimentoEfetiva = new Date(dataVencimento.getTime());
            dataVencimentoEfetiva.setMonth(dataVencimentoEfetiva.getMonth() + parcelasPagas);

            if (!isQuitado) {
                const diffTempo = hoje - dataVencimentoEfetiva;
                if (diffTempo > 0) {
                    diasAtraso = Math.floor(diffTempo / (1000 * 60 * 60 * 24));
                    const mesesAtraso = Math.floor(diasAtraso / 30);
                    if (mesesAtraso > 0 && reg.taxa_juros > 0) {
                        valorBase = valorBase * Math.pow((1 + (reg.taxa_juros / 100)), mesesAtraso);
                    }
                }
            }

            const dividaTotal = valorBase + (reg.acrescimo_manual || 0);
            let saldoDevedor = dividaTotal - valorPago;
            if (saldoDevedor < 0) saldoDevedor = 0;
            const valorParcelaAtual = dividaTotal / parcelas;

            const diaV = String(dataVencimentoEfetiva.getDate()).padStart(2, '0');
            const mesV = String(dataVencimentoEfetiva.getMonth() + 1).padStart(2, '0');
            const anoV = dataVencimentoEfetiva.getFullYear();

            listaRegistrosProcessados.push({
                ...reg,
                dataFormatada: `${diaV}/${mesV}/${anoV}`, 
                mesAnoSort: `${anoV}${mesV}`,
                mesAnoLabel: `${mesV}/${anoV}`, 
                diasAtraso, isQuitado, dividaTotal, saldoDevedor, valorParcelaAtual,
                parcelasPagas, parcelas
            });
        });

        atualizarDatalistNomes();
        atualizarListaClientesIA();
        filtrarInterface();
    } catch (erro) { console.error(erro); }
}

function atualizarDatalistNomes() {
    const datalistNomes = document.getElementById('lista-nomes');
    datalistNomes.innerHTML = "";
    const nomesUnicos = [...new Set(listaRegistrosProcessados.map(r => r.descricao))];
    nomesUnicos.forEach(nome => {
        const option = document.createElement('option');
        option.value = nome;
        datalistNomes.appendChild(option);
    });
}

function filtrarInterface() {
    const termoBusca = document.getElementById('filtro-nome').value.toLowerCase();
    const statusFiltro = document.getElementById('filtro-status').value;

    const dadosFiltrados = listaRegistrosProcessados.filter(reg => {
        const passaNome = reg.descricao.toLowerCase().includes(termoBusca);
        let passaStatus = true;
        if (statusFiltro === 'quitado') passaStatus = reg.isQuitado;
        else if (statusFiltro === 'atrasado') passaStatus = (!reg.isQuitado && reg.diasAtraso > 0);
        else if (statusFiltro === 'em-dia') passaStatus = (!reg.isQuitado && reg.diasAtraso === 0);
        return passaNome && passaStatus;
    });

    renderizarTabela(dadosFiltrados);
    renderizarDashboard(dadosFiltrados);
    renderizarGrafico(dadosFiltrados);
}

function renderizarTabela(dados) {
    const corpoTabela = document.getElementById('tabela-corpo');
    corpoTabela.innerHTML = "";

    dados.forEach(reg => {
        let badgeClass = reg.isQuitado ? "badge quitado" : (reg.diasAtraso > 0 ? "badge atrasado" : "badge em-dia");
        let statusTexto = reg.isQuitado ? "Quitado" : (reg.diasAtraso > 0 ? `Atraso (${reg.diasAtraso}d)` : "Em dia");
        
        let parcelasRestantes = reg.parcelas - (reg.parcelasPagas || 0);
        let infoParcelas = (reg.parcelas > 1 && !reg.isQuitado) 
            ? `<span class="info-extra">Restam ${parcelasRestantes}x de R$ ${reg.valorParcelaAtual.toFixed(2)}</span>` 
            : "";

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${reg.descricao}</strong><span class="info-extra">${reg.tipo}</span></td>
            <td>${reg.dataFormatada}</td>
            <td><span class="${badgeClass}">${statusTexto}</span></td>
            <td style="color: var(--success-dark); font-weight: 700;">R$ ${(reg.valor_pago || 0).toFixed(2)}</td>
            <td><span class="valor-destaque">R$ ${reg.saldoDevedor.toFixed(2)}</span> ${infoParcelas}</td>
            <td>
                <div class="acoes-grupo">
                    <button class="btn-sm btn-pagar" onclick="registrarPagamento('${reg.id}', '${reg.descricao}')" title="Registrar Pagamento" ${reg.isQuitado ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}><i class="fas fa-dollar-sign"></i> Pagar</button>
                    <button class="btn-sm btn-taxa" onclick="adicionarAcrescimo('${reg.id}', '${reg.descricao}')" title="Adicionar Taxa" ${reg.isQuitado ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}><i class="fas fa-plus"></i> Taxa</button>
                    <button class="btn-sm btn-editar" onclick="prepararEdicao('${reg.id}', '${reg.tipo}', '${reg.descricao}', ${reg.valor}, ${reg.taxa_juros || 0}, ${reg.acrescimo_manual || 0}, ${reg.parcelas || 1}, '${reg.data_vencimento}')" title="Editar Operação"><i class="fas fa-edit"></i></button>
                    <button class="btn-sm btn-detalhes" onclick="verDetalhes('${reg.id}', '${reg.descricao}')" title="Ver Detalhes"><i class="fas fa-eye"></i></button>
                    <button class="btn-sm btn-excluir" onclick="deletarRegistro('${reg.id}', '${reg.descricao}')" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        corpoTabela.appendChild(tr);
    });
}

function renderizarDashboard(dados) {
    let totalReceber = 0; let totalAtrasado = 0; let totalPago = 0;
    let totalCapital = 0; let totalLucro = 0;

    dados.forEach(reg => {
        totalReceber += reg.saldoDevedor;
        totalPago += (reg.valor_pago || 0);
        if (!reg.isQuitado && reg.diasAtraso > 0) totalAtrasado += reg.saldoDevedor;
        
        totalCapital += reg.valor;
        totalLucro += ((reg.dividaTotal || reg.valor) - reg.valor);
    });

    document.getElementById('dash-total').innerText = `R$ ${totalReceber.toFixed(2)}`;
    document.getElementById('dash-atrasado').innerText = `R$ ${totalAtrasado.toFixed(2)}`;
    document.getElementById('dash-pago').innerText = `R$ ${totalPago.toFixed(2)}`;
    
    const elCapital = document.getElementById('dash-capital');
    const elLucro = document.getElementById('dash-lucro');
    if (elCapital) elCapital.innerText = `R$ ${totalCapital.toFixed(2)}`;
    if (elLucro) elLucro.innerText = `R$ ${totalLucro.toFixed(2)}`;
    
    const taxaInadimplencia = totalReceber > 0 ? (totalAtrasado / totalReceber) * 100 : 0;
    document.getElementById('taxa-inadimplencia').innerHTML = `${taxaInadimplencia.toFixed(1)}%`;
}

// ==========================================
// MOTOR DE BUSINESS INTELLIGENCE (GRÁFICOS)
// ==========================================
function renderizarGrafico(dados) {
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

// ==========================================
// OPERAÇÕES DE BASE DE DADOS (C.R.U.D) COM TRAVA DE DUPLO CLIQUE
// ==========================================
async function salvarRegistro() {
    const btn = document.getElementById('btn-salvar');
    if (btn.disabled) return; 

    const tipo = document.getElementById('tipo').value;
    const descricao = document.getElementById('descricao').value;
    const valor = parseFloat(document.getElementById('valor').value);
    const taxa_juros = parseFloat(document.getElementById('taxa_juros').value) || 0;
    const acrescimo = parseFloat(document.getElementById('acrescimo').value) || 0;
    const parcelas = parseInt(document.getElementById('parcelas').value) || 1;
    const data_vencimento = document.getElementById('data_vencimento').value;

    if(!descricao || isNaN(valor) || !data_vencimento) return alert("Falha ao registrar: Preencha Nome, Valor Original e Vencimento.");

    const dados = { tipo, descricao, valor, taxa_juros, acrescimo_manual: acrescimo, parcelas, data_vencimento, valor_pago: 0, historico: [] };

    try {
        btn.disabled = true; 
        const textoOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gravando...';

        if (idEditando === null) {
            await addDoc(collection(db, "registros"), dados);
        } else {
            const ref = doc(db, "registros", idEditando);
            await updateDoc(ref, { tipo, descricao, valor, taxa_juros, acrescimo_manual: acrescimo, parcelas, data_vencimento });
            idEditando = null;
        }

        document.getElementById('descricao').value = ''; document.getElementById('valor').value = '';
        document.getElementById('taxa_juros').value = ''; document.getElementById('acrescimo').value = '';
        document.getElementById('parcelas').value = 1; document.getElementById('data_vencimento').value = '';
        
        verificarParcelas(); carregarDadosDoFirebase();
    } catch (erro) { 
        alert("Falha na gravação criptografada no banco da nuvem."); 
    } finally {
        btn.disabled = false; 
        btn.innerHTML = idEditando === null ? '<i class="fas fa-save"></i> Registrar Cobrança' : '<i class="fas fa-sync-alt"></i> Sincronizar Edição';
    }
}

function prepararEdicao(id, tipo, descricao, valor, taxa_juros, acrescimo_manual, parcelas, data_vencimento) {
    idEditando = id;
    document.getElementById('tipo').value = tipo; document.getElementById('descricao').value = descricao;
    document.getElementById('valor').value = valor; document.getElementById('taxa_juros').value = taxa_juros;
    document.getElementById('acrescimo').value = acrescimo_manual; document.getElementById('parcelas').value = parcelas;
    document.getElementById('data_vencimento').value = data_vencimento;

    verificarParcelas();
    const btn = document.getElementById('btn-salvar');
    btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Edição';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function adicionarAcrescimo(id, nome) {
    abrirModal("Lançar Taxa Extraordinária", `Defina o montante avulso para ${nome}:`, "var(--warning)", async () => {
        const valorNum = parseFloat(document.getElementById('modal-input-valor').value);
        if (isNaN(valorNum) || valorNum <= 0) return document.getElementById('modal-erro').style.display = 'block';
        
        const btnConfirmar = document.getElementById('modal-btn-confirmar');
        if (btnConfirmar.disabled) return; 
        
        try {
            btnConfirmar.disabled = true; 
            btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
            
            await updateDoc(doc(db, "registros", id), { acrescimo_manual: increment(valorNum) });
            await adicionarAoHistorico(id, 'taxa', `Lançamento de Taxa Avulsa`, valorNum);
            
            fecharModal(); carregarDadosDoFirebase();
        } catch (e) {
            alert("Erro ao lançar taxa.");
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = '<i class="fas fa-check"></i> Confirmar';
        }
    }, true);
}

async function registrarPagamento(id, nome) {
    abrirModal("Amortização de Saldo Devedor", `Insira o valor bruto liquidado em mãos por ${nome}:`, "var(--success)", async () => {
        const valorNum = parseFloat(document.getElementById('modal-input-valor').value);
        if (isNaN(valorNum) || valorNum <= 0) return document.getElementById('modal-erro').style.display = 'block';
        
        const btnConfirmar = document.getElementById('modal-btn-confirmar');
        if (btnConfirmar.disabled) return; 
        
        try {
            btnConfirmar.disabled = true; 
            btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
            
            await updateDoc(doc(db, "registros", id), { valor_pago: increment(valorNum) });
            await adicionarAoHistorico(id, 'pagamento', `Entrada de capital (Amortização)`, valorNum);
            
            fecharModal(); carregarDadosDoFirebase();
        } catch (e) {
            alert("Erro ao registrar pagamento.");
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = '<i class="fas fa-check"></i> Confirmar';
        }
    }, true);
}

function deletarRegistro(id, nome) {
    abrirModal("Exclusão de Operação", `ATENÇÃO: Deseja expurgar a operação de ${nome} permanentemente da base?`, "var(--danger-dark)", async () => {
        const btnConfirmar = document.getElementById('modal-btn-confirmar');
        if (btnConfirmar.disabled) return; 
        
        try {
            btnConfirmar.disabled = true; 
            btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';
            
            await deleteDoc(doc(db, "registros", id));
            
            fecharModal(); carregarDadosDoFirebase();
        } catch (e) {
            alert("Erro ao excluir registro.");
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = '<i class="fas fa-check"></i> Confirmar';
        }
    }, false);
}

// ==========================================
// CÉREBRO CENTRAL DE INTELIGÊNCIA ARTIFICIAL
// ==========================================
function atualizarListaClientesIA() {
    const selectIA = document.getElementById('ia-cliente-select');
    if (!selectIA) return;
    
    const clientesUnicos = [...new Map(listaRegistrosProcessados.map(r => [r.descricao, {
        nome: r.descricao, totalDevido: 0, totalPago: 0, qtdOperacoes: 0, operacoes: []
    }])).values()];
    
    clientesUnicos.forEach(cliente => {
        const registrosCliente = listaRegistrosProcessados.filter(r => r.descricao === cliente.nome);
        cliente.qtdOperacoes = registrosCliente.length;
        cliente.totalDevido = registrosCliente.reduce((sum, r) => sum + r.saldoDevedor, 0);
        cliente.totalPago = registrosCliente.reduce((sum, r) => sum + (r.valor_pago || 0), 0);
        cliente.operacoes = registrosCliente;
    });
    
    clientesUnicos.sort((a, b) => b.totalDevido - a.totalDevido);
    
    selectIA.innerHTML = '<option value="">⚙️ Aguardando comando de varredura...</option>';
    
    const optGeral = document.createElement('option');
    optGeral.value = "VARREDURA_GLOBAL";
    optGeral.innerHTML = "🌐 VARREDURA GLOBAL DA CARTEIRA";
    optGeral.style.fontWeight = "bold";
    optGeral.style.color = "var(--accent-gold)";
    selectIA.appendChild(optGeral);
    
    clientesUnicos.forEach(cliente => {
        if (cliente.nome && cliente.nome.trim() !== '') {
            const option = document.createElement('option');
            option.value = cliente.nome;
            const emoji = cliente.totalDevido > 0 ? '⚠️' : (cliente.totalPago > 0 ? '✅' : '📋');
            option.textContent = `${emoji} ${cliente.nome} - Dívida: R$ ${cliente.totalDevido.toFixed(2)}`;
            selectIA.appendChild(option);
        }
    });
}

async function iniciarAnaliseIA() {
    const valorSelecionado = document.getElementById('ia-cliente-select').value;
    
    document.getElementById('ia-resultado').style.display = 'none';
    document.getElementById('ia-placeholder').style.display = 'none';
    
    if (!valorSelecionado) {
        document.getElementById('ia-placeholder').style.display = 'block';
        return;
    }
    
    document.getElementById('ia-loading').style.display = 'block';
    const msg = document.getElementById('ia-loading-text');
    
    const mensagensDeEspera = [
        "Mapeando vetores de crédito da base de dados...",
        "Calculando métricas de solvência e liquidez imediata...",
        "Avaliando o impacto do ROI sobre a carteira ativa...",
        "Calculando teto máximo de crédito e exposição...",
        "Estruturando relatório executivo final..."
    ];
    
    for (let i = 0; i < mensagensDeEspera.length; i++) {
        msg.innerText = mensagensDeEspera[i];
        await new Promise(r => setTimeout(r, 550)); 
    }
    
    document.getElementById('ia-loading').style.display = 'none';
    
    if (valorSelecionado === "VARREDURA_GLOBAL") {
        gerarRelatorioGlobal();
    } else {
        gerarRelatorioCliente(valorSelecionado);
    }
}

function gerarRelatorioGlobal() {
    if (listaRegistrosProcessados.length === 0) {
        mostrarErroIA("Carteira sem registros para análise de big data.");
        return;
    }
    
    const totalDevido = listaRegistrosProcessados.reduce((sum, r) => sum + r.saldoDevedor, 0);
    const totalPago = listaRegistrosProcessados.reduce((sum, r) => sum + (r.valor_pago || 0), 0);
    const totalCapital = listaRegistrosProcessados.reduce((sum, r) => sum + r.valor, 0);
    const totalLucro = listaRegistrosProcessados.reduce((sum, r) => sum + ((r.dividaTotal || r.valor) - r.valor), 0);
    const roi = totalCapital > 0 ? (totalLucro / totalCapital) * 100 : 0;
    const taxaInad = totalDevido > 0 ? (listaRegistrosProcessados.filter(r => !r.isQuitado && r.diasAtraso > 0).reduce((sum, r) => sum + r.saldoDevedor, 0) / totalDevido) * 100 : 0;
    
    let scoreSaude = 100 - taxaInad; 
    scoreSaude = Math.max(0, Math.min(100, scoreSaude));
    
    let analogiaSaude = ""; let corRisco = ""; let emojiRisco = "";
    
    if(scoreSaude >= 80) {
        analogiaSaude = `A carteira comporta-se como um relógio suíço de alta precisão. A liquidez flui perfeitamente, e a taxa de retorno (ROI) em ${roi.toFixed(1)}% comprova que a alocação do capital é extremamente eficiente.`;
        corRisco = "baixo"; emojiRisco = "🟢"; 
    } else if (scoreSaude >= 50) {
        analogiaSaude = `A operação assemelha-se a uma barragem com fissuras leves de retenção. O lucro projetado (${roi.toFixed(1)}%) é robusto, mas o acúmulo na Dívida Ativa está a prender capital que deveria estar em circulação imediata.`;
        corRisco = "medio"; emojiRisco = "🟡"; 
    } else {
        analogiaSaude = `ESTADO DE ALERTA: Hemorragia grave de capital identificada. Com o lucro projetado sob alto risco de insolvência, é urgente travar novas concessões e executar um plano de resgate para proteger o capital original de R$ ${totalCapital.toFixed(2)}.`;
        corRisco = "alto"; emojiRisco = "🔴"; 
    }

    const html = `
        <div class="score-card" style="background: linear-gradient(135deg, rgba(26, 42, 79, 0.9), rgba(0,0,0,0.95)); border-color: var(--accent-gold);">
            <span class="score-label" style="color: var(--accent-gold-light);"><i class="fas fa-heartbeat"></i> SAÚDE FINANCEIRA (BANK AI)</span>
            <span class="score-value ${corRisco}" style="font-size: 24px; font-weight: 800;">${emojiRisco} ${Math.round(scoreSaude)}/100</span>
        </div>
        
        <div class="estrategia-card">
            <div class="estrategia-titulo"><i class="fas fa-brain"></i> PARECER ANALÍTICO GLOBAL</div>
            <p style="font-size: 14px; line-height: 1.6; color: #f1f5f9; font-style: italic;">"${analogiaSaude}"</p>
        </div>
        
        <div style="margin: 20px 0;">
            <strong><i class="fas fa-microscope"></i> INDICADORES OPERACIONAIS (KPIs):</strong>
            <div style="margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
                <div style="background: rgba(255,255,255,0.04); padding: 12px; border-radius: 8px;">🏦 Capital Fora de Caixa: <b style="color: white; display:block; font-size:15px; margin-top:2px;">R$ ${totalCapital.toFixed(2)}</b></div>
                <div style="background: rgba(255,255,255,0.04); padding: 12px; border-radius: 8px;">📈 Lucro Limpo Projetado: <b style="color: var(--accent-gold); display:block; font-size:15px; margin-top:2px;">R$ ${totalLucro.toFixed(2)}</b></div>
                <div style="background: rgba(255,255,255,0.04); padding: 12px; border-radius: 8px;">🚀 Retorno sobre Carteira (ROI): <b style="color: var(--success); display:block; font-size:15px; margin-top:2px;">${roi.toFixed(1)}%</b></div>
                <div style="background: rgba(255,255,255,0.04); padding: 12px; border-radius: 8px;">⚠️ Retenção em Atraso: <b style="color: var(--danger); display:block; font-size:15px; margin-top:2px;">R$ ${totalDevido.toFixed(2)}</b></div>
            </div>
        </div>
        
        <div class="dica-card" style="border-left-color: var(--accent-gold); background: rgba(201, 160, 61, 0.08);">
            <strong><i class="fas fa-chess-knight"></i> DIRETRIZ DE MITIGAÇÃO:</strong>
            <p style="margin-top: 8px; font-size: 13px;">O teu principal objetivo estratégico deve ser recuperar o capital base preso. A IA recomenda campanhas de liquidação rápida oferecendo perdão de até 40% sobre os juros de mora acumulados, priorizando reaver o valor investido raiz.</p>
        </div>
    `;
    
    document.getElementById('ia-conteudo').innerHTML = html;
    document.getElementById('ia-resultado').style.display = 'flex';
}

function gerarRelatorioCliente(clienteNome) {
    const registrosCliente = listaRegistrosProcessados.filter(r => r.descricao === clienteNome);
    
    const totalDevido = registrosCliente.reduce((sum, r) => sum + r.saldoDevedor, 0);
    const totalOriginal = registrosCliente.reduce((sum, r) => sum + r.valor, 0);
    const totalPago = registrosCliente.reduce((sum, r) => sum + (r.valor_pago || 0), 0);
    const totalJuros = registrosCliente.reduce((sum, r) => sum + ((r.dividaTotal || r.valor) - r.valor), 0);
    const totalTaxasAvulsas = registrosCliente.reduce((sum, r) => sum + (r.acrescimo_manual || 0), 0);
    
    const qtdAtrasadas = registrosCliente.filter(r => !r.isQuitado && r.diasAtraso > 0).length;
    const qtdQuitadas = registrosCliente.filter(r => r.isQuitado).length;
    
    let scoreSaude = 100;
    if (totalDevido > 0) {
        const percentualInadimplente = (totalDevido / ((totalOriginal + totalTaxasAvulsas) || 1)) * 100;
        scoreSaude = 100 - percentualInadimplente - (qtdAtrasadas * 15) + (qtdQuitadas * 5);
    } else if (qtdAtrasadas === 0 && totalPago > 0) {
        scoreSaude = 100; 
    }
    scoreSaude = Math.max(0, Math.min(100, scoreSaude));
    
    let corRisco = ""; let emojiRisco = ""; let estrategia = ""; let abordagem = ""; let analogiaCliente = "";
    
    let limiteSugerido = 0; let decisaoCredito = ""; let corDecisao = ""; let iconeDecisao = "";
    let basePagamento = totalPago > 0 ? totalPago : 0;

    if (scoreSaude >= 80) { 
        corRisco = "baixo"; emojiRisco = "🟢"; 
        estrategia = "Fidelização Nível 'Gold Standard'";
        analogiaCliente = "Trata-se de um 'Unicórnio de Crédito'. Liquidez perfeita, previsibilidade impecável. Um alicerce sólido para sua carteira.";
        abordagem = "O cliente possui excelente histórico e seu capital não corre riscos. Envie ofertas exclusivas para alocação de novo capital.";
        limiteSugerido = (basePagamento * 1.5) - totalDevido;
        decisaoCredito = "CRÉDITO PRÉ-APROVADO";
        corDecisao = "var(--success)";
        iconeDecisao = "fa-check-circle";
    } else if (scoreSaude >= 50) { 
        corRisco = "medio"; emojiRisco = "🟡"; 
        estrategia = "Fricção Ativa Modulada";
        analogiaCliente = "Devedor com comportamento oscilante. Não há intenção latente de fraude, mas demonstra falha de prioridade.";
        abordagem = "Acionar cobrança preventiva. Evitar desgaste direto de relacionamento, mas aplicar penalidades pontuais em atrasos.";
        limiteSugerido = (basePagamento * 0.7) - totalDevido;
        decisaoCredito = "CRÉDITO RESTRITO";
        corDecisao = "var(--warning)";
        iconeDecisao = "fa-exclamation-triangle";
    } else { 
        corRisco = "alto"; emojiRisco = "🔴"; 
        estrategia = "Operação 'Haircut' Compulsório";
        analogiaCliente = "Este devedor tornou-se um 'Buraco Negro' de capital. Ele suga liquidez e devolve promessas vazias.";
        abordagem = "Recomenda-se quebra de renegociações tradicionais. Propor imediatamente um acordo de liquidação com desconto tático sobre as taxas avulsas para mitigar perda do capital original.";
        limiteSugerido = 0;
        decisaoCredito = "CRÉDITO NEGADO";
        corDecisao = "var(--danger)";
        iconeDecisao = "fa-ban";
    }
    
    limiteSugerido = Math.max(0, limiteSugerido);

    if (totalPago === 0 && totalDevido === 0 && totalOriginal === 0) {
        limiteSugerido = 500; 
        decisaoCredito = "LIMITE INICIAL DE CONFIANÇA";
        corDecisao = "var(--info)";
        iconeDecisao = "fa-info-circle";
    }
    
    const analiseHTML = `
        <div class="score-card">
            <span class="score-label"><i class="fas fa-heartbeat"></i> SAÚDE DO CLIENTE</span>
            <span class="score-value ${corRisco}" style="font-size: 24px; font-weight: 800;">${emojiRisco} ${Math.round(scoreSaude)}/100</span>
        </div>
        
        <div class="estrategia-card">
            <div class="estrategia-titulo"><i class="fas fa-user-gear"></i> COMPORTAMENTO CONTÁBIL</div>
            <p style="font-size: 14px; font-style: italic; color: #cbd5e1; margin-bottom: 12px;">"${analogiaCliente}"</p>
            <div style="border-top: 1px dashed rgba(201, 160, 61, 0.3); padding-top: 12px;">
                <strong>🎯 Estratégia Recomendada: ${estrategia}</strong>
                <p style="margin-top: 6px; font-size: 13px; line-height:1.5;">${abordagem}</p>
            </div>
        </div>

        <div style="background: rgba(255,255,255,0.05); border: 1px solid ${corDecisao}; border-radius: 12px; padding: 15px; margin: 15px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
                <strong style="color: white; font-size: 13px; text-transform: uppercase;"><i class="fas fa-money-check-alt"></i> Mesa de Crédito Bank AI</strong>
                <span style="background: ${corDecisao}; color: #fff; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: bold;"><i class="fas ${iconeDecisao}"></i> ${decisaoCredito}</span>
            </div>
            <p style="font-size: 12px; color: #cbd5e1; margin-bottom: 10px; line-height: 1.4;">Com base na capacidade de pagamento comprovada e apetite de risco da operação, o Cérebro Central calculou a margem segura para novas emissões.</p>
            <div style="font-size: 22px; font-weight: 800; color: ${corDecisao};"><span style="font-size: 12px; color: #cbd5e1; font-weight: normal; text-transform: uppercase;">Teto Operacional Recomendado:</span> R$ ${limiteSugerido.toFixed(2)}</div>
        </div>
        
        <div style="margin: 15px 0;">
            <strong><i class="fas fa-chart-column"></i> POSIÇÃO PATRIMONIAL CONSOLIDADA:</strong>
            <div style="margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
                <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">Capital Despendido: R$ ${totalOriginal.toFixed(2)}</div>
                <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">Spread / Juros: R$ ${totalJuros.toFixed(2)}</div>
                <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px; color: var(--success); font-weight:700;">Amortizado: R$ ${totalPago.toFixed(2)}</div>
                <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px; color: var(--danger); font-weight:700;">Saldo em Aberto: R$ ${totalDevido.toFixed(2)}</div>
            </div>
        </div>
        
        <div class="dica-card">
            <strong><i class="fas fa-comment-dots"></i> ROTEIRO CIRÚRGICO DE COBRANÇA:</strong>
            <p style="margin-top: 8px; font-size:13px; line-height:1.5;">"Olá ${clienteNome}, boa tarde. Entramos em contato da mesa de análise de crédito do BANK com relação ao seu saldo em aberto de R$ ${totalDevido.toFixed(2)}. Formulamos uma proposta especial para regularizar a sua ficha na nossa instituição hoje. Conseguimos facilidades via Pix. Qual o melhor horário para fecharmos o acordo?"</p>
        </div>
    `;
    
    document.getElementById('ia-conteudo').innerHTML = analiseHTML;
    document.getElementById('ia-resultado').style.display = 'block';
    document.getElementById('ia-placeholder').style.display = 'none';
}

window.analisarClienteComIA = iniciarAnaliseIA;

function copiarAnaliseIA() {
    const conteudo = document.getElementById('ia-conteudo').innerText;
    navigator.clipboard.writeText(conteudo).then(() => {
        const btn = document.querySelector('.ia-copiar');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copiado';
        setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
    });
}

function mostrarErroIA(mensagem) {
    document.getElementById('ia-conteudo').innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--warning); margin-bottom: 15px;"></i>
            <p>${mensagem}</p>
        </div>
    `;
    document.getElementById('ia-resultado').style.display = 'block';
    document.getElementById('ia-placeholder').style.display = 'none';
}

// ==========================================
// EXPORTAÇÃO DAS FUNÇÕES PARA O ESCOPO GLOBAL
// ==========================================
window.salvarRegistro = salvarRegistro;
window.verificarParcelas = verificarParcelas;
window.fecharModal = fecharModal;
window.fecharModalDetalhes = fecharModalDetalhes;
window.prepararEdicao = prepararEdicao;
window.adicionarAcrescimo = adicionarAcrescimo;
window.registrarPagamento = registrarPagamento;
window.deletarRegistro = deletarRegistro;
window.filtrarInterface = filtrarInterface;
window.verDetalhes = verDetalhes;
window.copiarAnaliseIA = copiarAnaliseIA;

// Inicialização segura da aplicação
verificarParcelas();
carregarDadosDoFirebase();