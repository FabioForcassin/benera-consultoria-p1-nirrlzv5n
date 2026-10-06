// T1.2 — Redefine senhas das fixtures para a senha de TESTE guardada em segredo do projeto.
// O valor nunca aparece em código, log ou evidência — só no cofre de segredos do Skip.
// adapta-divida: senhas fixture em segredo de homologação; credenciais individuais quando houver usuários reais (gatilho: primeiro usuário real convidado)
migrate(
  (app) => {
    const senha = $secrets.get('FIXTURE_TEST_PASSWORD')
    if (!senha) {
      console.log('T1.2: FIXTURE_TEST_PASSWORD ausente — migração não altera senhas')
      return
    }

    const fixtures = [
      'u-admin@example.invalid',
      'u-lead@example.invalid',
      'u-consultor@example.invalid',
      'u-reviewer@example.invalid',
    ]
    for (const email of fixtures) {
      try {
        const rec = app.findAuthRecordByEmail('_pb_users_auth_', email)
        rec.setPassword(senha)
        app.save(rec)
        console.log(
          'T1.2: senha de teste aplicada para fixture (e-mail registrado em log sanitizado)',
        )
      } catch (_) {
        console.log('T1.2: fixture não encontrada: ' + email)
      }
    }
  },
  (app) => {
    // down: senhas aleatórias de novo (invalida a senha de teste)
    const fixtures = [
      'u-admin@example.invalid',
      'u-lead@example.invalid',
      'u-consultor@example.invalid',
      'u-reviewer@example.invalid',
    ]
    for (const email of fixtures) {
      try {
        const rec = app.findAuthRecordByEmail('_pb_users_auth_', email)
        rec.setRandomPassword()
        app.save(rec)
      } catch (_) {}
    }
  },
)
