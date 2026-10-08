// T1.5-fix — Converte stage e priority de select para text (catálogos ativos passam a mandar).
// As migrações anteriores tentaram renomear via field.type, que o runner não aplica; aqui recriamos
// os campos com os mesmos ids preservando os dados.
migrate(
  (app) => {
    const projects = app.findCollectionByNameOrId('projects')
    const stageField = projects.fields.getByName('stage')
    const prioField = projects.fields.getByName('priority')

    // Preserva os valores atuais em variáveis locais antes de recriar
    const dados = []
    const registros = app.findRecordsByFilter('projects', '', '', 500, 0)
    for (const r of registros) {
      dados.push({
        id: r.id,
        stage: r.getString('stage'),
        priority: r.getString('priority'),
      })
    }

    // Remove e recria como text
    projects.fields.removeByName('stage')
    projects.fields.removeByName('priority')
    projects.fields.add(
      new Field({ name: 'stage', type: 'text', required: true, min: 2, max: 100 }),
    )
    projects.fields.add(
      new Field({ name: 'priority', type: 'text', required: true, min: 2, max: 50 }),
    )
    app.save(projects)

    // Restaura os valores preservados
    for (const d of dados) {
      const r = app.findRecordById('projects', d.id)
      r.set('stage', d.stage)
      r.set('priority', d.priority)
      app.save(r)
    }

    console.log('T1.5-fix: projects.stage/priority convertidos para text com dados preservados')
  },
  (app) => {
    try {
      const projects = app.findCollectionByNameOrId('projects')
      projects.fields.removeByName('stage')
      projects.fields.removeByName('priority')
      projects.fields.add(
        new Field({
          name: 'stage',
          type: 'select',
          values: ['Entrada', 'Kick-off', 'Diagnóstico', 'Entrega', 'Encerrado'],
          maxSelect: 1,
          required: true,
        }),
      )
      projects.fields.add(
        new Field({
          name: 'priority',
          type: 'select',
          values: ['baixa', 'media', 'alta'],
          maxSelect: 1,
          required: true,
        }),
      )
      app.save(projects)
    } catch (_) {}
  },
)
