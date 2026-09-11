/* ======================================
   CHECKOUT — MERCADO PAGO

   Este arquivo só sabe conversar com um
   endereço de backend (/api/criar-preferencia).
   Ele NÃO processa pagamento sozinho —
   isso é proposital: dados de pagamento e
   a chave secreta do Mercado Pago nunca
   podem ficar no navegador do cliente.

   Veja o arquivo
   "mercadopago-servidor-exemplo.js" e o
   "INSTRUCOES-MERCADOPAGO.md" para montar
   essa parte.
====================================== */

document.addEventListener("click", async function (evento) {

    if (evento.target.id !== "btnFinalizarCompra") return;

    const botao = evento.target;
    const itens = oliveaObterSacola();

    if (itens.length === 0) return;

    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = "PROCESSANDO...";

    try {

        const resposta = await fetch("/api/criar-preferencia", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itens })
        });

        if (!resposta.ok) {
            throw new Error("Falha ao criar preferência");
        }

        const dados = await resposta.json();

        if (dados.init_point) {
            window.location.href = dados.init_point;
        } else {
            throw new Error("Resposta sem init_point");
        }

    } catch (erro) {
        console.error(erro);
        alert(
            "Não foi possível iniciar o pagamento agora. " +
            "Tente novamente em instantes ou fale com a gente pelo WhatsApp."
        );
        botao.disabled = false;
        botao.textContent = textoOriginal;
    }

});