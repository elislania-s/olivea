/* ======================================
   EMAILS DO PEDIDO

   Usa o Gmail da própria Olivea pra mandar,
   toda vez que um pedido for aprovado:
   1) um aviso pro email DA LOJA;
   2) a confirmação de pedido recebido pro
      email DA CLIENTE.

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

    // Linha do frete só aparece se o pedido tiver frete salvo
    const linhaFrete = pedido.frete_servico
        ? `Frete escolhido: ${pedido.frete_servico} — R$ ${Number(pedido.frete_valor).toFixed(2).replace(".", ",")}\n`
        : "";

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

${linhaFrete}TOTAL: R$ ${Number(pedido.total).toFixed(2).replace(".", ",")}

Número do pedido (id interno): ${pedido.id}
`.trim();

    try {
        await transportador.sendMail({
            from: `"Olivea — Pedidos" <${process.env.EMAIL_REMETENTE}>`,
            to: process.env.EMAIL_DESTINO || process.env.EMAIL_REMETENTE,
            subject: `Novo pedido — ${pedido.nome_completo} — R$ ${Number(pedido.total).toFixed(2).replace(".", ",")}`,
            text: corpo
        });

        console.log("[Olivea] Aviso de novo pedido enviado para a loja (pedido " + pedido.id + ")");

    } catch (erro) {
        console.error("[Olivea] Erro ao enviar email de novo pedido:", erro);
    }
}

/* ================================================
   CONFIRMAÇÃO PRA CLIENTE ("recebemos seu pedido")
================================================ */

const WHATSAPP_LOJA = "5571981437753";

function reais(valor) {
    return "R$ " + Number(valor || 0).toFixed(2).replace(".", ",");
}

// Impede que um nome/endereço com "<" ou "&" quebre o email
function esc(texto) {
    return String(texto == null ? "" : texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function enviarEmailConfirmacaoCliente(pedido) {

    if (!transportador) return;

    const emailCliente = String(pedido.email || "").trim();

    if (!emailCliente || !emailCliente.includes("@")) {
        console.error("[Olivea] Pedido " + pedido.id + " sem email válido da cliente — confirmação não enviada.");
        return;
    }

    const primeiroNome = String(pedido.nome_completo || "").trim().split(/\s+/)[0] || "";
    const saudacao = primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!";

    const itens = Array.isArray(pedido.itens) ? pedido.itens : [];

    const temFrete = Boolean(pedido.frete_servico);
    const freteTexto = Number(pedido.frete_valor) > 0 ? reais(pedido.frete_valor) : "Grátis";

    const endereco =
        `${pedido.rua}, ${pedido.numero}${pedido.complemento ? " " + pedido.complemento : ""}\n` +
        `${pedido.bairro} — ${pedido.cidade}/${pedido.estado}\n` +
        `CEP: ${pedido.cep}`;

    const linkWhatsApp = `https://wa.me/${WHATSAPP_LOJA}`;

    // ---------- versão em texto simples ----------
    const texto = `
${saudacao}

Recebemos o seu pedido e o pagamento foi aprovado. Muito obrigada por escolher a Olivea! 🤍

PEDIDO Nº ${pedido.id}

ITENS
${itens.map((i) => `- ${i.quantidade}x ${i.nome} — ${reais(i.preco * i.quantidade)}`).join("\n")}

${temFrete ? `Frete (${pedido.frete_servico}): ${freteTexto}\n` : ""}TOTAL: ${reais(pedido.total)}

ENTREGA EM
${endereco}

Assim que o pedido for enviado, avisamos você. Qualquer dúvida, é só falar com a gente pelo WhatsApp: ${linkWhatsApp}

Com carinho,
Equipe Olivea
`.trim();

    // ---------- versão bonita (HTML) ----------
    const linhasItens = itens.map((i) => `
        <tr>
            <td style="padding:8px 0;border-bottom:1px solid #EADFCF;color:#3F3026;font-size:14px;">
                ${esc(i.quantidade)}x ${esc(i.nome)}
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #EADFCF;color:#3F3026;font-size:14px;text-align:right;white-space:nowrap;">
                ${reais(i.preco * i.quantidade)}
            </td>
        </tr>
    `).join("");

    const html = `
<div style="background:#F3EDE3;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#FCFAF6;border-radius:8px;padding:32px 28px;">

    <div style="text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:28px;letter-spacing:6px;color:#3F3026;margin-bottom:24px;">
      OLIVEA
    </div>

    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#3F3026;margin:0 0 12px;font-weight:600;">
      ${esc(saudacao)} Recebemos o seu pedido 🤍
    </h1>

    <p style="color:#3F3026;font-size:15px;line-height:1.6;margin:0 0 20px;">
      O pagamento foi aprovado. Muito obrigada por escolher a Olivea!
      Assim que o pedido for enviado, avisamos você.
    </p>

    <p style="color:#7A6A5A;font-size:12px;letter-spacing:1px;margin:0 0 6px;">PEDIDO Nº ${esc(pedido.id)}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${linhasItens}
      ${temFrete ? `
      <tr>
        <td style="padding:8px 0;color:#3F3026;font-size:14px;">Frete (${esc(pedido.frete_servico)})</td>
        <td style="padding:8px 0;color:#3F3026;font-size:14px;text-align:right;">${freteTexto}</td>
      </tr>` : ""}
      <tr>
        <td style="padding:12px 0 0;color:#3F3026;font-size:16px;font-weight:bold;">Total</td>
        <td style="padding:12px 0 0;color:#3F3026;font-size:16px;font-weight:bold;text-align:right;">${reais(pedido.total)}</td>
      </tr>
    </table>

    <p style="color:#7A6A5A;font-size:12px;letter-spacing:1px;margin:24px 0 6px;">ENTREGA EM</p>
    <p style="color:#3F3026;font-size:14px;line-height:1.6;margin:0;">
      ${esc(pedido.rua)}, ${esc(pedido.numero)}${pedido.complemento ? " " + esc(pedido.complemento) : ""}<br>
      ${esc(pedido.bairro)} — ${esc(pedido.cidade)}/${esc(pedido.estado)}<br>
      CEP: ${esc(pedido.cep)}
    </p>

    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${linkWhatsApp}" style="background:#3F3026;color:#FCFAF6;text-decoration:none;padding:12px 24px;border-radius:4px;font-size:13px;letter-spacing:1px;display:inline-block;">
        FALAR COM A OLIVEA NO WHATSAPP
      </a>
    </div>

    <p style="color:#7A6A5A;font-size:12px;text-align:center;margin:20px 0 0;">
      Com carinho, equipe Olivea
    </p>
  </div>
</div>
`;

    try {
        await transportador.sendMail({
            from: `"Olivea" <${process.env.EMAIL_REMETENTE}>`,
            to: emailCliente,
            // Se a cliente responder o email, a resposta cai na caixa da loja
            replyTo: process.env.EMAIL_DESTINO || process.env.EMAIL_REMETENTE,
            subject: `Recebemos o seu pedido na Olivea 🤍 (nº ${pedido.id})`,
            text: texto,
            html
        });

        console.log("[Olivea] Confirmação enviada para a cliente (pedido " + pedido.id + ")");

    } catch (erro) {
        console.error("[Olivea] Erro ao enviar confirmação para a cliente (pedido " + pedido.id + "):", erro);
    }
}

module.exports = { enviarEmailNovoPedido, enviarEmailConfirmacaoCliente };