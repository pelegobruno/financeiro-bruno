import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, getDocs, updateDoc, doc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// ==========================================
// FUNÇÃO DE ALERTA PERSONALIZADO (NOVO)
// ==========================================
function mostrarAlerta(titulo, mensagem, tipo = 'info') {
    const modal = document.getElementById('modalAlerta');
    const icone = document.getElementById('alerta-icone');
    
    document.getElementById('alerta-titulo').innerText = titulo;
    document.getElementById('alerta-mensagem').innerText = mensagem;
    
    if (tipo === 'sucesso') {
        icone.innerHTML = '<i class="fas fa-check-circle" style="color: var(--success, #10b981);"></i>';
    } else if (tipo === 'erro') {
        icone.innerHTML = '<i class="fas fa-exclamation-circle" style="color: var(--danger, #ef4444);"></i>';
    } else {
        icone.innerHTML = '<i class="fas fa-info-circle" style="color: var(--info, #3b82f6);"></i>';
    }
    
    modal.style.display = 'flex';
}

// ==========================================
// COMPRESSÃO E ENVIO DE COMPROVANTE (CANVAS)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const inputComp = document.getElementById('input-comprovante');
    if (inputComp) {
        inputComp.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if(!file) return;

            const labelBtn = document.getElementById('label-comprovante');
            if (labelBtn) {
                labelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
                labelBtn.style.pointerEvents = 'none';
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = async function() {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 600; 
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

                    try {
                        await addDoc(collection(db, "comprovantes"), {
                            cliente: clienteLogado,
                            imagem: dataUrl,
                            dataEnvio: new Date().toLocaleString('pt-BR'),
                            status: 'pendente'
                        });
                        mostrarAlerta("Enviado com Sucesso!", "Seu comprovante foi recebido. O banco analisará a baixa em breve.", "sucesso");
                    } catch(err) {
                        console.error(err);
                        mostrarAlerta("Erro no Envio", "Não foi possível enviar o arquivo. Tente novamente.", "erro");
                    } finally {
                        if (labelBtn) {
                            labelBtn.innerHTML = '<i class="fas fa-camera"></i> Enviar Comprovante';
                            labelBtn.style.pointerEvents = 'auto';
                        }
                    }
                }
                img.src = e.target.result;
            }
            reader.readAsDataURL(file);
        });
    }
});

// ==========================================
// AUTENTICAÇÃO E NAVEGAÇÃO
// ==========================================
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
            sessionStorage.setItem('clienteLogado', clienteLogado);
            iniciarPainelCliente();
        } else {
            mostrarAlerta("Acesso Negado", "Cliente não encontrado na base de dados.", "erro");
        }
    } catch (error) {
        mostrarAlerta("Erro de Conexão", "Falha ao se conectar com o servidor.", "erro");
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
        const dataVencimentoOriginal = new Date(partesData[0], partesData[1] - 1, partesData[2]);
        dataVencimentoOriginal.setHours(0, 0, 0, 0);

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

        let dataVencimentoEfetiva = new Date(dataVencimentoOriginal.getTime());
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

        const strOriginal = `${String(dataVencimentoOriginal.getDate()).padStart(2, '0')}/${String(dataVencimentoOriginal.getMonth() + 1).padStart(2, '0')}/${dataVencimentoOriginal.getFullYear()}`;
        const strEfetiva = `${String(dataVencimentoEfetiva.getDate()).padStart(2, '0')}/${String(dataVencimentoEfetiva.getMonth() + 1).padStart(2, '0')}/${dataVencimentoEfetiva.getFullYear()}`;

        dadosTabela.push({
            ...reg, 
            dataOriginalStr: strOriginal,
            dataEfetivaStr: strEfetiva,
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

        let dataExibicao = reg.dataOriginalStr;
        if (reg.isQuitado) {
            dataExibicao = "Finalizado";
        } else if (reg.parcelasPagas > 0) {
            dataExibicao = `${reg.dataEfetivaStr} <br><span style="font-size: 9px; color: var(--accent-gold); font-weight: bold;">(Próx. Parcela)</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${reg.tipo}</strong></td>
            <td>${dataExibicao}</td>
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
    if (!novoNome) return mostrarAlerta("Atenção", "O nome não pode ficar vazio.", "erro");
    if (novoNome === clienteLogado) return mostrarAlerta("Aviso", "Seus dados já estão atualizados.", "info");

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
        sessionStorage.setItem('clienteLogado', clienteLogado);
        document.getElementById('header-nome-cliente').innerText = `Bem-vindo, ${clienteLogado}`;
        mostrarAlerta("Sucesso!", "Seu perfil foi atualizado corretamente.", "sucesso");
    } catch (error) { 
        mostrarAlerta("Erro", "Falha na conexão com o servidor.", "erro"); 
    } 
    finally {
        btnAtualizar.disabled = false;
        btnAtualizar.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Dados';
    }
}
document.getElementById('btn-atualizar-perfil').addEventListener('click', atualizarNomePerfil);

// LOGOUT: LIMPA A SESSÃO
document.getElementById('btn-sair').addEventListener('click', () => {
    clienteLogado = null;
    sessionStorage.removeItem('clienteLogado');
    document.getElementById('painel-cliente').style.display = 'none';
    document.getElementById('tela-login').style.display = 'flex';
    document.getElementById('login-usuario').value = '';
    document.getElementById('login-senha').value = '';
});

// COPIAR PIX COM ANIMAÇÃO NO BOTÃO (Sem popup)
document.getElementById('btn-copiar-pix').addEventListener('click', () => {
    const chavePix = document.getElementById('texto-pix-chave').innerText;
    navigator.clipboard.writeText(chavePix).then(() => {
        const btn = document.getElementById('btn-copiar-pix');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
        btn.style.background = 'var(--success)';
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.background = '';
        }, 2000);
    });
});

// ==========================================
// RESTAURAÇÃO DE SESSÃO DO CLIENTE (REFRESH)
// ==========================================
async function verificarSessaoCliente() {
    const clienteSalvo = sessionStorage.getItem('clienteLogado');
    if (clienteSalvo) {
        const btnEntrar = document.getElementById('btn-entrar');
        btnEntrar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restaurando sessão...';
        btnEntrar.disabled = true;
        
        try {
            const querySnapshot = await getDocs(collection(db, "registros"));
            listaRegistrosGeral = [];
            querySnapshot.forEach((doc) => {
                const reg = doc.data(); reg.id = doc.id;
                listaRegistrosGeral.push(reg);
            });
            
            clienteLogado = clienteSalvo;
            iniciarPainelCliente();
        } catch (error) {
            sessionStorage.removeItem('clienteLogado');
            btnEntrar.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar no Sistema';
            btnEntrar.disabled = false;
        }
    }
}
verificarSessaoCliente();