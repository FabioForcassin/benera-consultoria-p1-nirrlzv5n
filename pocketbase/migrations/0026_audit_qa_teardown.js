// QA-1 — Adiciona o evento qa_teardown ao select de audit_log.action.
// A limpeza do banco de teste precisa de nome próprio na auditoria: registrar como
// "config_changed" misturaria ação de QA com mudança de configuração de cliente.
// Aditivo: nenhum valor existente é removido.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('audit_log')
    const campo = col.fields.getByName('action')
    if (!campo) {
      console.log('QA-1: campo action não encontrado')
      return
    }
    const valores = campo.values || []
    if (valores.indexOf('qa_teardown') < 0) {
      valores.push('qa_teardown')
      campo.values = valores
      app.save(col)
      console.log('QA-1: qa_teardown adicionado ao select de auditoria')
    } else {
      console.log('QA-1: qa_teardown já existe')
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('audit_log')
      const campo = col.fields.getByName('action')
      if (campo && campo.values) {
        campo.values = campo.values.filter((v) => v !== 'qa_teardown')
        app.save(col)
      }
    } catch (_) {}
  },
)
