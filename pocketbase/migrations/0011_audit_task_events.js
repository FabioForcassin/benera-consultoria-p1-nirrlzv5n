// T1.7 — Estende audit_log.action com eventos de tarefa (padrão da 0006).
migrate(
  (app) => {
    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    const values = actionField.values
    if (values.indexOf('task_created') < 0) values.push('task_created')
    if (values.indexOf('task_updated') < 0) values.push('task_updated')
    if (values.indexOf('task_completed') < 0) values.push('task_completed')
    actionField.values = values
    app.save(audit)
    console.log('T1.7: audit_log.action estendido com task_created/task_updated/task_completed')
  },
  (app) => {
    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    actionField.values = actionField.values.filter(
      (v) => v !== 'task_created' && v !== 'task_updated' && v !== 'task_completed',
    )
    app.save(audit)
  },
)
