// TPL-3 — Listar templates e aplicar num projeto.
//
// GET  /backend/v1/task-templates                → templates ativos (com nº de tarefas)
// GET  /backend/v1/task-templates/{id}           → template + suas tarefas
// POST /backend/v1/projects/{key}/aplicar-template  { template_id, data_inicio? }
//
// Aplicar = criar as tarefas do template no projeto, com prazo calculado:
//   prazo = data_inicio do projeto + folga_semanas da tarefa
//   data_inicio = a informada, ou hoje, ou a data de criação do projeto
//
// Guardas:
//   - só admin/líder aplicam template (é configuração de projeto);
//   - projeto inativo não recebe tarefa;
//   - duplicidade: se a tarefa com o mesmo título já existe no projeto, ela é
//     PULADA (relatório diz quantas foram criadas e quantas puladas). Isso evita
//     o problema de duplo clique criar tarefa fantasma.
//   - auditado como config_changed (nº de tarefas criadas).
routerAdd(
  'GET',
  '/backend/v1/task-templates',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    if (!e.auth) return e.unauthorizedError('Autenticação necessária.')

    const tpls = $app.findRecordsByFilter('task_templates', 'ativo = true', 'nome', 50, 0)
    const resposta = []
    for (const t of tpls) {
      let qtd = 0
      try {
        const itens = $app.findRecordsByFilter(
          'task_template_items',
          'template_id = {:tid} && ativo = true',
          'ordem',
          200,
          0,
          { tid: t.id },
        )
        qtd = itens.length
      } catch (_) {}
      let tipoNome = ''
      try {
        tipoNome = $app
          .findRecordById('service_types', t.getString('service_type_id'))
          .getString('name')
      } catch (_) {}
      resposta.push({
        id: t.id,
        nome: t.getString('nome'),
        descricao: t.getString('descricao'),
        service_type_id: t.getString('service_type_id'),
        service_type_name: tipoNome,
        duracao_semanas: t.getInt('duracao_semanas'),
        tarefas: qtd,
      })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/task-templates/{id}',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    if (!e.auth) return e.unauthorizedError('Autenticação necessária.')

    let t = null
    try {
      t = $app.findRecordById('task_templates', e.request.pathValue('id'))
    } catch (_) {
      return e.notFoundError('Template não encontrado.')
    }
    const itens = $app.findRecordsByFilter(
      'task_template_items',
      'template_id = {:tid} && ativo = true',
      'ordem',
      200,
      0,
      { tid: t.id },
    )
    const lista = []
    for (const i of itens) {
      let check = []
      try {
        check = JSON.parse(i.getString('checklist') || '[]')
      } catch (_) {
        check = []
      }
      lista.push({
        id: i.id,
        ordem: i.getInt('ordem'),
        titulo: i.getString('titulo'),
        etapa: i.getString('etapa'),
        folga_semanas: i.getInt('folga_semanas'),
        duracao_semanas: i.getInt('duracao_semanas'),
        evidencia_esperada: i.getString('evidencia_esperada'),
        obrigatorio: i.getBool('obrigatorio'),
        checklist: check,
      })
    }
    return e.json(200, {
      id: t.id,
      nome: t.getString('nome'),
      descricao: t.getString('descricao'),
      duracao_semanas: t.getInt('duracao_semanas'),
      items: lista,
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/projects/{key}/aplicar-template',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')
    const papel = auth.getString('role')
    if (papel !== 'admin' && papel !== 'lider') {
      return e.forbiddenError('Somente administrador ou líder podem aplicar um template.')
    }

    const projectKey = e.request.pathValue('key')
    let p = null
    try {
      p = $app.findFirstRecordByData('projects', 'project_key', projectKey)
    } catch (_) {
      return e.notFoundError('Projeto não encontrado.')
    }
    if (!p.getBool('active')) {
      throw new BadRequestError('Projeto inativo não recebe tarefas.')
    }

    const data = new DynamicModel({ template_id: '', data_inicio: '', substituir: false })
    e.bindBody(data)
    const templateId = (data.template_id || '').trim()
    if (!templateId) throw new BadRequestError('template_id é obrigatório.')

    let tpl = null
    try {
      tpl = $app.findRecordById('task_templates', templateId)
    } catch (_) {
      return e.notFoundError('Template não encontrado.')
    }

    // data base do cronograma: informada > criação do projeto > hoje
    let baseStr = (data.data_inicio || '').trim()
    if (!baseStr) {
      baseStr = p.getDateTime('created').string().slice(0, 10)
    }
    if (!baseStr || baseStr.indexOf('0001-') === 0) {
      baseStr = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
    }
    const baseMs = new Date(baseStr + 'T00:00:00Z').getTime()
    if (isNaN(baseMs)) throw new BadRequestError('data_inicio inválida (use AAAA-MM-DD).')

    const itens = $app.findRecordsByFilter(
      'task_template_items',
      'template_id = {:tid} && ativo = true',
      'ordem',
      200,
      0,
      { tid: tpl.id },
    )
    if (itens.length === 0) throw new BadRequestError('Template sem tarefas ativas.')

    // títulos já existentes no projeto (guarda de duplicidade)
    const existentes = {}
    try {
      const jaTem = $app.findRecordsByFilter('tasks', 'project_key = {:pk}', '', 500, 0, {
        pk: projectKey,
      })
      for (const t of jaTem) existentes[t.getString('titulo')] = true
    } catch (_) {}

    const ownerId = p.getString('owner_id')
    const tasksCol = $app.findCollectionByNameOrId('tasks')
    const itemsCol = $app.findCollectionByNameOrId('task_items')

    let criadas = 0
    let puladas = 0
    const criadasTitulos = []

    for (const i of itens) {
      const titulo = i.getString('titulo')
      if (existentes[titulo]) {
        puladas = puladas + 1
        continue
      }
      const folga = i.getInt('folga_semanas')
      const prazoMs = baseMs + folga * 7 * 86400000
      const prazo = new Date(prazoMs).toISOString().slice(0, 10)

      let check = []
      try {
        check = JSON.parse(i.getString('checklist') || '[]')
      } catch (_) {
        check = []
      }

      const rec = new Record(tasksCol)
      rec.set('project_key', projectKey)
      rec.set('titulo', titulo)
      rec.set(
        'descricao',
        'Etapa: ' + i.getString('etapa') + ' (template: ' + tpl.getString('nome') + ')',
      )
      rec.set('assignee_id', ownerId)
      rec.set('due_date', prazo)
      rec.set('status', 'pendente')
      rec.set('evidencia_esperada', i.getString('evidencia_esperada') || 'Evidência de: ' + titulo)
      rec.set('created_by', auth.id)
      $app.save(rec)

      let ordem = 1
      for (const c of check) {
        const ct = ((c && c.titulo) || '').trim()
        if (!ct) continue
        const item = new Record(itemsCol)
        item.set('task_id', rec.id)
        item.set('titulo', ct)
        item.set('obrigatorio', c && c.obrigatorio ? true : false)
        item.set('concluido', false)
        item.set('ordem', ordem)
        $app.save(item)
        ordem = ordem + 1
      }

      existentes[titulo] = true
      criadas = criadas + 1
      criadasTitulos.push(titulo)
    }

    // auditoria
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(auditCol)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'config_changed')
    log.set('project_key', projectKey)
    log.set(
      'detail',
      (
        'template "' +
        tpl.getString('nome') +
        '" aplicado: ' +
        criadas +
        ' tarefas criadas, ' +
        puladas +
        ' já existiam (base ' +
        baseStr +
        ')'
      ).slice(0, 500),
    )
    $app.save(log)

    return e.json(201, {
      project_key: projectKey,
      template: tpl.getString('nome'),
      criadas: criadas,
      puladas: puladas,
      data_base: baseStr,
      tarefas: criadasTitulos,
    })
  },
  $apis.requireAuth(),
)
