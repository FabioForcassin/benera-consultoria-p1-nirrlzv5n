// T1.7+T1.8 — Atualizar tarefa e itens do checklist; bloqueio e retorno (CA-1-020/021/022).
// PATCH /backend/v1/tasks/{id} — quem pode: admin/líder (qualquer projeto); consultor/revisor
// com vínculo ao projeto da tarefa (sem vínculo = 403 auditado).
// Regras server-side:
//   CA-1-020: conclusão recusada com item obrigatório pendente (400 nomeando os itens).
//   CA-1-021: bloqueio EXIGE motivo + dono + data de revisão (falta qualquer um = 400 sem
//             alterar a tarefa); liberar volta a pendente (auditado).
//   CA-1-022: retorno para correção EXIGE motivo; responsável PRESERVADO; auditado.
// Auditado: task_blocked / task_unblocked / task_returned / task_updated / task_completed.
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
      bloqueio_motivo: '',
      bloqueio_dono: '',
      bloqueio_revisao: '',
      retorno_motivo: '',
    })
    e.bindBody(data)
    const novoStatus = (data.status || '').trim()
    const itensJson = (data.itens || '').trim()
    const evidencia = (data.evidencia || '').trim()
    const bloqueioMotivo = (data.bloqueio_motivo || '').trim()
    const bloqueioDono = (data.bloqueio_dono || '').trim()
    const bloqueioRevisao = (data.bloqueio_revisao || '').trim()
    const retornoMotivo = (data.retorno_motivo || '').trim()

    if (
      !novoStatus &&
      !itensJson &&
      !evidencia &&
      !bloqueioMotivo &&
      !bloqueioDono &&
      !bloqueioRevisao &&
      !retornoMotivo
    ) {
      throw new BadRequestError(
        'Nada para atualizar (informe status, itens, evidência, bloqueio ou retorno).',
      )
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
        if (item.getString('task_id') !== t.id) {
          throw new BadRequestError('Item não pertence a esta tarefa.')
        }
        if (typeof it.concluido === 'boolean') {
          item.set('concluido', it.concluido)
          $app.save(item)
        }
      }
    }

    // --- Evidência (texto descritivo; anexo entra na T1.10) ---
    if (evidencia) {
      t.set('evidencia_esperada', evidencia.slice(0, 500))
    }

    // --- Bloqueio (CA-1-021): motivo + dono + data de revisão obrigatórios ---
    const pediuBloqueio =
      novoStatus === 'bloqueada' || bloqueioMotivo || bloqueioDono || bloqueioRevisao
    if (pediuBloqueio) {
      if (t.getString('status') === 'concluida') {
        throw new BadRequestError(
          'Tarefa concluída não pode ser bloqueada — devolva para correção.',
        )
      }
      const faltandoBloqueio = []
      if (!bloqueioMotivo) faltandoBloqueio.push('motivo')
      if (!bloqueioDono) faltandoBloqueio.push('dono')
      if (!bloqueioRevisao) faltandoBloqueio.push('data de revisão')
      if (faltandoBloqueio.length > 0) {
        // Salvamento RECUSADO sem perder a tarefa (nada é alterado)
        throw new BadRequestError(
          'Bloqueio incompleto — informe: ' + faltandoBloqueio.join(', ') + '.',
        )
      }
      t.set('status', 'bloqueada')
      t.set('bloqueio_motivo', bloqueioMotivo.slice(0, 500))
      t.set('bloqueio_dono', bloqueioDono.slice(0, 200))
      t.set('bloqueio_revisao', bloqueioRevisao.replace('T', ' ').replace('Z', ''))
      $app.save(t)
      eventos.push('task_blocked')
    }

    // --- Retorno para correção (CA-1-022): motivo obrigatório; responsável PRESERVADO ---
    if (retornoMotivo) {
      const statusAgora = t.getString('status')
      if (statusAgora !== 'concluida' && statusAgora !== 'bloqueada' && !pediuBloqueio) {
        throw new BadRequestError(
          'Retorno para correção aplica-se a tarefa concluída ou bloqueada.',
        )
      }
      t.set('status', 'pendente')
      t.set('retorno_motivo', retornoMotivo.slice(0, 500))
      t.set('retorno_por', auth.getString('email').slice(0, 100))
      // assignee NÃO é alterado — preservado (CA-1-022)
      $app.save(t)
      eventos.push('task_returned')
    }

    // --- Liberar bloqueio (volta a pendente, auditado) ---
    if (novoStatus === 'pendente' && t.getString('status') === 'bloqueada' && !retornoMotivo) {
      t.set('status', 'pendente')
      $app.save(t)
      eventos.push('task_unblocked')
    }

    // --- Status comum (concluida / reabertura simples) ---
    if (novoStatus && novoStatus !== 'bloqueada' && !pediuBloqueio && !retornoMotivo) {
      if (novoStatus !== 'pendente' && novoStatus !== 'concluida') {
        throw new BadRequestError('Status inválido (use pendente, concluida ou bloqueada).')
      }

      if (novoStatus === 'concluida') {
        if (t.getString('status') === 'bloqueada') {
          throw new BadRequestError(
            'Tarefa bloqueada não pode ser concluída — libere o bloqueio antes.',
          )
        }
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
        // Reabrir tarefa concluída SEM motivo = reabertura simples (auditada)
        t.set('status', 'pendente')
        $app.save(t)
        eventos.push('task_updated')
      }
    } else if (!pediuBloqueio && !retornoMotivo && (itensJson || evidencia)) {
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
      bloqueio_motivo: t.getString('bloqueio_motivo'),
      bloqueio_dono: t.getString('bloqueio_dono'),
      bloqueio_revisao: t.getDateTime('bloqueio_revisao').string().slice(0, 10),
      retorno_motivo: t.getString('retorno_motivo'),
    })
  },
  $apis.requireAuth(),
)
