migrate(
  (app) => {
    // 1) users: campo role + regras (negação por padrão)
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          values: ['admin', 'lider', 'consultor', 'revisor'],
          maxSelect: 1,
          required: true,
        }),
      )
    }
    // Cadastro público fechado: criação somente via superusuário/fluxo de convite (hooks)
    users.createRule = null
    // Dono pode atualizar o próprio registro, mas nunca alterar o próprio papel
    users.updateRule =
      "id = @request.auth.id && (@request.body.role = '' || @request.body.role = role)"
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.deleteRule = 'id = @request.auth.id'
    app.save(users)

    // 2) invites: somente superusuário nas regras de API; acesso real só via hooks
    const invites = new Collection({
      name: 'invites',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'email', type: 'email', required: true },
        {
          name: 'role',
          type: 'select',
          values: ['admin', 'lider', 'consultor', 'revisor'],
          maxSelect: 1,
          required: true,
        },
        { name: 'token_hash', type: 'text', required: true },
        { name: 'expires_at', type: 'date', required: true },
        { name: 'accepted_at', type: 'date' },
        { name: 'invited_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_invites_token_hash ON invites (token_hash)',
        "CREATE UNIQUE INDEX idx_invites_email_pending ON invites (email) WHERE accepted_at = ''",
      ],
    })
    app.save(invites)

    // 3) fixture sintética (sem PII, sem segredo em código): senhas aleatórias de runtime
    const fixtures = {
      'u-admin@example.invalid': 'admin',
      'u-lead@example.invalid': 'lider',
      'u-consultor@example.invalid': 'consultor',
      'u-reviewer@example.invalid': 'revisor',
    }
    for (const email in fixtures) {
      let existing = null
      try {
        existing = app.findAuthRecordByEmail('_pb_users_auth_', email)
      } catch (_) {}
      if (!existing) {
        const rec = new Record(users)
        rec.setEmail(email)
        rec.setRandomPassword()
        rec.setVerified(true)
        rec.set('role', fixtures[email])
        rec.set('name', email.split('@')[0])
        app.save(rec)
      } else if (!existing.getString('role')) {
        existing.set('role', fixtures[email])
        app.save(existing)
      }
    }

    // 4) credencial de demonstração exposta: senha aleatória de runtime (invalida o segredo público)
    try {
      const demo = app.findAuthRecordByEmail('_pb_users_auth_', 'fabio.forcassin@benera.com.br')
      demo.setRandomPassword()
      demo.set('role', 'admin')
      app.save(demo)
      console.log('T1.1: credencial de demonstracao invalidada (valor nunca registrado)')
    } catch (_) {}
  },
  (app) => {
    // down: restaurar estado anterior
    try {
      app.delete(app.findCollectionByNameOrId('invites'))
    } catch (_) {}
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    try {
      users.fields.removeByName('role')
    } catch (_) {}
    users.createRule = ''
    users.updateRule = 'id = @request.auth.id'
    app.save(users)
  },
)
