migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // Idempotente: verificar se o usuário já existe
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'fabio.forcassin@benera.com.br')
      return // Já existe
    } catch (_) {}

    const record = new Record(users)
    record.setEmail('fabio.forcassin@benera.com.br')
    record.setPassword('Skip@Pass')
    record.setVerified(true)
    record.set('name', 'Fábio Forcassin')
    app.save(record)
  },
  (app) => {
    try {
      const record = app.findAuthRecordByEmail('_pb_users_auth_', 'fabio.forcassin@benera.com.br')
      app.delete(record)
    } catch (_) {}
  },
)
