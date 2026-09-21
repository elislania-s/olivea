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
//
// Navegação por SETAS laterais (não bolinhas): mais clara em
// qualquer tamanho de tela, e continua funcionando com arrastar
// (swipe) no celular e passar o mouse no desktop.
function montarCaixaImagem(imagens, nomeProduto, proporcaoAlturaLargura) {

    const temVariasFotos = imagens.length > 1;

    return `
        <div class="product-image-box" data-imagens='${JSON.stringify(imagens)}' style="
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
            ${temVariasFotos ? `
                <button type="button" class="seta-imagem seta-imagem-esquerda" aria-label="Foto anterior" style="${estiloSeta("left")}">‹</button>
                <button type="button" class="seta-imagem seta-imagem-direita" aria-label="Próxima foto" style="${estiloSeta("right")}">›</button>
            ` : ""}
        </div>
    `;
}

function estiloSeta(lado) {
    return `
        position: absolute;
        top: 50%;
        ${lado}: 8px;
        transform: translateY(-50%);
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: none;
        background-color: rgba(252, 250, 246, 0.85);
        color: #3F3026;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    `;
}

// Título com altura travada em 2 linhas — não importa o quão
// grande o nome do produto seja, o botão "Comprar" sempre fica na
// mesma posição em todos os cards da fileira.
function montarTitulo(nome, tag, centralizado) {
    return `
        <${tag} style="
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            min-height: 2.3em;
            ${centralizado ? "text-align: center;" : ""}
        ">${nome}</${tag}>
    `;
}

function criarCardColecao(produto) {

    const imagens = (produto.imagens && produto.imagens.length) ? produto.imagens : [""];

    return `
        <article class="product-card" data-category="${produto.categoria}" data-price="${produto.preco}">
            <a href="produto.html?id=${produto.id}" style="text-decoration:none; color:inherit; display:block; width:100%;">
                ${montarCaixaImagem(imagens, produto.nome, 99.375)}
                ${montarTitulo(produto.nome, "h3", false)}
                <p class="product-price">R$ ${Number(produto.preco).toFixed(2).replace(".", ",")}</p>
            </a>
            <a href="produto.html?id=${produto.id}" class="buy-button">COMPRAR</a>
        </article>
    `;
}

function criarCardDestaque(produto) {

    const imagens = (produto.imagens && produto.imagens.length) ? produto.imagens : [""];

    return `
        <article class="product-card" style="text-align: center;">
            <a href="produto.html?id=${produto.id}" class="product-link" style="width:100%;">
                ${montarCaixaImagem(imagens, produto.nome, 105.17)}
                ${montarTitulo(produto.nome.toUpperCase(), "h3", true)}
                <p class="product-price" style="text-align:center;">R$ ${Number(produto.preco).toFixed(2).replace(".", ",")}</p>
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

        if (!box || !image) return;

        let imagens = [];
        try {
            imagens = JSON.parse(box.dataset.imagens || "[]");
        } catch (erro) {
            imagens = [];
        }

        if (imagens.length === 0) return;

        let indiceAtual = 0;

        function trocarImagem(index, { instantaneo = false } = {}) {

            const total = imagens.length;
            index = ((index % total) + total) % total;

            if (index === indiceAtual) return;

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
        }

        // Setas laterais (funcionam em qualquer tamanho de tela)
        const setaEsquerda = box.querySelector(".seta-imagem-esquerda");
        const setaDireita = box.querySelector(".seta-imagem-direita");

        if (setaEsquerda) {
            setaEsquerda.addEventListener("click", (evento) => {
                evento.preventDefault();
                evento.stopPropagation();
                trocarImagem(indiceAtual - 1);
            });
        }

        if (setaDireita) {
            setaDireita.addEventListener("click", (evento) => {
                evento.preventDefault();
                evento.stopPropagation();
                trocarImagem(indiceAtual + 1);
            });
        }

        // Bônus no desktop: passar o mouse também troca a imagem
        if (imagens.length > 1) {
            box.addEventListener("mousemove", (evento) => {
                const rect = box.getBoundingClientRect();
                const relativeX = evento.clientX - rect.left;
                const sliceWidth = rect.width / imagens.length;
                let index = Math.floor(relativeX / sliceWidth);
                index = Math.max(0, Math.min(imagens.length - 1, index));
                trocarImagem(index);
            });

            box.addEventListener("mouseleave", () => trocarImagem(0));
        }

        // Continua funcionando arrastar (swipe) no celular
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
                trocarImagem(indiceAtual + (touchDeltaX < 0 ? 1 : -1), { instantaneo: true });
            }
        });
    });
}