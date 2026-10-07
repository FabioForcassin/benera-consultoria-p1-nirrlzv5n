// T1.4 — Listagem da carteira com filtros e escopo por papel (CA-1-009).
// Admin/líder: carteira toda. Consultor/revisor: só projetos com vínculo.
// Substitui a rota mínima do fix de alocação (mesmo caminho, comportamento estendido).
routerAdd(
  'GET',
  '/backend/v1/projects',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const papel = auth.getString('role')
    const escopoTotal = papel === 'admin' || papel === 'lider'

    // Filtros de query (opcionais): etapa, responsável, prioridade, atraso
    const q = e.request.query
    const filtroEtapa = (q.get('etapa') || '').trim()
    const filtroOwner = (q.get('owner') || '').trim()
    const filtroPrioridade = (q.get('prioridade') || '').trim()
    const filtroAtraso = (q.get('atraso') || '').trim() // "1" = só atrasados

    const filtros = ['active = true']
    const params = {}
    if (filtroEtapa) {
      filtros.push('stage = {:etapa}')
      params.etapa = filtroEtapa
    }
    if (filtroOwner) {
      filtros.push('owner_id = {:owner}')
      params.owner = filtroOwner
    }
    if (filtroPrioridade) {
      filtros.push('priority = {:prio}')
      params.prio = filtroPrioridade
    }
    if (filtroAtraso === '1') {
      filtros.push('due_date < {:agora} && stage != {:encerrado}')
      params.agora = new DateTime().string()
      params.encerrado = 'Encerrado'
    }

    // Escopo por vínculo (consultor/revisor)
    let keysPermitidas = null
    if (!escopoTotal) {
      const vinculos = $app.findRecordsByFilter(
        'project_members',
        'user_id = {:uid}',
        '-created',
        500,
        0,
        { uid: auth.id },
      )
      keysPermitidas = {}
      for (const v of vinculos) keysPermitidas[v.getString('project_key')] = true
    }

    const registros = $app.findRecordsByFilter(
      'projects',
      filtros.join(' && '),
      '-updated',
      200,
      0,
      params,
    )
    const resposta = []
    for (const p of registros) {
      const key = p.getString('project_key')
      if (keysPermitidas && !keysPermitidas[key]) continue
      resposta.push({
        project_key: key,
        name: p.getString('name'),
        stage: p.getString('stage'),
        priority: p.getString('priority'),
        due_date: p.getDateTime('due_date').string().slice(0, 10),
        next_action: p.getString('next_action'),
        owner_id: p.getString('owner_id'),
        atrasado:
          p.getDateTime('due_date').string() < new DateTime().string() &&
          p.getString('stage') !== 'Encerrado',
      })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)
