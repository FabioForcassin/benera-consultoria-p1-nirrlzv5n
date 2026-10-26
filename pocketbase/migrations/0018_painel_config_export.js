// T1.14 — Configuração de métrica do painel + auditoria de consulta/exportação (CA-1-036).
// painel_config com regras NULAS (acesso só via hooks server-side, padrão T1.2/T1.13).
// Seed: corte_eventos = 500 — valor que era hardcoded no baseline da T1.13, agora
// CONFIGURÁVEL: mudar a configuração muda o relatório de verdade (corte das consultas
// do painel e do export) e cada mudança fica auditada como config_changed (antes→depois,
// reversível com PUT de volta).
migrate(
  (app) => {
    const col = new Collection({
      name: 'painel_config',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'chave', type: 'text', required: true, min: 2, max: 100 },
        { name: 'valor', type: 'number', required: true },
        { name: 'descricao', type: 'text', max: 300 },
        { name: 'updated_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_painel_config_chave ON painel_config (chave)'],
    })
    app.save(col)

    const rec = new Record(col)
    rec.set('chave', 'corte_eventos')
    rec.set('valor', 500)
    rec.set(
      'descricao',
      'Corte da amostra do baseline: registros mais recentes por fonte (projetos, tarefas, apontamentos, eventos, usuários)',
    )
    app.save(rec)

    // audit_log: eventos da T1.14
    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    const values = actionField.values
    if (values.indexOf('painel_consulta') < 0) values.push('painel_consulta')
    if (values.indexOf('export_realizada') < 0) values.push('export_realizada')
    actionField.values = values
    app.save(audit)

    console.log(
      'T1.14: painel_config criada (seed corte_eventos=500); audit estendido (painel_consulta, export_realizada)',
    )
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('painel_config'))
    } catch (_) {}
    try {
      const audit = app.findCollectionByNameOrId('audit_log')
      const actionField = audit.fields.getByName('action')
      actionField.values = actionField.values.filter(
        (v) => v !== 'painel_consulta' && v !== 'export_realizada',
      )
      app.save(audit)
    } catch (_) {}
  },
)
