/* ================================================
   LOJA-EXTRA.CSS

   Estilos novos usados por produto.html e
   sacola.html. Carregado JUNTO com o
   style2.css (que já traz o header, o menu,
   os benefícios e o footer prontos) — não
   duplica nada que já existe.
================================================ */

/* ================================
   MIOLO — VOLTAR / BREADCRUMB
================================ */

.produto-voltar {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    margin: 30px 0 0 60px;

    font-family: "Montserrat", sans-serif;
    font-size: 16px;
    font-weight: 500;

    color: rgba(63, 48, 38, 0.6);

    text-decoration: none;

    transition: color 0.3s ease;
}

.produto-voltar:hover {
    color: #3F3026;
}


/* ================================
   ESTRUTURA PRINCIPAL
================================ */

.produto-secao {
    width: 100%;

    display: flex;
    align-items: flex-start;
    gap: 60px;

    padding: 30px 60px 90px;

    background-color: #F6F0E5;
}


/* ================================
   GALERIA (IMAGEM + MINIATURAS)
================================ */

.produto-galeria {
    width: 50%;

    display: flex;
    flex-direction: column;
    align-items: center;

    position: sticky;
    top: 170px;
}

.produto-zoom-box {
    width: 100%;
    max-width: 560px;
    aspect-ratio: 1 / 1;

    position: relative;

    display: flex;
    align-items: center;
    justify-content: center;

    background-color: #E8DED0;
    overflow: hidden;

    cursor: zoom-in;
}

.produto-zoom-box img {
    width: 72%;
    height: 72%;

    object-fit: contain;

    display: block;

    pointer-events: none;
}

/* Ícone de lupa, canto inferior direito, só de indicação */
.produto-zoom-dica {
    position: absolute;
    right: 16px;
    bottom: 16px;

    width: 38px;
    height: 38px;

    border-radius: 50%;
    background-color: rgba(63, 48, 38, 0.85);

    display: flex;
    align-items: center;
    justify-content: center;

    pointer-events: none;
}

.produto-zoom-dica svg {
    width: 18px;
    height: 18px;
    stroke: #FCFAF6;
}

/* Lente de aumento (desktop, ao passar o mouse) */
.produto-lens {
    display: none;

    position: absolute;

    width: 160px;
    height: 160px;

    border: 2px solid #FCFAF6;
    border-radius: 50%;

    background-repeat: no-repeat;

    pointer-events: none;

    box-shadow: 0 4px 18px rgba(63, 48, 38, 0.35);
}

/* Miniaturas */
.produto-thumbs {
    width: 100%;
    max-width: 560px;

    display: flex;
    gap: 12px;

    margin-top: 16px;
}

.produto-thumb {
    width: 76px;
    height: 76px;

    padding: 0;
    border: 2px solid transparent;

    background-color: #E8DED0;
    cursor: pointer;

    overflow: hidden;

    transition: border-color 0.2s ease;
}

.produto-thumb.active {
    border-color: #3F3026;
}

.produto-thumb img {
    width: 100%;
    height: 100%;

    object-fit: contain;

    display: block;
}


/* ================================
   INFORMAÇÕES DO PRODUTO
================================ */

.produto-info {
    width: 50%;

    padding-top: 10px;
}

.produto-categoria {
    display: block;

    margin-bottom: 10px;

    font-family: "Montserrat", sans-serif;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;

    color: rgba(63, 48, 38, 0.6);
}

.produto-nome {
    margin: 0 0 14px;

    font-family: "Cormorant Garamond", serif;
    font-size: 48px;
    font-weight: 600;
    line-height: 1.05;

    color: #6B452C;
}

.produto-preco {
    margin: 0 0 26px;

    font-family: "Montserrat", sans-serif;
    font-size: 30px;
    font-weight: 600;

    color: #3F3026;
}

.produto-descricao {
    max-width: 480px;
    margin: 0 0 34px;

    font-family: "Montserrat", sans-serif;
    font-size: 17px;
    font-weight: 400;
    line-height: 1.6;

    color: #3F3026;
}

/* Seletor de quantidade + botão adicionar */
.produto-acoes {
    display: flex;
    align-items: center;
    gap: 18px;

    margin-bottom: 18px;
}

.produto-qtd {
    display: flex;
    align-items: center;

    border: 2px solid #3F3026;
}

.produto-qtd button {
    width: 42px;
    height: 48px;

    border: none;
    background: transparent;

    font-family: "Montserrat", sans-serif;
    font-size: 20px;
    font-weight: 600;
    color: #3F3026;

    cursor: pointer;
}

.produto-qtd input {
    width: 42px;
    height: 48px;

    border: none;
    border-left: 1px solid #3F3026;
    border-right: 1px solid #3F3026;

    text-align: center;

    font-family: "Montserrat", sans-serif;
    font-size: 16px;
    font-weight: 600;
    color: #3F3026;

    background: transparent;

    /* remove as setinhas do input number */
    -moz-appearance: textfield;
}

.produto-qtd input::-webkit-outer-spin-button,
.produto-qtd input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}

.btn-adicionar-sacola {
    flex: 1;

    height: 48px;

    border: 2px solid #3F3026;
    background-color: #3F3026;

    font-family: "Montserrat", sans-serif;
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.02em;

    color: #FCFAF6;

    cursor: pointer;

    transition:
        background-color 0.3s ease,
        color 0.3s ease;
}

.btn-adicionar-sacola:hover {
    background-color: transparent;
    color: #3F3026;
}

.produto-selo {
    display: flex;
    align-items: center;
    gap: 10px;

    margin-top: 22px;

    font-family: "Montserrat", sans-serif;
    font-size: 14px;
    color: rgba(63, 48, 38, 0.75);
}


/* ================================
   MINI SACOLA (TOAST DE CONFIRMAÇÃO)
================================ */

.mini-sacola {
    position: fixed;
    top: 24px;
    right: 24px;

    width: 320px;
    max-width: calc(100% - 40px);

    background-color: #FCFAF6;
    border: 1px solid rgba(63, 48, 38, 0.15);
    box-shadow: 0 12px 30px rgba(63, 48, 38, 0.18);

    padding: 20px;

    display: flex;
    flex-direction: column;
    gap: 10px;

    z-index: 3000;

    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);

    transition:
        opacity 0.3s ease,
        transform 0.3s ease,
        visibility 0.3s ease;
}

.mini-sacola.is-open {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
}

.mini-sacola-topo {
    display: flex;
    align-items: center;
    justify-content: space-between;

    font-family: "Montserrat", sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #3F3026;
}

.mini-sacola-fechar {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    color: #3F3026;
}

.mini-sacola-link {
    align-self: flex-start;

    font-family: "Montserrat", sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #3F3026;

    text-decoration: underline;
}


/* ================================
   LIGHTBOX (ZOOM EM TELA CHEIA)
================================ */

.produto-lightbox {
    position: fixed;
    inset: 0;

    background-color: rgba(63, 48, 38, 0.92);

    z-index: 4000;

    display: flex;
    align-items: center;
    justify-content: center;

    opacity: 0;
    visibility: hidden;

    transition:
        opacity 0.3s ease,
        visibility 0.3s ease;
}

.produto-lightbox.is-open {
    opacity: 1;
    visibility: visible;
}

.produto-lightbox-fechar {
    position: absolute;
    top: 24px;
    right: 30px;

    background: none;
    border: none;

    font-size: 30px;
    line-height: 1;
    color: #FCFAF6;

    cursor: pointer;
}

.produto-lightbox-dica {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);

    font-family: "Montserrat", sans-serif;
    font-size: 14px;
    color: rgba(252, 250, 246, 0.75);
}

.produto-lightbox img {
    max-width: 88%;
    max-height: 82%;

    object-fit: contain;

    cursor: zoom-in;

    transition: transform 0.35s ease;
}

.produto-lightbox img.is-zoomed {
    cursor: zoom-out;
    transform: scale(2.2);
}


/* ================================================
   SACOLA (CARRINHO) — sacola.html
================================================ */

.sacola-secao {
    width: 100%;
    max-width: 1100px;

    margin: 0 auto;

    padding: 55px 30px 100px;

    background-color: #F6F0E5;
}

.sacola-titulo {
    margin: 0 0 34px;

    font-family: "Cormorant Garamond", serif;
    font-size: 46px;
    font-weight: 600;

    color: #6B452C;
}

.sacola-conteudo {
    display: flex;
    align-items: flex-start;
    gap: 50px;
}

.sacola-lista {
    flex: 1;

    display: flex;
    flex-direction: column;
}

.sacola-item {
    display: flex;
    align-items: center;
    gap: 20px;

    padding: 22px 0;

    border-bottom: 1px solid rgba(63, 48, 38, 0.15);
}

.sacola-item-imagem {
    width: 90px;
    height: 90px;
    flex-shrink: 0;

    background-color: #E8DED0;

    display: flex;
    align-items: center;
    justify-content: center;

    overflow: hidden;
}

.sacola-item-imagem img {
    width: 75%;
    height: 75%;
    object-fit: contain;
}

.sacola-item-info {
    flex: 1;
}

.sacola-item-nome {
    margin: 0 0 6px;

    font-family: "Cormorant Garamond", serif;
    font-size: 22px;
    font-weight: 500;
    color: #6B452C;
}

.sacola-item-preco {
    font-family: "Montserrat", sans-serif;
    font-size: 16px;
    font-weight: 600;
    color: #3F3026;
}

.sacola-item-qtd {
    display: flex;
    align-items: center;

    border: 1px solid #3F3026;
}

.sacola-item-qtd button {
    width: 32px;
    height: 34px;

    border: none;
    background: transparent;

    font-size: 16px;
    color: #3F3026;

    cursor: pointer;
}

.sacola-item-qtd span {
    width: 30px;
    text-align: center;

    font-family: "Montserrat", sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #3F3026;
}

.sacola-item-remover {
    background: none;
    border: none;

    font-family: "Montserrat", sans-serif;
    font-size: 13px;

    color: rgba(63, 48, 38, 0.6);

    text-decoration: underline;
    cursor: pointer;
}

.sacola-resumo {
    width: 340px;
    flex-shrink: 0;

    background-color: #FCFAF6;
    border: 1px solid rgba(63, 48, 38, 0.15);

    padding: 28px;
}

.sacola-resumo h2 {
    margin: 0 0 20px;

    font-family: "Cormorant Garamond", serif;
    font-size: 26px;
    font-weight: 600;
    color: #6B452C;
}

.sacola-resumo-linha {
    display: flex;
    justify-content: space-between;

    margin-bottom: 12px;

    font-family: "Montserrat", sans-serif;
    font-size: 15px;
    color: #3F3026;
}

.sacola-resumo-total {
    display: flex;
    justify-content: space-between;

    margin: 18px 0 24px;
    padding-top: 18px;

    border-top: 1px solid rgba(63, 48, 38, 0.15);

    font-family: "Montserrat", sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: #3F3026;
}

.btn-finalizar-compra {
    width: 100%;
    height: 50px;

    border: none;
    background-color: #3F3026;

    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;

    font-family: "Montserrat", sans-serif;
    font-size: 16px;
    font-weight: 600;

    color: #FCFAF6;

    cursor: pointer;

    transition: opacity 0.3s ease;
}

.btn-finalizar-compra:hover {
    opacity: 0.9;
}

.btn-finalizar-compra:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.sacola-seguranca {
    display: flex;
    align-items: center;
    gap: 8px;

    margin-top: 14px;

    font-family: "Montserrat", sans-serif;
    font-size: 13px;
    color: rgba(63, 48, 38, 0.7);
}

.sacola-vazia {
    text-align: center;

    padding: 60px 20px;

    font-family: "Montserrat", sans-serif;
    font-size: 18px;
    color: #3F3026;
}

.sacola-vazia a {
    color: #6B452C;
    text-decoration: underline;
}


/* ================================================
   RESPONSIVIDADE
================================================ */

@media (max-width: 900px) {

    .produto-voltar {
        margin-left: 25px;
    }

    .produto-secao {
        flex-direction: column;
        gap: 30px;

        padding: 25px 25px 70px;
    }

    .produto-galeria,
    .produto-info {
        width: 100%;
    }

    .produto-galeria {
        position: static;
    }

    .produto-nome {
        font-size: 36px;
    }

    .produto-preco {
        font-size: 24px;
    }

    .produto-lens {
        display: none !important;
    }

    .sacola-conteudo {
        flex-direction: column;
    }

    .sacola-resumo {
        width: 100%;
    }
}

@media (max-width: 480px) {

    .produto-nome {
        font-size: 30px;
    }

    .produto-acoes {
        flex-direction: column;
        align-items: stretch;
    }

    .produto-qtd {
        justify-content: center;
    }

    .sacola-item {
        flex-wrap: wrap;
    }
}