/* ======================================
   SERVIDOR — OLIVEA + PAGBANK

   O QUE ESTE ARQUIVO FAZ:
   1) Recebe a sacola do site (POST /api/criar-checkout-pagbank)
      e cria a cobrança (Checkout) no PagBank.
   2) Devolve a URL de pagamento pro site redirecionar o cliente.
   3) Recebe as notificações do PagBank avisando se o pagamento
      mudou de status (POST /api/webhook-pagbank) — é aqui que,
      no futuro, você vai marcar o pedido como "pago".

   POR QUE ISSO PRECISA FICAR SEPARADO DO SITE:
   O Token é a chave secreta da sua conta PagBank. Se ela estivesse
   em um arquivo do site (HTML/JS), qualquer visitante conseguiria
   ler e usar essa chave. Por isso ela só existe aqui, no servidor,
   escondida numa variável de ambiente (arquivo .env).
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

if (!process.env.PAGBANK_TOKEN) {
    console.error(
        "\n[Olivea] Faltou configurar o PAGBANK_TOKEN no arquivo .env. " +
        "Veja como pegar o token no painel do PagBank (Meu Negócio > Vendas > " +
        "Integrações > Gerar Token).\n"
    );
}

if (!process.env.URL_PUBLICA) {
    console.error(
        "\n[Olivea] Faltou configurar o URL_PUBLICA no arquivo .env " +
        "(o endereço público onde este servidor está publicado, ex: " +
        "https://olivea.onrender.com).\n"
    );
}

// Troque para a URL de sandbox enquanto estiver testando:
// https://sandbox.api.pagseguro.com
const PAGBANK_API_BASE = process.env.PAGBANK_API_BASE || "https://api.pagseguro.com";


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
   CRIAR A COBRANÇA NO PAGBANK
   (chamado pelo checkout.js do site)
================================================ */

app.post("/api/criar-checkout-pagbank", async (req, res) => {

    try {
        const itensRecebidos = req.body.itens || [];
        const cliente = req.body.cliente || {};
        const frete = req.body.frete || null;

        if (itensRecebidos.length === 0) {
            return res.status(400).json({ erro: "Sacola vazia" });
        }

        const camposObrigatorios = [
            "nomeCompleto", "email", "whatsapp", "cpf",
            "cep", "rua", "numero", "bairro", "cidade", "estado"
        ];

        for (const campo of camposObrigatorios) {
            if (!cliente[campo] || !String(cliente[campo]).trim()) {
                return res.status(400).json({ erro: "Preencha todos os campos obrigatórios, incluindo o CPF." });
            }
        }

        const cpfLimpo = String(cliente.cpf).replace(/\D/g, "");
        if (cpfLimpo.length !== 11) {
            return res.status(400).json({ erro: "CPF inválido." });
        }

        // Monta os itens no formato que o PagBank espera
        // (valores em CENTAVOS, não em reais)
        const itensPagbank = itensRecebidos.map((item, index) => ({
            reference_id: String(item.id || `item-${index}`),
            name: String(item.nome).slice(0, 100),
            quantity: Number(item.quantidade) || 1,
            unit_amount: Math.round(Number(item.preco) * 100)
        }));

        // Frete vira mais um "item" na cobrança, pra entrar no
        // mesmo pagamento (o cliente paga tudo de uma vez só)
        if (frete && frete.preco > 0) {
            itensPagbank.push({
                reference_id: "frete",
                name: "Frete - " + (frete.servico || "Entrega"),
                quantity: 1,
                unit_amount: Math.round(Number(frete.preco) * 100)
            });
        }

        const totalReais = itensPagbank.reduce(
            (soma, item) => soma + (item.unit_amount * item.quantity) / 100,
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
                status: "pendente"
            })
            .select()
            .single();

        if (erroPedido) throw erroPedido;

        // 2) Cria o Checkout no PagBank, já com os dados do cliente
        const urlPublica = process.env.URL_PUBLICA;

        const whatsappLimpo = cliente.whatsapp.replace(/\D/g, "");
        const [ddd, ...restoNumero] = whatsappLimpo.length > 10
            ? [whatsappLimpo.slice(0, 2), whatsappLimpo.slice(2)]
            : ["", whatsappLimpo];

        const formaPagamentoPreferida = req.body.formaPagamentoPreferida;

        const payloadCheckout = {
            reference_id: String(pedido.id),

            customer: {
                name: cliente.nomeCompleto,
                email: cliente.email,
                tax_id: cpfLimpo,
                phone: {
                    country: "+55",
                    area: ddd,
                    number: restoNumero.join("")
                }
            },

            // Se o cliente já chegou de um endereço válido, deixamos
            // travado (address_modifiable: false) pra não haver
            // divergência com o frete já calculado.
            customer_modifiable: true,

            items: itensPagbank,

            // Se o cliente escolheu "Pix" no nosso checkout, restringe
            // o PagBank a mostrar só essa opção; senão, deixa cartão.
            payment_methods: formaPagamentoPreferida === "pix"
                ? [{ type: "PIX" }]
                : [{ type: "CREDIT_CARD" }, { type: "DEBIT_CARD" }],

            redirect_url: urlPublica + "/pagamento-sucesso.html",
            return_url: urlPublica + "/checkout.html",

            notification_urls: [urlPublica + "/api/webhook-pagbank"],
            payment_notification_urls: [urlPublica + "/api/webhook-pagbank"]
        };

        const respostaPagbank = await fetch(`${PAGBANK_API_BASE}/checkouts`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.PAGBANK_TOKEN}`,
                "Content-Type": "application/json",
                "accept": "application/json"
            },
            body: JSON.stringify(payloadCheckout)
        });

        const dadosPagbank = await respostaPagbank.json();

        if (!respostaPagbank.ok) {
            console.error("[Olivea] Erro do PagBank ao criar checkout:", JSON.stringify(dadosPagbank));
            throw new Error("PagBank recusou a criação do checkout");
        }

        // A URL de pagamento vem dentro de "links", no link com rel "PAY"
        const linkPagamento = (dadosPagbank.links || []).find((link) => link.rel === "PAY");

        if (!linkPagamento) {
            console.error("[Olivea] PagBank não retornou link de pagamento:", JSON.stringify(dadosPagbank));
            throw new Error("PagBank não retornou o link de pagamento");
        }

        // 3) Guarda o id do checkout no pedido, pra referência futura
        await supabase
            .from("pedidos")
            .update({ preferencia_id: dadosPagbank.id })
            .eq("id", pedido.id);

        res.json({ checkout_url: linkPagamento.href });

    } catch (erro) {
        console.error("Erro ao criar checkout PagBank:", erro);
        res.status(500).json({ erro: "Erro ao criar checkout de pagamento" });
    }
});


/* ================================================
   WEBHOOK — PagBank avisa aqui quando o status
   do checkout/pagamento muda (pago, recusado, etc.)

   IMPORTANTE: o formato exato do corpo dessa notificação
   pode variar um pouco. O console.log abaixo mostra o payload
   real assim que a primeira notificação chegar em produção —
   ajuste a leitura de "novoStatus" conforme o que aparecer lá,
   se necessário.
================================================ */

app.post("/api/webhook-pagbank", async (req, res) => {

    try {
        console.log("[Olivea] Webhook PagBank recebido:", JSON.stringify(req.body));

        const referenciaExterna = req.body.reference_id
            || (req.body.charges && req.body.charges[0] && req.body.charges[0].reference_id);

        const statusCharge = req.body.status
            || (req.body.charges && req.body.charges[0] && req.body.charges[0].status);

        if (referenciaExterna) {

            const statusPorPagamento = {
                PAID: "aprovado",
                AVAILABLE: "aprovado",
                DECLINED: "recusado",
                CANCELED: "recusado",
                IN_ANALYSIS: "pendente",
                WAITING: "pendente"
            };

            const novoStatus = statusPorPagamento[statusCharge] || "pendente";

            const { data: pedidoAtualizado } = await supabase
                .from("pedidos")
                .update({ status: novoStatus })
                .eq("id", referenciaExterna)
                .select()
                .single();

            if (novoStatus === "aprovado" && pedidoAtualizado) {
                await enviarEmailNovoPedido(pedidoAtualizado);
            }
        }

        res.sendStatus(200);

    } catch (erro) {
        console.error("Erro no webhook PagBank:", erro);
        res.sendStatus(200); // mesmo com erro interno, confirma o recebimento
    }
});


/* ================================================
   ROTA DE TESTE (pra saber se o servidor está no ar)
================================================ */

app.get("/", (req, res) => {
    res.send("Servidor Olivea + PagBank está no ar ✅");
});


const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
    console.log("Servidor Olivea rodando na porta " + PORTA);
});