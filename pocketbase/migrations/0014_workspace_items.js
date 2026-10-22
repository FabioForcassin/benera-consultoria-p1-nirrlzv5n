// T1.10 — Workspace interno do projeto (CA-1-026..028).
// Padrão T1.2/T1.7: regras NULAS (acesso só via hooks server-side).
// tipo como TEXT com validação no hook (lição 0009: SelectField novo não é editável no jsvm).
// active=true/false permite inativar item preservando evento (rollback da SPEC).
migrate(
  (app) => {
    const items = new Collection({
      name: 'workspace_items',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'project_key', type: 'text', required: true, min: 1, max: 100 },
        { name: 'tipo', type: 'text', required: true, min: 3, max: 20 },
        { name: 'titulo', type: 'text', required: true, min: 3, max: 200 },
        { name: 'conteudo', type: 'text', max: 5000 },
        { name: 'origem_url', type: 'url', max: 500 },
        { name: 'origem_tipo', type: 'text', max: 50 },
        { name: 'destinatario', type: 'text', max: 200 },
        { name: 'data_entrega', type: 'date' },
        { name: 'entregue_por', type: 'text', max: 100 },
        { name: 'active', type: 'bool' },
        { name: 'created_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ws_project ON workspace_items (project_key)',
        'CREATE INDEX idx_ws_tipo ON workspace_items (tipo)',
      ],
    })
    app.save(items)

    // audit_log: eventos da T1.10
    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    const values = actionField.values
    if (values.indexOf('workspace_created') < 0) values.push('workspace_created')
    if (values.indexOf('workspace_updated') < 0) values.push('workspace_updated')
    if (values.indexOf('workspace_archived') < 0) values.push('workspace_archived')
    if (values.indexOf('entrega_registered') < 0) values.push('entrega_registered')
    actionField.values = values
    app.save(audit)

    console.log('T1.10: workspace_items criada; audit estendido')
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('workspace_items'))
    } catch (_) {}
    try {
      const audit = app.findCollectionByNameOrId('audit_log')
      const actionField = audit.fields.getByName('action')
      actionField.values = actionField.values.filter(
        (v) =>
          v !== 'workspace_created' &&
          v !== 'workspace_updated' &&
          v !== 'workspace_archived' &&
          v !== 'entrega_registered',
      )
      app.save(audit)
    } catch (_) {}
  },
)
