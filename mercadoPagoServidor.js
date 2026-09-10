/* ======================================
   SERVIDOR — EXEMPLO DE INTEGRAÇÃO COM
   O MERCADO PAGO (Checkout Pro)

   Por que isso precisa de um servidor?
   ------------------------------------
   Criar uma cobrança no Mercado Pago
   exige o "Access Token" da sua conta —
   uma chave secreta. Se ela ficasse no
   HTML/JS do site (que qualquer visitante
   pode abrir e ler), qualquer pessoa
   poderia usá-la para criar cobranças em
   nome da sua loja. Por isso essa etapa
   tem que rodar num servidor, não no
   navegador do cliente.

   Este arquivo é um EXEMPLO funcional.
   Para usar de verdade:

   1) Crie uma conta de desenvolvedor em
      https://www.mercadopago.com.br/developers
      e pegue o "Access Token" (comece
      com o de TESTE antes de ir pra
      produção).

   2) Instale as dependências:
        npm init -y
        npm install express mercadopago cors

   3) Troque "SEU_ACCESS_TOKEN_AQUI" pelo
      seu token (nunca coloque isso num
      arquivo público do front-end).

   4) Hospede este servidor em algum
      lugar (Render, Railway, um VPS, uma
      função serverless da Vercel/Netlify
      etc.) — ele PRECISA ficar acessível
      publicamente pra receber a chamada
      que o site faz em "mercadopago.js".

   5) Ajuste as "back_urls" abaixo para
      as páginas reais do seu domínio.
====================================== */

const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Preference } = require("mercadopago");

const app = express();

app.use(cors());
app.use(express.json());

// Se quiser, sirva os arquivos do próprio site por aqui também:
// app.use(express.static("public"));

const client = new MercadoPagoConfig({
    accessToken: "SEU_ACCESS_TOKEN_AQUI"
});

app.post("/api/criar-preferencia", async (req, res) => {

    try {
        const itensRecebidos = req.body.itens || [];

        if (itensRecebidos.length === 0) {
            return res.status(400).json({ erro: "Sacola vazia" });
        }

        const itens = itensRecebidos.map((item) => ({
            title: item.nome,
            quantity: item.quantidade,
            unit_price: Number(item.preco),
            currency_id: "BRL"
        }));

        const preference = new Preference(client);

        const resultado = await preference.create({
            body: {
                items: itens,
                back_urls: {
                    success: "https://SEUSITE.com/pagamento-sucesso.html",
                    failure: "https://SEUSITE.com/pagamento-erro.html",
                    pending: "https://SEUSITE.com/pagamento-pendente.html"
                },
                auto_return: "approved"
            }
        });

        res.json({ init_point: resultado.init_point });

    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: "Erro ao criar preferência de pagamento" });
    }
});

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
    console.log("Servidor Olivea rodando na porta " + PORTA);
});