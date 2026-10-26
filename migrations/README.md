# SISBEM — MIGRAÇÕES DA ETAPA 2A (COMPLEMENTOS CLÍNICOS EM PRONTUÁRIOS)

Este diretório contém os scripts SQL preparados para a homologação e produção da funcionalidade de **Complementos Clínicos em Prontuários Finalizados (Adendos)** do SISBEM.

---

## 1. Estrutura dos Scripts Preparados

| Script | Banco Alvo | Propósito | Características Técnicas & Permissões |
| :--- | :--- | :--- | :--- |
| `migrations/cloudsql/001_create_clinical_record_addenda_cloudsql.sql` | **Cloud SQL** (PostgreSQL Gerenciado) | Banco **Primário & Oficial** de gravação de todos os adendos. | • PostgreSQL padrão puro (ANSI/PG).<br>• Zero dependência de Supabase Auth ou funções `auth.uid()`.<br>• Chaves estrangeiras com `ON DELETE RESTRICT`.<br>• Restrição `idempotency_key UNIQUE`.<br>• Permissões `SELECT, INSERT, UPDATE` destinadas à conta operacional da aplicação (`SQL_USER`). |
| `migrations/supabase/001_create_clinical_record_addenda_supabase.sql` | **Supabase** (PostgreSQL com GoTrue/Auth & RLS) | Réplica remota para consultas de histórico no cliente web. | • Mesma estrutura canônica de tabela e restrições.<br>• Políticas RLS ativas: `SELECT` exclusivamente para `authenticated`.<br>• Proibição expressa de inserção/mutação/deleção pelo cliente web (`REVOKE INSERT, UPDATE, DELETE`).<br>• Acesso total exclusivo para a role `service_role` (Backend Node.js via `SUPABASE_SERVICE_ROLE_KEY`). |

---

## 2. Orientações Críticas de Infraestrutura e Homologação

### A. Cloud SQL — Identidade da Conta da Aplicação
- A aplicação backend conecta-se ao PostgreSQL utilizando o usuário definido na variável de ambiente `SQL_USER` (definida em tempo de execução no GCP Cloud Run / Vercel / ambiente local).
- Se a migração for executada diretamente por um usuário DBA ou superusuário (ex: `postgres`), o comando padrão `GRANT ... TO CURRENT_USER;` concederá os privilégios ao usuário DBA e **não** à aplicação.
- **Ação Obrigatória da Infraestrutura:** O responsável pela aplicação da migração deve verificar o valor configurado na variável `SQL_USER` do ambiente e executar:
  ```sql
  GRANT SELECT, INSERT, UPDATE ON TABLE public.clinical_record_addenda TO <VALOR_DE_SQL_USER>;
  ```

### B. Supabase — Credencial de Sincronização do Servidor
- Todas as gravações legítimas de complementos clínicos passam **obrigatoriamente pelo backend** (`POST /api/attendance/records/:id/addendum`), onde a autoria é derivada do token do usuário e o registro primário é gravado no Cloud SQL.
- A réplica no Supabase recebe o registro via `upsert` executado pelo servidor Node.js.
- Para que o backend consiga sincronizar com o Supabase sem violar o RLS, o servidor precisa da variável de ambiente:
  ```env
  SUPABASE_SERVICE_ROLE_KEY=<service_role_secret_do_painel_supabase>
  ```
  *(Esta chave nunca deve ter o prefixo `VITE_` e nunca é enviada ao navegador).*
- No cliente web, usuários autenticados possuem estritamente permissão de `SELECT` para consultar o histórico clínico. Qualquer tentativa de gravação direta via cliente no Supabase é rejeitada.

---

## 3. Ordem Recomendada de Aplicação em Homologação

1. **Etapa 1 — Aplicação no Banco Primário (Cloud SQL):**
   - Executar o script `migrations/cloudsql/001_create_clinical_record_addenda_cloudsql.sql` via console GCP / Cloud SQL Studio ou ferramenta de migração (ex: Drizzle/psql).
   - Garantir a concessão de `SELECT, INSERT, UPDATE` à role configurada em `SQL_USER`.
   - Validar que a tabela `public.clinical_record_addenda` foi criada com os índices e a restrição UNIQUE em `idempotency_key`.

2. **Etapa 2 — Aplicação na Réplica Remota (Supabase):**
   - Executar o script `migrations/supabase/001_create_clinical_record_addenda_supabase.sql` via SQL Editor do painel Supabase.
   - Validar que o RLS está habilitado, a role `authenticated` possui apenas `SELECT`, e a role `service_role` possui acesso total.

3. **Etapa 3 — Configuração de Ambiente do Backend:**
   - Adicionar a variável `SUPABASE_SERVICE_ROLE_KEY` nas variáveis de ambiente do serviço Node.js / Express.
   - Reiniciar ou efetuar deploy do backend SISBEM.

---

## 4. Garantias de Segurança e Não-Regressão

- **Imutabilidade do Prontuário:** O prontuário original (`clinical_records`) NÃO sofre `UPDATE` e não possui qualquer coluna alterada por esta funcionalidade.
- **Isolamento de Atendimento:** Não há interferência na tabela `animals`, na condição do animal, na fila veterinária ou no controle de concorrência dos atendimentos em andamento.
- **Idempotência Rigorosa:** A restrição `UNIQUE (idempotency_key)` impede duplicidade física mesmo sob rajadas de requisições concorrentes idênticas.
