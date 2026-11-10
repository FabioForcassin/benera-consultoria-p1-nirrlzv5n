// QA-LIMPEZA — Remove o resíduo que a sondagem de superfície criou em 10/11/2026.
//
// Durante o inventário de rotas, duas chamadas de sondagem criaram registros reais
// que não têm rota de deleção (clients e invites só têm inativação):
//   - cliente  "probe"                 (criado por u-admin@example.invalid)
//   - convite  "probe@example.invalid" (idem)
//
// Guardas (falha fechada — não toca dado de cliente):
//   1. cliente: nome EXATAMENTE 'probe' E criador com e-mail @example.invalid
//   2. convite: e-mail EXATAMENTE 'probe@example.invalid'
//   3. qualquer outro registro é ignorado; a operação é auditada
//
// Migração de uso único: depois de aplicada, não faz nada (idempotente).
migrate(
  (app) => {
    const ehFixture = (uid) => {
      if (!uid) return false
      try {
        const u = app.findRecordById('_pb_users_auth_', uid)
        return u.getString('email').indexOf('@example.invalid') > 0
      } catch (_) {
        return false
      }
    }

    const apagados = []

    // 1) cliente 'probe' criado por fixture
    try {
      const clientes = app.findRecordsByFilter('clients', 'id != ""', '-created', 200, 0)
      for (const c of clientes) {
        if (c.getString('name') !== 'probe') continue
        if (!ehFixture(c.getString('created_by'))) continue
        app.delete(c)
        apagados.push('cliente probe')
      }
    } catch (err) {
      console.log('QA-LIMPEZA: erro ao varrer clients: ' + err)
    }

    // 2) convite 'probe@example.invalid'
    try {
      const convites = app.findRecordsByFilter('invites', 'id != ""', '-created', 200, 0)
      for (const i of convites) {
        if (i.getString('email') !== 'probe@example.invalid') continue
        app.delete(i)
        apagados.push('convite probe@example.invalid')
      }
    } catch (err) {
      console.log('QA-LIMPEZA: erro ao varrer invites: ' + err)
    }

    console.log('QA-LIMPEZA: removidos ' + apagados.length + ' registro(s): ' + apagados.join('; '))

    // 3) auditoria da limpeza (append-only, nunca apagada)
    if (apagados.length > 0) {
      try {
        const auditCol = app.findCollectionByNameOrId('audit_log')
        const log = new Record(auditCol)
        log.set('action', 'qa_teardown')
        log.set('actor_email', 'qa-automatizado@example.invalid')
        log.set('project_key', '')
        log.set('detail', ('limpeza de resíduo de sondagem: ' + apagados.join('; ')).slice(0, 500))
        app.save(log)
      } catch (err) {
        console.log('QA-LIMPEZA: não foi possível auditar: ' + err)
      }
    }
  },
  (app) => {
    // down: não recria (resíduo de teste não deve voltar)
  },
)
