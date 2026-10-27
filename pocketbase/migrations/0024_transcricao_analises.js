// T3.2 — Análise IA em COLEÇÃO NOVA (lição Fábrica: migration que adiciona campo em
// coleção existente não persiste na instância viva; coleção NOVA persiste).
// transcricao_analises: 1 registro por item de transcrição (upsert por item_id).
migrate(
  (app) => {
    const col = new Collection({
      name: 'transcricao_analises',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'item_id', type: 'text', required: true, min: 1, max: 30 },
        { name: 'project_key', type: 'text', required: true, min: 1, max: 100 },
        { name: 'resumo', type: 'text', max: 4000 },
        { name: 'decisoes', type: 'text', max: 8000 },
        { name: 'compromissos', type: 'text', max: 8000 },
        { name: 'riscos', type: 'text', max: 4000 },
        { name: 'proximos', type: 'text', max: 4000 },
        { name: 'status', type: 'text', max: 20 },
        { name: 'modelo', type: 'text', max: 40 },
        { name: 'criado_em', type: 'text', max: 30 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_ta_item ON transcricao_analises (item_id)',
        'CREATE INDEX idx_ta_project ON transcricao_analises (project_key)',
      ],
    })
    app.save(col)
    console.log('T3.2: coleção transcricao_analises criada')
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('transcricao_analises'))
    } catch (_) {}
  },
)
