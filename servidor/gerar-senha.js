/* ======================================
   GERADOR DE SENHA DO ADMIN

   Rode este arquivo UMA VEZ na sua máquina pra
   gerar o hash da senha que vai no .env. Nunca
   colocamos a senha "pura" no .env, só o hash.

   Como usar (dentro da pasta servidor):

       node gerar-senha.js SuaSenhaAqui123

   Ele vai imprimir um texto longo — copia esse
   texto todo e cola no .env, na variável
   ADMIN_SENHA_HASH.
====================================== */

const bcrypt = require("bcryptjs");

const senha = process.argv[2];

if (!senha) {
    console.log("Uso: node gerar-senha.js SuaSenhaAqui");
    process.exit(1);
}

const hash = bcrypt.hashSync(senha, 10);

console.log("\nCopie a linha abaixo e cole no seu .env:\n");
console.log("ADMIN_SENHA_HASH=" + hash + "\n");