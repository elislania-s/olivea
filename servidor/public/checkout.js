document.addEventListener("DOMContentLoaded", () => {

    // ============================================
    // ESTADO
    // ============================================

    let itens = oliveaObterSacola();

    if (itens.length === 0) {
        window.location.href = "sacola.html";
        return;
    }

    let freteEscolhido = null; // { servico, preco, prazoDias }


    // ============================================
    // RESUMO DA SACOLA (recalcula sempre que o
    // frete muda)
    // ============================================

    function atualizarResumo() {

        const resumo = document.getElementById("checkoutResumo");
        const total = oliveaTotalSacola();
        const valorFrete = freteEscolhido ? freteEscolhido.preco : 0;
        const totalComFrete = total + valorFrete;

        resumo.innerHTML = `
            <h2>Seu pedido</h2>
            ${itens.map((item) => `
                <div class="checkout-resumo-item">
                    <span>${item.quantidade}x ${item.nome}</span>
                    <span>R$ ${(item.preco * item.quantidade).toFixed(2).replace(".", ",")}</span>
                </div>
            `).join("")}
            ${freteEscolhido ? `
                <div class="checkout-resumo-item">
                    <span>Frete (${freteEscolhido.servico})</span>
                    <span>${valorFrete === 0 ? "GRÁTIS" : "R$ " + valorFrete.toFixed(2).replace(".", ",")}</span>
                </div>
            ` : `
                <div class="checkout-resumo-item">
                    <span>Frete</span>
                    <span>a definir</span>
                </div>
            `}
            <div class="checkout-resumo-total">
                <span>Total</span>
                <span>R$ ${totalComFrete.toFixed(2).replace(".", ",")}</span>
            </div>
        `;
    }

    atualizarResumo();


    // ============================================
    // RESERVA DOS ITENS + CONTADOR DE 20 MINUTOS
    //
    // Ao abrir o checkout, os itens ficam "segurados"
    // por 20 min pra ninguém comprar a mesma peça. Se o
    // tempo acabar, os itens saem da sacola e voltam
    // a ficar disponíveis pra outras pessoas.
    // ============================================

    const MINUTOS_CHECKOUT = 20;
    const token = oliveaToken();

    // Convite de frete grátis (quem entrou pelo link secreto).
    // O servidor confirma se é verdadeiro; se não for, descarta.
    const convite = oliveaObterConvite();
    let conviteValido = false;

    const conviteChecado = (async () => {
        if (!convite) return;

        try {
            const resposta = await fetch("/api/convite-valido", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ convite })
            });

            const dados = await resposta.json();
            conviteValido = dados.valido === true;

            if (!conviteValido) {
                oliveaDescartarConvite();
            }
        } catch (erro) {
            conviteValido = false;
        }
    })();
    let intervaloContador = null;

    // Faixa com o contador, no topo da página
    const faixa = document.createElement("div");
    faixa.id = "oliveaContador";
    faixa.style.cssText =
        "position:sticky;top:0;z-index:50;padding:10px 16px;text-align:center;" +
        "background:#F3EDE3;color:#3F3026;font-family:'Montserrat',sans-serif;" +
        "font-size:13px;border-bottom:1px solid #E0D6C6;display:none;";
    document.body.insertBefore(faixa, document.body.firstChild);

    function formatarTempo(segundos) {
        const m = Math.floor(segundos / 60);
        const s = segundos % 60;
        return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
    }

    function tempoAcabou() {
        clearInterval(intervaloContador);

        try {
            localStorage.removeItem(OLIVEA_EXPIRA_CHAVE);
        } catch (erro) { /* ignora */ }

        oliveaLimparSacola();
        oliveaGuardarAviso(
            "O tempo para finalizar o pedido acabou e os itens saíram da sua sacola, " +
            "para ficarem disponíveis para outras pessoas. Se ainda quiser, é só adicionar de novo."
        );
        window.location.href = "sacola.html";
    }

    function iniciarContador(segundosRestantes) {
        const expiraEm = Date.now() + segundosRestantes * 1000;

        try {
            localStorage.setItem(OLIVEA_EXPIRA_CHAVE, String(expiraEm));
        } catch (erro) { /* ignora */ }

        clearInterval(intervaloContador);

        function atualizar() {
            const restante = Math.max(0, Math.round((expiraEm - Date.now()) / 1000));

            if (restante <= 0) {
                tempoAcabou();
                return;
            }

            faixa.style.display = "block";
            faixa.style.background = restante <= 120 ? "#F6DCD5" : "#F3EDE3";
            faixa.innerHTML =
                "⏳ Seus itens estão reservados por <strong>" + formatarTempo(restante) +
                "</strong> — finalize o pedido antes que o tempo acabe.";
        }

        atualizar();
        intervaloContador = setInterval(atualizar, 1000);
    }

    // Ajusta a sacola quando alguma peça esgotou / está com outra pessoa.
    // Devolve true se mudou alguma coisa.
    function tratarAjustes(ajustes) {

        if (!ajustes || ajustes.length === 0) return false;

        const mensagens = [];
        let sacola = oliveaObterSacola();

        ajustes.forEach((ajuste) => {
            const item = sacola.find((i) => String(i.id) === String(ajuste.id));
            if (!item) return;

            const nome = item.nome;
            const reservado = Number(ajuste.reservado) || 0;

            if (ajuste.motivo === "reservado") {
                mensagens.push(
                    "“" + nome + "” está reservado por outra pessoa que está finalizando a compra agora. " +
                    "Se ela não concluir, a peça volta a ficar disponível em alguns minutos."
                );
            } else if (reservado > 0) {
                mensagens.push(
                    "Só temos " + reservado + " unidade(s) de “" + nome + "” disponível(is) — ajustamos a quantidade."
                );
            } else {
                mensagens.push("“" + nome + "” esgotou.");
            }

            if (reservado > 0) {
                item.quantidade = reservado;
            } else {
                sacola = sacola.filter((i) => String(i.id) !== String(ajuste.id));
            }
        });

        if (mensagens.length === 0) return false;

        oliveaSalvarSacola(sacola);
        itens = oliveaObterSacola();

        if (itens.length === 0) {
            clearInterval(intervaloContador);

            try {
                localStorage.removeItem(OLIVEA_EXPIRA_CHAVE);
            } catch (erro) { /* ignora */ }

            oliveaGuardarAviso(mensagens.join(" "));
            window.location.href = "sacola.html";
            return true;
        }

        // O total mudou, então o frete precisa ser recalculado
        freteEscolhido = null;
        atualizarResumo();

        const cepAtual = inputCep.value.replace(/\D/g, "");
        if (cepAtual.length === 8) {
            calcularFrete(cepAtual);
        }

        mensagem.textContent = mensagens.join(" ");
        return true;
    }

    async function reservarItens() {
        try {
            const resposta = await fetch("/api/reservar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    itens: itens.map((i) => ({ id: i.id, quantidade: i.quantidade }))
                })
            });

            if (!resposta.ok) throw new Error("Falha ao reservar");

            const dados = await resposta.json();

            if (tratarAjustes(dados.ajustes) && itens.length === 0) return;

            iniciarContador(dados.restante_s);

        } catch (erro) {
            // Sem conseguir falar com o servidor agora: segue com o
            // contador local. O servidor confere tudo de novo no pagamento.
            console.error("[Olivea] Não foi possível reservar os itens:", erro);
            iniciarContador(MINUTOS_CHECKOUT * 60);
        }
    }

    // (o "mensagem" é declarado mais abaixo; a reserva só roda depois do
    // carregamento completo, então já existe quando for usado)
    setTimeout(reservarItens, 0);


    // ============================================
    // CEP AUTOMÁTICO (ViaCEP) + CÁLCULO DE FRETE
    // (considerando a sacola inteira)
    // ============================================

    const inputCep = document.getElementById("cep");
    const cepStatus = document.getElementById("cepStatus");
    const freteResultado = document.getElementById("freteCheckoutResultado");

    inputCep.addEventListener("input", () => {
        let valor = inputCep.value.replace(/\D/g, "").slice(0, 8);
        if (valor.length > 5) valor = valor.slice(0, 5) + "-" + valor.slice(5);
        inputCep.value = valor;
    });

    // Calcula o frete pra sacola inteira, pro CEP informado
    async function calcularFrete(cepLimpo) {
        await conviteChecado;

        freteResultado.innerHTML = '<p class="checkout-frete-aviso">Calculando opções de frete...</p>';
        freteEscolhido = null;
        atualizarResumo();

        try {
            const respostaFrete = await fetch("/api/calcular-frete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ itens, cepDestino: cepLimpo })
            });

            const dadosFrete = await respostaFrete.json();

            if (!respostaFrete.ok || !dadosFrete.opcoes || dadosFrete.opcoes.length === 0) {
                freteResultado.innerHTML = '<p class="checkout-frete-aviso">Não encontramos opções de frete pra esse CEP. Vamos combinar pelo WhatsApp.</p>';
                return;
            }

            // Da mais barata pra mais cara: assim a primeira (já selecionada
            // e somada no resumo) é sempre a de menor valor.
            const opcoes = [...dadosFrete.opcoes].sort((a, b) => a.preco - b.preco);

            // Frete grátis a partir de R$ 100 em produtos (sem contar o
            // próprio frete) — o cliente ainda escolhe o TIPO de envio
            // (PAC, SEDEX, Mini Envios), só que o valor cobrado é zero.
            const freteGratisPorValor = oliveaTotalSacola() >= 100;
            const freteGratis = freteGratisPorValor || conviteValido;

            freteResultado.innerHTML = opcoes.map((opcao, index) => `
                <label class="frete-opcao" data-index="${index}">
                    <input type="radio" name="freteEscolha" style="display:none;">
                    <span class="nome-servico">${opcao.servico}${opcao.nome ? " - " + opcao.nome : ""}
                        ${opcao.prazoDias ? ` (até ${opcao.prazoDias} dias úteis)` : ""}
                    </span>
                    <span class="preco-servico">${freteGratis ? "GRÁTIS" : "R$ " + opcao.preco.toFixed(2).replace(".", ",")}</span>
                </label>
            `).join("") + (freteGratis
                ? '<p class="checkout-frete-aviso" style="margin-top:8px;">' +
                  (freteGratisPorValor
                      ? "🎉 Frete grátis, sua compra passou de R$ 100!"
                      : "🎁 Frete grátis — cortesia Olivea!") +
                  "</p>"
                : "");

            freteResultado.querySelectorAll(".frete-opcao").forEach((elemento, index) => {
                elemento.addEventListener("click", () => {
                    freteResultado.querySelectorAll(".frete-opcao").forEach((el) => el.classList.remove("selecionada"));
                    elemento.classList.add("selecionada");
                    elemento.querySelector("input").checked = true;

                    freteEscolhido = {
                        ...opcoes[index],
                        preco: freteGratis ? 0 : opcoes[index].preco
                    };
                    atualizarResumo();
                });
            });

            // Já seleciona a opção mais barata (a primeira da lista) automaticamente
            freteResultado.querySelector(".frete-opcao")?.click();

        } catch (erro) {
            console.error("[Olivea] Erro ao calcular frete:", erro);
            freteResultado.innerHTML = '<p class="checkout-frete-aviso">Erro ao calcular o frete. Você pode continuar e combinamos pelo WhatsApp.</p>';
        }
    }

    inputCep.addEventListener("blur", async () => {

        const cepLimpo = inputCep.value.replace(/\D/g, "");
        if (cepLimpo.length !== 8) return;

        cepStatus.textContent = "Buscando endereço...";
        cepStatus.className = "checkout-cep-status";

        try {
            const resposta = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
            const dados = await resposta.json();

            if (dados.erro) {
                cepStatus.textContent = "CEP não encontrado. Preencha o endereço manualmente.";
                cepStatus.className = "checkout-cep-status erro";
            } else {
                document.getElementById("rua").value = dados.logradouro || "";
                document.getElementById("bairro").value = dados.bairro || "";
                document.getElementById("cidade").value = dados.localidade || "";
                document.getElementById("estado").value = dados.uf || "";

                cepStatus.textContent = "Endereço encontrado — confira e complete o número.";
                cepStatus.className = "checkout-cep-status";

                document.getElementById("numero").focus();
            }
        } catch (erro) {
            cepStatus.textContent = "Não foi possível buscar o CEP. Preencha manualmente.";
            cepStatus.className = "checkout-cep-status erro";
        }

        await calcularFrete(cepLimpo);
    });


    // ============================================
    // FORMA DE PAGAMENTO
    // ============================================

    const blocoPix = document.getElementById("blocoPix");
    const btnContinuar = document.getElementById("btnContinuar");

    document.querySelectorAll('input[name="formaPagamento"]').forEach((radio) => {
        radio.addEventListener("change", () => {

            const ehPix = document.querySelector('input[name="formaPagamento"]:checked').value === "pix";

            blocoPix.hidden = !ehPix;
            btnContinuar.textContent = "IR PARA O PAGAMENTO";

            if (ehPix) {
                blocoPix.innerHTML = `
                    <p class="checkout-frete-aviso">
                        Você vai ser levado pro ambiente seguro da InfinitePay já na tela de Pix — só
                        escanear o QR Code ou copiar o código pra pagar. A confirmação é automática.
                    </p>
                `;
            }
        });
    });


    // ============================================
    // ENVIAR PEDIDO
    // ============================================

    const form = document.getElementById("formCheckout");
    const mensagem = document.getElementById("checkoutMensagem");

    form.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        if (btnContinuar.disabled) return;

        btnContinuar.disabled = true;
        mensagem.textContent = "";

        const dadosCliente = {
            nomeCompleto: document.getElementById("nomeCompleto").value.trim(),
            email: document.getElementById("email").value.trim(),
            whatsapp: document.getElementById("whatsapp").value.trim(),
            cep: document.getElementById("cep").value.trim(),
            rua: document.getElementById("rua").value.trim(),
            numero: document.getElementById("numero").value.trim(),
            complemento: document.getElementById("complemento").value.trim(),
            bairro: document.getElementById("bairro").value.trim(),
            cidade: document.getElementById("cidade").value.trim(),
            estado: document.getElementById("estado").value.trim().toUpperCase()
        };

        const formaPagamento = document.querySelector('input[name="formaPagamento"]:checked').value;

        const controlador = new AbortController();
        const tempoLimite = setTimeout(() => controlador.abort(), 40000);

        try {

            const resposta = await fetch("/api/criar-checkout-infinitepay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    convite: conviteValido ? convite : undefined,
                    itens: itens.map((i) => ({ id: i.id, quantidade: i.quantidade })),
                    cliente: dadosCliente,
                    frete: freteEscolhido,
                    formaPagamentoPreferida: formaPagamento
                }),
                signal: controlador.signal
            });

            clearTimeout(tempoLimite);
            const dados = await resposta.json();

            // Alguma peça esgotou / foi segurada por outra pessoa no meio tempo
            if (resposta.status === 409 && dados.ajustes) {
                tratarAjustes(dados.ajustes);
                btnContinuar.disabled = false;
                return;
            }

            if (!resposta.ok || !dados.checkout_url) {
                throw new Error(dados.erro || "Falha ao criar pagamento");
            }

            // Guarda o pedido (pra esvaziar a sacola depois de pago, mesmo
            // que o cliente não volte pela página de sucesso) e estende o
            // prazo da reserva pro tempo do pagamento.
            try {
                localStorage.setItem(OLIVEA_PEDIDO_CHAVE, JSON.stringify({
                    id: dados.pedido_id,
                    itens: itens.map((i) => ({ id: i.id, quantidade: i.quantidade }))
                }));

                if (dados.restante_s) {
                    localStorage.setItem(
                        OLIVEA_EXPIRA_CHAVE,
                        String(Date.now() + dados.restante_s * 1000)
                    );
                }
            } catch (erroStorage) { /* ignora */ }

            clearInterval(intervaloContador);
            window.location.href = dados.checkout_url;

        } catch (erro) {
            clearTimeout(tempoLimite);

            mensagem.textContent = erro.name === "AbortError"
                ? "Demorou demais pra responder. Tente novamente."
                : "Não foi possível continuar. Tente novamente ou fale conosco no WhatsApp.";

            btnContinuar.disabled = false;
        }
    });

});