/* =====================================================
   FORMULÁRIO CONTATE-NOS
===================================================== */

const contactForm = document.getElementById("contactForm");

if (contactForm) {

    contactForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const nome = document.getElementById("nome").value.trim();
        const email = document.getElementById("email").value.trim();
        const whatsapp = document.getElementById("whatsapp").value.trim();
        const mensagem = document.getElementById("mensagem").value.trim();

        const texto =
`Olá, Olivea!

Nome: ${nome}
Email: ${email}
WhatsApp: ${whatsapp}

Mensagem:
${mensagem}`;

        const numeroOlivea = "5571981437753";

        const url =
            "https://wa.me/" +
            numeroOlivea +
            "?text=" +
            encodeURIComponent(texto);

        window.open(url, "_blank");

    });

}