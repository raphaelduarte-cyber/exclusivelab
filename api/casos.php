<?php
/**
 * GET  -> { ok:true, casos:[ ...objetos Caso completos... ] }
 * POST { action:"upsert", caso:{...} } -> { ok:true, caso:{...} }
 * POST { action:"delete", id:"..." }   -> { ok:true }
 *
 * Mesmo contrato JSON que o backend Google Apps Script (backend-appsscript/Code.gs)
 * já usava — o adaptador STORAGE do index.html só troca o transporte.
 */

require_once __DIR__ . '/_auth.php';

// O front-end manda datas em ISO 8601 (ex.: "2026-07-08T14:33:07.997Z"), mas
// a coluna DATETIME do MySQL exige "Y-m-d H:i:s" — só as colunas-espelho
// usam isso; o JSON dentro de `dados` continua em ISO 8601 sem conversão.
function to_mysql_datetime(?string $iso): string {
    $ts = $iso ? strtotime($iso) : false;
    return date('Y-m-d H:i:s', $ts !== false ? $ts : time());
}

try {
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $rows = $pdo->query('SELECT dados FROM casos')->fetchAll();
        $casos = array_map(fn($r) => json_decode($r['dados'], true), $rows);
        echo json_encode(['ok' => true, 'casos' => $casos]);
        exit;
    }

    if ($method === 'POST') {
        $body = read_json_body();
        $action = $body['action'] ?? '';

        if ($action === 'upsert') {
            $caso = $body['caso'] ?? null;
            if (!is_array($caso) || empty($caso['id'])) {
                json_fail(400, 'Campo "caso" ausente ou sem "id".');
            }
            $caso['atualizadoEm'] = date('c');
            $stmt = $pdo->prepare(
                'INSERT INTO casos (id, numero_caso, paciente, status_atual, tipo_caso, tipo_producao, dados, criado_em, atualizado_em)
                 VALUES (:id, :numero_caso, :paciente, :status_atual, :tipo_caso, :tipo_producao, :dados, :criado_em, NOW())
                 ON DUPLICATE KEY UPDATE
                   numero_caso = VALUES(numero_caso), paciente = VALUES(paciente),
                   status_atual = VALUES(status_atual), tipo_caso = VALUES(tipo_caso),
                   tipo_producao = VALUES(tipo_producao), dados = VALUES(dados),
                   atualizado_em = NOW()'
            );
            $stmt->execute([
                ':id' => $caso['id'],
                ':numero_caso' => $caso['numeroCaso'] ?? null,
                ':paciente' => $caso['paciente'] ?? null,
                ':status_atual' => $caso['statusAtual'] ?? null,
                ':tipo_caso' => $caso['tipoCaso'] ?? null,
                ':tipo_producao' => $caso['tipoProducao'] ?? null,
                ':dados' => json_encode($caso, JSON_UNESCAPED_UNICODE),
                ':criado_em' => to_mysql_datetime($caso['criadoEm'] ?? null),
            ]);
            echo json_encode(['ok' => true, 'caso' => $caso]);
            exit;
        }

        if ($action === 'delete') {
            $id = $body['id'] ?? '';
            if (!$id) json_fail(400, 'Campo "id" ausente.');
            $stmt = $pdo->prepare('DELETE FROM casos WHERE id = :id');
            $stmt->execute([':id' => $id]);
            echo json_encode(['ok' => true]);
            exit;
        }

        json_fail(400, 'Ação desconhecida: ' . $action);
    }

    json_fail(405, 'Método não suportado.');
} catch (Throwable $e) {
    json_fail(500, 'Erro interno: ' . $e->getMessage());
}
