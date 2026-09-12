/* ======================================
   CONEXÃO COM O SUPABASE

   Usa a chave "secret" (antiga service_role) —
   por isso este arquivo só roda no servidor,
   nunca no navegador do cliente.
====================================== */

const { createClient } = require("@supabase/supabase-js");

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    console.error(
        "\n[Olivea] Faltou configurar SUPABASE_URL e/ou " +
        "SUPABASE_SECRET_KEY no arquivo .env.\n"
    );
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

module.exports = supabase;