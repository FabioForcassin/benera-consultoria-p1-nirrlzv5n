// T1.12/T1.13/T1.14 — Painel operacional: agregados filtráveis (CA-1-031) + métricas de
// tempo e baseline (CA-1-032/033/037) + auditoria de consulta e corte configurável (T1.14).
// Agregados sobre o RESULTADO FILTRADO — totais sempre batem com a lista.
// T1.13: por projeto da lista filtrada — ciclo (dias corridos, criação → último evento
// de auditoria, BRT), touch (soma de minutos de apontamentos ATIVOS), espera
// (ciclo − touch, piso 0), incompleto (sem apontamento → flag, nunca inventa número).
// T1.14: CADA CONSULTA é auditada como painel_consulta (ator, filtros, nº de linhas) —
// CA-1-036. O corte da amostra vem de painel_config.corte_eventos (antes hardcoded 500):
// mudar a configuração muda o relatório de verdade (consultas e export).
// BASELINE como objeto calculado: período (primeira criação → hoje), relógio
// ("dias corridos, BRT"), amostra (projetos/apontamentos/eventos considerados, corte
// configurável declarado) e limitações FIXAS — incluindo a nota anti-ganho (CA-1-037).
// Escopo herdado da carteira: admin/líder veem tudo; consultor/revisor só com vínculo.
// Atraso com fuso BRT (lição T1.7); bloqueio = projeto com ≥1 tarefa 'bloqueada' (T1.8).
// [reescrito v0.0.63 — hooks exigem reescrita integral, patch não recarrega]
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

    // T1.14: corte da amostra vem da configuração (padrão se a config não existir)
    let corte = 500
    try {
      const cfg = $app.findFirstRecordByData('painel_config', 'chave', 'corte_eventos')
      corte = Math.floor(Number(cfg.get('valor')) || 500)
    } catch (_) {}

    // escopo por vínculo
    let chaves = null
    if (!escopoTotal) {
      chaves = {}
      const vinculos = $app.findRecordsByFilter(
        'project_members',
        'user_id = {:uid}',
        '-created',
        corte,
        0,
        { uid: auth.id },
      )
      for (const v of vinculos) chaves[v.getString('project_key')] = true
    }

    // hoje em BRT (UTC-3) — lição T1.7
    const hojeBRT = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
    const hojeMs = Date.now()

    // mapa de usuários (nome/e-mail do responsável)
    const usuarios = {}
    try {
      const us = $app.findRecordsByFilter('_pb_users_auth_', 'id != ""', '-created', corte, 0)
      for (const u of us) {
        usuarios[u.id] = { email: u.getString('email'), name: u.getString('name') }
      }
    } catch (_) {}

    // tarefas bloqueadas por projeto (T1.8)
    const bloqueadas = {}
    try {
      const tb = $app.findRecordsByFilter('tasks', "status = 'bloqueada'", '-created', corte, 0)
      for (const t of tb) {
        const pk = t.getString('project_key')
        bloqueadas[pk] = (bloqueadas[pk] || 0) + 1
      }
    } catch (_) {}

    // T1.13: apontamentos ATIVOS por projeto + amostra global
    const touchPorProjeto = {}
    let amostraApontamentos = 0
    try {
      const aps = $app.findRecordsByFilter('apontamentos', 'active = true', '-created', corte, 0)
      for (const a of aps) {
        amostraApontamentos++
        const pk = a.getString('project_key')
        touchPorProjeto[pk] = (touchPorProjeto[pk] || 0) + a.getInt('minutos')
      }
    } catch (_) {}

    // T1.13: último evento de auditoria por projeto (fim do ciclo) + amostra
    const ultimoEventoPorProjeto = {}
    let amostraEventos = 0
    try {
      const evs = $app.findRecordsByFilter('audit_log', 'id != ""', '-created', corte, 0)
      for (const ev of evs) {
        amostraEventos++
        const pk = ev.getString('project_key')
        if (pk && !ultimoEventoPorProjeto[pk]) {
          ultimoEventoPorProjeto[pk] = ev.getDateTime('created').string()
        }
      }
    } catch (_) {}

    // projetos → itens com flags + métricas de tempo
    const itens = []
    let primeiraCriacao = ''
    const projetos = $app.findRecordsByFilter('projects', 'id != ""', '-created', corte, 0)
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

      // T1.13: ciclo em dias corridos (criação → último evento, BRT)
      const criadoStr = p.getDateTime('created').string()
      const criadoDia = criadoStr.slice(0, 10)
      if (criadoDia && (!primeiraCriacao || criadoDia < primeiraCriacao)) {
        primeiraCriacao = criadoDia
      }
      const fimStr = ultimoEventoPorProjeto[key] || criadoStr
      let cicloDias = 0
      try {
        // normaliza "2026-10-06 10:00:00.000Z" → ISO válido (evita 'ZZ' que quebra o parse)
        const norm = (s) => {
          let x = s.replace(' ', 'T')
          if (x.charAt(x.length - 1) === 'Z') x = x.slice(0, -1)
          return x + 'Z'
        }
        const t1 = new Date(norm(criadoStr)).getTime()
        const t2 = new Date(norm(fimStr)).getTime()
        if (!isNaN(t1) && !isNaN(t2) && t2 >= t1) {
          cicloDias = Math.round(((t2 - t1) / 86400000) * 10) / 10
        }
      } catch (_) {}
      const touchMin = touchPorProjeto[key] || 0
      const touchDias = Math.round((touchMin / 60 / 24) * 10) / 10
      const esperaDias = Math.max(0, Math.round((cicloDias - touchDias) * 10) / 10)

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
        ciclo_dias: cicloDias,
        touch_min: touchMin,
        touch_dias: touchDias,
        espera_dias: esperaDias,
        incompleto: touchMin === 0,
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

    // T1.13: BASELINE do piloto (CA-1-033/037) — objeto calculado, não declarativo
    const periodoInicio = primeiraCriacao || hojeBRT
    let periodoDias = 0
    try {
      const t1 = new Date(periodoInicio + 'T00:00:00Z').getTime()
      periodoDias = Math.max(0, Math.round(((hojeMs - t1) / 86400000) * 10) / 10)
    } catch (_) {}
    const baseline = {
      tipo: 'baseline — primeiro ciclo do piloto',
      periodo_inicio: periodoInicio,
      periodo_fim: hojeBRT,
      periodo_dias: periodoDias,
      relogio: 'dias corridos, fuso BRT (UTC-3)',
      amostra: {
        projetos: itens.length,
        apontamentos_ativos: amostraApontamentos,
        eventos_auditoria: amostraEventos,
        corte: corte + ' registros mais recentes por fonte',
      },
      limitacoes: [
        'Baseline é o PRIMEIRO ciclo — não é ganho; não há comparação pós-baseline (CA-1-037).',
        'Touch time vem de apontamento manual (append-only, auditado) — risco de gameabilidade declarado na SPEC; eventos automáticos ficam separados.',
        'Espera = ciclo − touch (piso 0) — aproximação, não medição direta.',
        'Amostra cortada em ' +
          corte +
          ' registros mais recentes por fonte (projetos, apontamentos, eventos).',
        'Projetos sem apontamento aparecem como incompletos — dado ausente não é zero.',
      ],
    }

    // T1.14: CADA CONSULTA auditada (CA-1-036) — ator, filtros, nº de linhas
    const filtrosTxt =
      'etapa=' +
      (fEtapa || '-') +
      '; prioridade=' +
      (fPrioridade || '-') +
      '; owner=' +
      (fOwner || '-') +
      '; atraso=' +
      (fAtraso ? 1 : 0) +
      '; bloqueio=' +
      (fBloqueio ? 1 : 0) +
      '; encerrados=' +
      (fEncerrados ? 1 : 0)
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const logConsulta = new Record(auditCol)
    logConsulta.set('actor_id', auth.id)
    logConsulta.set('actor_email', auth.getString('email'))
    logConsulta.set('action', 'painel_consulta')
    logConsulta.set('project_key', '')
    logConsulta.set(
      'detail',
      'consulta ao painel — ' + filtrosTxt + ' — ' + itens.length + ' linhas',
    )
    $app.save(logConsulta)

    return e.json(200, {
      totais: totais,
      porEtapa: ordenar(porEtapa),
      porResponsavel: ordenar(porResponsavel),
      porPrioridade: ordenar(porPrioridade),
      lista: itens.slice(0, 100),
      totalLista: itens.length,
      baseline: baseline,
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
