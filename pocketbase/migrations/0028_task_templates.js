// TPL-1 — Templates de tarefas por tipo de serviço.
//
// Problema que resolve: hoje um projeto de Cargos e Salários nasce vazio e as ~18
// tarefas do roteiro são digitadas uma a uma (medido: 18 chamadas, ~520 ms, e é
// trabalho manual que se repete em todo projeto novo).
//
// Desenho:
//   task_templates       → o modelo (nome, tipo de serviço, duração em semanas)
//   task_template_items  → as tarefas do modelo, com uma FOLGA em semanas relativa
//                          ao início do projeto (prazo calculado, não digitado)
//
// Ao aplicar num projeto, o sistema cria as tarefas com prazo = data de início do
// projeto + folga da tarefa. O consultor ajusta o que for dele.
//
// Coleções novas: persistem na instância viva (lição de migrations do Skip).
migrate(
  (app) => {
    // ---------- task_templates ----------
    let ja = null
    try {
      ja = app.findCollectionByNameOrId('task_templates')
    } catch (_) {
      ja = null
    }
    if (!ja) {
      const col = new Collection({
        name: 'task_templates',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
      })
      col.fields.add(new TextField({ name: 'nome', required: true, max: 120, min: 3 }))
      col.fields.add(new TextField({ name: 'descricao', max: 500 }))
      col.fields.add(
        new RelationField({
          name: 'service_type_id',
          collectionId: app.findCollectionByNameOrId('service_types').id,
          maxSelect: 1,
          required: true,
        }),
      )
      col.fields.add(new NumberField({ name: 'duracao_semanas', min: 1, max: 104 }))
      col.fields.add(new BoolField({ name: 'ativo' }))
      col.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
      col.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
      app.save(col)
      console.log('TPL-1: coleção task_templates criada')
    } else {
      console.log('TPL-1: task_templates já existe')
    }

    // ---------- task_template_items ----------
    let jaItem = null
    try {
      jaItem = app.findCollectionByNameOrId('task_template_items')
    } catch (_) {
      jaItem = null
    }
    if (!jaItem) {
      const col = new Collection({
        name: 'task_template_items',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
      })
      col.fields.add(
        new RelationField({
          name: 'template_id',
          collectionId: app.findCollectionByNameOrId('task_templates').id,
          maxSelect: 1,
          required: true,
        }),
      )
      col.fields.add(new NumberField({ name: 'ordem', min: 1, max: 999 }))
      col.fields.add(new TextField({ name: 'titulo', required: true, max: 200, min: 3 }))
      col.fields.add(new TextField({ name: 'descricao', max: 1000 }))
      // etapa da esteira em que a tarefa entra (Entrada, Kick-off, Diagnóstico, ...)
      col.fields.add(new TextField({ name: 'etapa', max: 100 }))
      // quantas semanas após o início do projeto a tarefa deve estar pronta
      col.fields.add(new NumberField({ name: 'folga_semanas', min: 0, max: 104 }))
      col.fields.add(new NumberField({ name: 'duracao_semanas', min: 0, max: 52 }))
      col.fields.add(new TextField({ name: 'evidencia_esperada', max: 500 }))
      col.fields.add(new BoolField({ name: 'obrigatorio' }))
      // checklist em JSON: [{titulo, obrigatorio}]
      col.fields.add(new TextField({ name: 'checklist', max: 2000 }))
      col.fields.add(new BoolField({ name: 'ativo' }))
      col.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
      col.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
      app.save(col)
      console.log('TPL-1: coleção task_template_items criada')
    } else {
      console.log('TPL-1: task_template_items já existe')
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('task_template_items'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('task_templates'))
    } catch (_) {}
  },
)
