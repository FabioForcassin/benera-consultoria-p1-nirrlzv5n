// T1.4 — Listagem da carteira com filtros e escopo por papel (CA-1-009).
// Admin/líder: carteira toda. Consultor/revisor: só projetos com vínculo.
// Query params via e.request.url.query() (API Go do runtime). "Agora" via string ISO em JS.
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
    const q = e.request.url.query()
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

    // Agora em formato PB ("2006-01-02 15:04:05.000Z") — comparação lexicográfica segura
    const agoraStr = new Date().toISOString().replace('T', ' ').slice(0, 19) + '.000Z'

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
      if (Object.keys(keysPermitidas).length === 0) {
        return e.json(200, { items: [] })
      }
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
      const dueStr = p.getDateTime('due_date').string()
      const atrasado = dueStr < agoraStr && p.getString('stage') !== 'Encerrado'
      if (filtroAtraso === '1' && !atrasado) continue
      resposta.push({
        project_key: key,
        name: p.getString('name'),
        stage: p.getString('stage'),
        priority: p.getString('priority'),
        due_date: dueStr.slice(0, 10),
        next_action: p.getString('next_action'),
        owner_id: p.getString('owner_id'),
        atrasado: atrasado,
      })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)
