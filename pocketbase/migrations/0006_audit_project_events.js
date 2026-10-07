// T1.4 — Estende o enum de ações da auditoria: alteração e inativação de projeto (CA-1-010/011).
migrate(
  (app) => {
    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    const values = actionField.values
    if (values.indexOf('project_updated') < 0) values.push('project_updated')
    if (values.indexOf('project_archived') < 0) values.push('project_archived')
    actionField.values = values
    app.save(audit)
    console.log('T1.4: audit_log.action estendido com project_updated e project_archived')
  },
  (app) => {
    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    actionField.values = actionField.values.filter(
      (v) => v !== 'project_updated' && v !== 'project_archived',
    )
    app.save(audit)
  },
)
