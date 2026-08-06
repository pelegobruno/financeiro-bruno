import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

let clienteLogado = null;
let listaRegistrosGeral = [];

async function tentarLogin() {
    const usuarioInput = document.getElementById('login-usuario').value.trim();
    const senhaInput = document.getElementById('login-senha').value;
    const erroMsg = document.getElementById('login-erro');
    const btnEntrar = document.getElementById('btn-entrar');

    if(!usuarioInput || !senhaInput) {
        erroMsg.style.display = 'block';
        erroMsg.innerHTML = '<i class="fas fa-exclamation-circle"></i> Preencha o nome e a senha.';
        return;
    }

    if(senhaInput !== "123") {
        erroMsg.style.display = 'block';
        erroMsg.innerHTML = '<i class="fas fa-exclamation-circle"></i> Senha incorreta.';
        return;
    }

    btnEntrar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';
    btnEntrar.disabled = true;
    erroMsg.style.display = 'none';

    try {
        const querySnapshot = await getDocs(collection(db, "registros"));
        listaRegistrosGeral = [];
        let clienteEncontrado = null;

        querySnapshot.forEach((doc) => {
            const reg = doc.data(); reg.id = doc.id;
            listaRegistrosGeral.push(reg);
            if (reg.descricao && reg.descricao.toLowerCase() === usuarioInput.toLowerCase()) {
                clienteEncontrado = reg.descricao; 
            }
        });

        if (clienteEncontrado) {
            clienteLogado = clienteEncontrado;
            iniciarPainelCliente();
        } else {
            erroMsg.style.display = 'block';
            erroMsg.innerHTML = '<i class="fas fa-exclamation-circle"></i> Cliente não encontrado na base de dados.';
        }
    } catch (error) {
        erroMsg.style.display = 'block';
        erroMsg.innerHTML = '<i class="fas fa-exclamation-circle"></i> Falha na conexão com o servidor.';
    } finally {
        btnEntrar.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar no Sistema';
        btnEntrar.disabled = false;
    }
}

document.getElementById('login-senha').addEventListener('keypress', function(e) { if(e.key === 'Enter') tentarLogin(); });
document.getElementById('btn-entrar').addEventListener('click', tentarLogin);

function iniciarPainelCliente() {
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel-cliente').style.display = 'block';
    document.getElementById('header-nome-cliente').innerText = `Bem-vindo, ${clienteLogado}`;
    document.getElementById('editar-nome-cliente').value = clienteLogado;
    processarDadosCliente();
}

function processarDadosCliente() {
    const registrosCliente = listaRegistrosGeral.filter(r => r.descricao === clienteLogado);
    let totalDevido = 0, totalOriginal = 0, totalPago = 0, totalTaxasAvulsas = 0;
    let qtdAtrasadas = 0, qtdQuitadas = 0;
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const dadosTabela = [];

    registrosCliente.forEach(reg => {
        const partesData = reg.data_vencimento.split('-');
        const dataVencimento = new Date(partesData[0], partesData[1] - 1, partesData[2]);
        dataVencimento.setHours(0, 0, 0, 0);

        let valorBase = reg.valor;
        let dividaOriginal = valorBase + (reg.acrescimo_manual || 0);
        let valorPagoReg = reg.valor_pago || 0;
        let parcelas = reg.parcelas || 1;
        let valorParcelaOriginal = dividaOriginal / parcelas;

        const isQuitado = valorPagoReg >= (dividaOriginal - 0.01);
        let parcelasPagas = 0;
        if (!isQuitado && parcelas > 1 && valorPagoReg > 0) {
            parcelasPagas = Math.floor((valorPagoReg + 0.01) / valorParcelaOriginal);
            if (parcelasPagas > parcelas) parcelasPagas = parcelas;
        }

        let dataVencimentoEfetiva = new Date(dataVencimento.getTime());
        dataVencimentoEfetiva.setMonth(dataVencimentoEfetiva.getMonth() + parcelasPagas);

        let diasAtraso = 0;
        if (!isQuitado) {
            const diffTempo = hoje - dataVencimentoEfetiva;
            if (diffTempo > 0) {
                diasAtraso = Math.floor(diffTempo / (1000 * 60 * 60 * 24));
                const mesesAtraso = Math.floor(diasAtraso / 30);
                if (mesesAtraso > 0 && reg.taxa_juros > 0) valorBase = valorBase * Math.pow((1 + (reg.taxa_juros / 100)), mesesAtraso);
            }
        }

        const dividaTotalReg = valorBase + (reg.acrescimo_manual || 0);
        let saldoDevedorReg = Math.max(0, dividaTotalReg - valorPagoReg);

        totalDevido += saldoDevedorReg; totalOriginal += reg.valor; totalPago += valorPagoReg; totalTaxasAvulsas += (reg.acrescimo_manual || 0);
        if (isQuitado) qtdQuitadas++; else if (diasAtraso > 0) qtdAtrasadas++;

        const diaV = String(dataVencimentoEfetiva.getDate()).padStart(2, '0');
        const mesV = String(dataVencimentoEfetiva.getMonth() + 1).padStart(2, '0');
        const anoV = dataVencimentoEfetiva.getFullYear();

        dadosTabela.push({
            ...reg, dataFormatada: parcelasPagas >= parcelas ? "Finalizado" : `${diaV}/${mesV}/${anoV}`,
            isQuitado, diasAtraso, saldoDevedorReg, dividaTotalReg, parcelasPagas
        });
    });

    let scoreSaude = 100;
    if (totalDevido > 0) {
        const percentualInadimplente = (totalDevido / ((totalOriginal + totalTaxasAvulsas) || 1)) * 100;
        scoreSaude = 100 - percentualInadimplente - (qtdAtrasadas * 15) + (qtdQuitadas * 5);
    }
    scoreSaude = Math.max(0, Math.min(100, scoreSaude));

    let limiteSugerido = 0;
    let basePagamento = totalPago > 0 ? totalPago : 0;
    if (scoreSaude >= 80) limiteSugerido = (basePagamento * 1.5) - totalDevido;
    else if (scoreSaude >= 50) limiteSugerido = (basePagamento * 0.7) - totalDevido;
    else limiteSugerido = 0;

    if (totalPago === 0 && totalDevido === 0 && totalOriginal === 0) limiteSugerido = 500;
    limiteSugerido = Math.max(0, limiteSugerido);

    document.getElementById('cliente-devido').innerText = `R$ ${totalDevido.toFixed(2)}`;
    document.getElementById('cliente-pago').innerText = `R$ ${totalPago.toFixed(2)}`;
    const displayLimite = `R$ ${limiteSugerido.toFixed(2)}`;
    document.getElementById('cliente-limite').innerText = displayLimite;
    document.getElementById('display-limite-solicitar').innerText = displayLimite;

    renderizarTabelaCliente(dadosTabela);
}

function renderizarTabelaCliente(dados) {
    const corpoTabela = document.getElementById('tabela-corpo-cliente');
    corpoTabela.innerHTML = "";
    if (dados.length === 0) {
        corpoTabela.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted); font-size: 11px;">Sem operações ativas.</td></tr>`;
        return;
    }
    dados.forEach(reg => {
        let badgeClass = reg.isQuitado ? "badge quitado" : (reg.diasAtraso > 0 ? "badge atrasado" : "badge em-dia");
        let statusTexto = reg.isQuitado ? "Quitado" : (reg.diasAtraso > 0 ? `Atraso` : "Em dia");
        let parcelasRestantes = (reg.parcelas || 1) - (reg.parcelasPagas || 0);
        let infoParcelas = (reg.parcelas > 1 && !reg.isQuitado) ? `<span class="info-extra">Restam ${parcelasRestantes} parc.</span>` : "";

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${reg.tipo}</strong></td>
            <td>${reg.dataFormatada}</td>
            <td style="text-align: center;"><span class="${badgeClass}">${statusTexto}</span></td>
            <td style="color: var(--success-dark); font-weight: 700; text-align: right;">R$ ${(reg.valor_pago || 0).toFixed(2)}</td>
            <td style="text-align: right;"><span class="valor-destaque">R$ ${reg.saldoDevedorReg.toFixed(2)}</span> ${infoParcelas}</td>
        `;
        corpoTabela.appendChild(tr);
    });
}

async function atualizarNomePerfil() {
    const novoNome = document.getElementById('editar-nome-cliente').value.trim();
    const btnAtualizar = document.getElementById('btn-atualizar-perfil');
    if (!novoNome) return alert("O nome não pode ficar vazio.");
    if (novoNome === clienteLogado) return alert("Os dados já estão atualizados.");

    btnAtualizar.disabled = true;
    btnAtualizar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...';

    try {
        const registrosCliente = listaRegistrosGeral.filter(r => r.descricao === clienteLogado);
        for (let reg of registrosCliente) {
            const ref = doc(db, "registros", reg.id);
            await updateDoc(ref, { descricao: novoNome });
            reg.descricao = novoNome; 
        }
        clienteLogado = novoNome;
        document.getElementById('header-nome-cliente').innerText = `Bem-vindo, ${clienteLogado}`;
        alert("Perfil atualizado com sucesso!");
    } catch (error) { alert("Erro na conexão com o servidor."); } 
    finally {
        btnAtualizar.disabled = false;
        btnAtualizar.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Dados';
    }
}
document.getElementById('btn-atualizar-perfil').addEventListener('click', atualizarNomePerfil);

document.getElementById('btn-sair').addEventListener('click', () => {
    clienteLogado = null;
    document.getElementById('painel-cliente').style.display = 'none';
    document.getElementById('tela-login').style.display = 'flex';
    document.getElementById('login-usuario').value = '';
    document.getElementById('login-senha').value = '';
});

document.getElementById('btn-copiar-pix').addEventListener('click', () => {
    const chavePix = document.getElementById('texto-pix-chave').innerText;
    navigator.clipboard.writeText(chavePix).then(() => {
        const btn = document.getElementById('btn-copiar-pix');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Chave Pix Copiada!';
        btn.style.background = 'var(--success)';
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.background = '';
        }, 2000);
    });
});