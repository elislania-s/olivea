/* ======================================
   BASE DE PRODUTOS

   Edite/adicione produtos aqui. Cada um
   precisa de um "id" único — é esse id
   que vai na URL da página de produto:

   produto.html?id=2

   Assim que você adicionar o "?id=X" no
   link de cada card do site (nos
   arquivos brincos.html, colares.html,
   pulseira.html, colecao.html e no
   index.html), a página de produto vai
   mostrar o item certo automaticamente.

   Sem nenhum "id" na URL, a página
   mostra o produto de id "1" (o primeiro
   da lista).
====================================== */

const OLIVEA_PRODUTOS = [
    {
        id: "1",
        nome: "Brinco Ponto de Luz",
        categoria: "brincos",
        preco: 69.90,
        descricao:
            "Brinco em aço inoxidável dourado, com ponto de luz cravejado " +
            "em zircônia. Antialérgico, não escurece e não perde a cor com " +
            "o tempo. Perfeito para o dia a dia ou para compor um look " +
            "mais sofisticado.",
        imagens: ["brinco.png", "brinco2.jpg", "brinco.png"]
    },
    {
        id: "2",
        nome: "Colar Mar",
        categoria: "colares",
        preco: 69.90,
        descricao:
            "Colar delicado inspirado nas ondas do mar, confeccionado em " +
            "aço inoxidável banhado a ouro. Antialérgico e resistente à " +
            "água — pode usar todos os dias sem tirar.",
        imagens: ["colar.png", "colar.png", "colar.png"]
    },
    {
        id: "3",
        nome: "Pulseira Cristal",
        categoria: "pulseiras",
        preco: 69.90,
        descricao:
            "Pulseira em aço inoxidável com cristais incrustados, fecho " +
            "ajustável e acabamento antialérgico. Combina com o Colar Mar " +
            "e o Brinco Ponto de Luz.",
        imagens: ["pulseira.png", "pulseira.png", "pulseira.png"]
    }
];

// Busca um produto pelo id. Se não achar, devolve o primeiro da lista.
function oliveaBuscarProduto(id) {
    return OLIVEA_PRODUTOS.find((produto) => produto.id === id) || OLIVEA_PRODUTOS[0];
}