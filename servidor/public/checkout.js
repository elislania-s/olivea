document.addEventListener("DOMContentLoaded", () => {

    // ============================================
    // ESTADO
    // ============================================

    const itens = oliveaObterSacola();

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
                    <span>R$ ${valorFrete.toFixed(2).replace(".", ",")}</span>
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

        // Calcula o frete pra sacola inteira, pro CEP informado
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

            freteResultado.innerHTML = dadosFrete.opcoes.map((opcao, index) => `
                <label class="frete-opcao" data-index="${index}">
                    <input type="radio" name="freteEscolha" style="display:none;">
                    <span class="nome-servico">${opcao.servico}${opcao.nome ? " - " + opcao.nome : ""}
                        ${opcao.prazoDias ? ` (até ${opcao.prazoDias} dias úteis)` : ""}
                    </span>
                    <span class="preco-servico">R$ ${opcao.preco.toFixed(2).replace(".", ",")}</span>
                </label>
            `).join("");

            freteResultado.querySelectorAll(".frete-opcao").forEach((elemento, index) => {
                elemento.addEventListener("click", () => {
                    freteResultado.querySelectorAll(".frete-opcao").forEach((el) => el.classList.remove("selecionada"));
                    elemento.classList.add("selecionada");
                    elemento.querySelector("input").checked = true;

                    freteEscolhido = dadosFrete.opcoes[index];
                    atualizarResumo();
                });
            });

            // Já seleciona a primeira opção automaticamente
            freteResultado.querySelector(".frete-opcao")?.click();

        } catch (erro) {
            console.error("[Olivea] Erro ao calcular frete:", erro);
            freteResultado.innerHTML = '<p class="checkout-frete-aviso">Erro ao calcular o frete. Você pode continuar e combinamos pelo WhatsApp.</p>';
        }
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
                        Você vai ser levado pro Mercado Pago já na tela de Pix — só escanear o
                        QR Code ou copiar o código pra pagar. A confirmação é automática.
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

            const resposta = await fetch("/api/criar-preferencia", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    itens,
                    cliente: dadosCliente,
                    frete: freteEscolhido,
                    formaPagamentoPreferida: formaPagamento
                }),
                signal: controlador.signal
            });

            clearTimeout(tempoLimite);
            const dados = await resposta.json();

            if (!resposta.ok || !dados.init_point) {
                throw new Error(dados.erro || "Falha ao criar pagamento");
            }

            window.location.href = dados.init_point;

        } catch (erro) {
            clearTimeout(tempoLimite);

            mensagem.textContent = erro.name === "AbortError"
                ? "Demorou demais pra responder. Tente novamente."
                : "Não foi possível continuar. Tente novamente ou fale conosco no WhatsApp.";

            btnContinuar.disabled = false;
        }
    });

});