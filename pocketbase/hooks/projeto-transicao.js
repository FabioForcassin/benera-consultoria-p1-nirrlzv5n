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
    if (!auth || (auth.get('role') !== 'admin' && auth.get('role') !== 'lider')) {
      return e.forbiddenError('Somente administrador ou líder podem mover o projeto de etapa.')
    }

    const projectKey = e.request.pathValue('key')
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
    })
  },
  $apis.requireAuth(),
)
