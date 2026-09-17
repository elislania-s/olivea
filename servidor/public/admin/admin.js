/* ======================================
   PAINEL ADMIN — OLIVEA
====================================== */

const ehPaginaDeLogin = document.body.classList.contains("admin-login-body");

// Em qualquer página do admin (menos o login), confirma que
// está logado antes de mostrar qualquer coisa.
if (!ehPaginaDeLogin) {
    verificarLogin();
}

async function verificarLogin() {
    try {
        const resposta = await fetch("/api/admin/verificar");
        const dados = await resposta.json();

        if (!dados.logado) {
            window.location.href = "login.html";
        } else {
            iniciarPainel();
        }
    } catch (erro) {
        window.location.href = "login.html";
    }
}

function iniciarPainel() {

    document.getElementById("btnSair").addEventListener("click", async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        window.location.href = "login.html";
    });


    // ============================================
    // ABAS
    // ============================================

    const abas = document.querySelectorAll(".admin-tab");
    abas.forEach((aba) => {
        aba.addEventListener("click", () => {
            abas.forEach((a) => a.classList.remove("active"));
            aba.classList.add("active");

            document.getElementById("abaProdutos").hidden = aba.dataset.tab !== "produtos";
            document.getElementById("abaConfiguracoes").hidden = aba.dataset.tab !== "configuracoes";
        });
    });


    // ============================================
    // ESTADO
    // ============================================

    let todosOsProdutos = [];
    let categoriaAtual = "todas";
    let fotosDoFormulario = []; // URLs já enviadas pro produto em edição/criação


    // ============================================
    // CARREGAR E LISTAR PRODUTOS
    // ============================================

    async function carregarProdutos() {

        const lista = document.getElementById("listaProdutos");
        lista.innerHTML = '<p class="admin-carregando">Carregando produtos...</p>';

        try {
            const resposta = await fetch("/api/admin/produtos");
            todosOsProdutos = await resposta.json();
            renderizarLista();
        } catch (erro) {
            lista.innerHTML = '<p class="admin-carregando">Erro ao carregar produtos.</p>';
        }
    }

    function renderizarLista() {

        const lista = document.getElementById("listaProdutos");

        const produtosFiltrados = categoriaAtual === "todas"
            ? todosOsProdutos
            : todosOsProdutos.filter((p) => p.categoria === categoriaAtual);

        if (produtosFiltrados.length === 0) {
            lista.innerHTML = '<p class="admin-carregando">Nenhum produto nessa categoria ainda.</p>';
            return;
        }

        lista.innerHTML = produtosFiltrados.map((produto) => `
            <div class="admin-produto-linha" data-id="${produto.id}">

                <img src="${(produto.imagens && produto.imagens[0]) || ''}" alt="${produto.nome}">

                <div class="admin-produto-linha-info">
                    <div class="admin-produto-linha-nome">${produto.nome}</div>
                    <div class="admin-produto-linha-detalhe">
                        ${produto.categoria} · R$ ${Number(produto.preco).toFixed(2).replace(".", ",")}
                        · estoque: ${produto.estoque}
                        ${produto.destaque ? " · destaque" : ""}
                    </div>
                </div>

                <span class="admin-produto-badge ${produto.ativo ? "" : "inativo"}">
                    ${produto.ativo ? "Visível" : "Oculto"}
                </span>

                <div class="admin-produto-acoes">
                    <button type="button" class="editar">Editar</button>
                    <button type="button" class="apagar">Apagar</button>
                </div>

            </div>
        `).join("");

        lista.querySelectorAll(".editar").forEach((botao) => {
            botao.addEventListener("click", (evento) => {
                const id = evento.target.closest(".admin-produto-linha").dataset.id;
                abrirModalEdicao(id);
            });
        });

        lista.querySelectorAll(".apagar").forEach((botao) => {
            botao.addEventListener("click", (evento) => {
                const id = evento.target.closest(".admin-produto-linha").dataset.id;
                apagarProduto(id);
            });
        });
    }

    document.querySelectorAll(".admin-filtro").forEach((botao) => {
        botao.addEventListener("click", () => {
            document.querySelectorAll(".admin-filtro").forEach((b) => b.classList.remove("active"));
            botao.classList.add("active");
            categoriaAtual = botao.dataset.categoria;
            renderizarLista();
        });
    });

    async function apagarProduto(id) {

        if (!confirm("Tem certeza que quer apagar este produto? Essa ação não pode ser desfeita.")) {
            return;
        }

        try {
            await fetch("/api/admin/produtos/" + id, { method: "DELETE" });
            carregarProdutos();
        } catch (erro) {
            alert("Erro ao apagar o produto.");
        }
    }


    // ============================================
    // MODAL DE CRIAR/EDITAR PRODUTO
    // ============================================

    const modalOverlay = document.getElementById("modalOverlay");
    const formProduto = document.getElementById("formProduto");

    function abrirModalNovo() {
        formProduto.reset();
        document.getElementById("produtoId").value = "";
        document.getElementById("modalTitulo").textContent = "Novo produto";
        document.getElementById("mensagemProduto").textContent = "";
        fotosDoFormulario = [];
        renderizarFotosPreview();
        modalOverlay.hidden = false;
    }

    function abrirModalEdicao(id) {

        const produto = todosOsProdutos.find((p) => p.id === id);
        if (!produto) return;

        formProduto.reset();
        document.getElementById("modalTitulo").textContent = "Editar produto";
        document.getElementById("mensagemProduto").textContent = "";

        document.getElementById("produtoId").value = produto.id;
        document.getElementById("produtoNome").value = produto.nome;
        document.getElementById("produtoCategoria").value = produto.categoria;
        document.getElementById("produtoPreco").value = produto.preco;
        document.getElementById("produtoEstoque").value = produto.estoque;
        document.getElementById("produtoDescricao").value = produto.descricao || "";
        document.getElementById("produtoDestaque").checked = !!produto.destaque;
        document.getElementById("produtoAtivo").checked = !!produto.ativo;
        document.getElementById("produtoOrdem").value = produto.ordem || 0;
        document.getElementById("produtoPeso").value = produto.peso_kg || 0.2;
        document.getElementById("produtoAltura").value = produto.altura_cm || 4;
        document.getElementById("produtoLargura").value = produto.largura_cm || 12;
        document.getElementById("produtoComprimento").value = produto.comprimento_cm || 17;

        fotosDoFormulario = Array.isArray(produto.imagens) ? [...produto.imagens] : [];
        renderizarFotosPreview();

        modalOverlay.hidden = false;
    }

    function fecharModal() {
        modalOverlay.hidden = true;
    }

    document.getElementById("btnNovoProduto").addEventListener("click", abrirModalNovo);
    document.getElementById("btnFecharModal").addEventListener("click", fecharModal);
    document.getElementById("btnCancelarModal").addEventListener("click", fecharModal);
    modalOverlay.addEventListener("click", (evento) => {
        if (evento.target === modalOverlay) fecharModal();
    });


    // ---- Upload de fotos ----

    function renderizarFotosPreview() {

        const preview = document.getElementById("produtoFotosPreview");

        preview.innerHTML = fotosDoFormulario.map((url, index) => `
            <div class="foto-item">
                <img src="${url}" alt="Foto ${index + 1}">
                <button type="button" class="remover-foto" data-index="${index}">✕</button>
            </div>
        `).join("");

        preview.querySelectorAll(".remover-foto").forEach((botao) => {
            botao.addEventListener("click", () => {
                fotosDoFormulario.splice(Number(botao.dataset.index), 1);
                renderizarFotosPreview();
            });
        });
    }

    document.getElementById("produtoFotosArquivo").addEventListener("change", async (evento) => {

        const arquivos = Array.from(evento.target.files);
        const mensagem = document.getElementById("mensagemProduto");

        mensagem.textContent = "Enviando fotos...";
        mensagem.className = "admin-mensagem";

        for (const arquivo of arquivos) {
            try {
                const formData = new FormData();
                formData.append("imagem", arquivo);

                const resposta = await fetch("/api/admin/upload-imagem", {
                    method: "POST",
                    body: formData
                });

                if (!resposta.ok) throw new Error("Falha no upload");

                const dados = await resposta.json();
                fotosDoFormulario.push(dados.url);
                renderizarFotosPreview();

            } catch (erro) {
                mensagem.textContent = "Erro ao enviar uma das fotos.";
                mensagem.className = "admin-mensagem erro";
            }
        }

        if (mensagem.textContent === "Enviando fotos...") {
            mensagem.textContent = "";
        }

        evento.target.value = "";
    });


    // ---- Salvar produto (criar ou editar) ----

    formProduto.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const mensagem = document.getElementById("mensagemProduto");
        const id = document.getElementById("produtoId").value;
        const botaoSalvar = formProduto.querySelector('button[type="submit"]');

        // Trava o botão pra não deixar clicar de novo (e duplicar
        // o produto) enquanto o pedido ainda está em andamento.
        if (botaoSalvar.disabled) return;
        botaoSalvar.disabled = true;

        if (fotosDoFormulario.length === 0) {
            mensagem.textContent = "Adicione pelo menos uma foto.";
            mensagem.className = "admin-mensagem erro";
            botaoSalvar.disabled = false;
            return;
        }

        const corpo = {
            nome: document.getElementById("produtoNome").value.trim(),
            categoria: document.getElementById("produtoCategoria").value,
            preco: parseFloat(document.getElementById("produtoPreco").value),
            estoque: parseInt(document.getElementById("produtoEstoque").value, 10),
            descricao: document.getElementById("produtoDescricao").value.trim(),
            imagens: fotosDoFormulario,
            destaque: document.getElementById("produtoDestaque").checked,
            ativo: document.getElementById("produtoAtivo").checked,
            ordem: parseInt(document.getElementById("produtoOrdem").value, 10) || 0,
            peso_kg: parseFloat(document.getElementById("produtoPeso").value) || 0.1,
            altura_cm: parseFloat(document.getElementById("produtoAltura").value) || 3,
            largura_cm: parseFloat(document.getElementById("produtoLargura").value) || 10,
            comprimento_cm: parseFloat(document.getElementById("produtoComprimento").value) || 15
        };

        mensagem.textContent = "Salvando... (pode levar até 1 minuto na primeira vez, enquanto o servidor gratuito 'acorda')";
        mensagem.className = "admin-mensagem";

        // Corta a espera em 40s pra nunca ficar travado pra sempre —
        // se passar disso, mostra erro e libera o botão de novo.
        const controlador = new AbortController();
        const tempoLimite = setTimeout(() => controlador.abort(), 40000);

        try {
            const resposta = await fetch(
                id ? "/api/admin/produtos/" + id : "/api/admin/produtos",
                {
                    method: id ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(corpo),
                    signal: controlador.signal
                }
            );

            clearTimeout(tempoLimite);

            if (!resposta.ok) throw new Error("Falha ao salvar");

            fecharModal();
            carregarProdutos();

        } catch (erro) {
            clearTimeout(tempoLimite);

            if (erro.name === "AbortError") {
                mensagem.textContent = "Demorou demais pra responder. Confira sua internet e tente de novo.";
            } else {
                mensagem.textContent = "Erro ao salvar o produto. Tente novamente.";
            }
            mensagem.className = "admin-mensagem erro";

        } finally {
            botaoSalvar.disabled = false;
        }
    });


    // ============================================
    // CONFIGURAÇÕES GERAIS
    // ============================================

    let bannerUrlAtual = "";

    async function carregarConfiguracoes() {
        try {
            const resposta = await fetch("/api/configuracoes");
            const config = await resposta.json();

            document.getElementById("configItensPorPagina").value = config.itens_por_pagina || 9;

            bannerUrlAtual = config.banner_colecao || "";
            if (bannerUrlAtual) {
                const preview = document.getElementById("configBannerPreview");
                preview.src = bannerUrlAtual;
                preview.hidden = false;
            }
        } catch (erro) {
            console.error("Erro ao carregar configurações:", erro);
        }
    }

    document.getElementById("configBannerArquivo").addEventListener("change", async (evento) => {

        const arquivo = evento.target.files[0];
        if (!arquivo) return;

        const mensagem = document.getElementById("mensagemConfig");
        mensagem.textContent = "Enviando banner...";
        mensagem.className = "admin-mensagem";

        try {
            const formData = new FormData();
            formData.append("imagem", arquivo);

            const resposta = await fetch("/api/admin/upload-imagem", {
                method: "POST",
                body: formData
            });

            if (!resposta.ok) throw new Error("Falha no upload");

            const dados = await resposta.json();
            bannerUrlAtual = dados.url;

            const preview = document.getElementById("configBannerPreview");
            preview.src = bannerUrlAtual;
            preview.hidden = false;

            mensagem.textContent = "Banner enviado — clique em Salvar para confirmar.";

        } catch (erro) {
            mensagem.textContent = "Erro ao enviar o banner.";
            mensagem.className = "admin-mensagem erro";
        }
    });

    document.getElementById("btnSalvarConfig").addEventListener("click", async () => {

        const mensagem = document.getElementById("mensagemConfig");
        mensagem.textContent = "Salvando...";
        mensagem.className = "admin-mensagem";

        try {
            const resposta = await fetch("/api/admin/configuracoes", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    itens_por_pagina: parseInt(document.getElementById("configItensPorPagina").value, 10) || 9,
                    banner_colecao: bannerUrlAtual
                })
            });

            if (!resposta.ok) throw new Error("Falha ao salvar");

            mensagem.textContent = "Configurações salvas!";

        } catch (erro) {
            mensagem.textContent = "Erro ao salvar configurações.";
            mensagem.className = "admin-mensagem erro";
        }
    });


    // ============================================
    // INÍCIO
    // ============================================

    carregarProdutos();
    carregarConfiguracoes();
}