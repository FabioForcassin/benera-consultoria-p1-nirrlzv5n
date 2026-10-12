// T1.7 — Criar tarefa com checklist: admin/líder em qualquer projeto; consultor/revisor
// somente em projetos com vínculo (mesma regra de transição da T1.5/T1.6).
// Validações server-side (CA-1-019): responsável existe e está ativo; prazo no passado
// é recusado (política conservadora); status nasce 'pendente'; evidência esperada obrigatória.
// Auditado: task_created (CA-1-025).
routerAdd(
  'POST',
  '/backend/v1/projects/{key}/tasks',
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
        logNeg.set('detail', 'criar tarefa sem vínculo ao projeto')
        $app.save(logNeg)
        return e.forbiddenError('Você não tem vínculo com este projeto.')
      }
    }

    // Projeto precisa existir (e estar ativo)
    let p = null
    try {
      p = $app.findFirstRecordByData('projects', 'project_key', projectKey)
    } catch (_) {
      return e.notFoundError('Projeto não encontrado.')
    }
    if (!p.getBool('active')) {
      throw new BadRequestError('Projeto inativo não recebe tarefas.')
    }

    const data = new DynamicModel({
      titulo: '',
      descricao: '',
      assignee_id: '',
      due_date: '',
      evidencia_esperada: '',
      itens: '',
    })
    e.bindBody(data)

    const titulo = (data.titulo || '').trim()
    const descricao = (data.descricao || '').trim()
    const assigneeId = (data.assignee_id || '').trim()
    const dueDate = (data.due_date || '').trim()
    const evidencia = (data.evidencia_esperada || '').trim()

    const faltantes = []
    if (titulo.length < 3) faltantes.push('titulo')
    if (!assigneeId) faltantes.push('assignee_id')
    if (!dueDate) faltantes.push('due_date')
    if (evidencia.length < 3) faltantes.push('evidencia_esperada')
    if (faltantes.length > 0) {
      const errors = {}
      for (const f of faltantes) {
        errors[f] = new ValidationError('validation_required', 'Campo obrigatório.')
      }
      throw new BadRequestError('Campos obrigatórios faltando.', errors)
    }

    // Caminho de erro obrigatório: dono inexistente/inativo
    let assignee = null
    try {
      assignee = $app.findRecordById('_pb_users_auth_', assigneeId)
    } catch (_) {
      throw new BadRequestError('Responsável não encontrado.')
    }
    if (!assignee.getBool('verified')) {
      throw new BadRequestError('Responsável inativo (não verificado).')
    }

    // Caminho de erro obrigatório: prazo no passado (comparação lexicográfica segura,
    // padrão do projetos-listar). Aceita "YYYY-MM-DD" ou datetime ISO.
    const hojeStr = new Date().toISOString().slice(0, 10)
    const dueDia = dueDate.slice(0, 10)
    if (dueDia < hojeStr) {
      throw new BadRequestError('Prazo no passado não é permitido.')
    }

    // Itens do checklist (opcional na criação; array de {titulo, obrigatorio})
    let itens = []
    if ((data.itens || '').trim()) {
      try {
        const raw = JSON.parse(data.itens)
        if (Array.isArray(raw)) itens = raw
      } catch (_) {
        throw new BadRequestError('Itens do checklist inválidos.')
      }
    }

    const col = $app.findCollectionByNameOrId('tasks')
    const rec = new Record(col)
    rec.set('project_key', projectKey)
    rec.set('titulo', titulo)
    rec.set('descricao', descricao)
    rec.set('assignee_id', assigneeId)
    rec.set('due_date', dueDate.replace('T', ' ').replace('Z', ''))
    rec.set('status', 'pendente')
    rec.set('evidencia_esperada', evidencia)
    rec.set('created_by', auth.id)
    $app.save(rec)

    const itemsCol = $app.findCollectionByNameOrId('task_items')
    let ordem = 1
    for (const it of itens) {
      const t = ((it && it.titulo) || '').trim()
      if (!t) continue
      const item = new Record(itemsCol)
      item.set('task_id', rec.id)
      item.set('titulo', t)
      item.set('obrigatorio', it && it.obrigatorio ? true : false)
      item.set('concluido', false)
      item.set('ordem', ordem)
      $app.save(item)
      ordem = ordem + 1
    }

    // Auditoria (CA-1-025)
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(auditCol)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'task_created')
    log.set('project_key', projectKey)
    log.set('detail', 'tarefa criada: ' + titulo + ' → ' + assignee.getString('email'))
    $app.save(log)

    return e.json(201, {
      id: rec.id,
      project_key: projectKey,
      titulo: titulo,
      assignee_id: assigneeId,
      due_date: dueDia,
      status: 'pendente',
      evidencia_esperada: evidencia,
      itens: ordem - 1,
    })
  },
  $apis.requireAuth(),
)
