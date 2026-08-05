export function atualizarListaClientesIA(perfilClientesCache) {
    const selectIA = document.getElementById('ia-cliente-select');
    if (!selectIA) return;
    
    const clientesUnicos = Object.keys(perfilClientesCache);
    
    selectIA.innerHTML = '<option value="">⚙️ Aguardando comando de varredura...</option>';
    
    const optGeral = document.createElement('option');
    optGeral.value = "VARREDURA_GLOBAL";
    optGeral.innerHTML = "🌐 VARREDURA GLOBAL DA CARTEIRA";
    optGeral.style.fontWeight = "bold";
    optGeral.style.color = "var(--accent-gold)";
    selectIA.appendChild(optGeral);
    
    clientesUnicos.forEach(nome => {
        if (nome && nome.trim() !== '') {
            const perfil = perfilClientesCache[nome];
            const option = document.createElement('option');
            option.value = nome;
            const emoji = perfil.score < 50 ? '🔴' : (perfil.score >= 80 ? '🟢' : '🟡');
            option.textContent = `${emoji} ${nome} - Dívida: R$ ${perfil.usado.toFixed(2)}`;
            selectIA.appendChild(option);
        }
    });
}

export async function iniciarAnaliseIA(listaRegistrosProcessados, perfilClientesCache) {
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
        gerarRelatorioGlobal(listaRegistrosProcessados);
    } else {
        gerarRelatorioCliente(valorSelecionado, listaRegistrosProcessados, perfilClientesCache);
    }
}

function gerarRelatorioGlobal(listaRegistrosProcessados) {
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

function gerarRelatorioCliente(clienteNome, listaRegistrosProcessados, perfilClientesCache) {
    const registrosCliente = listaRegistrosProcessados.filter(r => r.descricao === clienteNome);
    const perfilCalculado = perfilClientesCache[clienteNome];
    
    const totalDevido = perfilCalculado.usado;
    const totalOriginal = registrosCliente.reduce((sum, r) => sum + r.valor, 0);
    const totalPago = registrosCliente.reduce((sum, r) => sum + (r.valor_pago || 0), 0);
    const totalJuros = registrosCliente.reduce((sum, r) => sum + ((r.dividaTotal || r.valor) - r.valor), 0);
    const scoreSaude = perfilCalculado.score;
    
    let corRisco = ""; let emojiRisco = ""; let estrategia = ""; let abordagem = ""; let analogiaCliente = "";
    let limiteSugerido = perfilCalculado.limiteLivre; let decisaoCredito = ""; let corDecisao = ""; let iconeDecisao = "";

    if (scoreSaude >= 80) { 
        corRisco = "baixo"; emojiRisco = "🟢"; 
        estrategia = "Fidelização Nível 'Gold Standard'";
        analogiaCliente = "Trata-se de um 'Unicórnio de Crédito'. Liquidez perfeita, previsibilidade impecável. Um alicerce sólido para sua carteira.";
        abordagem = "O cliente possui excelente histórico e seu capital não corre riscos. Envie ofertas exclusivas para alocação de novo capital.";
        decisaoCredito = "CRÉDITO PRÉ-APROVADO";
        corDecisao = "var(--success)";
        iconeDecisao = "fa-check-circle";
    } else if (scoreSaude >= 50) { 
        corRisco = "medio"; emojiRisco = "🟡"; 
        estrategia = "Fricção Ativa Modulada";
        analogiaCliente = "Devedor com comportamento oscilante. Não há intenção latente de fraude, mas demonstra falha de prioridade.";
        abordagem = "Acionar cobrança preventiva. Evitar desgaste direto de relacionamento, mas aplicar penalidades pontuais em atrasos.";
        decisaoCredito = "CRÉDITO RESTRITO";
        corDecisao = "var(--warning)";
        iconeDecisao = "fa-exclamation-triangle";
    } else { 
        corRisco = "alto"; emojiRisco = "🔴"; 
        estrategia = "Operação 'Haircut' Compulsório";
        analogiaCliente = "Este devedor tornou-se um 'Buraco Negro' de capital. Ele suga liquidez e devolve promessas vazias.";
        abordagem = "Recomenda-se quebra de renegociações tradicionais. Propor imediatamente um acordo de liquidação com desconto tático sobre as taxas avulsas para mitigar perda do capital original.";
        decisaoCredito = "CRÉDITO BLOQUEADO";
        corDecisao = "var(--danger)";
        iconeDecisao = "fa-ban";
    }
    
    if (totalPago === 0 && totalDevido === 0 && totalOriginal === 0) {
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

export function copiarAnaliseIA() {
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