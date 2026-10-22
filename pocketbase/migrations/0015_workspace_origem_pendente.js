// T1.11 — Fallback manual para destino externo (CA-1-030).
// origem_pendente: documento pode nascer SEM origem_url quando o destino externo
// está indisponível — item fica marcado como pendente (registro manual, sem
// integração automática). Preencher a origem depois completa o item (auditado
// como workspace_completado no hook de atualização).
// LIÇÃO 0012: bool com required:true rejeita false — campo criado SEM required.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('workspace_items')
    if (!col.fields.getByName('origem_pendente')) {
      col.fields.add(new BoolField({ name: 'origem_pendente' }))
    }
    app.save(col)

    // audit_log: evento de conclusão do fallback (T1.11)
    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    const values = actionField.values
    if (values.indexOf('workspace_completado') < 0) values.push('workspace_completado')
    actionField.values = values
    app.save(audit)

    console.log('T1.11: origem_pendente adicionada a workspace_items; audit estendido')
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('workspace_items')
      col.fields.removeByName('origem_pendente')
      app.save(col)
    } catch (_) {}
    try {
      const audit = app.findCollectionByNameOrId('audit_log')
      const actionField = audit.fields.getByName('action')
      actionField.values = actionField.values.filter((v) => v !== 'workspace_completado')
      app.save(audit)
    } catch (_) {}
  },
)
