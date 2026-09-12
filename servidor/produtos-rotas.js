/* ======================================
   ROTAS DE PRODUTOS

   PÚBLICAS (usadas pelo site, sem login):
     GET  /api/produtos              → lista (com filtro ?categoria=)
     GET  /api/produtos/:id          → um produto específico
     GET  /api/configuracoes         → banner, itens por página, etc.

   ADMINISTRATIVAS (exigem estar logado no painel):
     POST   /api/admin/produtos          → criar
     PUT    /api/admin/produtos/:id      → editar
     DELETE /api/admin/produtos/:id      → apagar
     POST   /api/admin/upload-imagem     → subir uma foto
     PUT    /api/admin/configuracoes     → salvar configurações
====================================== */

const express = require("express");
const multer = require("multer");
const supabase = require("./db");
const { exigirLogin } = require("./admin-auth");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB por foto
});


/* ================================================
   PÚBLICAS
================================================ */

router.get("/api/produtos", async (req, res) => {

    try {
        let consulta = supabase
            .from("produtos")
            .select("*")
            .eq("ativo", true)
            .order("ordem", { ascending: true });

        if (req.query.categoria) {
            consulta = consulta.eq("categoria", req.query.categoria);
        }

        if (req.query.destaque === "true") {
            consulta = consulta.eq("destaque", true);
        }

        const { data, error } = await consulta;

        if (error) throw error;

        res.json(data);

    } catch (erro) {
        console.error("Erro ao listar produtos:", erro);
        res.status(500).json({ erro: "Erro ao buscar produtos" });
    }
});

router.get("/api/produtos/:id", async (req, res) => {

    try {
        const { data, error } = await supabase
            .from("produtos")
            .select("*")
            .eq("id", req.params.id)
            .eq("ativo", true)
            .single();

        if (error || !data) {
            return res.status(404).json({ erro: "Produto não encontrado" });
        }

        res.json(data);

    } catch (erro) {
        console.error("Erro ao buscar produto:", erro);
        res.status(500).json({ erro: "Erro ao buscar produto" });
    }
});

router.get("/api/configuracoes", async (req, res) => {

    try {
        const { data, error } = await supabase
            .from("configuracoes")
            .select("*");

        if (error) throw error;

        const configuracoes = {};
        (data || []).forEach((linha) => {
            configuracoes[linha.chave] = linha.valor;
        });

        res.json(configuracoes);

    } catch (erro) {
        console.error("Erro ao buscar configurações:", erro);
        res.status(500).json({ erro: "Erro ao buscar configurações" });
    }
});


/* ================================================
   ADMINISTRATIVAS (protegidas)
================================================ */

// Todas as rotas abaixo desta linha exigem login
router.use("/api/admin", exigirLogin);

// Lista TODOS os produtos (inclusive inativos) — só pro painel
router.get("/api/admin/produtos", async (req, res) => {

    try {
        const { data, error } = await supabase
            .from("produtos")
            .select("*")
            .order("categoria", { ascending: true })
            .order("ordem", { ascending: true });

        if (error) throw error;

        res.json(data);

    } catch (erro) {
        console.error("Erro ao listar produtos (admin):", erro);
        res.status(500).json({ erro: "Erro ao buscar produtos" });
    }
});

router.post("/api/admin/produtos", async (req, res) => {

    try {
        const { data, error } = await supabase
            .from("produtos")
            .insert(req.body)
            .select()
            .single();

        if (error) throw error;

        res.json(data);

    } catch (erro) {
        console.error("Erro ao criar produto:", erro);
        res.status(500).json({ erro: "Erro ao criar produto" });
    }
});

router.put("/api/admin/produtos/:id", async (req, res) => {

    try {
        const { data, error } = await supabase
            .from("produtos")
            .update(req.body)
            .eq("id", req.params.id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);

    } catch (erro) {
        console.error("Erro ao editar produto:", erro);
        res.status(500).json({ erro: "Erro ao editar produto" });
    }
});

router.delete("/api/admin/produtos/:id", async (req, res) => {

    try {
        const { error } = await supabase
            .from("produtos")
            .delete()
            .eq("id", req.params.id);

        if (error) throw error;

        res.json({ ok: true });

    } catch (erro) {
        console.error("Erro ao apagar produto:", erro);
        res.status(500).json({ erro: "Erro ao apagar produto" });
    }
});

router.put("/api/admin/configuracoes", async (req, res) => {

    try {
        const entradas = Object.entries(req.body);

        for (const [chave, valor] of entradas) {
            const { error } = await supabase
                .from("configuracoes")
                .upsert({ chave, valor });

            if (error) throw error;
        }

        res.json({ ok: true });

    } catch (erro) {
        console.error("Erro ao salvar configurações:", erro);
        res.status(500).json({ erro: "Erro ao salvar configurações" });
    }
});

// Upload de foto — recebe o arquivo, sobe pro Supabase Storage,
// devolve a URL pública pra salvar no produto.
router.post("/api/admin/upload-imagem", upload.single("imagem"), async (req, res) => {

    try {
        if (!req.file) {
            return res.status(400).json({ erro: "Nenhuma imagem enviada" });
        }

        const nomeArquivo = `${Date.now()}-${req.file.originalname}`.replace(/\s+/g, "-");

        const { error: erroUpload } = await supabase.storage
            .from("produtos-fotos")
            .upload(nomeArquivo, req.file.buffer, {
                contentType: req.file.mimetype
            });

        if (erroUpload) throw erroUpload;

        const { data } = supabase.storage
            .from("produtos-fotos")
            .getPublicUrl(nomeArquivo);

        res.json({ url: data.publicUrl });

    } catch (erro) {
        console.error("Erro no upload da imagem:", erro);
        res.status(500).json({ erro: "Erro ao subir a imagem" });
    }
});

module.exports = router;