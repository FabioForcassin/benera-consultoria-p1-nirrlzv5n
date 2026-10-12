// T1.7 — Listar tarefas de um projeto com escopo por vínculo (padrão da carteira):
// admin/líder veem tudo; consultor/revisor só projetos com vínculo (senão 403 auditado).
// Retorna cada tarefa com seus itens de checklist e contagem de pendências obrigatórias.
routerAdd(
  'GET',
  '/backend/v1/projects/{key}/tasks',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const projectKey = e.request.pathValue('key')
    const papel = auth.getString('role')
    const escopoTotal = papel === 'admin' || papel === 'lider'

    if (!escopoTotal) {
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
        logNeg.set('detail', 'listar tarefas sem vínculo ao projeto')
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

    const tarefas = $app.findRecordsByFilter('tasks', 'project_key = {:pk}', '-created', 200, 0, {
      pk: projectKey,
    })

    const resposta = []
    for (const t of tarefas) {
      const itens = $app.findRecordsByFilter('task_items', 'task_id = {:tid}', 'ordem', 100, 0, {
        tid: t.id,
      })
      const itensResp = []
      let pendObrigatorios = 0
      for (const it of itens) {
        const obrig = it.getBool('obrigatorio')
        const concl = it.getBool('concluido')
        if (obrig && !concl) pendObrigatorios = pendObrigatorios + 1
        itensResp.push({
          id: it.id,
          titulo: it.getString('titulo'),
          obrigatorio: obrig,
          concluido: concl,
          ordem: it.getInt('ordem'),
        })
      }

      // Atraso: prazo < hoje e status != concluída (padrão da carteira)
      const agoraStr = new Date().toISOString().slice(0, 10)
      const dueStr = t.getDateTime('due_date').string()
      const atrasada = dueStr.slice(0, 10) < agoraStr && t.getString('status') !== 'concluida'

      resposta.push({
        id: t.id,
        titulo: t.getString('titulo'),
        descricao: t.getString('descricao'),
        assignee_id: t.getString('assignee_id'),
        due_date: dueStr.slice(0, 10),
        status: t.getString('status'),
        evidencia_esperada: t.getString('evidencia_esperada'),
        atrasada: atrasada,
        itens: itensResp,
        pendentes_obrigatorios: pendObrigatorios,
        created: t.getDateTime('created').string(),
      })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)
