-- Painel do Laboratório Exclusive — schema MySQL (Hostinger)
--
-- Guarda cada `Caso` inteiro (com lotes, eventos de impressão, histórico etc.)
-- como JSON numa única coluna (`dados`) — a mesma lógica que já roda hoje no
-- navegador continua sendo a fonte da verdade sobre como interpretar esse
-- objeto; o banco só precisa guardar e devolver o JSON inteiro de cada caso.
-- As colunas extras (numero_caso, paciente, status_atual, tipo_*) são cópias
-- só para permitir olhar/filtrar rapidamente pelo phpMyAdmin — o aplicativo
-- nunca lê essas colunas, sempre lê `dados`.
--
-- Como usar na Hostinger: hPanel > Bancos de dados > phpMyAdmin > aba "Importar"
-- > selecione este arquivo. Ou copie/cole o conteúdo na aba "SQL".

CREATE TABLE IF NOT EXISTS casos (
  id CHAR(36) NOT NULL PRIMARY KEY,
  numero_caso VARCHAR(50)     DEFAULT NULL,
  paciente    VARCHAR(200)    DEFAULT NULL,
  status_atual VARCHAR(100)   DEFAULT NULL,
  tipo_caso   VARCHAR(20)     DEFAULT NULL,
  tipo_producao VARCHAR(30)   DEFAULT NULL,
  dados JSON NOT NULL,
  criado_em DATETIME          DEFAULT NULL,
  atualizado_em DATETIME      DEFAULT NULL,
  KEY idx_status (status_atual),
  KEY idx_paciente (paciente)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profissionais (
  id CHAR(36) NOT NULL PRIMARY KEY,
  nome_completo VARCHAR(200) NOT NULL,
  nome_curto    VARCHAR(100) NOT NULL,
  funcao        VARCHAR(50)  DEFAULT NULL,
  ativo         TINYINT(1)   NOT NULL DEFAULT 1,
  criado_em     DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
