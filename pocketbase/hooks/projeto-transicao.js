// T1.5 — Transição de etapa com validação de critérios da esteira ativa (CA-1-015/016).
// POST /backend/v1/projects/{key}/transicao — admin/líder executam; consultor/revisor não.
// Válida: atualiza etapa + histórico com ator/horário e versão da esteira usada.
// Inválida (critério de entrada não atendido): bloqueada e auditada (transition_blocked).
routerAdd(
  'POST',
  '/backend/v1/projects/{key}/transicao',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const projectKey = e.request.pathValue('key')
    const papel = auth.getString('role')
    const podeGlobal = papel === 'admin' || papel === 'lider'

    // Consultor/revisor movem somente projetos com vínculo (SPEC-1-003: "líder e consultor ...
    // só realizam transições válidas"); admin/líder movem qualquer projeto.
    if (!podeGlobal) {
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
        logNeg.set('action', 'transition_blocked')
        logNeg.set('project_key', projectKey)
        logNeg.set('detail', 'transição sem vínculo ao projeto')
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

    const data = new DynamicModel({ destino: '', kickoff_date: '' })
    e.bindBody(data)
    const destino = (data.destino || '').trim()
    if (!destino) throw new BadRequestError('Etapa de destino é obrigatória.')

    // Etapa de destino deve existir na esteira ativa
    let etapaDestino = null
    try {
      etapaDestino = $app.findFirstRecordByData('pipeline_stages', 'name', destino)
    } catch (_) {
      throw new BadRequestError('Etapa de destino não existe na esteira ativa.')
    }

    const etapaAtual = p.getString('stage')
    const ordemAtual = (() => {
      try {
        return $app.findFirstRecordByData('pipeline_stages', 'name', etapaAtual).getInt('ordem')
      } catch (_) {
        return 0
      }
    })()
    const ordemDestino = etapaDestino.getInt('ordem')

    // Transição válida: para frente (ordem maior) ou retorno imediato para a etapa anterior
    if (ordemDestino <= ordemAtual) {
      // Auditoria da recusa estrutural
      const auditCol = $app.findCollectionByNameOrId('audit_log')
      const logNeg = new Record(auditCol)
      logNeg.set('actor_id', auth.id)
      logNeg.set('actor_email', auth.getString('email'))
      logNeg.set('action', 'transition_blocked')
      logNeg.set('project_key', projectKey)
      logNeg.set('detail', 'transição para trás ou mesma etapa: ' + etapaAtual + ' → ' + destino)
      $app.save(logNeg)
      throw new BadRequestError(
        'Transição inválida: "' + destino + '" não vem depois de "' + etapaAtual + '" na esteira.',
      )
    }

    // Critérios de entrada da etapa de destino
    let requires = []
    try {
      requires = JSON.parse(etapaDestino.getString('entry_requires') || '[]')
    } catch (_) {
      requires = []
    }
    const faltando = []
    for (const r of requires) {
      if (r === 'kickoff_date') {
        const kickoffInformada = (data.kickoff_date || '').trim()
        if (kickoffInformada) {
          p.set('kickoff_date', kickoffInformada.replace('T', ' ').replace('Z', ''))
        }
        if (!p.getString('kickoff_date')) faltando.push('data de kick-off')
      }
    }

    if (faltando.length > 0) {
      // CA-1-016: critério incompleto bloqueia a transição e registra
      const auditCol = $app.findCollectionByNameOrId('audit_log')
      const logNeg = new Record(auditCol)
      logNeg.set('actor_id', auth.id)
      logNeg.set('actor_email', auth.getString('email'))
      logNeg.set('action', 'transition_blocked')
      logNeg.set('project_key', projectKey)
      logNeg.set(
        'detail',
        etapaAtual + ' → ' + destino + ': critério não atendido (' + faltando.join(', ') + ')',
      )
      $app.save(logNeg)
      throw new BadRequestError(
        'Transição bloqueada — critério de entrada não atendido: ' + faltando.join(', ') + '.',
      )
    }

    // Versão ativa da esteira no momento da transição
    let versaoAtiva = 0
    try {
      versaoAtiva = $app
        .findFirstRecordByData('pipeline_versions', 'active_version', true)
        .getInt('version')
    } catch (_) {
      versaoAtiva = 0
    }

    p.set('stage', destino)
    p.set('pipeline_version', versaoAtiva)
    $app.save(p)

    // T1.8 — Handoff automático da etapa (CA-1-023): chave determinística
    // etapa:{projeto}:{destino} — reprocessar a transição NÃO duplica a tarefa.
    const handoffKey = 'etapa:' + projectKey + ':' + destino
    let handoffInfo = null
    let existente = null
    try {
      existente = $app.findFirstRecordByData('handoffs', 'handoff_key', handoffKey)
    } catch (_) {
      existente = null
    }
    if (existente) {
      // Retry da transição: tenta conservada no histórico, sem duplicar estado
      const retries = (existente.getInt('retry_count') || 0) + 1
      existente.set('retry_count', retries)
      $app.save(existente)
      const auditColR = $app.findCollectionByNameOrId('audit_log')
      const logR = new Record(auditColR)
      logR.set('actor_id', auth.id)
      logR.set('actor_email', auth.getString('email'))
      logR.set('action', 'handoff_retry')
      logR.set('project_key', projectKey)
      logR.set('detail', 'handoff reprocessado (retry ' + retries + '): ' + handoffKey)
      $app.save(logR)
      handoffInfo = {
        retry: true,
        handoff_key: handoffKey,
        task_id: existente.getString('task_id') || null,
      }
    } else {
      const tasksCol = $app.findCollectionByNameOrId('tasks')
      const recH = new Record(tasksCol)
      recH.set('project_key', projectKey)
      recH.set('titulo', 'Handoff — ' + destino)
      recH.set(
        'descricao',
        'Tarefa de handoff gerada automaticamente na transição para "' + destino + '".',
      )
      recH.set('assignee_id', p.getString('owner_id'))
      recH.set('due_date', p.getDateTime('due_date').string().slice(0, 10))
      recH.set('status', 'pendente')
      recH.set('evidencia_esperada', 'handoff registrado e fila atualizada')
      recH.set('created_by', auth.id)
      $app.save(recH)
      const handoffsCol = $app.findCollectionByNameOrId('handoffs')
      const h = new Record(handoffsCol)
      h.set('handoff_key', handoffKey)
      h.set('project_key', projectKey)
      h.set('task_id', recH.id)
      h.set('retry_count', 0)
      h.set('created_by', auth.id)
      $app.save(h)
      const auditColH = $app.findCollectionByNameOrId('audit_log')
      const logH = new Record(auditColH)
      logH.set('actor_id', auth.id)
      logH.set('actor_email', auth.getString('email'))
      logH.set('action', 'handoff_created')
      logH.set('project_key', projectKey)
      logH.set('detail', 'handoff gerado: ' + handoffKey + ' → tarefa "Handoff — ' + destino + '"')
      $app.save(logH)
      handoffInfo = { retry: false, handoff_key: handoffKey, task_id: recH.id }
    }

    // CA-1-015: histórico da transição com ator e horário
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(auditCol)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'stage_transition')
    log.set('project_key', projectKey)
    log.set(
      'detail',
      etapaAtual +
        ' → ' +
        destino +
        ' (esteira v' +
        versaoAtiva +
        (faltando.length ? '' : '') +
        ')',
    )
    $app.save(log)

    return e.json(200, {
      project_key: projectKey,
      stage: destino,
      pipeline_version: versaoAtiva,
      previous_stage: etapaAtual,
      handoff: handoffInfo,
    })
  },
  $apis.requireAuth(),
)
