/* ======================================
   FRETE — SUPERFRETE

   Consulta o preço/prazo de frete de verdade,
   com os descontos da sua conta SuperFrete.

   Documentação oficial:
   https://superfrete.readme.io/reference/primeiros-passos

   Precisa no .env:

   SUPERFRETE_TOKEN=...........(o token que você gerou lá)
   SUPERFRETE_EMAIL=seuemail@exemplo.com  (usado só de identificação)
   SUPERFRETE_CEP_ORIGEM=00000000         (CEP de onde você envia)
   SUPERFRETE_AMBIENTE=sandbox            (ou "producao")
====================================== */

const express = require("express");
const supabase = require("./db");

const router = express.Router();

function baseUrlSuperfrete() {
    return process.env.SUPERFRETE_AMBIENTE === "producao"
        ? "https://api.superfrete.com/api/v0/calculator"
        : "https://sandbox.superfrete.com/api/v0/calculator";
}

router.post("/api/calcular-frete", async (req, res) => {

    try {
        const { produtoId, itens, cepDestino } = req.body;

        const cepLimpo = String(cepDestino || "").replace(/\D/g, "");

        if (cepLimpo.length !== 8) {
            return res.status(400).json({ erro: "CEP de destino inválido" });
        }

        if (!process.env.SUPERFRETE_TOKEN || !process.env.SUPERFRETE_CEP_ORIGEM) {
            return res.status(500).json({
                erro: "Cálculo de frete não configurado no servidor (.env)"
            });
        }

        // Monta a lista de produtos a considerar: ou é 1 produto só
        // (usado na página de produto, só de prévia) ou a sacola
        // inteira (usado no checkout, com quantidades).
        const listaConsulta = itens && itens.length
            ? itens
            : [{ id: produtoId, quantidade: 1 }];

        const idsProdutos = listaConsulta.map((item) => item.id);

        const { data: produtos, error: erroProduto } = await supabase
            .from("produtos")
            .select("id, peso_kg, altura_cm, largura_cm, comprimento_cm")
            .in("id", idsProdutos);

        if (erroProduto || !produtos || produtos.length === 0) {
            return res.status(404).json({ erro: "Produto(s) não encontrado(s)" });
        }

        // Peso total = soma de todos os itens (peso x quantidade).
        // Dimensões = a maior altura/largura/comprimento entre os
        // itens (aproximação razoável pra uma única caixa com tudo
        // dentro — funciona bem pra itens pequenos como semijoias).
        let pesoTotal = 0;
        let alturaMax = 4;
        let larguraMax = 12;
        let comprimentoMax = 17;

        listaConsulta.forEach((itemPedido) => {
            const produto = produtos.find((p) => p.id === itemPedido.id);
            if (!produto) return;

            const quantidade = itemPedido.quantidade || 1;

            pesoTotal += (Number(produto.peso_kg) || 0.2) * quantidade;
            alturaMax = Math.max(alturaMax, Number(produto.altura_cm) || 4);
            larguraMax = Math.max(larguraMax, Number(produto.largura_cm) || 12);
            comprimentoMax = Math.max(comprimentoMax, Number(produto.comprimento_cm) || 17);
        });

        const corpoSuperfrete = {
            from: { postal_code: process.env.SUPERFRETE_CEP_ORIGEM },
            to: { postal_code: cepLimpo },
            package: {
                height: alturaMax,
                width: larguraMax,
                length: comprimentoMax,
                weight: Math.max(pesoTotal, 0.1)
            },
            // 1 = PAC, 2 = SEDEX, 17 = Mini Envios (Correios).
            services: "1,2,17"
        };

        console.log("[Olivea] Consultando frete:", JSON.stringify(corpoSuperfrete));

        const respostaSuperfrete = await fetch(baseUrlSuperfrete(), {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + process.env.SUPERFRETE_TOKEN,
                "User-Agent": `Olivea/1.0 (${process.env.SUPERFRETE_EMAIL || "contato@olivea.com"})`,
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(corpoSuperfrete)
        });

        const dadosSuperfrete = await respostaSuperfrete.json();

        console.log("[Olivea] Resposta da SuperFrete:", JSON.stringify(dadosSuperfrete));

        if (!respostaSuperfrete.ok) {
            console.error("[Olivea] Erro da SuperFrete:", dadosSuperfrete);
            return res.status(502).json({ erro: "Não foi possível calcular o frete agora" });
        }

        // A SuperFrete devolve uma lista de opções (uma por
        // transportadora/serviço). Simplificamos pro front-end.
        const opcoes = (Array.isArray(dadosSuperfrete) ? dadosSuperfrete : [])
            .filter((opcao) => !opcao.error)
            .map((opcao) => ({
                servico: (opcao.company && opcao.company.name) || opcao.name || "Frete",
                nome: opcao.name || "",
                preco: Number(opcao.price),
                prazoDias: opcao.delivery_time || opcao.delivery_range?.max || null
            }));

        res.json({ opcoes });

    } catch (erro) {
        console.error("[Olivea] Erro ao calcular frete:", erro);
        res.status(500).json({ erro: "Erro ao calcular o frete" });
    }
});

module.exports = router;