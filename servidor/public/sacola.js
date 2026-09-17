function sacolaRenderizar() {

    const wrapper = document.getElementById("sacolaConteudoWrapper");
    const itens = oliveaObterSacola();

    if (itens.length === 0) {
        wrapper.innerHTML = `
            <div class="sacola-vazia">
                Sua sacola está vazia. <a href="colecao.html">Ver a coleção</a>
            </div>
        `;
        return;
    }

    const linhasItens = itens.map((item) => `
        <div class="sacola-item" data-id="${item.id}">

            <div class="sacola-item-imagem">
                <img src="${item.imagem}" alt="${item.nome}">
            </div>

            <div class="sacola-item-info">
                <a href="produto.html?id=${item.id}" class="sacola-item-nome-link">
                    <h3 class="sacola-item-nome">${item.nome}</h3>
                </a>
                <span class="sacola-item-preco">
                    R$ ${item.preco.toFixed(2).replace(".", ",")}
                </span>
            </div>

            <div class="sacola-item-qtd">
                <button type="button" class="sacola-qtd-menos" aria-label="Diminuir">−</button>
                <span>${item.quantidade}</span>
                <button type="button" class="sacola-qtd-mais" aria-label="Aumentar">+</button>
            </div>

            <button type="button" class="sacola-item-remover">Remover</button>

        </div>
    `).join("");

    const total = oliveaTotalSacola();

    wrapper.innerHTML = `
        <div class="sacola-conteudo">

            <div class="sacola-lista">
                ${linhasItens}
            </div>

            <aside class="sacola-resumo">

                <h2>Resumo do pedido</h2>

                <div class="sacola-resumo-linha">
                    <span>Subtotal</span>
                    <span>R$ ${total.toFixed(2).replace(".", ",")}</span>
                </div>

                <div class="sacola-resumo-linha">
                    <span>Frete</span>
                    <span>Calculado no checkout</span>
                </div>

                <div class="sacola-resumo-total">
                    <span>Total</span>
                    <span>R$ ${total.toFixed(2).replace(".", ",")}</span>
                </div>

                <a href="checkout.html" class="btn-finalizar-compra" id="btnFinalizarCompra">
                    🔒 FINALIZAR COMPRA
                </a>

                <div class="sacola-seguranca">
                    Pagamento processado com segurança pelo Mercado Pago
                </div>

            </aside>

        </div>
    `;

    // ---- Ações de cada item (+, -, remover) ----

    wrapper.querySelectorAll(".sacola-item").forEach((linha) => {

        const id = linha.dataset.id;
        const item = itens.find((i) => i.id === id);

        linha.querySelector(".sacola-qtd-menos").addEventListener("click", () => {
            oliveaAtualizarQuantidade(id, item.quantidade - 1);
            sacolaRenderizar();
        });

        linha.querySelector(".sacola-qtd-mais").addEventListener("click", () => {
            oliveaAtualizarQuantidade(id, item.quantidade + 1);
            sacolaRenderizar();
        });

        linha.querySelector(".sacola-item-remover").addEventListener("click", () => {
            oliveaRemoverDaSacola(id);
            sacolaRenderizar();
        });
    });
}

document.addEventListener("DOMContentLoaded", sacolaRenderizar);

// "pageshow" dispara também quando a página volta do cache do
// navegador (botão voltar) — sem isso, o botão "voltar" às vezes
// mostra uma versão congelada de antes, sem os itens atualizados.
window.addEventListener("pageshow", sacolaRenderizar);