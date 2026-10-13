// T1.8 — Handoff idempotente (CA-1-023).
// POST /backend/v1/projects/{key}/handoff — cria a tarefa de handoff UMA VEZ por handoff_key.
// 1ª chamada: cria tarefa + registro em handoffs → 201.
// Reenvio com a MESMA chave: NÃO duplica — responde 200 com retry: true e incrementa
// retry_count; tentativa conservada no histórico (audit handoff_retry).
// Permissão: admin/líder qualquer projeto; consultor/revisor com vínculo (padrão T1.7).
// Chamado também pela transição de etapa (tarefa gerada automaticamente com chave
// determinística etapa:{projeto}:{destino}) — reprocessar a transição não duplica.
routerAdd(
  'POST',
  '/backend/v1/projects/{key}/handoff',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const projectKey = e.request.pathValue('key')
    const papel = auth.getString('role')
    const podeGlobal = papel === 'admin' || papel === 'lider'

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
        logNeg.set('action', 'access_denied')
        logNeg.set('project_key', projectKey)
        logNeg.set('detail', 'handoff sem vínculo ao projeto')
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

    const data = new DynamicModel({
      handoff_key: '',
      titulo: '',
      descricao: '',
      assignee_id: '',
      due_date: '',
      evidencia_esperada: '',
    })
    e.bindBody(data)

    const handoffKey = (data.handoff_key || '').trim()
    if (!handoffKey) throw new BadRequestError('handoff_key é obrigatória (idempotência).')

    const auditCol = $app.findCollectionByNameOrId('audit_log')

    // --- Idempotência: chave já usada? Não duplica. ---
    let existente = null
    try {
      existente = $app.findFirstRecordByData('handoffs', 'handoff_key', handoffKey)
    } catch (_) {
      existente = null
    }
    if (existente) {
      // CA-1-023: mesmo handoff duas vezes → uma tarefa criada, retry identificado,
      // tentativa conservada no histórico sem duplicar estado.
      const retries = (existente.getInt('retry_count') || 0) + 1
      existente.set('retry_count', retries)
      existente.set('updated', new Date().toISOString().replace('T', ' ').slice(0, 19) + '.000Z')
      $app.save(existente)

      const log = new Record(auditCol)
      log.set('actor_id', auth.id)
      log.set('actor_email', auth.getString('email'))
      log.set('action', 'handoff_retry')
      log.set('project_key', projectKey)
      log.set('detail', 'handoff reprocessado (retry ' + retries + '): ' + handoffKey)
      $app.save(log)

      return e.json(200, {
        retry: true,
        retry_count: retries,
        handoff_key: handoffKey,
        task_id: existente.getString('task_id') || null,
      })
    }

    // --- Primeira execução: cria a tarefa de handoff ---
    const titulo = (data.titulo || '').trim() || 'Handoff — próxima etapa'
    const descricao = (data.descricao || '').trim()
    // Assignee padrão: responsável do projeto (owner); pode ser informado.
    let assigneeId = (data.assignee_id || '').trim()
    if (!assigneeId) assigneeId = p.getString('owner_id')
    const dueDate = (data.due_date || '').trim() || p.getDateTime('due_date').string().slice(0, 10)
    const evidencia =
      (data.evidencia_esperada || '').trim() || 'handoff registrado e fila atualizada'

    // Validações mínimas (reuso das regras da T1.7 — adapta-divida: extrair função
    // compartilhada quando aparecer o 3º consumidor de criação de tarefa)
    let assignee = null
    try {
      assignee = $app.findRecordById('_pb_users_auth_', assigneeId)
    } catch (_) {
      throw new BadRequestError('Responsável não encontrado.')
    }
    if (!assignee.getBool('verified')) {
      throw new BadRequestError('Responsável inativo (não verificado).')
    }

    const tasksCol = $app.findCollectionByNameOrId('tasks')
    const rec = new Record(tasksCol)
    rec.set('project_key', projectKey)
    rec.set('titulo', titulo)
    rec.set('descricao', descricao)
    rec.set('assignee_id', assigneeId)
    rec.set('due_date', dueDate.replace('T', ' ').replace('Z', ''))
    rec.set('status', 'pendente')
    rec.set('evidencia_esperada', evidencia)
    rec.set('created_by', auth.id)
    $app.save(rec)

    // Registro do handoff (chave única garante single-execution)
    const handoffsCol = $app.findCollectionByNameOrId('handoffs')
    const h = new Record(handoffsCol)
    h.set('handoff_key', handoffKey)
    h.set('project_key', projectKey)
    h.set('task_id', rec.id)
    h.set('retry_count', 0)
    h.set('created_by', auth.id)
    $app.save(h)

    const log = new Record(auditCol)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'handoff_created')
    log.set('project_key', projectKey)
    log.set('detail', 'handoff gerado: ' + handoffKey + ' → tarefa "' + titulo + '"')
    $app.save(log)

    return e.json(201, {
      retry: false,
      handoff_key: handoffKey,
      task_id: rec.id,
      titulo: titulo,
      assignee_id: assigneeId,
      status: 'pendente',
    })
  },
  $apis.requireAuth(),
)
