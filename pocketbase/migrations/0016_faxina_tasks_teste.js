// T1.11 — FAXINA autorizada pelo champion (2026-10-22): remover as 27 tarefas de teste
// acumuladas em PROJ-F1-001 nas provas T1.7–T1.9 (resíduo que enterrava o Workspace
// no cartão — lição AP-2026-10-22-t110-descobribilidade).
// Escopo: SOMENTE tasks de PROJ-F1-001 (piloto controlado). STARIAN-001 e
// PROJETO_KLABIN_001 (projetos reais) NÃO são tocados.
// Cascade (definido na 0010/0013): task_items e handoffs vinculados vão junto.
// Preservado: audit_log (append-only — histórico do que aconteceu), workspace_items
// (itens do champion + item pendente da prova T1.11, base do teste humano).
// Down: não recria tarefas de teste.
migrate(
  (app) => {
    const tasks = app.findRecordsByFilter('tasks', 'project_key = {:pk}', '-created', 500, 0, {
      pk: 'PROJ-F1-001',
    })
    const total = tasks.length
    for (const t of tasks) {
      app.delete(t)
    }
    console.log(
      'T1.11 faxina: ' +
        total +
        ' tarefas de teste removidas de PROJ-F1-001 (cascade em task_items/handoffs)',
    )
  },
  (app) => {
    console.log('T1.11 faxina: down não recria tarefas de teste')
  },
)
