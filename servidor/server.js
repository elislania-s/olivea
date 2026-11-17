/* ======================================
   SERVIDOR — OLIVEA + INFINITEPAY

   O QUE ESTE ARQUIVO FAZ:
   1) Recebe a sacola do site (POST /api/criar-checkout-infinitepay)
      e cria o link de pagamento na InfinitePay.
   2) Devolve a URL de pagamento pro site redirecionar o cliente.
   3) Recebe as notificações da InfinitePay avisando quando um
      pagamento é aprovado (POST /api/webhook-infinitepay).

   SOBRE A "HANDLE":
   Diferente do Mercado Pago e do PagBank, a InfinitePay não usa
   um token secreto pra criar o link — só a sua "InfiniteTag"
   (o nome de usuário que aparece no topo do seu app InfinitePay,
   sem o "$"). Mesmo assim, ela fica numa variável de ambiente
   pra facilitar trocar sem mexer no código.
====================================== */

require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const session = require("express-session");

const { router: adminAuthRouter } = require("./admin-auth");
const produtosRotas = require("./produtos-rotas");
const freteRotas = require("./frete-rotas");
const supabase = require("./db");
const { enviarEmailNovoPedido, enviarEmailConfirmacaoCliente } = require("./email");
const { router: reservasRotas, limparItens, tokenValido } = require("./reservas-rotas");
const crypto = require("crypto");

const app = express();

// O Render (e a maioria das hospedagens) coloca o site atrás de um
// "proxy" — sem isso, o Express não reconhece corretamente que a
// conexão é HTTPS, e o cookie de login não funciona direito em
// produção (mesmo com usuário/senha certos).
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());

// Sessão do admin (cookie assinado, guarda só "está logado ou não")
app.use(session({
    secret: process.env.SESSION_SECRET || "troque-isso-no-env",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 8, // 8 horas
        httpOnly: true,
        secure: "auto", // usa HTTPS automaticamente quando disponível
        sameSite: "lax"
    }
}));

// Rotas de login do admin e de produtos (públicas + administrativas)
app.use(adminAuthRouter);
app.use(produtosRotas);
app.use(freteRotas);
app.use(reservasRotas);

// Serve o próprio site (tudo que estiver dentro da pasta "public/")
app.use(express.static(path.join(__dirname, "public")));

if (!process.env.INFINITEPAY_HANDLE) {
    console.error(
        "\n[Olivea] Faltou configurar o INFINITEPAY_HANDLE no arquivo .env. " +
        "É o nome de usuário (InfiniteTag) que aparece no topo do seu app " +
        "InfinitePay, sem o símbolo $.\n"
    );
}

if (!process.env.URL_PUBLICA) {
    console.error(
        "\n[Olivea] Faltou configurar o URL_PUBLICA no arquivo .env " +
        "(o endereço público onde este servidor está publicado, ex: " +
        "https://olivea.onrender.com).\n"
    );
}


/* ================================================
   PEDIDO VIA PIX DIRETO (sem gateway)

   Registra o pedido como "aguardando confirmação
   manual" — o Pix cai direto na sua conta, e você
   confirma o pagamento manualmente ao receber o
   comprovante pelo WhatsApp (não existe webhook
   automático nesse caminho).
================================================ */

app.post("/api/criar-pedido-pix", async (req, res) => {

    try {
        const itensRecebidos = req.body.itens || [];
        const cliente = req.body.cliente || {};
        const frete = req.body.frete || null;

        if (itensRecebidos.length === 0) {
            return res.status(400).json({ erro: "Sacola vazia" });
        }

        const camposObrigatorios = [
            "nomeCompleto", "email", "whatsapp",
            "cep", "rua", "numero", "bairro", "cidade", "estado"
        ];

        for (const campo of camposObrigatorios) {
            if (!cliente[campo] || !String(cliente[campo]).trim()) {
                return res.status(400).json({ erro: "Preencha todos os campos obrigatórios do endereço." });
            }
        }

        let total = itensRecebidos.reduce(
            (soma, item) => soma + Number(item.preco) * Number(item.quantidade || 1),
            0
        );

        if (frete && frete.preco > 0) {
            total += Number(frete.preco);
        }

        const { data: pedido, error: erroPedido } = await supabase
            .from("pedidos")
            .insert({
                nome_completo: cliente.nomeCompleto,
                email: cliente.email,
                whatsapp: cliente.whatsapp,
                cep: cliente.cep,
                rua: cliente.rua,
                numero: cliente.numero,
                complemento: cliente.complemento || "",
                bairro: cliente.bairro,
                cidade: cliente.cidade,
                estado: cliente.estado,
                itens: itensRecebidos,
                total,
                status: "aguardando_confirmacao_pix"
            })
            .select()
            .single();

        if (erroPedido) throw erroPedido;

        res.json({ pedidoId: pedido.id });

    } catch (erro) {
        console.error("Erro ao criar pedido Pix:", erro);
        res.status(500).json({ erro: "Erro ao registrar o pedido" });
    }
});


/* ================================================
   CRIAR O LINK DE CHECKOUT NA INFINITEPAY
   (chamado pelo checkout.js do site)
================================================ */

// Depois que o cliente clica em "Ir para o pagamento", os itens
// ficam segurados por mais este tempo (pra ele conseguir pagar
// o Pix/cartão na tela da InfinitePay sem perder a peça).
const MINUTOS_PAGAMENTO = 30;

// Endereço do site que a InfinitePay usa pra mandar o cliente de
// volta depois de pagar. Usa o endereço em que o cliente está
// navegando (se for um dos permitidos), senão o URL_PUBLICA.
// Isso evita a página de sucesso abrir em OUTRO endereço e não
// conseguir esvaziar a sacola (cada endereço tem sua própria sacola).
function urlBaseDoSite(req) {
    const limpar = (url) => String(url || "").trim().replace(/\/+$/, "");

    const padrao = limpar(process.env.URL_PUBLICA);
    const origem = limpar(req.get("origin"));
    const permitidas = String(process.env.URLS_PERMITIDAS || "")
        .split(",")
        .map(limpar)
        .filter(Boolean);

    if (origem && (origem === padrao || permitidas.includes(origem))) {
        return origem;
    }

    return padrao;
}

/* ------------------------------------------------
   CONVITE DE FRETE GRÁTIS (link secreto)

   No Render (Environment) crie:
     CONVITE_FRETE_GRATIS=uma-frase-longa-e-aleatoria

   Quem abrir o site por  https://SEU-SITE/?convite=uma-frase-longa-e-aleatoria
   fica com frete grátis nas compras. Pra desligar (ou trocar a
   pessoa que tem acesso), apague ou mude essa variável.
   Sem a variável, o recurso fica desligado.
------------------------------------------------ */
function conviteConfere(valor) {
    const segredo = String(process.env.CONVITE_FRETE_GRATIS || "").trim();

    if (segredo.length < 8 || typeof valor !== "string" || valor.length === 0) {
        return false;
    }

    const hash = (texto) => crypto.createHash("sha256").update(texto).digest();

    return crypto.timingSafeEqual(hash(valor.trim()), hash(segredo));
}

app.post("/api/convite-valido", (req, res) => {
    res.json({ valido: conviteConfere(req.body && req.body.convite) });
});

async function liberarReserva(token) {
    if (!tokenValido(token)) return;

    try {
        await supabase
            .from("reservas")
            .update({ status: "cancelada" })
            .eq("token", token)
            .eq("status", "ativa");
    } catch (erro) {
        console.error("Erro ao liberar reserva:", erro);
    }
}

app.post("/api/criar-checkout-infinitepay", async (req, res) => {

    const token = req.body.token;

    try {
        const itensRecebidos = limparItens(req.body.itens);
        const cliente = req.body.cliente || {};
        const frete = req.body.frete || null;

        if (itensRecebidos.length === 0) {
            return res.status(400).json({ erro: "Sacola vazia" });
        }

        if (!tokenValido(token)) {
            return res.status(400).json({ erro: "Sessão inválida. Recarregue a página." });
        }

        const camposObrigatorios = [
            "nomeCompleto", "email", "whatsapp",
            "cep", "rua", "numero", "bairro", "cidade", "estado"
        ];

        for (const campo of camposObrigatorios) {
            if (!cliente[campo] || !String(cliente[campo]).trim()) {
                return res.status(400).json({ erro: "Preencha todos os campos obrigatórios do endereço." });
            }
        }

        // 0) Confere o estoque e SEGURA os itens (de forma atômica:
        //    se duas pessoas tentarem a última peça juntas, só uma leva).
        const { data: reserva, error: erroReserva } = await supabase.rpc("reservar_itens", {
            p_token: token,
            p_itens: itensRecebidos,
            p_minutos: MINUTOS_PAGAMENTO,
            p_renovar: true
        });

        if (erroReserva) throw erroReserva;

        if (reserva.ajustes && reserva.ajustes.length > 0) {
            return res.status(409).json({
                erro: "itens_indisponiveis",
                ajustes: reserva.ajustes
            });
        }

        // Nome e preço vêm do BANCO, não do navegador (o navegador
        // poderia ter mexido no preço).
        const { data: produtosDb, error: erroProdutos } = await supabase
            .from("produtos")
            .select("id, nome, preco, imagens")
            .in("id", itensRecebidos.map((item) => item.id));

        if (erroProdutos) throw erroProdutos;

        const itensConfiaveis = itensRecebidos.map((item) => {
            const produto = (produtosDb || []).find((p) => String(p.id) === item.id);
            if (!produto) return null;

            return {
                id: item.id,
                nome: produto.nome,
                preco: Number(produto.preco),
                imagem: produto.imagens && produto.imagens[0] ? produto.imagens[0] : null,
                quantidade: item.quantidade
            };
        });

        if (itensConfiaveis.some((item) => item === null)) {
            await liberarReserva(token);
            return res.status(409).json({
                erro: "itens_indisponiveis",
                ajustes: itensRecebidos.map((item) => ({
                    id: item.id, pedido: item.quantidade, reservado: 0, motivo: "estoque"
                }))
            });
        }

        // Monta os itens no formato que a InfinitePay espera
        // (valores em CENTAVOS, não em reais)
        const itensInfinitePay = itensConfiaveis.map((item) => ({
            description: String(item.nome).slice(0, 100),
            quantity: item.quantidade,
            price: Math.round(item.preco * 100)
        }));

        // Subtotal só dos produtos (sem frete) — usado pra decidir
        // se o frete é grátis.
        const subtotalProdutos = itensInfinitePay.reduce(
            (soma, item) => soma + (item.price * item.quantity) / 100,
            0
        );
        const conviteValido = conviteConfere(req.body.convite);
        const freteGratisPorValor = subtotalProdutos >= 100;
        const freteGratis = freteGratisPorValor || conviteValido;
        // Marca no pedido quando o frete só foi grátis por causa do convite
        // (aparece no email da loja: a postagem fica por sua conta).
        const freteCortesia = conviteValido && !freteGratisPorValor;

        // Frete vira mais um "item" na cobrança, pra entrar no
        // mesmo pagamento (o cliente paga tudo de uma vez só).
        // Acima de R$ 100 em produtos, o frete é grátis — o cliente
        // só escolhe o tipo de envio (PAC/SEDEX/Mini Envios), mas
        // não é cobrado por ele.
        if (frete && frete.preco > 0 && !freteGratis) {
            itensInfinitePay.push({
                description: "Frete - " + (frete.servico || "Entrega"),
                quantity: 1,
                price: Math.round(Number(frete.preco) * 100)
            });
        }

        const totalReais = itensInfinitePay.reduce(
            (soma, item) => soma + (item.price * item.quantity) / 100,
            0
        );

        // 1) Grava o pedido no nosso banco, com status "pendente"
        const { data: pedido, error: erroPedido } = await supabase
            .from("pedidos")
            .insert({
                nome_completo: cliente.nomeCompleto,
                email: cliente.email,
                whatsapp: cliente.whatsapp,
                cep: cliente.cep,
                rua: cliente.rua,
                numero: cliente.numero,
                complemento: cliente.complemento || "",
                bairro: cliente.bairro,
                cidade: cliente.cidade,
                estado: cliente.estado,
                itens: itensConfiaveis,
                total: totalReais,
                frete_servico: frete
                    ? (frete.nome ? `${frete.servico} - ${frete.nome}` : frete.servico) +
                      (freteCortesia ? " (cortesia)" : "")
                    : null,
                frete_valor: frete ? (freteGratis ? 0 : frete.preco) : null,
                status: "pendente"
            })
            .select()
            .single();

        if (erroPedido) throw erroPedido;

        // Liga a reserva ao pedido (quando o pagamento for aprovado,
        // a reserva vira venda e o estoque é baixado de verdade).
        await supabase
            .from("reservas")
            .update({ pedido_id: String(pedido.id) })
            .eq("token", token)
            .eq("status", "ativa");

        // 2) Cria o link de checkout na InfinitePay
        const urlPublica = String(process.env.URL_PUBLICA || "").replace(/\/+$/, "");
        const urlSite = urlBaseDoSite(req);
        const whatsappLimpo = cliente.whatsapp.replace(/\D/g, "");

        const payloadCheckout = {
            handle: process.env.INFINITEPAY_HANDLE,

            items: itensInfinitePay,

            // Liga esse link ao pedido salvo no nosso banco — é assim
            // que o webhook vai saber qual pedido atualizar.
            order_nsu: String(pedido.id),

            customer: {
                name: cliente.nomeCompleto,
                email: cliente.email,
                // InfinitePay pede o telefone já com o +55 na frente
                phone_number: "+55" + whatsappLimpo
            },

            address: {
                cep: cliente.cep.replace(/\D/g, ""),
                street: cliente.rua,
                neighborhood: cliente.bairro,
                number: cliente.numero,
                complement: cliente.complemento || ""
            },

            redirect_url: urlSite + "/pagamento-sucesso.html?pedido=" + encodeURIComponent(pedido.id),
            webhook_url: urlPublica + "/api/webhook-infinitepay"
        };

        const respostaInfinitePay = await fetch("https://api.checkout.infinitepay.io/links", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "accept": "application/json"
            },
            body: JSON.stringify(payloadCheckout)
        });

        const dadosInfinitePay = await respostaInfinitePay.json();

        console.log(
            "[Olivea] Resposta da InfinitePay (status " + respostaInfinitePay.status + "):",
            JSON.stringify(dadosInfinitePay, null, 2)
        );

        if (!respostaInfinitePay.ok) {
            throw new Error("InfinitePay recusou a criação do checkout");
        }

        const checkoutUrl = dadosInfinitePay.checkout_url || dadosInfinitePay.url;

        if (!checkoutUrl) {
            throw new Error("InfinitePay não retornou o link de pagamento");
        }

        res.json({
            checkout_url: checkoutUrl,
            pedido_id: pedido.id,
            restante_s: reserva.restante_s
        });

    } catch (erro) {
        console.error("Erro ao criar checkout InfinitePay:", erro);

        // Deu erro: solta os itens pra outras pessoas poderem comprar
        await liberarReserva(token);

        res.status(500).json({ erro: "Erro ao criar checkout de pagamento" });
    }
});


/* ================================================
   WEBHOOK — InfinitePay avisa aqui quando o
   pagamento é aprovado.

   Como qualquer pessoa na internet poderia chamar
   esse endereço e fingir um pagamento, antes de
   aprovar o pedido o servidor PERGUNTA pra própria
   InfinitePay se aquele pagamento é verdadeiro
   (endpoint payment_check).

   Ao aprovar, baixa o estoque (uma única vez por
   pedido, mesmo que a InfinitePay reenvie o aviso).
================================================ */

app.post("/api/webhook-infinitepay", async (req, res) => {

    try {
        console.log("[Olivea] Webhook InfinitePay recebido:", JSON.stringify(req.body));

        const pedidoId = req.body.order_nsu;
        const transacao = req.body.transaction_nsu;
        const slug = req.body.invoice_slug || req.body.slug;

        if (!pedidoId) {
            return res.sendStatus(200);
        }

        if (!transacao || !slug) {
            console.error("[Olivea] Webhook sem transaction_nsu/invoice_slug — não dá pra confirmar o pagamento. Pedido:", pedidoId);
            return res.sendStatus(200);
        }

        // 1) Confirma com a InfinitePay que o pagamento é real
        const respostaCheck = await fetch("https://api.checkout.infinitepay.io/payment_check", {
            method: "POST",
            headers: { "Content-Type": "application/json", "accept": "application/json" },
            body: JSON.stringify({
                handle: process.env.INFINITEPAY_HANDLE,
                order_nsu: String(pedidoId),
                transaction_nsu: transacao,
                slug: slug
            })
        });

        if (!respostaCheck.ok) {
            console.error("[Olivea] payment_check falhou (status " + respostaCheck.status + ") — pedido " + pedidoId);
            return res.sendStatus(400); // a InfinitePay tenta de novo depois
        }

        const check = await respostaCheck.json();

        if (check.paid !== true) {
            console.warn("[Olivea] payment_check diz que NÃO está pago — pedido " + pedidoId, JSON.stringify(check));
            return res.sendStatus(200);
        }

        // 2) Marca o pedido como aprovado
        const { data: pedidoAtualizado } = await supabase
            .from("pedidos")
            .update({ status: "aprovado" })
            .eq("id", pedidoId)
            .select()
            .single();

        if (!pedidoAtualizado) {
            console.error("[Olivea] Webhook de pedido que não existe:", pedidoId);
            return res.sendStatus(200);
        }

        // 3) Baixa o estoque (só na primeira vez)
        let primeiraVez = true;

        const { data: baixa, error: erroBaixa } = await supabase.rpc("baixar_estoque_pedido", {
            p_pedido_id: String(pedidoId)
        });

        if (erroBaixa) {
            console.error(
                "[Olivea] ERRO ao baixar o estoque do pedido " + pedidoId +
                " — ajuste manualmente no admin:", erroBaixa
            );
        } else {
            primeiraVez = baixa && baixa.baixado === true;

            if (baixa && baixa.faltas && baixa.faltas.length > 0) {
                console.warn(
                    "[Olivea] ATENÇÃO: pedido " + pedidoId +
                    " vendeu mais do que havia em estoque:", JSON.stringify(baixa.faltas)
                );
            }
        }

        // Responder rápido (idealmente em menos de 1 segundo) com 200 —
        // os emails abaixo são enviados DEPOIS, sem atrasar a resposta.
        res.sendStatus(200);

        // 4) Emails (só na primeira vez, pra não repetir):
        //    aviso pra loja + confirmação pra cliente.
        //    Um falhar não impede o outro (cada um trata o próprio erro).
        if (primeiraVez) {
            await Promise.all([
                enviarEmailNovoPedido(pedidoAtualizado),
                enviarEmailConfirmacaoCliente(pedidoAtualizado)
            ]);
        }

    } catch (erro) {
        console.error("Erro no webhook InfinitePay:", erro);
        res.sendStatus(400); // aqui SIM vale devolver erro, pra InfinitePay reenviar depois
    }
});


/* ================================================
   ROTA DE TESTE (pra saber se o servidor está no ar)
================================================ */

app.get("/", (req, res) => {
    res.send("Servidor Olivea + InfinitePay está no ar ✅");
});


const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
    console.log("Servidor Olivea rodando na porta " + PORTA);
});