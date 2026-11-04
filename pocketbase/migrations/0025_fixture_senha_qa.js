// QA-0 — Senha de teste das fixtures reaplicada a partir do segredo FIXTURE_TEST_PASSWORD
// (valor rotacionado em 04/11/2026 para o banco de teste automatizado do sistema).
// O valor nunca aparece em código, log ou evidência — só no cofre de segredos do Skip.
migrate(
  (app) => {
    const senha = $secrets.get('FIXTURE_TEST_PASSWORD')
    if (!senha) {
      console.log('QA-0: FIXTURE_TEST_PASSWORD ausente — migração não altera senhas')
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
        rec.setVerified(true)
        app.save(rec)
        console.log('QA-0: senha de teste aplicada para ' + email)
      } catch (_) {
        console.log('QA-0: fixture não encontrada: ' + email)
      }
    }
  },
  (app) => {
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
