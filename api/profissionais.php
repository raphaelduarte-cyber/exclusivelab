<?php
/**
 * GET  -> { ok:true, profissionais:[ {id,nomeCompleto,nomeCurto,funcao,ativo}, ... ] }
 * POST { profissionais:[...] } -> substitui a lista inteira (mesmo padrão que
 *        salvarProfissionais() já usava com localStorage.setItem: sempre
 *        regrava a lista completa, não faz upsert de um item só).
 */

require_once __DIR__ . '/_auth.php';

try {
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $rows = $pdo->query('SELECT id, nome_completo, nome_curto, funcao, ativo FROM profissionais ORDER BY nome_curto')->fetchAll();
        $profissionais = array_map(fn($r) => [
            'id' => $r['id'],
            'nomeCompleto' => $r['nome_completo'],
            'nomeCurto' => $r['nome_curto'],
            'funcao' => $r['funcao'],
            'ativo' => (bool) $r['ativo'],
        ], $rows);
        echo json_encode(['ok' => true, 'profissionais' => $profissionais]);
        exit;
    }

    if ($method === 'POST') {
        $body = read_json_body();
        $lista = $body['profissionais'] ?? null;
        if (!is_array($lista)) {
            json_fail(400, 'Campo "profissionais" ausente ou inválido.');
        }

        $pdo->beginTransaction();
        $pdo->exec('DELETE FROM profissionais');
        $stmt = $pdo->prepare(
            'INSERT INTO profissionais (id, nome_completo, nome_curto, funcao, ativo) VALUES (:id, :nome_completo, :nome_curto, :funcao, :ativo)'
        );
        foreach ($lista as $p) {
            if (empty($p['id'])) continue;
            $stmt->execute([
                ':id' => $p['id'],
                ':nome_completo' => $p['nomeCompleto'] ?? '',
                ':nome_curto' => $p['nomeCurto'] ?? ($p['nomeCompleto'] ?? ''),
                ':funcao' => $p['funcao'] ?? null,
                ':ativo' => !empty($p['ativo']) ? 1 : 0,
            ]);
        }
        $pdo->commit();
        echo json_encode(['ok' => true, 'profissionais' => $lista]);
        exit;
    }

    json_fail(405, 'Método não suportado.');
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    json_fail(500, 'Erro interno: ' . $e->getMessage());
}
