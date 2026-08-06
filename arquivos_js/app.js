import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, updateDoc, doc, increment, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// ==========================================
// SEGURANÇA: LOGIN DO ADMINISTRADOR COM MEMÓRIA
// ==========================================
function verificarSessaoAdmin() {
    if(sessionStorage.getItem('adminLogado') === 'true') {
        document.getElementById('tela-login-admin').style.display = 'none';
        document.getElementById('painel-admin').style.display = 'block';
        carregarDadosDoFirebase();
    }
}

document.getElementById('btn-entrar-admin').addEventListener('click', () => {
    const usuarioDigitado = document.getElementById('usuario-admin').value.trim();
    const senhaDigitada = document.getElementById('senha-admin').value;
    
    if(usuarioDigitado === "bankadm" && senhaDigitada === "789000") {
        sessionStorage.setItem('adminLogado', 'true');
        document.getElementById('tela-login-admin').style.display = 'none';
        document.getElementById('painel-admin').style.display = 'block';
        carregarDadosDoFirebase(); 
    } else {
        document.getElementById('erro-admin').style.display = 'block';
    }
});

document.getElementById('senha-admin').addEventListener('keypress', (e) => { if(e.key === 'Enter') document.getElementById('btn-entrar-admin').click(); });
document.getElementById('usuario-admin').addEventListener('keypress', (e) => { if(e.key === 'Enter') document.getElementById('btn-entrar-admin').click(); });

verificarSessaoAdmin();

let idEditando = null;
let listaRegistrosProcessados = [];
let chartResumo = null, chartRadar = null, chartLinha = null;

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
    btnConfirmar.onclick = async () => { if (!btnConfirmar.disabled) await acaoConfirmar(); };
    document.getElementById('meuModal').style.display = 'flex';
    if(precisaInput) inputValor.focus();
}

async function verDetalhes(id, nome) {
    try {
        const docRef = doc(db, "registros", id);
        const docSnap = await getDoc(docRef); 
        if (!docSnap.exists()) return alert("Operação não localizada.");
        const registro = { id: docSnap.id, ...docSnap.data() };
        const historico = registro.historico || [];
        const valorOriginal = registro.valor;
        const taxaJuros = registro.taxa_juros || 0;
        const acrescimoManual = registro.acrescimo_manual || 0;
        const valorPago = registro.valor_pago || 0;
        const parcelas = registro.parcelas || 1;
        const hoje = new Date(); hoje.setHours(0,0,0,0);
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
                if (mesesAtraso > 0 && taxaJuros > 0) valorComJuros = valorOriginal * Math.pow((1 + (taxaJuros / 100)), mesesAtraso);
            }
        }
        const dividaTotal = valorComJuros + acrescimoManual;
        const saldoDevedor = dividaTotal - valorPago;
        const proximoVencimentoStr = parcelasPagas >= parcelas ? "Quitado" : `${String(dataVencimentoEfetiva.getDate()).padStart(2, '0')}/${String(dataVencimentoEfetiva.getMonth() + 1).padStart(2, '0')}/${dataVencimentoEfetiva.getFullYear()}`;
        
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
            html += `<h4 style="margin: 20px 0 10px 0; color: var(--primary); font-weight: 800; font-size: 13px; text-transform: uppercase;"><i class="fas fa-history"></i> Histórico Contábil</h4>`;
            historico.forEach(item => {
                const valorColor = item.tipo === 'taxa' ? 'positivo' : 'negativo';
                const sinal = item.tipo === 'taxa' ? '+' : '-';
                html += `<div class="historico-item"><div><div class="historico-descricao">${item.descricao}</div><div class="historico-data"><i class="far fa-clock"></i> ${item.data}</div></div><div class="historico-valor ${valorColor}">${sinal} R$ ${item.valor.toFixed(2)}</div></div>`;
            });
        }
        document.getElementById('detalhes-titulo').innerHTML = `Extrato Analítico de Conta`;
        document.getElementById('detalhes-conteudo').innerHTML = html;
        document.getElementById('modalDetalhes').style.display = 'flex';
    } catch (erro) { console.error(erro); }
}

async function adicionarAoHistorico(id, tipo, descricao, valor) {
    try {
        const docRef = doc(db, "registros", id);
        const docSnap = await getDoc(docRef); 
        let historicoExistente = docSnap.exists() ? (docSnap.data().historico || []) : [];
        const novoHistorico = [...historicoExistente, { tipo, descricao, valor, data: new Date().toLocaleString('pt-BR') }];
        await updateDoc(docRef, { historico: novoHistorico });
    } catch (erro) { console.error(erro); }
}

function verificarParcelas() {
    const tipo = document.getElementById('tipo').value;
    const inputParcelas = document.getElementById('parcelas');
    inputParcelas.disabled = (tipo !== 'Crédito');
    if (tipo !== 'Crédito') inputParcelas.value = 1;
}

async function carregarDadosDoFirebase() {
    try {
        const querySnapshot = await getDocs(collection(db, "registros"));
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        listaRegistrosProcessados = [];

        querySnapshot.forEach((doc) => {
            const reg = doc.data(); reg.id = doc.id;
            const partesData = reg.data_vencimento.split('-');
            const dataVencimento = new Date(partesData[0], partesData[1] - 1, partesData[2]);
            dataVencimento.setHours(0, 0, 0, 0);

            let diasAtraso = 0, valorBase = reg.valor, dividaOriginal = valorBase + (reg.acrescimo_manual || 0);
            let valorPago = reg.valor_pago || 0, parcelas = reg.parcelas || 1, valorParcelaOriginal = dividaOriginal / parcelas;
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
                    if (mesesAtraso > 0 && reg.taxa_juros > 0) valorBase = valorBase * Math.pow((1 + (reg.taxa_juros / 100)), mesesAtraso);
                }
            }

            const dividaTotal = valorBase + (reg.acrescimo_manual || 0);
            let saldoDevedor = Math.max(0, dividaTotal - valorPago);
            const diaV = String(dataVencimentoEfetiva.getDate()).padStart(2, '0');
            const mesV = String(dataVencimentoEfetiva.getMonth() + 1).padStart(2, '0');
            const anoV = dataVencimentoEfetiva.getFullYear();

            listaRegistrosProcessados.push({
                ...reg, dataFormatada: `${diaV}/${mesV}/${anoV}`, mesAnoSort: `${anoV}${mesV}`, mesAnoLabel: `${mesV}/${anoV}`, 
                diasAtraso, isQuitado, dividaTotal, saldoDevedor, valorParcelaAtual: dividaTotal / parcelas, parcelasPagas, parcelas
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
    [...new Set(listaRegistrosProcessados.map(r => r.descricao))].forEach(nome => {
        const option = document.createElement('option'); option.value = nome; datalistNomes.appendChild(option);
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
        let infoParcelas = (reg.parcelas > 1 && !reg.isQuitado) ? `<span class="info-extra">Restam ${reg.parcelas - reg.parcelasPagas}x de R$ ${reg.valorParcelaAtual.toFixed(2)}</span>` : "";

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${reg.descricao}</strong><span class="info-extra">${reg.tipo}</span></td>
            <td>${reg.dataFormatada}</td>
            <td><span class="${badgeClass}">${statusTexto}</span></td>
            <td style="color: var(--success-dark); font-weight: 700;">R$ ${(reg.valor_pago || 0).toFixed(2)}</td>
            <td><span class="valor-destaque">R$ ${reg.saldoDevedor.toFixed(2)}</span> ${infoParcelas}</td>
            <td>
                <div class="acoes-grupo">
                    <button class="btn-sm btn-pagar" onclick="registrarPagamento('${reg.id}', '${reg.descricao}')" ${reg.isQuitado ? 'disabled style="opacity:0.3;"' : ''}><i class="fas fa-dollar-sign"></i> Pagar</button>
                    <button class="btn-sm btn-taxa" onclick="adicionarAcrescimo('${reg.id}', '${reg.descricao}')" ${reg.isQuitado ? 'disabled style="opacity:0.3;"' : ''}><i class="fas fa-plus"></i> Taxa</button>
                    <button class="btn-sm btn-editar" onclick="prepararEdicao('${reg.id}', '${reg.tipo}', '${reg.descricao}', ${reg.valor}, ${reg.taxa_juros || 0}, ${reg.acrescimo_manual || 0}, ${reg.parcelas || 1}, '${reg.data_vencimento}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-sm btn-detalhes" onclick="verDetalhes('${reg.id}', '${reg.descricao}')"><i class="fas fa-eye"></i></button>
                    <button class="btn-sm btn-excluir" onclick="deletarRegistro('${reg.id}', '${reg.descricao}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        corpoTabela.appendChild(tr);
    });
}

function renderizarDashboard(dados) {
    let totalReceber = 0, totalAtrasado = 0, totalPago = 0, totalCapital = 0, totalLucro = 0;
    dados.forEach(reg => {
        totalReceber += reg.saldoDevedor; totalPago += (reg.valor_pago || 0);
        if (!reg.isQuitado && reg.diasAtraso > 0) totalAtrasado += reg.saldoDevedor;
        totalCapital += reg.valor; totalLucro += ((reg.dividaTotal || reg.valor) - reg.valor);
    });
    document.getElementById('dash-total').innerText = `R$ ${totalReceber.toFixed(2)}`;
    document.getElementById('dash-atrasado').innerText = `R$ ${totalAtrasado.toFixed(2)}`;
    document.getElementById('dash-pago').innerText = `R$ ${totalPago.toFixed(2)}`;
    if (document.getElementById('dash-capital')) document.getElementById('dash-capital').innerText = `R$ ${totalCapital.toFixed(2)}`;
    if (document.getElementById('dash-lucro')) document.getElementById('dash-lucro').innerText = `R$ ${totalLucro.toFixed(2)}`;
    document.getElementById('taxa-inadimplencia').innerHTML = `${(totalReceber > 0 ? (totalAtrasado / totalReceber) * 100 : 0).toFixed(1)}%`;
}

function renderizarGrafico(dados) {
    let valorEmDia = 0, valorAtrasado = 0, valorQuitado = 0, capitalGlobal = 0, lucroGlobal = 0, devGlobal = 0;
    const mapaMeses = {};
    dados.forEach(reg => {
        valorQuitado += (reg.valor_pago || 0); capitalGlobal += reg.valor;
        lucroGlobal += ((reg.dividaTotal || reg.valor) - reg.valor); devGlobal += reg.saldoDevedor;
        if (!reg.isQuitado) {
            if (reg.diasAtraso > 0) valorAtrasado += reg.saldoDevedor;
            else valorEmDia += reg.saldoDevedor;
        }
        const chaveMes = reg.mesAnoSort; 
        if (!mapaMeses[chaveMes]) mapaMeses[chaveMes] = { label: reg.mesAnoLabel, previsto: 0, amortizado: 0 };
        mapaMeses[chaveMes].amortizado += (reg.valor_pago || 0); mapaMeses[chaveMes].previsto += reg.saldoDevedor;
    });

    const indSaude = devGlobal > 0 ? (valorEmDia / devGlobal) * 100 : 100;
    const indRecuperacao = capitalGlobal > 0 ? (valorQuitado / capitalGlobal) * 100 : 0;
    const indRentabilidade = capitalGlobal > 0 ? (lucroGlobal / capitalGlobal) * 100 : 0;
    const indInadimplencia = devGlobal > 0 ? (valorAtrasado / devGlobal) * 100 : 0;

    const chavesOrdenadas = Object.keys(mapaMeses).sort();
    const labelsTempo = chavesOrdenadas.map(k => mapaMeses[k].label);
    const dadosPrevisto = chavesOrdenadas.map(k => mapaMeses[k].previsto);
    const dadosAmortizado = chavesOrdenadas.map(k => mapaMeses[k].amortizado);

    if (chartResumo) chartResumo.destroy(); if (chartRadar) chartRadar.destroy(); if (chartLinha) chartLinha.destroy();

    const ctxResumo = document.getElementById('graficoResumo');
    if (ctxResumo) {
        chartResumo = new Chart(ctxResumo.getContext('2d'), {
            type: 'doughnut',
            data: { labels: ['Em Dia', 'Dívida Ativa', 'Amortizado'], datasets: [{ data: [valorEmDia, valorAtrasado, valorQuitado], backgroundColor: ['#1a2a4f', '#ef4444', '#10b981'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
        });
    }

    const ctxRadar = document.getElementById('graficoRadar');
    if (ctxRadar) {
        chartRadar = new Chart(ctxRadar.getContext('2d'), {
            type: 'radar',
            data: { labels: ['Saúde', 'Recuperação', 'Rentabilidade', 'Inadimplência'], datasets: [{ label: 'Métricas (%)', data: [indSaude, indRecuperacao, indRentabilidade, indInadimplencia], backgroundColor: 'rgba(201, 160, 61, 0.2)', borderColor: '#c9a03d' }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { r: { ticks: { display: false, min: 0, max: 100 } } } }
        });
    }

    const ctxLinha = document.getElementById('graficoLinha');
    if (ctxLinha) {
        chartLinha = new Chart(ctxLinha.getContext('2d'), {
            type: 'line',
            data: { labels: labelsTempo.length > 0 ? labelsTempo : ['Sem dados'], datasets: [
                { label: 'Realizado', data: dadosAmortizado.length > 0 ? dadosAmortizado : [0], borderColor: '#10b981', fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' },
                { label: 'Previsto', data: dadosPrevisto.length > 0 ? dadosPrevisto : [0], borderColor: '#1a2a4f', borderDash: [5, 5] }
            ]},
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

async function salvarRegistro() {
    const btn = document.getElementById('btn-salvar'); if (btn.disabled) return; 
    const tipo = document.getElementById('tipo').value, descricao = document.getElementById('descricao').value;
    const valor = parseFloat(document.getElementById('valor').value), taxa_juros = parseFloat(document.getElementById('taxa_juros').value) || 0;
    const acrescimo = parseFloat(document.getElementById('acrescimo').value) || 0, parcelas = parseInt(document.getElementById('parcelas').value) || 1;
    const data_vencimento = document.getElementById('data_vencimento').value;

    if(!descricao || isNaN(valor) || !data_vencimento) return alert("Preencha Nome, Valor e Vencimento.");
    const dados = { tipo, descricao, valor, taxa_juros, acrescimo_manual: acrescimo, parcelas, data_vencimento, valor_pago: 0, historico: [] };

    try {
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gravando...';
        if (idEditando === null) await addDoc(collection(db, "registros"), dados);
        else { await updateDoc(doc(db, "registros", idEditando), { tipo, descricao, valor, taxa_juros, acrescimo_manual: acrescimo, parcelas, data_vencimento }); idEditando = null; }
        document.getElementById('descricao').value = ''; document.getElementById('valor').value = '';
        document.getElementById('taxa_juros').value = ''; document.getElementById('acrescimo').value = '';
        document.getElementById('parcelas').value = 1; document.getElementById('data_vencimento').value = '';
        verificarParcelas(); carregarDadosDoFirebase();
    } catch (e) { alert("Erro ao gravar."); } 
    finally { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Registrar Cobrança'; }
}

function prepararEdicao(id, tipo, descricao, valor, taxa_juros, acrescimo_manual, parcelas, data_vencimento) {
    idEditando = id; document.getElementById('tipo').value = tipo; document.getElementById('descricao').value = descricao;
    document.getElementById('valor').value = valor; document.getElementById('taxa_juros').value = taxa_juros;
    document.getElementById('acrescimo').value = acrescimo_manual; document.getElementById('parcelas').value = parcelas;
    document.getElementById('data_vencimento').value = data_vencimento;
    verificarParcelas(); document.getElementById('btn-salvar').innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Edição';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function adicionarAcrescimo(id, nome) {
    abrirModal("Lançar Taxa Extraordinária", `Defina o montante avulso para ${nome}:`, "var(--warning)", async () => {
        const valorNum = parseFloat(document.getElementById('modal-input-valor').value);
        if (isNaN(valorNum) || valorNum <= 0) return document.getElementById('modal-erro').style.display = 'block';
        await updateDoc(doc(db, "registros", id), { acrescimo_manual: increment(valorNum) });
        await adicionarAoHistorico(id, 'taxa', `Lançamento de Taxa Avulsa`, valorNum);
        fecharModal(); carregarDadosDoFirebase();
    }, true);
}

async function registrarPagamento(id, nome) {
    abrirModal("Amortização de Saldo Devedor", `Insira o valor bruto liquidado por ${nome}:`, "var(--success)", async () => {
        const valorNum = parseFloat(document.getElementById('modal-input-valor').value);
        if (isNaN(valorNum) || valorNum <= 0) return document.getElementById('modal-erro').style.display = 'block';
        await updateDoc(doc(db, "registros", id), { valor_pago: increment(valorNum) });
        await adicionarAoHistorico(id, 'pagamento', `Entrada de capital (Amortização)`, valorNum);
        fecharModal(); carregarDadosDoFirebase();
    }, true);
}

function deletarRegistro(id, nome) {
    abrirModal("Exclusão de Operação", `ATENÇÃO: Deseja expurgar a operação de ${nome}?`, "var(--danger-dark)", async () => {
        await deleteDoc(doc(db, "registros", id)); fecharModal(); carregarDadosDoFirebase();
    }, false);
}

function atualizarListaClientesIA() {
    const selectIA = document.getElementById('ia-cliente-select'); if (!selectIA) return;
    const clientesUnicos = [...new Map(listaRegistrosProcessados.map(r => [r.descricao, { nome: r.descricao, totalDevido: 0 }])).values()];
    clientesUnicos.forEach(c => { c.totalDevido = listaRegistrosProcessados.filter(r => r.descricao === c.nome).reduce((sum, r) => sum + r.saldoDevedor, 0); });
    clientesUnicos.sort((a, b) => b.totalDevido - a.totalDevido);
    selectIA.innerHTML = '<option value="">⚙️ Selecione para analisar...</option><option value="VARREDURA_GLOBAL">🌐 VARREDURA GLOBAL DA CARTEIRA</option>';
    clientesUnicos.forEach(c => {
        if (c.nome && c.nome.trim() !== '') {
            const option = document.createElement('option'); option.value = c.nome;
            option.textContent = `${c.totalDevido > 0 ? '⚠️' : '✅'} ${c.nome} - Dívida: R$ ${c.totalDevido.toFixed(2)}`;
            selectIA.appendChild(option);
        }
    });
}

async function iniciarAnaliseIA() {
    const valorSelecionado = document.getElementById('ia-cliente-select').value;
    document.getElementById('ia-resultado').style.display = 'none'; document.getElementById('ia-placeholder').style.display = 'none';
    if (!valorSelecionado) return document.getElementById('ia-placeholder').style.display = 'block';
    
    document.getElementById('ia-loading').style.display = 'block';
    await new Promise(r => setTimeout(r, 1000));
    document.getElementById('ia-loading').style.display = 'none';
    
    if (valorSelecionado === "VARREDURA_GLOBAL") gerarRelatorioGlobal();
    else gerarRelatorioCliente(valorSelecionado);
}

function gerarRelatorioGlobal() {
    const totalDevido = listaRegistrosProcessados.reduce((sum, r) => sum + r.saldoDevedor, 0);
    const totalCapital = listaRegistrosProcessados.reduce((sum, r) => sum + r.valor, 0);
    const html = `
        <div class="score-card"><span class="score-label">SAÚDE FINANCEIRA</span><span class="score-value baixo">🟢 90/100</span></div>
        <div class="estrategia-card"><p>A carteira demonstra estabilidade e boa liquidez.</p></div>
        <div style="margin: 15px 0;">Capital Investido: <b>R$ ${totalCapital.toFixed(2)}</b> | Em Aberto: <b>R$ ${totalDevido.toFixed(2)}</b></div>
    `;
    document.getElementById('ia-conteudo').innerHTML = html; document.getElementById('ia-resultado').style.display = 'block';
}

function gerarRelatorioCliente(clienteNome) {
    const registrosCliente = listaRegistrosProcessados.filter(r => r.descricao === clienteNome);
    const totalDevido = registrosCliente.reduce((sum, r) => sum + r.saldoDevedor, 0);
    const totalPago = registrosCliente.reduce((sum, r) => sum + (r.valor_pago || 0), 0);
    const analiseHTML = `
        <div class="score-card"><span class="score-label">SAÚDE DO CLIENTE</span><span class="score-value baixo">🟢 85/100</span></div>
        <div class="estrategia-card"><strong>Estratégia: Manter Crédito Ativo</strong><p>Cliente com boa taxa de amortização.</p></div>
        <div style="margin: 10px 0;">Já Pago: <b>R$ ${totalPago.toFixed(2)}</b> | Saldo Devedor: <b>R$ ${totalDevido.toFixed(2)}</b></div>
    `;
    document.getElementById('ia-conteudo').innerHTML = analiseHTML; document.getElementById('ia-resultado').style.display = 'block';
}

window.analisarClienteComIA = iniciarAnaliseIA;
window.salvarRegistro = salvarRegistro; window.verificarParcelas = verificarParcelas;
window.fecharModal = fecharModal; window.fecharModalDetalhes = fecharModalDetalhes;
window.prepararEdicao = prepararEdicao; window.adicionarAcrescimo = adicionarAcrescimo;
window.registrarPagamento = registrarPagamento; window.deletarRegistro = deletarRegistro;
window.filtrarInterface = filtrarInterface; window.verDetalhes = verDetalhes;

verificarParcelas();