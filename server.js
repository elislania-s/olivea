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

const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

const app = express();

app.use(cors());
app.use(express.json());

if (!process.env.MP_ACCESS_TOKEN) {
    console.error(
        "\n[Olivea] Faltou configurar o MP_ACCESS_TOKEN no arquivo .env. " +
        "Veja o .env.example.\n"
    );
}

if (!process.env.URL_DO_SITE) {
    console.error(
        "\n[Olivea] Faltou configurar o URL_DO_SITE no arquivo .env " +
        "(ex: https://www.olivea.com.br).\n"
    );
}

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});


/* ================================================
   CRIAR A COBRANÇA (chamado pelo mercadopago.js do site)
================================================ */

app.post("/api/criar-preferencia", async (req, res) => {

    try {
        const itensRecebidos = req.body.itens || [];

        if (itensRecebidos.length === 0) {
            return res.status(400).json({ erro: "Sacola vazia" });
        }

        const itens = itensRecebidos.map((item) => ({
            title: String(item.nome).slice(0, 250),
            quantity: Number(item.quantidade) || 1,
            unit_price: Number(item.preco),
            currency_id: "BRL"
        }));

        const urlSite = process.env.URL_DO_SITE;

        const preference = new Preference(client);

        const resultado = await preference.create({
            body: {
                items: itens,

                back_urls: {
                    success: urlSite + "/pagamento-sucesso.html",
                    failure: urlSite + "/pagamento-erro.html",
                    pending: urlSite + "/pagamento-pendente.html"
                },

                auto_return: "approved",

                // Endereço que o Mercado Pago vai chamar avisando o
                // status real do pagamento (mais confiável que só o
                // back_url, que depende do cliente ser redirecionado).
                notification_url: process.env.URL_DO_SERVIDOR + "/api/webhook-mercadopago"
            }
        });

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

            // AQUI é onde, futuramente, você conecta com:
            // - envio de e-mail/WhatsApp de confirmação pro cliente
            // - baixa de estoque
            // - marcação do pedido como pago no seu banco de dados/planilha
            //
            // if (pagamento.status === "approved") { ... }
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