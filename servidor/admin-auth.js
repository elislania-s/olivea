/* ======================================
   LOGIN DO ADMIN

   Login simples (usuário/senha únicos, definidos
   no .env) usando sessão por cookie. Não usa
   tabela de usuários — é só pra você mesma acessar.
====================================== */

const express = require("express");
const bcrypt = require("bcryptjs");

const router = express.Router();

// Middleware: bloqueia rotas de admin se não estiver logado
function exigirLogin(req, res, next) {
    if (req.session && req.session.admin === true) {
        return next();
    }
    res.status(401).json({ erro: "Não autenticado" });
}

router.post("/api/admin/login", async (req, res) => {

    const { usuario, senha } = req.body;

    const usuarioCorreto = process.env.ADMIN_USUARIO;
    const hashSenhaCorreta = process.env.ADMIN_SENHA_HASH;

    if (!usuarioCorreto || !hashSenhaCorreta) {
        return res.status(500).json({
            erro: "Login do admin não configurado no servidor (.env)"
        });
    }

    if (usuario !== usuarioCorreto) {
        return res.status(401).json({ erro: "Usuário ou senha incorretos" });
    }

    const senhaConfere = await bcrypt.compare(senha || "", hashSenhaCorreta);

    if (!senhaConfere) {
        return res.status(401).json({ erro: "Usuário ou senha incorretos" });
    }

    req.session.admin = true;
    res.json({ ok: true });
});

router.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({ ok: true });
    });
});

router.get("/api/admin/verificar", (req, res) => {
    res.json({ logado: !!(req.session && req.session.admin) });
});

module.exports = { router, exigirLogin };