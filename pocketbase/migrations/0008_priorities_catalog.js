// T1.5/T1.6 — Prioridades configuráveis (catálogo editável pelo admin) + edição de cliente.
migrate(
  (app) => {
    // 1) priorities: catálogo editável
    const priorities = new Collection({
      name: 'priorities',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'name', type: 'text', required: true, min: 2, max: 50 },
        { name: 'value', type: 'text', required: true, min: 2, max: 50 },
        { name: 'ordem', type: 'number', required: true },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_priorities_value ON priorities (value)'],
    })
    app.save(priorities)

    // 2) projects: priority vira texto (validação contra o catálogo)
    const projects = app.findCollectionByNameOrId('projects')
    const prioField = projects.fields.getByName('priority')
    prioField.type = 'text'
    app.save(projects)

    // 3) seed: prioridades padrão
    const seed = [
      { name: 'Baixa', value: 'baixa', ordem: 1 },
      { name: 'Média', value: 'media', ordem: 2 },
      { name: 'Alta', value: 'alta', ordem: 3 },
    ]
    for (const s of seed) {
      const rec = new Record(priorities)
      rec.set('name', s.name)
      rec.set('value', s.value)
      rec.set('ordem', s.ordem)
      rec.set('active', true)
      app.save(rec)
    }

    // 4) auditoria: evento de transição negada por permissão (consultor tenta mover)
    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    if (actionField.values.indexOf('config_changed') < 0) {
      actionField.values.push('config_changed')
      app.save(audit)
    }

    console.log('T1.5+: catálogo de prioridades criado; projects.priority vira texto')
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('priorities'))
    } catch (_) {}
    try {
      const projects = app.findCollectionByNameOrId('projects')
      const prioField = projects.fields.getByName('priority')
      prioField.type = 'select'
      prioField.values = ['baixa', 'media', 'alta']
      app.save(projects)
    } catch (_) {}
  },
)
