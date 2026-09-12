document.addEventListener("DOMContentLoaded", async function () {

    // ============================================
    // 1) CARREGA O PRODUTO PELA URL (?id=)
    //    Agora vem do banco de dados (Supabase),
    //    através da nossa própria API.
    // ============================================

    let produto = null;

    try {
        const params = new URLSearchParams(window.location.search);
        const produtoId = params.get("id");

        if (!produtoId) {
            document.getElementById("produtoNome").textContent =
                "Produto não especificado";
            console.error("[Olivea] Nenhum ?id= foi passado na URL.");
            return;
        }

        const resposta = await fetch("/api/produtos/" + produtoId);

        if (!resposta.ok) {
            document.getElementById("produtoNome").textContent =
                "Produto não encontrado";
            console.error("[Olivea] Produto não encontrado:", produtoId);
            return;
        }

        produto = await resposta.json();

        document.title = "Olivea — " + produto.nome;

        document.getElementById("produtoCategoriaTopo").textContent =
            produto.categoria.toUpperCase();
        document.getElementById("produtoNome").textContent = produto.nome;
        document.getElementById("produtoDescricao").textContent = produto.descricao;
        document.getElementById("produtoPreco").textContent =
            "R$ " + Number(produto.preco).toFixed(2).replace(".", ",");

    } catch (erro) {
        console.error("[Olivea] Erro ao carregar os dados do produto:", erro);
        document.getElementById("produtoNome").textContent =
            "Erro ao carregar o produto";
        return;
    }

    if (!produto) return;


    // ============================================
    // 2) GALERIA (imagem principal + bolinhas)
    // ============================================

    const imagemPrincipal = document.getElementById("produtoImagemPrincipal");
    const thumbsContainer = document.getElementById("produtoThumbs");

    try {
        if (imagemPrincipal && thumbsContainer && produto.imagens && produto.imagens.length) {

            imagemPrincipal.src = produto.imagens[0];
            imagemPrincipal.alt = produto.nome;

            produto.imagens.forEach((imagem, index) => {
                const dot = document.createElement("button");
                dot.type = "button";
                dot.className = "dot" + (index === 0 ? " active" : "");
                dot.setAttribute("aria-label", "Imagem " + (index + 1));

                dot.addEventListener("click", () => {
                    imagemPrincipal.src = imagem;

                    thumbsContainer.querySelectorAll(".dot").forEach((d) => {
                        d.classList.remove("active");
                    });
                    dot.classList.add("active");
                });

                thumbsContainer.appendChild(dot);
            });
        }
    } catch (erro) {
        console.error("[Olivea] Erro ao montar a galeria:", erro);
    }


    // ============================================
    // 3) QUANTIDADE
    // ============================================

    try {
        const inputQtd = document.getElementById("produtoQtd");
        const btnMenos = document.getElementById("qtdMenos");
        const btnMais = document.getElementById("qtdMais");

        if (inputQtd && btnMenos && btnMais) {

            btnMenos.addEventListener("click", () => {
                inputQtd.value = Math.max(1, parseInt(inputQtd.value || "1", 10) - 1);
            });

            btnMais.addEventListener("click", () => {
                const max = produto.estoque || 99;
                inputQtd.value = Math.min(max, parseInt(inputQtd.value || "1", 10) + 1);
            });
        }
    } catch (erro) {
        console.error("[Olivea] Erro no seletor de quantidade:", erro);
    }


    // ============================================
    // 4) ADICIONAR À SACOLA
    // ============================================

    try {
        const btnAdicionar = document.getElementById("btnAdicionarSacola");
        const inputQtd = document.getElementById("produtoQtd");
        const miniSacola = document.getElementById("miniSacola");
        const btnFecharMini = document.querySelector(".mini-sacola-fechar");
        let miniSacolaTimer = null;

        if (produto.estoque <= 0 && btnAdicionar) {
            btnAdicionar.textContent = "PRODUTO ESGOTADO";
            btnAdicionar.disabled = true;
        }

        if (btnAdicionar) {

            btnAdicionar.addEventListener("click", () => {

                if (typeof oliveaAdicionarNaSacola !== "function") {
                    alert(
                        "A sacola não está disponível agora (carrinho.js não " +
                        "carregou). Veja o console (F12) para detalhes."
                    );
                    return;
                }

                const quantidade = Math.max(
                    1,
                    parseInt((inputQtd && inputQtd.value) || "1", 10)
                );

                oliveaAdicionarNaSacola(produto, quantidade);

                if (miniSacola) {
                    miniSacola.classList.add("is-open");
                    clearTimeout(miniSacolaTimer);
                    miniSacolaTimer = setTimeout(
                        () => miniSacola.classList.remove("is-open"),
                        3000
                    );
                }
            });
        }

        if (btnFecharMini && miniSacola) {
            btnFecharMini.addEventListener("click", () => {
                miniSacola.classList.remove("is-open");
            });
        }

    } catch (erro) {
        console.error("[Olivea] Erro ao adicionar à sacola:", erro);
    }


    // ============================================
    // 5) LUPA (hover, desktop) + LIGHTBOX (clique)
    // ============================================

    try {
        const zoomBox = document.getElementById("produtoZoomBox");
        const lens = document.getElementById("produtoLens");
        const lightbox = document.getElementById("produtoLightbox");
        const lightboxImg = document.getElementById("produtoLightboxImg");
        const btnFecharLightbox = document.getElementById("produtoLightboxFechar");

        if (zoomBox && lens && lightbox && lightboxImg && imagemPrincipal) {

            const temHover = window.matchMedia("(hover: hover)").matches;
            const ZOOM_FATOR = 2.4;

            if (temHover) {

                zoomBox.addEventListener("mouseenter", () => {
                    lens.style.display = "block";
                });

                zoomBox.addEventListener("mousemove", (evento) => {

                    const rect = zoomBox.getBoundingClientRect();
                    const x = evento.clientX - rect.left;
                    const y = evento.clientY - rect.top;

                    const lensSize = lens.offsetWidth;

                    let lensX = x - lensSize / 2;
                    let lensY = y - lensSize / 2;

                    lensX = Math.max(0, Math.min(rect.width - lensSize, lensX));
                    lensY = Math.max(0, Math.min(rect.height - lensSize, lensY));

                    lens.style.left = lensX + "px";
                    lens.style.top = lensY + "px";

                    lens.style.backgroundImage = `url("${imagemPrincipal.src}")`;
                    lens.style.backgroundSize =
                        (rect.width * ZOOM_FATOR) + "px " + (rect.height * ZOOM_FATOR) + "px";
                    lens.style.backgroundPosition =
                        `-${lensX * ZOOM_FATOR}px -${lensY * ZOOM_FATOR}px`;
                });

                zoomBox.addEventListener("mouseleave", () => {
                    lens.style.display = "none";
                });
            }

            zoomBox.addEventListener("click", () => {
                lightboxImg.src = imagemPrincipal.src;
                lightboxImg.alt = imagemPrincipal.alt;
                lightboxImg.classList.remove("is-zoomed");
                lightbox.classList.add("is-open");
            });

            if (btnFecharLightbox) {
                btnFecharLightbox.addEventListener("click", () => {
                    lightbox.classList.remove("is-open");
                });
            }

            lightbox.addEventListener("click", (evento) => {
                if (evento.target === lightbox) {
                    lightbox.classList.remove("is-open");
                }
            });

            lightboxImg.addEventListener("click", (evento) => {
                evento.stopPropagation();

                if (lightboxImg.classList.contains("is-zoomed")) {
                    lightboxImg.classList.remove("is-zoomed");
                    lightboxImg.style.transformOrigin = "center center";
                    return;
                }

                const rect = lightboxImg.getBoundingClientRect();
                const origemX = ((evento.clientX - rect.left) / rect.width) * 100;
                const origemY = ((evento.clientY - rect.top) / rect.height) * 100;

                lightboxImg.style.transformOrigin = origemX + "% " + origemY + "%";
                lightboxImg.classList.add("is-zoomed");
            });

            document.addEventListener("keydown", (evento) => {
                if (evento.key === "Escape") {
                    lightbox.classList.remove("is-open");
                }
            });
        }
    } catch (erro) {
        console.error("[Olivea] Erro na lupa/lightbox:", erro);
    }

});