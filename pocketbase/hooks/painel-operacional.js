// T1.12 — Painel operacional (CA-1-031): agregados por etapa, responsável, atraso,
// bloqueio e prioridade, com filtros SERVER-SIDE — os agregados são calculados sobre
// o RESULTADO FILTRADO, então sempre batem com a lista (prova verificável).
// Escopo herdado da carteira: admin/líder veem tudo; consultor/revisor só projetos
// com vínculo em project_members (owner ganha vínculo automático na criação — v0.0.32).
// Atraso com fuso BRT (lição T1.7); bloqueio = projeto com ≥1 tarefa 'bloqueada' (T1.8).
// Touch time/espera/ciclo e baseline são da T1.13; auditoria de consulta, da T1.14.
routerAdd(
  'GET',
  '/backend/v1/painel',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const papel = auth.getString('role')
    const escopoTotal = papel === 'admin' || papel === 'lider'

    // filtros da query (defensivo: duas formas de acessar a URL)
    let fEtapa = ''
    let fPrioridade = ''
    let fAtraso = false
    let fOwner = ''
    let fBloqueio = false
    let fEncerrados = false
    try {
      const q = e.request.url.query()
      fEtapa = (q.get('etapa') || '').trim()
      fPrioridade = (q.get('prioridade') || '').trim()
      fAtraso = q.get('atraso') === '1'
      fOwner = (q.get('owner') || '').trim()
      fBloqueio = q.get('bloqueio') === '1'
      fEncerrados = q.get('encerrados') === '1'
    } catch (_) {
      try {
        const q2 = e.request.url().query()
        fEtapa = (q2.get('etapa') || '').trim()
        fPrioridade = (q2.get('prioridade') || '').trim()
        fAtraso = q2.get('atraso') === '1'
        fOwner = (q2.get('owner') || '').trim()
        fBloqueio = q2.get('bloqueio') === '1'
        fEncerrados = q2.get('encerrados') === '1'
      } catch (_) {}
    }

    // escopo por vínculo
    let chaves = null
    if (!escopoTotal) {
      chaves = {}
      const vinculos = $app.findRecordsByFilter(
        'project_members',
        'user_id = {:uid}',
        '-created',
        500,
        0,
        { uid: auth.id },
      )
      for (const v of vinculos) chaves[v.getString('project_key')] = true
    }

    // hoje em BRT (UTC-3) — lição T1.7
    const hojeBRT = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)

    // mapa de usuários (nome/e-mail do responsável)
    const usuarios = {}
    try {
      const us = $app.findRecordsByFilter('_pb_users_auth_', 'id != ""', '-created', 500, 0)
      for (const u of us) {
        usuarios[u.id] = { email: u.getString('email'), name: u.getString('name') }
      }
    } catch (_) {}

    // tarefas bloqueadas por projeto (T1.8)
    const bloqueadas = {}
    try {
      const tb = $app.findRecordsByFilter('tasks', "status = 'bloqueada'", '-created', 500, 0)
      for (const t of tb) {
        const pk = t.getString('project_key')
        bloqueadas[pk] = (bloqueadas[pk] || 0) + 1
      }
    } catch (_) {}

    // projetos → itens com flags
    const itens = []
    const projetos = $app.findRecordsByFilter('projects', 'id != ""', '-created', 500, 0)
    for (const p of projetos) {
      const key = p.getString('project_key')
      if (chaves && !chaves[key]) continue
      const stage = p.getString('stage')
      const active = p.getBool('active')
      const encerrado = stage === 'Encerrado' || !active
      const dueStr = p.getDateTime('due_date').string()
      const due = dueStr.indexOf('0001-') === 0 ? '' : dueStr.slice(0, 10)
      const atrasado = !encerrado && !!due && due < hojeBRT
      const ownerId = p.getString('owner_id')
      const item = {
        project_key: key,
        name: p.getString('name'),
        stage: stage,
        priority: p.getString('priority'),
        owner_id: ownerId,
        owner_email: (usuarios[ownerId] || {}).email || '—',
        due_date: due,
        atrasado: atrasado,
        bloqueado: !!bloqueadas[key],
        encerrado: encerrado,
      }
      // filtros server-side
      if (fEtapa && stage !== fEtapa) continue
      if (fPrioridade && item.priority !== fPrioridade) continue
      if (fAtraso && !atrasado) continue
      if (fOwner && ownerId !== fOwner) continue
      if (fBloqueio && !item.bloqueado) continue
      if (!fEncerrados && encerrado) continue
      itens.push(item)
    }

    // agregados sobre o RESULTADO FILTRADO
    const totais = { ativos: 0, atrasados: 0, bloqueados: 0, encerrados: 0 }
    const porEtapa = {}
    const porResponsavel = {}
    const porPrioridade = {}
    const agg = (m, k) => {
      if (!m[k]) m[k] = { name: k, total: 0, atrasados: 0, bloqueados: 0 }
      return m[k]
    }
    for (const it of itens) {
      if (it.encerrado) totais.encerrados++
      else totais.ativos++
      if (it.atrasado) totais.atrasados++
      if (it.bloqueado) totais.bloqueados++
      const a1 = agg(porEtapa, it.stage || '—')
      a1.total++
      if (it.atrasado) a1.atrasados++
      if (it.bloqueado) a1.bloqueados++
      const a2 = agg(porResponsavel, it.owner_email)
      a2.total++
      if (it.atrasado) a2.atrasados++
      if (it.bloqueado) a2.bloqueados++
      const a3 = agg(porPrioridade, it.priority || '—')
      a3.total++
      if (it.atrasado) a3.atrasados++
      if (it.bloqueado) a3.bloqueados++
    }
    const ordenar = (m) =>
      Object.values(m).sort((a, b) => b.total - a.total || (a.name < b.name ? -1 : 1))

    return e.json(200, {
      totais: totais,
      porEtapa: ordenar(porEtapa),
      porResponsavel: ordenar(porResponsavel),
      porPrioridade: ordenar(porPrioridade),
      lista: itens.slice(0, 100),
      totalLista: itens.length,
      filtros: {
        etapa: fEtapa,
        prioridade: fPrioridade,
        atraso: fAtraso,
        owner: fOwner,
        bloqueio: fBloqueio,
        encerrados: fEncerrados,
      },
    })
  },
  $apis.requireAuth(),
)
