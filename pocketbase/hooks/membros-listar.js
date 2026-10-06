// T1.2 — Listar membros de um projeto: somente admin global (deny-default para outros papéis).
routerAdd(
  'GET',
  '/backend/v1/projects/{key}/members',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || auth.get('role') !== 'admin') {
      return e.forbiddenError('Somente administrador pode listar membros do projeto.')
    }

    const projectKey = e.request.pathValue('key')
    const membros = $app.findRecordsByFilter(
      'project_members',
      'project_key = {:pk}',
      '-created',
      100,
      0,
      { pk: projectKey },
    )

    const resposta = []
    for (const m of membros) {
      resposta.push({
        id: m.id,
        user_id: m.getString('user_id'),
        project_role: m.getString('project_role'),
        created: m.getDateTime('created').string(),
      })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)
