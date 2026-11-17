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

// Chaves auxiliares (guardadas no navegador do cliente)
const OLIVEA_TOKEN_CHAVE = "olivea_token";               // identifica este navegador nas reservas
const OLIVEA_EXPIRA_CHAVE = "olivea_checkout_expira";    // até quando os itens estão reservados
const OLIVEA_PEDIDO_CHAVE = "olivea_pedido_pendente";    // pedido que foi pra InfinitePay
const OLIVEA_AVISO_CHAVE = "olivea_aviso";               // mensagem pra mostrar na sacola
const OLIVEA_CONVITE_CHAVE = "olivea_convite";           // convite de frete grátis (link secreto)

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

// Esvazia a sacola inteira — chamada na página de pagamento
// aprovado, depois que a compra foi concluída com sucesso.
function oliveaLimparSacola() {
    oliveaSalvarSacola([]);
}

// ---------------------------------------------------------------
// TOKEN DO NAVEGADOR
// Um código aleatório que identifica este cliente na hora de
// "segurar" as peças no estoque. Não tem dado pessoal nenhum.
// ---------------------------------------------------------------
function oliveaToken() {
    let token = null;

    try {
        token = localStorage.getItem(OLIVEA_TOKEN_CHAVE);
    } catch (erro) { /* ignora */ }

    if (!token || token.length < 16) {
        token = (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

        try {
            localStorage.setItem(OLIVEA_TOKEN_CHAVE, token);
        } catch (erro) { /* ignora */ }
    }

    return token;
}

// ---------------------------------------------------------------
// AVISO PRA MOSTRAR NA SACOLA (ex.: "o tempo acabou")
// Lê e já apaga, pra aparecer uma vez só.
// ---------------------------------------------------------------
function oliveaGuardarAviso(texto) {
    try {
        localStorage.setItem(OLIVEA_AVISO_CHAVE, texto);
    } catch (erro) { /* ignora */ }
}

function oliveaLerAviso() {
    try {
        const texto = localStorage.getItem(OLIVEA_AVISO_CHAVE);
        localStorage.removeItem(OLIVEA_AVISO_CHAVE);
        return texto;
    } catch (erro) {
        return null;
    }
}

// ---------------------------------------------------------------
// COMPRA CONCLUÍDA
// Esvazia a sacola e apaga os controles do checkout.
// ---------------------------------------------------------------
function oliveaConcluirCompra() {
    try {
        localStorage.removeItem(OLIVEA_EXPIRA_CHAVE);
        localStorage.removeItem(OLIVEA_PEDIDO_CHAVE);
    } catch (erro) { /* ignora */ }

    // O convite de frete grátis vale pra uma compra: terminou, acabou.
    oliveaDescartarConvite();

    oliveaLimparSacola();
}

// ---------------------------------------------------------------
// TEMPO DO CHECKOUT ACABOU
// Se passou do prazo (20 min no checkout), os itens saem da
// sacola — em qualquer página que o cliente abrir depois.
// ---------------------------------------------------------------
function oliveaVerificarExpiracao() {
    let expira = 0;

    try {
        expira = Number(localStorage.getItem(OLIVEA_EXPIRA_CHAVE)) || 0;
    } catch (erro) {
        return false;
    }

    if (!expira || Date.now() < expira) return false;

    try {
        localStorage.removeItem(OLIVEA_EXPIRA_CHAVE);
    } catch (erro) { /* ignora */ }

    if (oliveaObterSacola().length > 0) {
        oliveaSalvarSacola([]);
        oliveaGuardarAviso(
            "O tempo para finalizar o pedido acabou e os itens saíram da sua sacola, " +
            "para ficarem disponíveis para outras pessoas. Se ainda quiser, é só adicionar de novo."
        );
    }

    return true;
}

// ---------------------------------------------------------------
// PEDIDO JÁ PAGO? (plano B)
// Se o cliente pagou mas NÃO voltou pela página de sucesso, a
// sacola continuaria cheia. Aqui o site pergunta ao servidor se
// o último pedido foi aprovado e, se foi, tira só aqueles itens.
// ---------------------------------------------------------------
async function oliveaVerificarPedidoPendente() {
    let pendente = null;

    try {
        pendente = JSON.parse(localStorage.getItem(OLIVEA_PEDIDO_CHAVE));
    } catch (erro) {
        pendente = null;
    }

    if (!pendente || !pendente.id) return;

    try {
        const resposta = await fetch("/api/pedido-status/" + encodeURIComponent(pendente.id));

        if (resposta.status === 404) {
            localStorage.removeItem(OLIVEA_PEDIDO_CHAVE);
            return;
        }

        if (!resposta.ok) return;

        const dados = await resposta.json();

        if (dados.status !== "aprovado") return;

        // Tira da sacola só o que foi comprado nesse pedido
        const sacola = oliveaObterSacola();

        (pendente.itens || []).forEach((comprado) => {
            const item = sacola.find((i) => String(i.id) === String(comprado.id));
            if (item) item.quantidade -= comprado.quantidade;
        });

        oliveaSalvarSacola(sacola.filter((item) => item.quantidade > 0));

        localStorage.removeItem(OLIVEA_PEDIDO_CHAVE);
        localStorage.removeItem(OLIVEA_EXPIRA_CHAVE);
        oliveaDescartarConvite();

        if (typeof sacolaRenderizar === "function") sacolaRenderizar();

    } catch (erro) {
        console.error("[Olivea] Não foi possível conferir o pedido:", erro);
    }
}

// ---------------------------------------------------------------
// CONVITE DE FRETE GRÁTIS (link secreto)
// Quem abre o site por um link com  ?convite=SEGREDO  fica com frete
// grátis ENQUANTO ESTIVER NAQUELA VISITA. O convite acaba quando:
//   - a compra termina (ele vale pra uma compra);
//   - a pessoa entra no site "do zero" (digitando o endereço, por
//     favorito ou vindo de outro site) sem o link do convite;
//   - a aba/o navegador é fechado.
// Navegar dentro do site (sacola, checkout, produtos) não tira.
// O servidor é quem confere se o segredo é verdadeiro.
// Depois de guardar, o "?convite=..." some do endereço.
//
// Pra DESLIGAR o convite na hora (ex.: nos seus testes), abra o site
// com  ?convite=sair
// ---------------------------------------------------------------
// A pessoa chegou agora no site? (digitou o endereço, abriu um favorito
// ou veio de outro site — inclusive da tela de pagamento). Recarregar a
// página ou usar "voltar" NÃO conta como entrada nova.
function oliveaEntradaNova() {
    try {
        const navegacao = performance.getEntriesByType("navigation")[0];

        if (navegacao && (navegacao.type === "reload" || navegacao.type === "back_forward")) {
            return false;
        }
    } catch (erro) { /* ignora */ }

    const origem = document.referrer || "";

    if (!origem) return true;

    try {
        return new URL(origem).origin !== window.location.origin;
    } catch (erro) {
        return true;
    }
}

function oliveaCapturarConvite() {
    // Limpeza: uma versão anterior guardava o convite de forma permanente
    try {
        localStorage.removeItem(OLIVEA_CONVITE_CHAVE);
    } catch (erro) { /* ignora */ }

    try {
        const parametros = new URLSearchParams(window.location.search);
        const convite = parametros.get("convite");

        if (convite === null) {
            // Sem o link do convite: se foi uma entrada nova no site, o convite acaba
            if (oliveaEntradaNova()) {
                sessionStorage.removeItem(OLIVEA_CONVITE_CHAVE);
            }
            return;
        }

        if (convite.trim() === "" || convite.trim().toLowerCase() === "sair") {
            sessionStorage.removeItem(OLIVEA_CONVITE_CHAVE);
        } else {
            sessionStorage.setItem(OLIVEA_CONVITE_CHAVE, convite.trim().slice(0, 200));
        }

        parametros.delete("convite");
        const resto = parametros.toString();

        window.history.replaceState(
            null,
            "",
            window.location.pathname + (resto ? "?" + resto : "") + window.location.hash
        );
    } catch (erro) { /* ignora */ }
}

function oliveaObterConvite() {
    try {
        return sessionStorage.getItem(OLIVEA_CONVITE_CHAVE) || "";
    } catch (erro) {
        return "";
    }
}

function oliveaDescartarConvite() {
    try {
        sessionStorage.removeItem(OLIVEA_CONVITE_CHAVE);
    } catch (erro) { /* ignora */ }
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

// Roda assim que o arquivo carrega (antes das páginas desenharem a sacola)
oliveaCapturarConvite();
oliveaVerificarExpiracao();
oliveaVerificarPedidoPendente();