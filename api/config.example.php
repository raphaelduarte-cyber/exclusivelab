<?php
/**
 * Modelo de configuração — copie este arquivo para "config.php" (mesma pasta)
 * e preencha com as credenciais reais do banco criado no hPanel da Hostinger.
 *
 * IMPORTANTE:
 * - "config.php" (sem o ".example") é o único arquivo com dados sensíveis.
 *   Nunca é enviado ao navegador — só o PHP no servidor o lê.
 * - Troque API_KEY por um valor aleatório qualquer (ex.: gere uma string longa
 *   em https://www.uuidgenerator.net/ ou similar). O index.html precisa usar
 *   exatamente o mesmo valor em CONFIG.API_KEY.
 * - Isso é uma proteção básica só para esta etapa (sem login ainda). Quando o
 *   login for implementado numa próxima etapa, essa chave única será
 *   substituída por sessão de usuário de verdade.
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'trocar_pelo_nome_do_banco');
define('DB_USER', 'trocar_pelo_usuario_do_banco');
define('DB_PASS', 'trocar_pela_senha_do_banco');

define('API_KEY', 'trocar-por-uma-chave-aleatoria-longa');
