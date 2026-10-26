// T1.4 — Editar projeto (responsável/prioridade/prazo/etapa/próxima ação) com auditoria de valores (CA-1-010).
// PATCH /backend/v1/projects/{key} — somente admin/líder. Alterações auditadas com antes/depois.
routerAdd(
  'PATCH',
  '/backend/v1/projects/{key}',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || (auth.get('role') !== 'admin' && auth.get('role') !== 'lider')) {
      return e.forbiddenError('Somente administrador ou líder podem editar projetos.')
    }

    const projectKey = e.request.pathValue('key')
    let p = null
    try {
      p = $app.findFirstRecordByData('projects', 'project_key', projectKey)
    } catch (_) {
      return e.notFoundError('Projeto não encontrado.')
    }

    const data = new DynamicModel({
      owner_id: '',
      priority: '',
      due_date: '',
      stage: '',
      next_action: '',
      sp_folder: '',
    })
    e.bindBody(data)

    const mudancas = []
    const aplicar = (campo, valor, rotulo) => {
      if (!valor || valor === p.getString(campo)) return
      mudancas.push(rotulo + ': ' + p.getString(campo) + ' → ' + valor)
      p.set(campo, valor)
    }

    // Responsável: valida existência e estado ativo + GARANTE vínculo de visualização/movimentação
    const novoOwner = (data.owner_id || '').trim()
    if (novoOwner && novoOwner !== p.getString('owner_id')) {
      let owner = null
      try {
        owner = $app.findRecordById('_pb_users_auth_', novoOwner)
      } catch (_) {
        throw new BadRequestError('Responsável não encontrado.')
      }
      if (!owner.getBool('verified')) {
        throw new BadRequestError('Responsável inativo (não verificado).')
      }
      mudancas.push('owner_id: ' + p.getString('owner_id') + ' → ' + novoOwner)
      p.set('owner_id', novoOwner)

      // Vínculo automático: o responsável sempre enxerga e movimenta o projeto (papel do vínculo
      // preservado se já existir; senão, herda o papel global do usuário)
      const papelGlobal = owner.getString('role')
      const papelVinculo =
        ['admin', 'lider', 'consultor', 'revisor'].indexOf(papelGlobal) >= 0
          ? papelGlobal
          : 'consultor'
      const existentes = $app.findRecordsByFilter(
        'project_members',
        'user_id = {:uid} && project_key = {:pk}',
        '-created',
        1,
        0,
        { uid: novoOwner, pk: projectKey },
      )
      if (existentes.length === 0) {
        const membersCol = $app.findCollectionByNameOrId('project_members')
        const novoVinculo = new Record(membersCol)
        novoVinculo.set('user_id', novoOwner)
        novoVinculo.set('project_key', projectKey)
        novoVinculo.set('project_role', papelVinculo)
        novoVinculo.set('granted_by', auth.id)
        $app.save(novoVinculo)
        mudancas.push('vínculo criado p/ responsável (' + papelVinculo + ')')
      }
    }

    // Prioridade: valida contra o catálogo ativo
    const novaPrioridade = (data.priority || '').trim()
    if (novaPrioridade && novaPrioridade !== p.getString('priority')) {
      let priosValidas = []
      try {
        const prios = $app.findRecordsByFilter('priorities', 'active = true', 'ordem', 100, 0)
        for (const pr of prios) priosValidas.push(pr.getString('value'))
      } catch (_) {}
      if (priosValidas.length === 0) priosValidas = ['baixa', 'media', 'alta']
      if (priosValidas.indexOf(novaPrioridade) < 0) {
        throw new BadRequestError('Prioridade inválida.')
      }
      mudancas.push('priority: ' + p.getString('priority') + ' → ' + novaPrioridade)
      p.set('priority', novaPrioridade)
    }

    // Prazo
    const novoPrazo = (data.due_date || '').trim()
    if (novoPrazo) {
      mudancas.push(
        'due_date: ' +
          p.getDateTime('due_date').string().slice(0, 10) +
          ' → ' +
          novoPrazo.slice(0, 10),
      )
      p.set('due_date', novoPrazo.replace('T', ' ').replace('Z', ''))
    }

    // Etapa: valida contra a esteira ativa (configurável desde a T1.5)
    const novaEtapa = (data.stage || '').trim()
    if (novaEtapa && novaEtapa !== p.getString('stage')) {
      let etapasValidas = []
      try {
        const ativas = $app.findRecordsByFilter('pipeline_stages', 'active = true', 'ordem', 100, 0)
        for (const s of ativas) etapasValidas.push(s.getString('name'))
      } catch (_) {}
      if (etapasValidas.length === 0)
        etapasValidas = ['Entrada', 'Kick-off', 'Diagnóstico', 'Entrega', 'Encerrado']
      if (etapasValidas.indexOf(novaEtapa) < 0) {
        throw new BadRequestError('Etapa inválida.')
      }
      mudancas.push('stage: ' + p.getString('stage') + ' → ' + novaEtapa)
      p.set('stage', novaEtapa)
    }

    // Pasta no SharePoint (T2.2b): mapeamento projeto → pasta na biblioteca BENERA CORP.
    // Define o escopo do consultor/revisor no navegador (só pastas dos projetos alocados).
    const novaPasta = (data.sp_folder || '').trim()
    if (novaPasta !== p.getString('sp_folder').trim()) {
      if (novaPasta && (novaPasta.indexOf('..') >= 0 || novaPasta.charAt(0) === '/')) {
        throw new BadRequestError('Pasta do SharePoint inválida (caminho relativo ou absoluto).')
      }
      mudancas.push('sp_folder: "' + p.getString('sp_folder') + '" → "' + novaPasta + '"')
      p.set('sp_folder', novaPasta)
    }

    // Próxima ação
    const novaAcao = (data.next_action || '').trim()
    if (novaAcao && novaAcao.length >= 3 && novaAcao !== p.getString('next_action')) {
      mudancas.push('next_action: ' + p.getString('next_action') + ' → ' + novaAcao)
      p.set('next_action', novaAcao)
    }

    if (mudancas.length === 0) {
      return e.json(200, { project_key: projectKey, message: 'Nada a alterar.' })
    }

    $app.save(p)

    // Auditoria: ator + horário + valores antes/depois (CA-1-010)
    const audit = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(audit)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'project_updated')
    log.set('project_key', projectKey)
    log.set('detail', mudancas.join(' | ').slice(0, 500))
    $app.save(log)

    return e.json(200, {
      project_key: projectKey,
      stage: p.getString('stage'),
      priority: p.getString('priority'),
      altered: mudancas.length,
    })
  },
  $apis.requireAuth(),
)
