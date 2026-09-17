/* ======================================
   EMAIL DE NOVO PEDIDO

   Usa o Gmail da própria Olivea pra mandar
   um aviso pro email da loja toda vez que
   um pedido for aprovado.

   Pra funcionar, precisa no .env:

   EMAIL_REMETENTE=contatobyolivea@gmail.com
   EMAIL_SENHA_APP=xxxx xxxx xxxx xxxx

   IMPORTANTE: EMAIL_SENHA_APP NÃO é a senha
   normal da conta Google — é uma "senha de
   app" gerada especificamente pra isso.
   Veja como gerar em:
   https://myaccount.google.com/apppasswords
   (precisa ter a verificação em duas etapas
   ativada na conta Google primeiro).
====================================== */

const nodemailer = require("nodemailer");

let transportador = null;

if (process.env.EMAIL_REMETENTE && process.env.EMAIL_SENHA_APP) {
    transportador = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_REMETENTE,
            pass: process.env.EMAIL_SENHA_APP
        }
    });
} else {
    console.error(
        "\n[Olivea] EMAIL_REMETENTE e/ou EMAIL_SENHA_APP não configurados " +
        "no .env — os emails de novo pedido não serão enviados.\n"
    );
}

async function enviarEmailNovoPedido(pedido) {

    if (!transportador) return;

    const listaItens = pedido.itens.map((item) =>
        `- ${item.quantidade}x ${item.nome} — R$ ${Number(item.preco).toFixed(2).replace(".", ",")}`
    ).join("\n");

    const corpo = `
Novo pedido aprovado na Olivea! 🎉

CLIENTE
Nome: ${pedido.nome_completo}
Email: ${pedido.email}
WhatsApp: ${pedido.whatsapp}

ENDEREÇO DE ENTREGA
${pedido.rua}, ${pedido.numero} ${pedido.complemento || ""}
${pedido.bairro} — ${pedido.cidade}/${pedido.estado}
CEP: ${pedido.cep}

ITENS
${listaItens}

TOTAL: R$ ${Number(pedido.total).toFixed(2).replace(".", ",")}

Número do pedido (id interno): ${pedido.id}
`.trim();

    try {
        await transportador.sendMail({
            from: `"Olivea — Pedidos" <${process.env.EMAIL_REMETENTE}>`,
            to: process.env.EMAIL_DESTINO || process.env.EMAIL_REMETENTE,
            subject: `Novo pedido — ${pedido.nome_completo} — R$ ${Number(pedido.total).toFixed(2).replace(".", ",")}`,
            text: corpo
        });

        console.log("[Olivea] Email de novo pedido enviado para", pedido.email);

    } catch (erro) {
        console.error("[Olivea] Erro ao enviar email de novo pedido:", erro);
    }
}

module.exports = { enviarEmailNovoPedido };