/* ======================================
   ATUALIZAR ABAS — OLIVEA

   Como usar (uma vez só):
   1) Coloque este arquivo dentro da pasta  servidor/public
   2) No terminal, dentro dessa pasta, rode:   node atualizar-abas.js
   3) Pode apagar este arquivo depois.

   O que ele faz em TODAS as páginas (.html):
   - troca o nome que aparece na aba do navegador;
   - coloca o logo da Olivea (logo.png) como ícone da aba;
   - em produto.html, troca "PagBank/Infinity Pay" por "InfinitePay".

   Pra mudar algum nome de aba, edite a lista abaixo e rode de novo.
====================================== */

const fs = require("fs");
const path = require("path");

const TITULOS = {
    "index.html": "Olivea",
    "colecao.html": "Coleção | Olivea",
    "colares.html": "Colares e Gargantilhas | Olivea",
    "brincos.html": "Brincos e Argolas | Olivea",
    "pulseira.html": "Pulseiras e Braceletes | Olivea",
    "produto.html": "Produto | Olivea",
    "sacola.html": "Sacola | Olivea",
    "checkout.html": "Finalizar pedido | Olivea",
    "sobre.html": "Sobre a Olivea",
    "atendimento.html": "Atendimento | Olivea",
    "entrega.html": "Entrega | Olivea",
    "pagamento-sucesso.html": "Pedido confirmado | Olivea",
    "pagamento-pendente.html": "Pagamento pendente | Olivea",
    "pagamento-erro.html": "Pagamento não concluído | Olivea",
    "admin/login.html": "Admin | Olivea",
    "admin/painel.html": "Painel | Olivea"
};

// "?v=2" faz o navegador baixar o ícone novo (ele guarda o antigo no cache).
// Se mudar o logo de novo no futuro, aumente esse número.
const ICONE = '<link rel="icon" type="image/png" href="/logo.png?v=2">';

let alterados = 0;

for (const [arquivo, titulo] of Object.entries(TITULOS)) {

    const caminho = path.join(__dirname, arquivo);

    if (!fs.existsSync(caminho)) {
        console.log("(não achei, pulei)  " + arquivo);
        continue;
    }

    const original = fs.readFileSync(caminho, "utf8");
    let html = original;

    // 1) título da aba
    html = html.replace(/<title>[\s\S]*?<\/title>/i, "<title>" + titulo + "</title>");

    // 2) ícone da aba (troca o que existir, ou cria)
    if (/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/i.test(html)) {
        html = html.replace(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/i, ICONE);
    } else {
        html = html.replace(/<\/title>/i, "</title>\n    " + ICONE);
    }

    // 3) gateway de pagamento na página do produto
    if (arquivo === "produto.html") {
        html = html.replace(
            /Pagamento 100% seguro via [^<]*/,
            "Pagamento 100% seguro via InfinitePay"
        );
    }

    if (html !== original) {
        fs.writeFileSync(caminho, html, "utf8");
        alterados++;
        console.log("✔ atualizado        " + arquivo);
    } else {
        console.log("= já estava certo   " + arquivo);
    }
}

console.log("\nPronto! " + alterados + " arquivo(s) atualizado(s).");