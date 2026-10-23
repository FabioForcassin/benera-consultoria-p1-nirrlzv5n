// T1.13 — Listar apontamentos de touch time do projeto (CA-1-032).
// GET /backend/v1/projects/{key}/apontamentos — escopo por vínculo (padrão workspace).
// Retorna itens ATIVOS (inativados preservam evento e ficam fora da listagem).
routerAdd(
  'GET',
  '/backend/v1/projects/{key}/apontamentos',
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
        const auditCol = $app.findCollectionByNameOrId('audit_log')
        const logNeg = new Record(auditCol)
        logNeg.set('actor_id', auth.id)
        logNeg.set('actor_email', auth.getString('email'))
        logNeg.set('action', 'access_denied')
        logNeg.set('project_key', projectKey)
        logNeg.set('detail', 'listar apontamentos sem vínculo ao projeto')
        $app.save(logNeg)
        return e.forbiddenError('Você não tem vínculo com este projeto.')
      }
    }

    let p = null
    try {
      p = $app.findFirstRecordByData('projects', 'project_key', projectKey)
    } catch (_) {
      return e.notFoundError('Projeto não encontrado.')
    }

    const itens = $app.findRecordsByFilter(
      'apontamentos',
      'project_key = {:pk} && active = true',
      '-created',
      200,
      0,
      { pk: projectKey },
    )

    const lista = []
    let totalMinutos = 0
    for (const it of itens) {
      const m = it.getInt('minutos')
      totalMinutos += m
      lista.push({
        id: it.id,
        minutos: m,
        motivo: it.getString('motivo'),
        etapa: it.getString('etapa'),
        actor_email: it.getString('actor_email'),
        created: it.getDateTime('created').string(),
      })
    }

    return e.json(200, {
      itens: lista,
      total: lista.length,
      total_minutos: totalMinutos,
    })
  },
  $apis.requireAuth(),
)
