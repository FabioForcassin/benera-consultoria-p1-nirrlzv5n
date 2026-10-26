// T1.14 — Exportação sanitizada e auditada (CA-1-034/035/036).
// GET /backend/v1/exportar?formato=csv|json — mesmos filtros do painel.
// PERMISSÃO (CA-1-035): só admin/líder — consultor/revisor levam 403 AUDITADO
// (access_denied); formato inválido → 400.
// SANITIZAÇÃO (CA-1-034): TODA célula de texto iniciada com = + - @ tab ou CR recebe
// apóstrofo ANTES da entrega — "=1+1" vira texto inerte, não fórmula executável.
// DETERMINISMO: o corpo do arquivo NÃO leva timestamp (gerado_em vai no envelope da
// resposta e na auditoria) — 2 exportações seguidas = bytes idênticos.
// AUDITORIA (CA-1-036): export_realizada com ator, formato, filtros e nº de linhas.
// O arquivo só é montado no navegador após a resposta 200 completa (envelope com o
// conteúdo pronto) — nada parcial é entregue.
routerAdd(
  'GET',
  '/backend/v1/exportar',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const papel = auth.getString('role')
    if (papel !== 'admin' && papel !== 'lider') {
      const auditCol = $app.findCollectionByNameOrId('audit_log')
      const logNeg = new Record(auditCol)
      logNeg.set('actor_id', auth.id)
      logNeg.set('actor_email', auth.getString('email'))
      logNeg.set('action', 'access_denied')
      logNeg.set('project_key', '')
      logNeg.set('detail', 'exportação negada — papel ' + papel + ' sem permissão de exportar')
      $app.save(logNeg)
      return e.forbiddenError('Somente administrador ou líder podem exportar dados.')
    }

    // formato
    let formato = ''
    try {
      formato = (e.request.url.query().get('formato') || '').trim().toLowerCase()
    } catch (_) {
      try {
        formato = (e.request.url().query().get('formato') || '').trim().toLowerCase()
      } catch (_) {}
    }
    if (formato !== 'csv' && formato !== 'json') {
      throw new BadRequestError('Formato inválido — use csv ou json.')
    }

    // filtros (mesmos do painel)
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

    // corte da amostra vem da configuração (T1.14) — mudar config muda o relatório
    let corte = 500
    try {
      const cfg = $app.findFirstRecordByData('painel_config', 'chave', 'corte_eventos')
      corte = Math.floor(Number(cfg.get('valor')) || 500)
    } catch (_) {}

    // hoje em BRT (UTC-3) — lição T1.7
    const hojeBRT = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
    const hojeMs = Date.now()

    // mapa de usuários
    const usuarios = {}
    try {
      const us = $app.findRecordsByFilter('_pb_users_auth_', 'id != ""', '-created', corte, 0)
      for (const u of us) {
        usuarios[u.id] = { email: u.getString('email'), name: u.getString('name') }
      }
    } catch (_) {}

    // tarefas bloqueadas por projeto
    const bloqueadas = {}
    try {
      const tb = $app.findRecordsByFilter('tasks', "status = 'bloqueada'", '-created', corte, 0)
      for (const t of tb) {
        const pk = t.getString('project_key')
        bloqueadas[pk] = (bloqueadas[pk] || 0) + 1
      }
    } catch (_) {}

    // apontamentos ATIVOS por projeto + amostra
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

    // último evento de auditoria por projeto (fim do ciclo) + amostra
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

    // projetos → itens com flags + métricas (mesma lógica do painel)
    const itens = []
    let primeiraCriacao = ''
    const projetos = $app.findRecordsByFilter('projects', 'id != ""', '-created', corte, 0)
    for (const p of projetos) {
      const key = p.getString('project_key')
      const stage = p.getString('stage')
      const active = p.getBool('active')
      const encerrado = stage === 'Encerrado' || !active
      const dueStr = p.getDateTime('due_date').string()
      const due = dueStr.indexOf('0001-') === 0 ? '' : dueStr.slice(0, 10)
      const atrasado = !encerrado && !!due && due < hojeBRT
      const ownerId = p.getString('owner_id')

      const criadoStr = p.getDateTime('created').string()
      const criadoDia = criadoStr.slice(0, 10)
      if (criadoDia && (!primeiraCriacao || criadoDia < primeiraCriacao)) {
        primeiraCriacao = criadoDia
      }
      const fimStr = ultimoEventoPorProjeto[key] || criadoStr
      let cicloDias = 0
      try {
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
      if (fEtapa && stage !== fEtapa) continue
      if (fPrioridade && item.priority !== fPrioridade) continue
      if (fAtraso && !atrasado) continue
      if (fOwner && ownerId !== fOwner) continue
      if (fBloqueio && !item.bloqueado) continue
      if (!fEncerrados && encerrado) continue
      itens.push(item)
    }

    // totais sobre o resultado filtrado
    const totais = { ativos: 0, atrasados: 0, bloqueados: 0, encerrados: 0 }
    for (const it of itens) {
      if (it.encerrado) totais.encerrados++
      else totais.ativos++
      if (it.atrasado) totais.atrasados++
      if (it.bloqueado) totais.bloqueados++
    }

    // baseline (igual ao painel, com o corte configurável)
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

    // sanitização server-side de TODAS as células de texto (CA-1-034)
    const sanitizar = (v) => {
      if (v === null || v === undefined) return ''
      let s = String(v)
      if (s.length > 0) {
        const c = s.charAt(0)
        if (c === '=' || c === '+' || c === '-' || c === '@' || c === '\t' || c === '\r') {
          s = "'" + s
        }
      }
      return s
    }
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

    let conteudo = ''
    if (formato === 'csv') {
      const esc = (v) => {
        let s = sanitizar(v)
        if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
        return s
      }
      const linha = (cols) => {
        const r = cols.map(esc)
        while (r.length < 15) r.push('')
        return r.join(',')
      }
      const linhas = []
      linhas.push(
        linha([
          'Seção',
          'Chave',
          'Valor',
          'Extra 1',
          'Extra 2',
          'Extra 3',
          'Extra 4',
          'Extra 5',
          'Extra 6',
          'Extra 7',
          'Extra 8',
          'Extra 9',
          'Extra 10',
          'Extra 11',
          'Extra 12',
        ]),
      )
      linhas.push(
        linha([
          'METADADO',
          'relatorio',
          'Painel operacional Benera — exportação sanitizada (T1.14)',
        ]),
      )
      linhas.push(linha(['METADADO', 'filtros', filtrosTxt]))
      linhas.push(
        linha([
          'METADADO',
          'totais',
          'ativos=' +
            totais.ativos +
            '; atrasados=' +
            totais.atrasados +
            '; bloqueados=' +
            totais.bloqueados +
            '; encerrados=' +
            totais.encerrados,
        ]),
      )
      linhas.push(linha(['METADADO', 'linhas', itens.length + ' projetos no filtro atual']))
      linhas.push(linha(['BASELINE', 'tipo', baseline.tipo]))
      linhas.push(
        linha([
          'BASELINE',
          'periodo',
          baseline.periodo_inicio +
            ' → ' +
            baseline.periodo_fim +
            ' (' +
            baseline.periodo_dias +
            ' dias)',
        ]),
      )
      linhas.push(linha(['BASELINE', 'relogio', baseline.relogio]))
      linhas.push(
        linha([
          'BASELINE',
          'amostra',
          baseline.amostra.projetos +
            ' projetos · ' +
            baseline.amostra.apontamentos_ativos +
            ' apontamentos · ' +
            baseline.amostra.eventos_auditoria +
            ' eventos (corte: ' +
            baseline.amostra.corte +
            ')',
        ]),
      )
      for (let i = 0; i < baseline.limitacoes.length; i++) {
        linhas.push(linha(['BASELINE', 'limitacao_' + (i + 1), baseline.limitacoes[i]]))
      }
      for (const it of itens) {
        linhas.push(
          linha([
            'PROJETO',
            it.project_key,
            it.name,
            it.stage,
            it.priority,
            it.owner_email,
            it.due_date || 'sem prazo',
            it.atrasado ? 'SIM' : 'NAO',
            it.bloqueado ? 'SIM' : 'NAO',
            it.encerrado ? 'SIM' : 'NAO',
            it.ciclo_dias,
            it.touch_min,
            it.touch_dias,
            it.espera_dias,
            it.incompleto ? 'INCOMPLETO (sem apontamento)' : 'completo',
          ]),
        )
      }
      linhas.push(linha(['TOTAL', '', itens.length + ' projetos no filtro atual']))
      conteudo = linhas.join('\r\n') + '\r\n'
    } else {
      const listaSan = itens.map((it) => ({
        project_key: sanitizar(it.project_key),
        name: sanitizar(it.name),
        stage: sanitizar(it.stage),
        priority: sanitizar(it.priority),
        owner_email: sanitizar(it.owner_email),
        due_date: sanitizar(it.due_date),
        atrasado: it.atrasado,
        bloqueado: it.bloqueado,
        encerrado: it.encerrado,
        ciclo_dias: it.ciclo_dias,
        touch_min: it.touch_min,
        touch_dias: it.touch_dias,
        espera_dias: it.espera_dias,
        incompleto: it.incompleto,
      }))
      conteudo = JSON.stringify(
        {
          relatorio: 'Painel operacional Benera — exportação sanitizada (T1.14)',
          filtros: {
            etapa: fEtapa,
            prioridade: fPrioridade,
            owner: fOwner,
            atraso: fAtraso,
            bloqueio: fBloqueio,
            encerrados: fEncerrados,
          },
          totais: totais,
          baseline: baseline,
          total_linhas: itens.length,
          lista: listaSan,
        },
        null,
        2,
      )
    }

    const geradoEm =
      new Date(Date.now() - 3 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' BRT'
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(auditCol)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'export_realizada')
    log.set('project_key', '')
    log.set(
      'detail',
      'exportação ' +
        formato +
        ' — ' +
        filtrosTxt +
        ' — ' +
        itens.length +
        ' linhas — gerado em ' +
        geradoEm,
    )
    $app.save(log)

    return e.json(200, {
      formato: formato,
      linhas: itens.length,
      gerado_em: geradoEm,
      filtros: filtrosTxt,
      conteudo: conteudo,
    })
  },
  $apis.requireAuth(),
)
