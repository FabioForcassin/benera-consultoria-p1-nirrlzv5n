// T2.4 — evento workspace_upload na auditoria (upload auditado p/ pasta do projeto).
migrate(
  (app) => {
    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    const values = actionField.values
    if (values.indexOf('workspace_upload') < 0) values.push('workspace_upload')
    actionField.values = values
    app.save(audit)
    console.log('T2.4: audit workspace_upload adicionado')
  },
  (app) => {
    try {
      const audit = app.findCollectionByNameOrId('audit_log')
      const actionField = audit.fields.getByName('action')
      actionField.values = actionField.values.filter((v) => v !== 'workspace_upload')
      app.save(audit)
    } catch (_) {}
  },
)
