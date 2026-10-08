// T1.5 — Esteira configurável: etapas como dados (não enum), versões com diff e rollback (CA-1-012/013/018).
migrate(
  (app) => {
    // 1) projects: stage vira texto (validação passa a ser contra a esteira ativa);
    //    kickoff_date alimenta critérios de entrada (T1.6 usa); pipeline_version registra o contrato da transição.
    const projects = app.findCollectionByNameOrId('projects')
    const stageField = projects.fields.getByName('stage')
    stageField.type = 'text'
    if (!projects.fields.getByName('kickoff_date')) {
      projects.fields.add(
        new Field({
          name: 'kickoff_date',
          type: 'date',
        }),
      )
    }
    if (!projects.fields.getByName('pipeline_version')) {
      projects.fields.add(
        new Field({
          name: 'pipeline_version',
          type: 'number',
        }),
      )
    }
    app.save(projects)

    // 2) pipeline_stages: etapa configurável com ordem e critérios
    const stages = new Collection({
      name: 'pipeline_stages',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'name', type: 'text', required: true, min: 2, max: 100 },
        { name: 'ordem', type: 'number', required: true },
        { name: 'entry_criteria', type: 'text', max: 500 },
        { name: 'entry_requires', type: 'json', maxSize: 2000 },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_pipeline_stage_name ON pipeline_stages (name)',
        'CREATE INDEX idx_pipeline_stage_ordem ON pipeline_stages (ordem)',
      ],
    })
    app.save(stages)

    // 3) pipeline_versions: snapshot JSON da esteira + diff + autor; nunca deletado
    const versions = new Collection({
      name: 'pipeline_versions',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'version', type: 'number', required: true },
        { name: 'stages_json', type: 'json', required: true, maxSize: 50000 },
        { name: 'diff', type: 'text', max: 1000 },
        { name: 'active_version', type: 'bool' },
        { name: 'created_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_pipeline_version ON pipeline_versions (version)'],
    })
    app.save(versions)

    // 4) auditoria: eventos da esteira e de transição
    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    const values = actionField.values
    if (values.indexOf('stage_transition') < 0) values.push('stage_transition')
    if (values.indexOf('transition_blocked') < 0) values.push('transition_blocked')
    if (values.indexOf('pipeline_updated') < 0) values.push('pipeline_updated')
    actionField.values = values
    app.save(audit)

    // 5) Seed: 5 etapas homologadas + versão 1 ativa
    const seedStages = [
      {
        name: 'Entrada',
        ordem: 1,
        entry_criteria: 'Projeto cadastrado com campos mínimos',
        entry_requires: [],
      },
      {
        name: 'Kick-off',
        ordem: 2,
        entry_criteria: 'Reunião de abertura agendada',
        entry_requires: [],
      },
      {
        name: 'Diagnóstico',
        ordem: 3,
        entry_criteria: 'Kick-off realizado (data registrada)',
        entry_requires: ['kickoff_date'],
      },
      {
        name: 'Entrega',
        ordem: 4,
        entry_criteria: 'Kick-off realizado (data registrada)',
        entry_requires: ['kickoff_date'],
      },
      { name: 'Encerrado', ordem: 5, entry_criteria: 'Entrega concluída', entry_requires: [] },
    ]
    for (const s of seedStages) {
      const rec = new Record(stages)
      rec.set('name', s.name)
      rec.set('ordem', s.ordem)
      rec.set('entry_criteria', s.entry_criteria)
      rec.set('entry_requires', JSON.stringify(s.entry_requires))
      rec.set('active', true)
      app.save(rec)
    }

    const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'fabio.forcassin@benera.com.br')
    const v1 = new Record(versions)
    v1.set('version', 1)
    v1.set('stages_json', JSON.stringify(seedStages))
    v1.set(
      'diff',
      'versão inicial: 5 etapas homologadas (Entrada, Kick-off, Diagnóstico, Entrega, Encerrado)',
    )
    v1.set('active_version', true)
    if (admin) v1.set('created_by', admin.id)
    app.save(v1)

    console.log('T1.5: esteira configurável criada + versão 1 seedada')
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('pipeline_versions'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('pipeline_stages'))
    } catch (_) {}
    try {
      const projects = app.findCollectionByNameOrId('projects')
      const stageField = projects.fields.getByName('stage')
      stageField.type = 'select'
      stageField.values = ['Entrada', 'Kick-off', 'Diagnóstico', 'Entrega', 'Encerrado']
      app.save(projects)
    } catch (_) {}
  },
)
