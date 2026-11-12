/* ======================================
   ROTAS DE RESERVA DE ESTOQUE

   POST /api/reservar
     O checkout chama assim que o cliente abre a página.
     Segura os itens por 20 minutos pra ninguém mais
     conseguir comprar a mesma peça enquanto ele preenche.
     Devolve quanto tempo resta e o que precisou ser ajustado
     (peça esgotada, quantidade menor, segurada por outra pessoa).

   GET /api/pedido-status/:id
     O site pergunta se um pedido já foi aprovado
     (usado pra esvaziar a sacola mesmo se o cliente
     não voltou pela página de sucesso).
====================================== */

const express = require("express");
const supabase = require("./db");

const router = express.Router();

// Tempo que o cliente tem pra preencher o checkout
const MINUTOS_CHECKOUT = 20;

// Valida o que vem do navegador (nunca confiar direto)
function limparItens(itens) {
    if (!Array.isArray(itens)) return [];

    const porId = new Map();

    itens.slice(0, 50).forEach((item) => {
        const id = item && item.id != null ? String(item.id).slice(0, 100) : "";
        const quantidade = Math.min(Math.max(parseInt(item && item.quantidade, 10) || 1, 1), 99);
        if (!id) return;
        porId.set(id, (porId.get(id) || 0) + quantidade);
    });

    return Array.from(porId, ([id, quantidade]) => ({ id, quantidade }));
}

function tokenValido(token) {
    return typeof token === "string" && token.length >= 16 && token.length <= 100;
}


router.post("/api/reservar", async (req, res) => {

    try {
        const { token } = req.body || {};
        const itens = limparItens(req.body && req.body.itens);

        if (!tokenValido(token) || itens.length === 0) {
            return res.status(400).json({ erro: "Dados inválidos" });
        }

        const { data, error } = await supabase.rpc("reservar_itens", {
            p_token: token,
            p_itens: itens,
            p_minutos: MINUTOS_CHECKOUT,
            p_renovar: false
        });

        if (error) throw error;

        res.json(data);

    } catch (erro) {
        console.error("Erro ao reservar itens:", erro);
        res.status(500).json({ erro: "Erro ao reservar os itens" });
    }
});


router.get("/api/pedido-status/:id", async (req, res) => {

    try {
        const { data, error } = await supabase
            .from("pedidos")
            .select("status")
            .eq("id", req.params.id)
            .single();

        if (error || !data) {
            return res.status(404).json({ erro: "Pedido não encontrado" });
        }

        res.json({ status: data.status });

    } catch (erro) {
        res.status(404).json({ erro: "Pedido não encontrado" });
    }
});


module.exports = { router, limparItens, tokenValido };