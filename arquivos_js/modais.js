// modais.js
export function fecharModal() { 
    document.getElementById('meuModal').style.display = 'none'; 
}

export function fecharModalDetalhes() { 
    document.getElementById('modalDetalhes').style.display = 'none'; 
}

export function abrirModal(titulo, texto, corBotao, acaoConfirmar, precisaInput = true) {
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