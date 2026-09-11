// ======================================
// PRODUTOS - TROCA DE IMAGENS
// (mesma dinâmica da seção Destaques
// da página principal)
// ======================================

const productCards = document.querySelectorAll(".product-card");

productCards.forEach((card) => {

    const box = card.querySelector(".product-image-box");
    const image = card.querySelector(".product-image");
    const dots = Array.from(card.querySelectorAll(".dot"));
    const images = dots.map((dot) => dot.dataset.image);

    if (!box || !image || dots.length === 0) return;

    let currentIndex = 0;

    function setActiveDot(index) {
        dots.forEach((dot, i) => {
            dot.classList.toggle("active", i === index);
        });
    }

    function setImage(index, { instant = false } = {}) {

        if (index === currentIndex || index < 0 || index >= images.length) {
            return;
        }

        currentIndex = index;

        if (instant) {
            image.style.transition = "none";
            image.src = images[currentIndex];
            void image.offsetWidth;
            image.style.transition = "";
        } else {
            image.style.opacity = "0";

            setTimeout(() => {
                image.src = images[currentIndex];
                image.style.opacity = "1";
            }, 90);
        }

        setActiveDot(currentIndex);
    }

    dots.forEach((dot, index) => {
        dot.addEventListener("click", () => setImage(index));
    });

    // Desktop: passar o mouse troca a imagem
    box.addEventListener("mousemove", (event) => {

        const rect = box.getBoundingClientRect();
        const relativeX = event.clientX - rect.left;
        const sliceWidth = rect.width / images.length;

        let index = Math.floor(relativeX / sliceWidth);
        index = Math.max(0, Math.min(images.length - 1, index));

        setImage(index);

    });

    box.addEventListener("mouseleave", () => {
        setImage(0);
    });

    // Mobile: arrastar (swipe) troca a imagem
    let touchStartX = 0;
    let touchDeltaX = 0;

    const SWIPE_THRESHOLD = 35;

    box.addEventListener("touchstart", (event) => {
        touchStartX = event.touches[0].clientX;
        touchDeltaX = 0;
    }, { passive: true });

    box.addEventListener("touchmove", (event) => {
        touchDeltaX = event.touches[0].clientX - touchStartX;
    }, { passive: true });

    box.addEventListener("touchend", () => {

        if (Math.abs(touchDeltaX) > SWIPE_THRESHOLD) {

            if (touchDeltaX < 0) {
                const nextIndex = (currentIndex + 1) % images.length;
                setImage(nextIndex, { instant: true });
            } else {
                const prevIndex = (currentIndex - 1 + images.length) % images.length;
                setImage(prevIndex, { instant: true });
            }

        }

    });

});


// ======================================
// "VER MAIS" - sublinhado permanece
// depois de clicar
// ======================================

document.querySelectorAll(".see-more").forEach((link) => {
    link.addEventListener("click", () => {
        link.classList.add("was-clicked");
    });
});


// ======================================
// FILTRO - painel estilo "sanduíche"
// (desliza da lateral, com overlay)
// ======================================

const filtroBtn = document.getElementById("filtroBtn");
const filtroPanel = document.getElementById("filtroPanel");
const filtroOverlay = document.getElementById("filtroOverlay");
const filtroFechar = document.getElementById("filtroFechar");
const filtroAplicar = document.getElementById("filtroAplicar");
const filtroLimpar = document.getElementById("filtroLimpar");
const collectionGrid = document.getElementById("collectionGrid");

function abrirFiltro() {
    filtroPanel.classList.add("is-open");
    filtroOverlay.classList.add("is-open");
    filtroOverlay.hidden = false;

    filtroPanel.setAttribute("aria-hidden", "false");
    filtroBtn.setAttribute("aria-expanded", "true");
}

function fecharFiltro() {
    filtroPanel.classList.remove("is-open");
    filtroOverlay.classList.remove("is-open");

    filtroPanel.setAttribute("aria-hidden", "true");
    filtroBtn.setAttribute("aria-expanded", "false");

    // espera a transição de slide terminar antes de esconder o overlay
    setTimeout(() => {
        if (!filtroPanel.classList.contains("is-open")) {
            filtroOverlay.hidden = true;
        }
    }, 350);
}

if (filtroBtn) {
    filtroBtn.addEventListener("click", () => {
        const isOpen = filtroPanel.classList.contains("is-open");
        isOpen ? fecharFiltro() : abrirFiltro();
    });
}

if (filtroFechar) {
    filtroFechar.addEventListener("click", fecharFiltro);
}

if (filtroOverlay) {
    filtroOverlay.addEventListener("click", fecharFiltro);
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        fecharFiltro();
    }
});

// Aplica o filtro: mostra só os produtos das categorias marcadas.
// Se nenhuma categoria estiver marcada, mostra todos os produtos.
function aplicarFiltro() {

    const marcados = Array.from(
        document.querySelectorAll('#filtroPanel input[name="categoria"]:checked')
    ).map((input) => input.value);

    const cards = collectionGrid.querySelectorAll(".product-card");

    cards.forEach((card) => {

        const categoria = card.dataset.category;

        const deveMostrar = marcados.length === 0 || marcados.includes(categoria);

        card.classList.toggle("is-hidden", !deveMostrar);

    });
}

if (filtroAplicar) {
    filtroAplicar.addEventListener("click", () => {
        aplicarFiltro();
        fecharFiltro();
    });
}

if (filtroLimpar) {
    filtroLimpar.addEventListener("click", () => {

        document
            .querySelectorAll('#filtroPanel input[name="categoria"]')
            .forEach((input) => { input.checked = false; });

        aplicarFiltro();

    });
}


// ======================================
// CLASSIFICAR POR - dropdown pequeno
// ("telinha")
// ======================================

const classificarBtn = document.getElementById("classificarBtn");
const classificarPanel = document.getElementById("classificarPanel");

function abrirClassificar() {
    classificarPanel.hidden = false;
    classificarBtn.setAttribute("aria-expanded", "true");
}

function fecharClassificar() {
    classificarPanel.hidden = true;
    classificarBtn.setAttribute("aria-expanded", "false");
}

if (classificarBtn) {

    classificarBtn.addEventListener("click", (event) => {
        event.stopPropagation();

        const isOpen = !classificarPanel.hidden;
        isOpen ? fecharClassificar() : abrirClassificar();
    });

    // Fecha ao clicar fora do dropdown
    document.addEventListener("click", (event) => {
        if (
            !classificarPanel.hidden &&
            !classificarPanel.contains(event.target) &&
            event.target !== classificarBtn
        ) {
            fecharClassificar();
        }
    });
}

// Ordena os cards visíveis por preço (crescente ou decrescente)
document.querySelectorAll(".sort-option").forEach((option) => {

    option.addEventListener("click", () => {

        const ordem = option.dataset.sort; // "asc" ou "desc"

        const cards = Array.from(collectionGrid.querySelectorAll(".product-card"));

        cards.sort((a, b) => {
            const precoA = parseFloat(a.dataset.price);
            const precoB = parseFloat(b.dataset.price);

            return ordem === "asc" ? precoA - precoB : precoB - precoA;
        });

        cards.forEach((card) => collectionGrid.appendChild(card));

        document
            .querySelectorAll(".sort-option")
            .forEach((btn) => btn.classList.remove("active"));

        option.classList.add("active");

        fecharClassificar();

    });

});


/* ================================================
   VER MAIS — paginação do grid de produtos

   Mostra só as linhas "completas" do grid (múltiplo do
   número de colunas atual). O que sobraria como item
   solto na última linha fica escondido até o usuário
   clicar em "Ver mais" — aí tudo aparece normal, na
   posição lateral de cada item, sem centralização especial.

   Recalcula automaticamente ao redimensionar a tela,
   já que o número de colunas muda (3 no desktop, 2 no
   tablet/mobile). Depois que o usuário clica em "Ver mais",
   para de esconder itens de novo, mesmo se a tela for
   redimensionada.
================================================ */

(function () {
    const grid = document.getElementById('collectionGrid');
    const seeMoreBtn = document.querySelector('.collection-products .see-more');

    if (!grid || !seeMoreBtn) return;

    const cards = Array.from(grid.querySelectorAll('.product-card'));
    let expanded = false;

    function getColumns() {
        const width = window.innerWidth;
        if (width > 1100) return 3;
        return 2;
    }

    function applyPagination() {
        if (expanded) return;

        const columns = getColumns();
        const total = cards.length;

        // maior múltiplo de "columns" que cabe no total
        const visibleCount = total - (total % columns);

        cards.forEach(function (card, index) {
            if (index < visibleCount) {
                card.classList.remove('is-hidden');
            } else {
                card.classList.add('is-hidden');
            }
        });

        seeMoreBtn.style.display = visibleCount < total ? '' : 'none';
    }

    seeMoreBtn.addEventListener('click', function (event) {
        event.preventDefault();

        expanded = true;

        cards.forEach(function (card) {
            card.classList.remove('is-hidden');
        });

        seeMoreBtn.style.display = 'none';
    });

    applyPagination();

    let resizeTimer;

    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(applyPagination, 150);
    });
})();