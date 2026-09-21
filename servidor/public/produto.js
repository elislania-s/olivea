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
            document.body.classList.add("produto-pronto");
            console.error("[Olivea] Nenhum ?id= foi passado na URL.");
            return;
        }

        const resposta = await fetch("/api/produtos/" + produtoId);

        if (!resposta.ok) {
            document.getElementById("produtoNome").textContent =
                "Produto não encontrado";
            document.body.classList.add("produto-pronto");
            console.error("[Olivea] Produto não encontrado:", produtoId);
            return;
        }

        produto = await resposta.json();

        document.title = "Olivea — " + produto.nome;
        document.body.classList.add("produto-pronto");

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
        document.body.classList.add("produto-pronto");
        return;
    }

    if (!produto) return;


    // ============================================
    // 2) GALERIA (imagem principal + bolinhas)
    // ============================================

    const imagemPrincipal = document.getElementById("produtoImagemPrincipal");
    let indiceImagemAtual = 0;
    let houveSwipeRecente = false;

    try {
        if (imagemPrincipal && produto.imagens && produto.imagens.length) {

            imagemPrincipal.src = produto.imagens[0];
            imagemPrincipal.alt = produto.nome;

            function irParaImagem(index) {
                const total = produto.imagens.length;
                index = ((index % total) + total) % total; // sempre dentro do intervalo

                indiceImagemAtual = index;
                imagemPrincipal.src = produto.imagens[index];
            }

            // Setas laterais (aparecem só se tiver mais de 1 foto)
            const setaEsquerda = document.getElementById("produtoSetaEsquerda");
            const setaDireita = document.getElementById("produtoSetaDireita");

            if (produto.imagens.length > 1) {

                if (setaEsquerda) {
                    setaEsquerda.hidden = false;
                    setaEsquerda.addEventListener("click", () => irParaImagem(indiceImagemAtual - 1));
                }

                if (setaDireita) {
                    setaDireita.hidden = false;
                    setaDireita.addEventListener("click", () => irParaImagem(indiceImagemAtual + 1));
                }
            }

            // Deslizar (swipe) no celular também troca a imagem
            const zoomBoxSwipe = document.getElementById("produtoZoomBox");

            if (zoomBoxSwipe && produto.imagens.length > 1) {

                let toqueInicioX = 0;
                let toqueDeltaX = 0;
                const LIMITE_SWIPE = 35;

                zoomBoxSwipe.addEventListener("touchstart", (evento) => {
                    toqueInicioX = evento.touches[0].clientX;
                    toqueDeltaX = 0;
                }, { passive: true });

                zoomBoxSwipe.addEventListener("touchmove", (evento) => {
                    toqueDeltaX = evento.touches[0].clientX - toqueInicioX;
                }, { passive: true });

                zoomBoxSwipe.addEventListener("touchend", () => {
                    if (Math.abs(toqueDeltaX) > LIMITE_SWIPE) {
                        irParaImagem(indiceImagemAtual + (toqueDeltaX < 0 ? 1 : -1));
                        houveSwipeRecente = true;
                    }
                });
            }
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
                if (houveSwipeRecente) {
                    houveSwipeRecente = false;
                    return;
                }

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


    // ============================================
    // 6) CALCULAR FRETE (SuperFrete)
    // ============================================

    try {
        const inputCep = document.getElementById("freteCep");
        const btnCalcular = document.getElementById("btnCalcularFrete");
        const resultado = document.getElementById("freteResultado");

        inputCep.addEventListener("input", () => {
            let valor = inputCep.value.replace(/\D/g, "").slice(0, 8);
            if (valor.length > 5) valor = valor.slice(0, 5) + "-" + valor.slice(5);
            inputCep.value = valor;
        });

        btnCalcular.addEventListener("click", async () => {

            const cepLimpo = inputCep.value.replace(/\D/g, "");

            if (cepLimpo.length !== 8) {
                resultado.innerHTML = '<p class="frete-mensagem">Digite um CEP válido (8 números).</p>';
                return;
            }

            resultado.innerHTML = '<p class="frete-mensagem">Calculando...</p>';
            btnCalcular.disabled = true;

            try {
                const resposta = await fetch("/api/calcular-frete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ produtoId: produto.id, cepDestino: cepLimpo })
                });

                const dados = await resposta.json();

                if (!resposta.ok || !dados.opcoes || dados.opcoes.length === 0) {
                    resultado.innerHTML = '<p class="frete-mensagem">Não encontramos opções de frete para esse CEP.</p>';
                    return;
                }

                resultado.innerHTML = dados.opcoes.map((opcao) => `
                    <div class="frete-opcao frete-opcao-preview">
                        <span class="nome-servico">${opcao.servico}${opcao.nome ? " - " + opcao.nome : ""}
                            ${opcao.prazoDias ? ` (até ${opcao.prazoDias} dias úteis)` : ""}
                        </span>
                        <span class="preco-servico">R$ ${opcao.preco.toFixed(2).replace(".", ",")}</span>
                    </div>
                `).join("") + '<p class="frete-mensagem" style="margin-top:8px;">Você escolhe a opção de envio na hora de fechar o pedido, no checkout.</p>';

            } catch (erro) {
                console.error("[Olivea] Erro ao calcular frete:", erro);
                resultado.innerHTML = '<p class="frete-mensagem">Erro ao calcular o frete. Tente novamente.</p>';
            } finally {
                btnCalcular.disabled = false;
            }
        });

    } catch (erro) {
        console.error("[Olivea] Erro no bloco de frete:", erro);
    }

});