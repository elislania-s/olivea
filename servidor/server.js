/* ======================================
   SERVIDOR — OLIVEA + MERCADO PAGO

   O QUE ESTE ARQUIVO FAZ:
   1) Recebe a sacola do site (POST /api/criar-preferencia)
      e cria a cobrança no Mercado Pago.
   2) Devolve o link de pagamento (init_point) pro site
      redirecionar o cliente.
   3) Recebe as notificações do Mercado Pago avisando se
      o pagamento foi aprovado (POST /api/webhook-mercadopago) —
      é aqui que, no futuro, você vai marcar o pedido como
      "pago" no seu sistema/planilha/e-mail.

   POR QUE ISSO PRECISA FICAR SEPARADO DO SITE:
   O Access Token é a chave secreta da sua conta Mercado
   Pago. Se ela estivesse em um arquivo do site (HTML/JS),
   qualquer visitante conseguiria ler e usar essa chave.
   Por isso ela só existe aqui, no servidor, escondida
   numa variável de ambiente (arquivo .env).
====================================== */

require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

const { router: adminAuthRouter } = require("./admin-auth");
const produtosRotas = require("./produtos-rotas");
const freteRotas = require("./frete-rotas");
const supabase = require("./db");
const { enviarEmailNovoPedido } = require("./email");

const app = express();

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
        secure: process.env.NODE_ENV === "production"
    }
}));

// Rotas de login do admin e de produtos (públicas + administrativas)
app.use(adminAuthRouter);
app.use(produtosRotas);
app.use(freteRotas);

// Serve o próprio site (tudo que estiver dentro da pasta "public/")
// Assim o site e o servidor ficam na MESMA url — não precisa mais
// apontar o mercadopago.js pra um endereço diferente.
app.use(express.static(path.join(__dirname, "public")));

if (!process.env.MP_ACCESS_TOKEN) {
    console.error(
        "\n[Olivea] Faltou configurar o MP_ACCESS_TOKEN no arquivo .env. " +
        "Veja o .env.example.\n"
    );
}

if (!process.env.URL_PUBLICA) {
    console.error(
        "\n[Olivea] Faltou configurar o URL_PUBLICA no arquivo .env " +
        "(o endereço público onde este servidor está publicado, ex: " +
        "https://olivea.onrender.com).\n"
    );
}

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});


/* ================================================
   CRIAR A COBRANÇA (chamado pelo mercadopago.js do site)
================================================ */

/* ================================================
   PEDIDO VIA PIX DIRETO (sem Mercado Pago)

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


app.post("/api/criar-preferencia", async (req, res) => {

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

        const itens = itensRecebidos.map((item) => ({
            title: String(item.nome).slice(0, 250),
            quantity: Number(item.quantidade) || 1,
            unit_price: Number(item.preco),
            currency_id: "BRL"
        }));

        // Frete vira mais um "item" na cobrança, pra entrar no
        // mesmo pagamento (o cliente paga tudo de uma vez só)
        if (frete && frete.preco > 0) {
            itens.push({
                title: "Frete - " + (frete.servico || "Entrega"),
                quantity: 1,
                unit_price: Number(frete.preco),
                currency_id: "BRL"
            });
        }

        const total = itens.reduce((soma, item) => soma + item.unit_price * item.quantity, 0);

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
                total,
                status: "pendente"
            })
            .select()
            .single();

        if (erroPedido) throw erroPedido;

        // 2) Cria a cobrança no Mercado Pago, já com os dados do
        //    cliente (nome, email, telefone e endereço de entrega)
        const urlPublica = process.env.URL_PUBLICA;

        const [ddd, ...restoNumero] = cliente.whatsapp.replace(/\D/g, "").length > 10
            ? [cliente.whatsapp.replace(/\D/g, "").slice(0, 2), cliente.whatsapp.replace(/\D/g, "").slice(2)]
            : ["", cliente.whatsapp.replace(/\D/g, "")];

        const preference = new Preference(client);

        const formaPagamentoPreferida = req.body.formaPagamentoPreferida;

        const resultado = await preference.create({
            body: {
                items: itens,

                payer: {
                    name: cliente.nomeCompleto,
                    email: cliente.email,
                    phone: {
                        area_code: ddd,
                        number: restoNumero.join("")
                    },
                    address: {
                        zip_code: cliente.cep.replace(/\D/g, ""),
                        street_name: cliente.rua,
                        street_number: cliente.numero
                    }
                },

                // Se o cliente já escolheu "Pix" no nosso checkout,
                // pede pro Mercado Pago abrir direto na tela do Pix,
                // sem precisar escolher de novo lá.
                ...(formaPagamentoPreferida === "pix" ? {
                    payment_methods: {
                        default_payment_method_id: "pix"
                    }
                } : {}),

                // Liga essa cobrança ao pedido salvo no nosso banco —
                // é assim que o webhook vai saber qual pedido atualizar.
                external_reference: pedido.id,

                back_urls: {
                    success: urlPublica + "/pagamento-sucesso.html",
                    failure: urlPublica + "/pagamento-erro.html",
                    pending: urlPublica + "/pagamento-pendente.html"
                },

                auto_return: "approved",
                notification_url: urlPublica + "/api/webhook-mercadopago"
            }
        });

        // 3) Guarda o id da preferência no pedido, pra referência futura
        await supabase
            .from("pedidos")
            .update({ preferencia_id: resultado.id })
            .eq("id", pedido.id);

        res.json({ init_point: resultado.init_point });

    } catch (erro) {
        console.error("Erro ao criar preferência:", erro);
        res.status(500).json({ erro: "Erro ao criar preferência de pagamento" });
    }
});


/* ================================================
   WEBHOOK — Mercado Pago avisa aqui quando o status
   do pagamento muda (aprovado, recusado, etc.)
================================================ */

app.post("/api/webhook-mercadopago", async (req, res) => {

    try {
        const tipo = req.query.type || req.body.type;
        const paymentId = req.query["data.id"] || (req.body.data && req.body.data.id);

        if (tipo === "payment" && paymentId) {

            const payment = new Payment(client);
            const pagamento = await payment.get({ id: paymentId });

            console.log(
                "[Olivea] Pagamento", paymentId,
                "- status:", pagamento.status,
                "- valor:", pagamento.transaction_amount
            );

            const pedidoId = pagamento.external_reference;

            if (pedidoId) {

                const statusPorPagamento = {
                    approved: "aprovado",
                    rejected: "recusado",
                    cancelled: "recusado",
                    refunded: "recusado",
                    pending: "pendente",
                    in_process: "pendente"
                };

                const novoStatus = statusPorPagamento[pagamento.status] || "pendente";

                const { data: pedidoAtualizado } = await supabase
                    .from("pedidos")
                    .update({ status: novoStatus })
                    .eq("id", pedidoId)
                    .select()
                    .single();

                if (novoStatus === "aprovado" && pedidoAtualizado) {
                    await enviarEmailNovoPedido(pedidoAtualizado);
                }
            }
        }

        // Responder 200 rápido é importante — o Mercado Pago
        // reenvia a notificação se não receber essa confirmação.
        res.sendStatus(200);

    } catch (erro) {
        console.error("Erro no webhook:", erro);
        res.sendStatus(200); // mesmo com erro interno, confirma o recebimento
    }
});


/* ================================================
   ROTA DE TESTE (pra saber se o servidor está no ar)
================================================ */

app.get("/", (req, res) => {
    res.send("Servidor Olivea + Mercado Pago está no ar ✅");
});


const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
    console.log("Servidor Olivea rodando na porta " + PORTA);
});