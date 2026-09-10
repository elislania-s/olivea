// ======================================
// DESTAQUES - TROCA DE IMAGENS
//
// - Clique nos pontinhos: troca a imagem (qualquer dispositivo)
// - Desktop: passar o mouse sobre a foto troca a imagem
//   (a caixa é dividida em "fatias" verticais, uma por imagem —
//   a posição do cursor decide qual imagem aparece)
// - Mobile: arrastar (swipe) na foto troca pra a próxima/anterior,
//   de forma quase instantânea (sem fade lento)
// - Em ambos os casos, a bolinha ativa acompanha a imagem atual
// ======================================

const productCards = document.querySelectorAll(".product-card");

productCards.forEach((card) => {

    const box = card.querySelector(".product-image-box");
    const image = card.querySelector(".product-image");
    const dots = Array.from(card.querySelectorAll(".dot"));
    const images = dots.map((dot) => dot.dataset.image);

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
            // Troca quase imediata, sem fade — usada no swipe do celular
            image.style.transition = "none";
            image.src = images[currentIndex];

            // força o navegador a "recalcular" antes de religar a transição
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


    // ---------- PONTINHOS (clique) ----------

    dots.forEach((dot, index) => {
        dot.addEventListener("click", () => setImage(index));
    });


    // ---------- DESKTOP: passar o mouse troca a imagem ----------

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


    // ---------- MOBILE: arrastar (swipe) troca a imagem ----------

    let touchStartX = 0;
    let touchDeltaX = 0;

    const SWIPE_THRESHOLD = 35; // px mínimos pra considerar um swipe

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
                // arrastou pra esquerda -> próxima imagem (com loop)
                const nextIndex = (currentIndex + 1) % images.length;
                setImage(nextIndex, { instant: true });
            } else {
                // arrastou pra direita -> imagem anterior (com loop)
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

const seeMoreLinks = document.querySelectorAll(".see-more");

seeMoreLinks.forEach((link) => {
    link.addEventListener("click", () => {
        link.classList.add("was-clicked");
    });
});