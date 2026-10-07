// T1.4 — Cartão 360 do projeto (CA-1-008) com escopo por vínculo.
// GET /backend/v1/projects/{key} — retorna todos os campos do cartão + nome do cliente e do serviço.
routerAdd(
  'GET',
  '/backend/v1/projects/{key}',
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
        // Sem vínculo: negação auditada, sem revelar conteúdo
        const audit = $app.findCollectionByNameOrId('audit_log')
        const log = new Record(audit)
        log.set('actor_id', auth.id)
        log.set('actor_email', auth.getString('email'))
        log.set('action', 'access_denied')
        log.set('project_key', projectKey)
        log.set('detail', 'cartão sem vínculo')
        $app.save(log)
        return e.forbiddenError('Acesso negado a este projeto.')
      }
    }

    let p = null
    try {
      p = $app.findFirstRecordByData('projects', 'project_key', projectKey)
    } catch (_) {
      return e.notFoundError('Projeto não encontrado.')
    }

    let clienteNome = ''
    try {
      clienteNome = $app.findRecordById('clients', p.getString('client_id')).getString('name')
    } catch (_) {
      clienteNome = ''
    }
    let servicoNome = ''
    try {
      servicoNome = $app
        .findRecordById('service_types', p.getString('service_type_id'))
        .getString('name')
    } catch (_) {
      servicoNome = ''
    }

    return e.json(200, {
      project_key: p.getString('project_key'),
      name: p.getString('name'),
      client_name: clienteNome,
      service_name: servicoNome,
      stage: p.getString('stage'),
      priority: p.getString('priority'),
      due_date: p.getDateTime('due_date').string().slice(0, 10),
      next_action: p.getString('next_action'),
      owner_id: p.getString('owner_id'),
      active: p.getBool('active'),
      created: p.getDateTime('created').string(),
      updated: p.getDateTime('updated').string(),
    })
  },
  $apis.requireAuth(),
)
