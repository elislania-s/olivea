document.addEventListener("DOMContentLoaded", function () {

    // ============================================
    // 0) VERIFICAÇÃO DE ARQUIVOS
    //    Se algum script não carregou, avisa no
    //    console em vez de travar tudo em silêncio.
    // ============================================

    if (typeof oliveaBuscarProduto !== "function") {
        console.error(
            "[Olivea] produtos-dados.js não foi carregado (ou está com " +
            "outro nome/caminho). Verifique se o arquivo " +
            "'produtos-dados.js' está na mesma pasta do produto.html e " +
            "se o <script> dele vem ANTES do produto.js."
        );
    }

    if (typeof oliveaAdicionarNaSacola !== "function") {
        console.error(
            "[Olivea] carrinho.js não foi carregado (ou está com outro " +
            "nome/caminho). Verifique se o arquivo 'carrinho.js' está " +
            "na mesma pasta do produto.html e se o <script> dele vem " +
            "ANTES do produto.js."
        );
    }


    // ============================================
    // 1) CARREGA O PRODUTO PELA URL (?id=)
    // ============================================

    let produto = null;

    try {
        const params = new URLSearchParams(window.location.search);
        const produtoId = params.get("id") || "1";
        produto = oliveaBuscarProduto(produtoId);

        document.title = "Olivea — " + produto.nome;

        document.getElementById("produtoCategoriaTopo").textContent =
            produto.categoria.toUpperCase();
        document.getElementById("produtoNome").textContent = produto.nome;
        document.getElementById("produtoDescricao").textContent = produto.descricao;
        document.getElementById("produtoPreco").textContent =
            "R$ " + produto.preco.toFixed(2).replace(".", ",");

    } catch (erro) {
        console.error("[Olivea] Erro ao carregar os dados do produto:", erro);
    }


    // ============================================
    // 2) GALERIA (imagem principal + bolinhas)
    // ============================================

    const imagemPrincipal = document.getElementById("produtoImagemPrincipal");
    const thumbsContainer = document.getElementById("produtoThumbs");

    try {
        if (produto && imagemPrincipal && thumbsContainer) {

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
                inputQtd.value = parseInt(inputQtd.value || "1", 10) + 1;
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

        if (btnAdicionar) {

            btnAdicionar.addEventListener("click", () => {

                if (!produto) {
                    alert("Não foi possível identificar este produto. Recarregue a página.");
                    return;
                }

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

            // Clique/toque na imagem abre o zoom em tela cheia
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

        } else {
            console.error(
                "[Olivea] Algum elemento da lupa/lightbox não foi encontrado " +
                "no HTML (produtoZoomBox, produtoLens, produtoLightbox, " +
                "produtoLightboxImg). Confira se o produto.html usado é a " +
                "versão mais recente."
            );
        }
    } catch (erro) {
        console.error("[Olivea] Erro na lupa/lightbox:", erro);
    }

});