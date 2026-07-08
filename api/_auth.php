<?php
/**
 * Proteção básica dos endpoints: exige o header X-Api-Key batendo com a
 * API_KEY configurada em config.php. Isso NÃO é um sistema de login — é só
 * uma barreira simples contra acesso aleatório enquanto não existe
 * autenticação de usuário (etapa futura). Toda requisição sem a chave certa
 * recebe 401 e a execução para aqui.
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

function json_fail(int $status, string $message): void {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message]);
    exit;
}

function read_json_body(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_fail(400, 'Corpo da requisição não é um JSON válido.');
    }
    return $data;
}

$headers = function_exists('getallheaders') ? getallheaders() : [];
$sentKey = $headers['X-Api-Key'] ?? $headers['x-api-key'] ?? ($_SERVER['HTTP_X_API_KEY'] ?? '');
if (!hash_equals(API_KEY, (string) $sentKey)) {
    json_fail(401, 'Chave de API ausente ou inválida.');
}
