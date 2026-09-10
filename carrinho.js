/* ======================================
   CARRINHO (SACOLA) — OLIVEA

   Guarda os itens da sacola no navegador
   do próprio cliente (localStorage), sem
   precisar de servidor. Isso é usado
   pela página de produto (adicionar) e
   pela sacola.html (listar/editar).

   IMPORTANTE: para o "bolinha com o
   número de itens" aparecer no ícone da
   sacola em TODAS as páginas (index,
   brincos, colares, pulseira, coleção,
   sobre, atendimento), inclua esta linha
   antes do </body> de cada uma delas:

   <script src="carrinho.js"></script>

   Isso não muda nada visualmente — só
   liga a "contagem" da sacola. Sem esse
   script, a sacola continua funcionando
   normalmente, só não mostra a bolinha
   com a quantidade nas outras páginas.
====================================== */

const OLIVEA_CARRINHO_CHAVE = "olivea_sacola";

function oliveaObterSacola() {
    try {
        return JSON.parse(localStorage.getItem(OLIVEA_CARRINHO_CHAVE)) || [];
    } catch (erro) {
        return [];
    }
}

function oliveaSalvarSacola(sacola) {
    localStorage.setItem(OLIVEA_CARRINHO_CHAVE, JSON.stringify(sacola));
    oliveaAtualizarBolinha();
}

function oliveaAdicionarNaSacola(produto, quantidade) {
    const sacola = oliveaObterSacola();
    const existente = sacola.find((item) => item.id === produto.id);

    if (existente) {
        existente.quantidade += quantidade;
    } else {
        sacola.push({
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco,
            imagem: produto.imagens[0],
            quantidade: quantidade
        });
    }

    oliveaSalvarSacola(sacola);
}

function oliveaRemoverDaSacola(id) {
    const sacola = oliveaObterSacola().filter((item) => item.id !== id);
    oliveaSalvarSacola(sacola);
}

function oliveaAtualizarQuantidade(id, quantidade) {
    const sacola = oliveaObterSacola();
    const item = sacola.find((i) => i.id === id);

    if (item) {
        item.quantidade = Math.max(1, quantidade);
        oliveaSalvarSacola(sacola);
    }
}

function oliveaTotalSacola() {
    return oliveaObterSacola().reduce(
        (total, item) => total + item.preco * item.quantidade,
        0
    );
}

function oliveaQuantidadeItensSacola() {
    return oliveaObterSacola().reduce((total, item) => total + item.quantidade, 0);
}

// Coloca (ou atualiza) a bolinha com o número de itens em cima do
// ícone da sacola, em qualquer página que carregue este arquivo.
function oliveaAtualizarBolinha() {
    const links = document.querySelectorAll(".bag-link");
    const quantidade = oliveaQuantidadeItensSacola();

    links.forEach((link) => {
        link.setAttribute("href", "sacola.html");

        let bolinha = link.querySelector(".bag-badge");

        if (!bolinha) {
            bolinha = document.createElement("span");
            bolinha.className = "bag-badge";
            bolinha.style.cssText =
                "position:absolute;top:-4px;right:-6px;min-width:18px;" +
                "height:18px;padding:0 4px;border-radius:50%;" +
                "background-color:#3F3026;color:#FCFAF6;" +
                "font-family:'Montserrat',sans-serif;font-size:11px;" +
                "font-weight:600;line-height:18px;text-align:center;";
            link.appendChild(bolinha);
        }

        if (quantidade > 0) {
            bolinha.textContent = quantidade > 99 ? "99+" : quantidade;
            bolinha.style.display = "block";
        } else {
            bolinha.style.display = "none";
        }
    });
}

document.addEventListener("DOMContentLoaded", oliveaAtualizarBolinha);