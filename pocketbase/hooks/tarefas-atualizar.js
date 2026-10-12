// T1.7 — Atualizar tarefa e itens do checklist.
// PATCH /backend/v1/tasks/{id} — quem pode: admin/líder (qualquer projeto); consultor/revisor
// com vínculo ao projeto da tarefa (sem vínculo = 403 auditado).
// Regras server-side (CA-1-020): só admin/líder (ou criador) alteram itens; consultor marca
// conclusão de item; CONCLUSÃO DA TAREFA é recusada com item obrigatório pendente (400 nomeando
// os itens). Reabrir tarefa concluída volta para 'pendente' (auditado).
// Auditado: task_updated / task_completed (CA-1-025).
routerAdd(
  'PATCH',
  '/backend/v1/tasks/{id}',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    let t = null
    try {
      t = $app.findRecordById('tasks', e.request.pathValue('id'))
    } catch (_) {
      return e.notFoundError('Tarefa não encontrada.')
    }
    const projectKey = t.getString('project_key')
    const papel = auth.getString('role')
    const podeGlobal = papel === 'admin' || papel === 'lider'

    // Vínculo obrigatório para consultor/revisor
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
        logNeg.set('detail', 'atualizar tarefa sem vínculo ao projeto')
        $app.save(logNeg)
        return e.forbiddenError('Você não tem vínculo com este projeto.')
      }
    }

    const data = new DynamicModel({
      status: '',
      itens: '',
      evidencia: '',
    })
    e.bindBody(data)
    const novoStatus = (data.status || '').trim()
    const itensJson = (data.itens || '').trim()
    const evidencia = (data.evidencia || '').trim()

    if (!novoStatus && !itensJson && !evidencia) {
      throw new BadRequestError('Nada para atualizar (informe status, itens ou evidência).')
    }

    const eventos = []
    const statusAnterior = t.getString('status')

    // --- Itens do checklist ---
    if (itensJson) {
      let itens = null
      try {
        itens = JSON.parse(itensJson)
      } catch (_) {
        throw new BadRequestError('Itens inválidos.')
      }
      if (!Array.isArray(itens)) throw new BadRequestError('Itens inválidos.')

      // Atualização de itens é papel de quem executa (consultor) ou de quem gerencia
      // (admin/líder); o criador da tarefa também pode ajustar (mesmo sem papel global).
      const ehCriador = t.getString('created_by') === auth.id
      if (!podeGlobal && !ehCriador && papel !== 'consultor' && papel !== 'revisor') {
        throw new BadRequestError('Sem permissão para alterar itens do checklist.')
      }

      for (const it of itens) {
        if (!it || !it.id) continue
        let item = null
        try {
          item = $app.findRecordById('task_items', String(it.id))
        } catch (_) {
          throw new BadRequestError('Item do checklist não encontrado: ' + String(it.id))
        }
        // Item deve pertencer à tarefa
        if (item.getString('task_id') !== t.id) {
          throw new BadRequestError('Item não pertence a esta tarefa.')
        }
        if (typeof it.concluido === 'boolean') {
          item.set('concluido', it.concluido)
          $app.save(item)
        }
      }
    }

    // --- Evidência (texto descritivo nesta task; anexo entra na T1.10) ---
    if (evidencia) {
      t.set('evidencia_esperada', evidencia.slice(0, 500))
    }

    // --- Status ---
    if (novoStatus) {
      if (novoStatus !== 'pendente' && novoStatus !== 'concluida') {
        throw new BadRequestError('Status inválido (use pendente ou concluida).')
      }

      if (novoStatus === 'concluida') {
        // CA-1-020: item obrigatório pendente bloqueia a conclusão
        const itensTarefa = $app.findRecordsByFilter(
          'task_items',
          'task_id = {:tid} && obrigatorio = true && concluido = false',
          'ordem',
          100,
          0,
          { tid: t.id },
        )
        if (itensTarefa.length > 0) {
          const nomes = []
          for (const it of itensTarefa) nomes.push(it.getString('titulo'))
          throw new BadRequestError(
            'Conclusão bloqueada — item obrigatório pendente: ' + nomes.join('; '),
          )
        }
        t.set('status', 'concluida')
        $app.save(t)
        eventos.push('task_completed')
      } else {
        // Reabrir tarefa concluída (volta para pendente, auditado)
        t.set('status', 'pendente')
        $app.save(t)
        eventos.push('task_updated')
      }
    } else if (itensJson || evidencia) {
      t.set('updated', new Date().toISOString().replace('T', ' ').slice(0, 19) + '.000Z')
      $app.save(t)
      eventos.push('task_updated')
    }

    // --- Auditoria ---
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    for (const ev of eventos) {
      const log = new Record(auditCol)
      log.set('actor_id', auth.id)
      log.set('actor_email', auth.getString('email'))
      log.set('action', ev)
      log.set('project_key', projectKey)
      log.set(
        'detail',
        'tarefa: ' +
          t.getString('titulo') +
          ' (' +
          statusAnterior +
          ' → ' +
          t.getString('status') +
          ')',
      )
      $app.save(log)
    }

    return e.json(200, {
      id: t.id,
      titulo: t.getString('titulo'),
      status: t.getString('status'),
      evidencia_esperada: t.getString('evidencia_esperada'),
    })
  },
  $apis.requireAuth(),
)
