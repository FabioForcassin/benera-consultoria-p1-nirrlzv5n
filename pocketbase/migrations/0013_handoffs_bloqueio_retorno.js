// T1.8 — Handoffs idempotentes + campos de bloqueio/retorno na tarefa (CA-1-021..023).
// Padrão T1.2/T1.7: regras NULAS (acesso só via hooks); handoff_key ÚNICA é a chave da
// idempotência. Status da task continua TEXT (lição 0009) — 'bloqueada' validado no hook.
// audit_log.action estendido: task_blocked, task_unblocked, task_returned, handoff_created,
// handoff_retry (mesmo padrão da 0006/0011).
migrate(
  (app) => {
    // 1) handoffs: registro de geração única de próxima tarefa ao concluir etapa.
    // Relação task_id → tasks resolvida pelo id real (guardrail: coleção de migração
    // anterior também precisa do id resolvido por nome no momento da criação).
    const tasksId = app.findCollectionByNameOrId('tasks').id
    const handoffs = new Collection({
      name: 'handoffs',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'handoff_key', type: 'text', required: true, min: 1, max: 200 },
        { name: 'project_key', type: 'text', required: true, min: 1, max: 100 },
        {
          name: 'task_id',
          type: 'relation',
          collectionId: tasksId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'retry_count', type: 'number' },
        { name: 'created_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_handoff_key ON handoffs (handoff_key)',
        'CREATE INDEX idx_handoff_project ON handoffs (project_key)',
      ],
    })
    app.save(handoffs)

    // 2) tasks: campos de bloqueio (CA-1-021) e retorno (CA-1-022).
    const tasks = app.findCollectionByNameOrId('tasks')
    tasks.fields.add(new TextField({ name: 'bloqueio_motivo', max: 500 }))
    tasks.fields.add(new TextField({ name: 'bloqueio_dono', max: 200 }))
    tasks.fields.add(new DateField({ name: 'bloqueio_revisao' }))
    tasks.fields.add(new TextField({ name: 'retorno_motivo', max: 500 }))
    tasks.fields.add(new TextField({ name: 'retorno_por', max: 100 }))
    app.save(tasks)

    // 3) audit_log: eventos da T1.8
    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    const values = actionField.values
    if (values.indexOf('task_blocked') < 0) values.push('task_blocked')
    if (values.indexOf('task_unblocked') < 0) values.push('task_unblocked')
    if (values.indexOf('task_returned') < 0) values.push('task_returned')
    if (values.indexOf('handoff_created') < 0) values.push('handoff_created')
    if (values.indexOf('handoff_retry') < 0) values.push('handoff_retry')
    actionField.values = values
    app.save(audit)

    console.log('T1.8: handoffs criada; tasks com bloqueio/retorno; audit estendido')
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('handoffs'))
    } catch (_) {}
    try {
      const tasks = app.findCollectionByNameOrId('tasks')
      for (const f of [
        'bloqueio_motivo',
        'bloqueio_dono',
        'bloqueio_revisao',
        'retorno_motivo',
        'retorno_por',
      ]) {
        try {
          tasks.fields.removeByName(f)
        } catch (_) {}
      }
      app.save(tasks)
    } catch (_) {}
    try {
      const audit = app.findCollectionByNameOrId('audit_log')
      const actionField = audit.fields.getByName('action')
      actionField.values = actionField.values.filter(
        (v) =>
          v !== 'task_blocked' &&
          v !== 'task_unblocked' &&
          v !== 'task_returned' &&
          v !== 'handoff_created' &&
          v !== 'handoff_retry',
      )
      app.save(audit)
    } catch (_) {}
  },
)
