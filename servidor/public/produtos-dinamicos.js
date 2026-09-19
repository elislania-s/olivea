/* ======================================
   PRODUTOS DINÂMICOS — OLIVEA

   Busca os produtos no banco (via nossa API)
   e monta os cards, tanto nas páginas de
   coleção (colares, brincos, pulseiras,
   coleção) quanto nos "Destaques" da home.

   Não mexe no script2.js/script3.js/script.js
   que já existem — eles continuam cuidando do
   filtro e da ordenação por preço normalmente,
   porque eles procuram os cards "ao vivo" toda
   vez que você clica, então funcionam também
   com os cards que este arquivo cria.
====================================== */

document.addEventListener("DOMContentLoaded", async () => {

    const gridColecao = document.getElementById("collectionGrid");
    const gridDestaques = document.querySelector(".products-grid");

    if (gridColecao) {
        await carregarColecao(gridColecao);
    }

    if (gridDestaques) {
        await carregarDestaques(gridDestaques);
    }
});


async function carregarColecao(grid) {

    try {
        const categoria = grid.dataset.categoria || "";

        // Respeita o "produtos por página" definido no painel admin
        const configuracoes = await (await fetch("/api/configuracoes")).json();
        const limite = configuracoes.itens_por_pagina || 9;

        let url = "/api/produtos";
        if (categoria) url += "?categoria=" + encodeURIComponent(categoria);

        const resposta = await fetch(url);
        const produtos = await resposta.json();

        if (!produtos || produtos.length === 0) {
            grid.innerHTML = '<p style="padding:40px 0;grid-column:1/-1;">Em breve, novos produtos por aqui.</p>';
            esconderVerMais();
            return;
        }

        const produtosVisiveis = produtos.slice(0, limite);

        grid.innerHTML = produtosVisiveis.map(criarCardColecao).join("");

        inicializarInteracaoCards(grid);

        // Como já aplicamos o limite aqui, o botão "Ver mais" (feito
        // pra esconder linhas incompletas de cards fixos) não se aplica
        // mais — evita comportamento estranho com conteúdo dinâmico.
        esconderVerMais();

    } catch (erro) {
        console.error("[Olivea] Erro ao carregar coleção:", erro);
        grid.innerHTML = '<p style="padding:40px 0;grid-column:1/-1;">Não foi possível carregar os produtos agora.</p>';
    }
}

async function carregarDestaques(grid) {

    try {
        const resposta = await fetch("/api/produtos?destaque=true");
        const produtos = await resposta.json();

        if (!produtos || produtos.length === 0) {
            return; // mantém a seção discretamente vazia
        }

        grid.innerHTML = produtos.map(criarCardDestaque).join("");

        inicializarInteracaoCards(grid);

    } catch (erro) {
        console.error("[Olivea] Erro ao carregar destaques:", erro);
    }
}

function esconderVerMais() {
    const btn = document.querySelector(".collection-products .see-more");
    if (btn) btn.style.display = "none";
}


/* ================================================
   MONTAGEM DOS CARDS (mesma estrutura/classes que
   o CSS do site já espera)
================================================ */

function montarDots(imagens) {
    return imagens.map((img, i) => `
        <button class="dot${i === 0 ? " active" : ""}" data-image="${img}" aria-label="Imagem ${i + 1}"></button>
    `).join("");
}

// Caixinha de imagem com proporção travada por matemática (padding
// em %), não pelo "aspect-ratio" do CSS — esse último tem
// comportamento inconsistente em alguns Safari/iOS, e foi a causa
// dos cards ficando de tamanhos diferentes no celular.
function montarCaixaImagem(imagens, nomeProduto, proporcaoAlturaLargura) {
    return `
        <div class="product-image-box" style="
            position: relative;
            width: 100%;
            height: 0;
            padding-bottom: ${proporcaoAlturaLargura}%;
            overflow: hidden;
            background-color: transparent;
        ">
            <img src="${imagens[0]}" alt="${nomeProduto}" class="product-image" style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 68%;
                height: 81%;
                object-fit: contain;
            ">
            <div class="product-dots" style="
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: 5px;
            ">${montarDots(imagens)}</div>
        </div>
    `;
}

// Título com altura travada em 2 linhas — não importa o quão
// grande o nome do produto seja, o botão "Comprar" sempre fica na
// mesma posição em todos os cards da fileira.
function montarTitulo(nome, tag) {
    return `
        <${tag} style="
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            min-height: 2.3em;
        ">${nome}</${tag}>
    `;
}

function criarCardColecao(produto) {

    const imagens = (produto.imagens && produto.imagens.length) ? produto.imagens : [""];

    return `
        <article class="product-card" data-category="${produto.categoria}" data-price="${produto.preco}">
            <a href="produto.html?id=${produto.id}" style="text-decoration:none; color:inherit; display:block; width:100%;">
                ${montarCaixaImagem(imagens, produto.nome, 99.375)}
                ${montarTitulo(produto.nome, "h3")}
                <p class="product-price">R$ ${Number(produto.preco).toFixed(2).replace(".", ",")}</p>
            </a>
            <a href="produto.html?id=${produto.id}" class="buy-button">COMPRAR</a>
        </article>
    `;
}

function criarCardDestaque(produto) {

    const imagens = (produto.imagens && produto.imagens.length) ? produto.imagens : [""];

    return `
        <article class="product-card">
            <a href="produto.html?id=${produto.id}" class="product-link" style="width:100%;">
                ${montarCaixaImagem(imagens, produto.nome, 105.17)}
                ${montarTitulo(produto.nome.toUpperCase(), "h3")}
                <p class="product-price">R$ ${Number(produto.preco).toFixed(2).replace(".", ",")}</p>
            </a>
        </article>
    `;
}


/* ================================================
   INTERAÇÃO DOS CARDS (troca de imagem por hover/
   dots/swipe) — mesma lógica de sempre, só que
   aplicada nos cards recém-criados
================================================ */

function inicializarInteracaoCards(container) {

    container.querySelectorAll(".product-card").forEach((card) => {

        const box = card.querySelector(".product-image-box");
        const image = card.querySelector(".product-image");
        const dots = Array.from(card.querySelectorAll(".dot"));
        const imagens = dots.map((dot) => dot.dataset.image);

        if (!box || !image || dots.length === 0) return;

        let indiceAtual = 0;

        function marcarDotAtivo(index) {
            dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
        }

        function trocarImagem(index, { instantaneo = false } = {}) {

            if (index === indiceAtual || index < 0 || index >= imagens.length) return;

            indiceAtual = index;

            if (instantaneo) {
                image.style.transition = "none";
                image.src = imagens[indiceAtual];
                void image.offsetWidth;
                image.style.transition = "";
            } else {
                image.style.opacity = "0";
                setTimeout(() => {
                    image.src = imagens[indiceAtual];
                    image.style.opacity = "1";
                }, 90);
            }

            marcarDotAtivo(indiceAtual);
        }

        dots.forEach((dot, index) => {
            dot.addEventListener("click", (evento) => {
                evento.preventDefault();
                evento.stopPropagation();
                trocarImagem(index);
            });
        });

        box.addEventListener("mousemove", (evento) => {
            const rect = box.getBoundingClientRect();
            const relativeX = evento.clientX - rect.left;
            const sliceWidth = rect.width / imagens.length;
            let index = Math.floor(relativeX / sliceWidth);
            index = Math.max(0, Math.min(imagens.length - 1, index));
            trocarImagem(index);
        });

        box.addEventListener("mouseleave", () => trocarImagem(0));

        let touchStartX = 0;
        let touchDeltaX = 0;
        const SWIPE_THRESHOLD = 35;

        box.addEventListener("touchstart", (evento) => {
            touchStartX = evento.touches[0].clientX;
            touchDeltaX = 0;
        }, { passive: true });

        box.addEventListener("touchmove", (evento) => {
            touchDeltaX = evento.touches[0].clientX - touchStartX;
        }, { passive: true });

        box.addEventListener("touchend", () => {
            if (Math.abs(touchDeltaX) > SWIPE_THRESHOLD) {
                if (touchDeltaX < 0) {
                    trocarImagem((indiceAtual + 1) % imagens.length, { instantaneo: true });
                } else {
                    trocarImagem((indiceAtual - 1 + imagens.length) % imagens.length, { instantaneo: true });
                }
            }
        });
    });
}