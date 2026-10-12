// T1.7-fix — bool required=false no PocketBase rejeita o valor false ("Cannot be blank"):
// a validação de campo obrigatório trata false como vazio. obrigatorio/concluido deixam de
// ser required (a trava real é server-side no hook: conclusão exige obrigatórios concluídos).
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('task_items')
    const obrig = col.fields.getByName('obrigatorio')
    obrig.required = false
    const concl = col.fields.getByName('concluido')
    concl.required = false
    app.save(col)
    console.log('T1.7-fix: task_items.obrigatorio/concluido sem required (bool false é válido)')
  },
  (app) => {
    const col = app.findCollectionByNameOrId('task_items')
    const obrig = col.fields.getByName('obrigatorio')
    obrig.required = true
    const concl = col.fields.getByName('concluido')
    concl.required = true
    app.save(col)
  },
)
