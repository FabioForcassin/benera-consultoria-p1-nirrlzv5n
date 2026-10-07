// T1.4 — Timeline do projeto: eventos de auditoria por chave (CA-1-010/011).
// GET /backend/v1/projects/{key}/timeline — admin/líder veem tudo; consultor/revisor só com vínculo.
routerAdd(
  'GET',
  '/backend/v1/projects/{key}/timeline',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const projectKey = e.request.pathValue('key')
    const papel = auth.getString('role')
    const escopoTotal = papel === 'admin' || papel === 'lider'

    if (!escopoTotal) {
      const vinculos = $app.findRecordsByFilter(
        'project_members',
        'user_id = {:uid} && project_key = {:pk}',
        '-created',
        1,
        0,
        { uid: auth.id, pk: projectKey },
      )
      if (vinculos.length === 0) {
        return e.forbiddenError('Acesso negado a este projeto.')
      }
    }

    const eventos = $app.findRecordsByFilter(
      'audit_log',
      'project_key = {:pk}',
      '-created',
      50,
      0,
      { pk: projectKey },
    )
    const resposta = []
    for (const ev of eventos) {
      resposta.push({
        id: ev.id,
        actor_email: ev.getString('actor_email'),
        action: ev.getString('action'),
        detail: ev.getString('detail'),
        created: ev.getDateTime('created').string(),
      })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)
