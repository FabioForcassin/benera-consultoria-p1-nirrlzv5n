// T1.2 — Verificação de acesso a projeto: prova server-side de isolamento.
// GET /backend/v1/projects/{key}/access — responde o papel efetivo do usuário autenticado.
// Sem vínculo = 403 (negação server-side, sem revelar conteúdo do projeto).
routerAdd(
  'GET',
  '/backend/v1/projects/{key}/access',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) {
      return e.unauthorizedError('Autenticação necessária.')
    }

    const projectKey = e.request.pathValue('key')
    const userId = auth.id

    const vinculos = $app.findRecordsByFilter(
      'project_members',
      'user_id = {:uid} && project_key = {:pk}',
      '-created',
      1,
      0,
      { uid: userId, pk: projectKey },
    )

    if (vinculos.length === 0) {
      // Auditoria da negação (sem conteúdo do projeto na resposta)
      const audit = $app.findCollectionByNameOrId('audit_log')
      const log = new Record(audit)
      log.set('actor_id', userId)
      log.set('actor_email', auth.getString('email'))
      log.set('action', 'access_denied')
      log.set('project_key', projectKey)
      log.set('detail', 'sem vínculo')
      $app.save(log)

      return e.forbiddenError('Acesso negado a este projeto.')
    }

    return e.json(200, {
      project_key: projectKey,
      project_role: vinculos[0].getString('project_role'),
    })
  },
  $apis.requireAuth(),
)
