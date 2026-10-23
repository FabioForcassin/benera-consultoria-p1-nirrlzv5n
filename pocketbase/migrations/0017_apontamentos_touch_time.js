// T1.13 — Apontamentos de touch time (CA-1-032/033).
// Padrão T1.2/T1.10: regras NULAS (acesso só via hooks server-side).
// Append-only: apontamento NÃO se edita nem se apaga — correção é novo apontamento;
// inativação (active=false) preserva o registro e o evento (rollback da SPEC).
// Risco da SPEC ("métrica gameável por apontamento manual"): registro manual fica
// SEPARADO dos eventos automáticos e preservado na auditoria.
// LIÇÃO 0012: bool sem required (false é valor válido).
migrate(
  (app) => {
    const col = new Collection({
      name: 'apontamentos',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'project_key', type: 'text', required: true, min: 1, max: 100 },
        { name: 'minutos', type: 'number', required: true },
        { name: 'motivo', type: 'text', required: true, min: 3, max: 300 },
        { name: 'etapa', type: 'text', max: 100 },
        { name: 'actor_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'actor_email', type: 'text', max: 100 },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_ap_project ON apontamentos (project_key)',
        'CREATE INDEX idx_ap_actor ON apontamentos (actor_id)',
      ],
    })
    app.save(col)

    // audit_log: eventos da T1.13
    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    const values = actionField.values
    if (values.indexOf('apontamento_created') < 0) values.push('apontamento_created')
    if (values.indexOf('apontamento_archived') < 0) values.push('apontamento_archived')
    actionField.values = values
    app.save(audit)

    console.log('T1.13: apontamentos criada (append-only); audit estendido')
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('apontamentos'))
    } catch (_) {}
    try {
      const audit = app.findCollectionByNameOrId('audit_log')
      const actionField = audit.fields.getByName('action')
      actionField.values = actionField.values.filter(
        (v) => v !== 'apontamento_created' && v !== 'apontamento_archived',
      )
      app.save(audit)
    } catch (_) {}
  },
)
