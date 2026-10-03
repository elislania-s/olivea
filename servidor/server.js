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
const { enviarEmailNovoPedido } = require("./email");

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

app.post("/api/criar-checkout-infinitepay", async (req, res) => {

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

        // Monta os itens no formato que a InfinitePay espera
        // (valores em CENTAVOS, não em reais)
        const itensInfinitePay = itensRecebidos.map((item) => ({
            description: String(item.nome).slice(0, 100),
            quantity: Number(item.quantidade) || 1,
            price: Math.round(Number(item.preco) * 100)
        }));

        // Subtotal só dos produtos (sem frete) — usado pra decidir
        // se o frete é grátis. Calculado aqui no servidor, não
        // confiando só no que o navegador mandou.
        const subtotalProdutos = itensInfinitePay.reduce(
            (soma, item) => soma + (item.price * item.quantity) / 100,
            0
        );
        const freteGratis = subtotalProdutos >= 100;

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
                itens: itensRecebidos,
                total: totalReais,
                frete_servico: frete
                    ? (frete.nome ? `${frete.servico} - ${frete.nome}` : frete.servico)
                    : null,
                frete_valor: frete ? (freteGratis ? 0 : frete.preco) : null,
                status: "pendente"
            })
            .select()
            .single();

        if (erroPedido) throw erroPedido;

        // 2) Cria o link de checkout na InfinitePay
        const urlPublica = process.env.URL_PUBLICA;
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

            redirect_url: urlPublica + "/pagamento-sucesso.html",
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

        res.json({ checkout_url: checkoutUrl });

    } catch (erro) {
        console.error("Erro ao criar checkout InfinitePay:", erro);
        res.status(500).json({ erro: "Erro ao criar checkout de pagamento" });
    }
});


/* ================================================
   WEBHOOK — InfinitePay avisa aqui quando o
   pagamento é aprovado.

   A InfinitePay só chama esse endpoint QUANDO O
   PAGAMENTO É APROVADO (não existe um "status" no
   corpo pra checar) — a própria chamada já é a
   confirmação.
================================================ */

app.post("/api/webhook-infinitepay", async (req, res) => {

    try {
        console.log("[Olivea] Webhook InfinitePay recebido:", JSON.stringify(req.body));

        const pedidoId = req.body.order_nsu;

        if (pedidoId) {

            const { data: pedidoAtualizado } = await supabase
                .from("pedidos")
                .update({ status: "aprovado" })
                .eq("id", pedidoId)
                .select()
                .single();

            if (pedidoAtualizado) {
                await enviarEmailNovoPedido(pedidoAtualizado);
            }
        }

        // Responder rápido (idealmente em menos de 1 segundo) com 200.
        // Se responder com erro, a InfinitePay tenta reenviar.
        res.sendStatus(200);

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