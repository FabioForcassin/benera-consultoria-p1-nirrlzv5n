// T3.1 — Transcrições de reuniões (Fase 3, decisão do dono 27/10: 100% nativo Skip).
// workspace_items ganha o tipo "transcricao" + campos da análise IA:
//   an_resumo, an_decisoes, an_compromissos, an_riscos, an_proximos (JSON/texto),
//   an_status (pendente/processando/pronto/erro), an_modelo, an_criado_em.
// Coleção de conversas do agente analista fica para a T3.3.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('workspace_items')
    if (!col.fields.getByName('an_resumo')) {
      col.fields.add(new TextField({ name: 'an_resumo', max: 4000 }))
      col.fields.add(new TextField({ name: 'an_decisoes', max: 8000 }))
      col.fields.add(new TextField({ name: 'an_compromissos', max: 8000 }))
      col.fields.add(new TextField({ name: 'an_riscos', max: 4000 }))
      col.fields.add(new TextField({ name: 'an_proximos', max: 4000 }))
      col.fields.add(new TextField({ name: 'an_status', max: 20 }))
      col.fields.add(new TextField({ name: 'an_modelo', max: 40 }))
      col.fields.add(new AutodateField({ name: 'an_criado_em', onCreate: false, onUpdate: false }))
    }
    // audit_log: eventos da Fase 3
    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    const values = actionField.values
    if (values.indexOf('transcricao_criada') < 0) values.push('transcricao_criada')
    if (values.indexOf('transcricao_analisada') < 0) values.push('transcricao_analisada')
    if (values.indexOf('transcricao_erro') < 0) values.push('transcricao_erro')
    actionField.values = values
    app.save(audit)

    console.log('T3.1: tipo transcricao + campos an_* em workspace_items; audit estendido')
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('workspace_items')
      for (const f of [
        'an_resumo',
        'an_decisoes',
        'an_compromissos',
        'an_riscos',
        'an_proximos',
        'an_status',
        'an_modelo',
        'an_criado_em',
      ]) {
        col.fields.removeByName(f)
      }
      app.save(col)
    } catch (_) {}
    try {
      const audit = app.findCollectionByNameOrId('audit_log')
      const actionField = audit.fields.getByName('action')
      actionField.values = actionField.values.filter(
        (v) =>
          v !== 'transcricao_criada' && v !== 'transcricao_analisada' && v !== 'transcricao_erro',
      )
      app.save(audit)
    } catch (_) {}
  },
)
