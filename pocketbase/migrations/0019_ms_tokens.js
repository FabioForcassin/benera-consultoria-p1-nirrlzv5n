// T2.2 — Coleção ms_tokens: guarda o token corrente do Microsoft Graph (access +
// refresh rotacionado + expiração) para os hooks server-side da Fase 2.
// Regras NULAS (padrão da Fase 1): acesso só via hooks — nunca via API direta,
// nunca no front, nunca em log. Seed vazio: o primeiro uso popula via refresh.
// audit_log: sharepoint_consulta (navegador de arquivos, CA-2-007/008).
migrate(
  (app) => {
    const col = new Collection({
      name: 'ms_tokens',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'chave', type: 'text', required: true, min: 2, max: 50 },
        { name: 'access_token', type: 'text', max: 4000 },
        { name: 'refresh_token', type: 'text', max: 4000 },
        { name: 'expira_em', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_ms_tokens_chave ON ms_tokens (chave)'],
    })
    app.save(col)

    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    const values = actionField.values
    if (values.indexOf('sharepoint_consulta') < 0) values.push('sharepoint_consulta')
    actionField.values = values
    app.save(audit)

    console.log('T2.2: ms_tokens criada (regras nulas); audit estendido (sharepoint_consulta)')
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('ms_tokens'))
    } catch (_) {}
    try {
      const audit = app.findCollectionByNameOrId('audit_log')
      const actionField = audit.fields.getByName('action')
      actionField.values = actionField.values.filter((v) => v !== 'sharepoint_consulta')
      app.save(audit)
    } catch (_) {}
  },
)
