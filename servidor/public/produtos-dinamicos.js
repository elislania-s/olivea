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

        let url = "/api/produtos";
        if (categoria) url += "?categoria=" + encodeURIComponent(categoria);

        const resposta = await fetch(url);
        const produtos = await resposta.json();

        if (!produtos || produtos.length === 0) {
            grid.innerHTML = '<p style="padding:40px 0;grid-column:1/-1;">Em breve, novos produtos por aqui.</p>';
            esconderVerMais();
            return;
        }

        // Renderiza TODOS os produtos de uma vez — a paginação (o que
        // aparece antes de clicar "Ver mais") é feita só escondendo
        // cards via CSS, não deixando de buscar eles.
        grid.innerHTML = produtos.map(criarCardColecao).join("");

        inicializarInteracaoCards(grid);
        configurarPaginacaoPorFileiras(grid);

    } catch (erro) {
        console.error("[Olivea] Erro ao carregar coleção:", erro);
        grid.innerHTML = '<p style="padding:40px 0;grid-column:1/-1;">Não foi possível carregar os produtos agora.</p>';
    }
}

// Mostra só as fileiras "completas" iniciais (3 fileiras de 3 = 9
// produtos em telas grandes, 4 fileiras de 2 = 8 em tablet/celular),
// e revela o resto ao clicar em "Ver mais". Reage a redimensionar a
// tela também (some/aparece coluna, recalcula).
function configurarPaginacaoPorFileiras(grid) {

    const verMaisBtn = document.querySelector(".collection-products .see-more");
    if (!verMaisBtn) return;

    const cards = Array.from(grid.querySelectorAll(".product-card"));
    let expandido = false;

    function colunasAtuais() {
        return window.innerWidth > 1100 ? 3 : 2;
    }

    function fileirasIniciais() {
        return colunasAtuais() === 3 ? 3 : 4;
    }

    function aplicar() {

        if (expandido) return;

        const colunas = colunasAtuais();
        const visiveis = colunas * fileirasIniciais();

        cards.forEach((card, index) => {
            card.classList.toggle("is-hidden", index >= visiveis);
        });

        verMaisBtn.style.display = cards.length > visiveis ? "" : "none";
    }

    verMaisBtn.style.display = "";

    verMaisBtn.onclick = (evento) => {
        evento.preventDefault();
        expandido = true;
        cards.forEach((card) => card.classList.remove("is-hidden"));
        verMaisBtn.style.display = "none";
    };

    aplicar();

    let temporizadorResize;
    window.addEventListener("resize", () => {
        clearTimeout(temporizadorResize);
        temporizadorResize = setTimeout(aplicar, 150);
    });
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
    const esgotado = Number(produto.estoque) <= 0;

    return `
        <article class="product-card" data-category="${produto.categoria}" data-price="${produto.preco}">
            <a href="produto.html?id=${produto.id}" style="text-decoration:none; color:inherit; display:block; width:100%;">
                ${montarCaixaImagem(imagens, produto.nome, 99.375)}
                ${montarTitulo(produto.nome, "h3", false)}
                <p class="product-price">R$ ${Number(produto.preco).toFixed(2).replace(".", ",")}</p>
            </a>
            ${esgotado
                ? `<span class="buy-button" style="opacity:0.5; cursor:not-allowed; pointer-events:none;">ESGOTADO</span>`
                : `<a href="produto.html?id=${produto.id}" class="buy-button">COMPRAR</a>`
            }
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
    });
}