// T1.3 — Criar projeto: admin e líder. Campos obrigatórios validados server-side.
// Deleção física bloqueada (só inativação). Auditado.
routerAdd(
  'POST',
  '/backend/v1/projects',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || (auth.get('role') !== 'admin' && auth.get('role') !== 'lider')) {
      return e.forbiddenError('Somente administrador ou líder podem criar projetos.')
    }

    const data = new DynamicModel({
      project_key: '',
      name: '',
      client_id: '',
      service_type_id: '',
      owner_id: '',
      stage: '',
      priority: '',
      due_date: '',
      next_action: '',
    })
    e.bindBody(data)

    const projectKey = (data.project_key || '').trim().toUpperCase()
    const name = (data.name || '').trim()
    const clientId = (data.client_id || '').trim()
    const serviceTypeId = (data.service_type_id || '').trim()
    const ownerId = (data.owner_id || '').trim()
    const stage = (data.stage || '').trim()
    const priority = (data.priority || '').trim()
    const dueDate = (data.due_date || '').trim()
    const nextAction = (data.next_action || '').trim()

    // RED: campo obrigatório vazio impede salvar
    const faltantes = []
    if (!projectKey) faltantes.push('project_key')
    if (name.length < 2) faltantes.push('name')
    if (!clientId) faltantes.push('client_id')
    if (!serviceTypeId) faltantes.push('service_type_id')
    if (!ownerId) faltantes.push('owner_id')
    if (!stage) faltantes.push('stage')
    if (!priority) faltantes.push('priority')
    if (!dueDate) faltantes.push('due_date')
    if (nextAction.length < 3) faltantes.push('next_action')
    if (faltantes.length > 0) {
      const errors = {}
      for (const f of faltantes) {
        errors[f] = new ValidationError('validation_required', 'Campo obrigatório.')
      }
      throw new BadRequestError('Campos obrigatórios faltando.', errors)
    }

    // Etapas válidas = esteira ativa (configurável desde a T1.5)
    const stages = []
    try {
      const ativas = $app.findRecordsByFilter('pipeline_stages', 'active = true', 'ordem', 100, 0)
      for (const s of ativas) stages.push(s.getString('name'))
    } catch (_) {}
    if (stages.length === 0)
      stages.push('Entrada', 'Kick-off', 'Diagnóstico', 'Entrega', 'Encerrado')
    let priosValidas = []
    try {
      const prios = $app.findRecordsByFilter('priorities', 'active = true', 'ordem', 100, 0)
      for (const pr of prios) priosValidas.push(pr.getString('value'))
    } catch (_) {}
    if (priosValidas.length === 0) priosValidas = ['baixa', 'media', 'alta']
    if (stages.indexOf(stage) < 0) throw new BadRequestError('Etapa inválida.')
    if (priosValidas.indexOf(priority) < 0) throw new BadRequestError('Prioridade inválida.')

    // Validações de relação
    try {
      $app.findRecordById('clients', clientId)
    } catch (_) {
      throw new BadRequestError('Cliente não encontrado.')
    }
    try {
      $app.findRecordById('service_types', serviceTypeId)
    } catch (_) {
      throw new BadRequestError('Tipo de serviço não encontrado.')
    }
    let owner = null
    try {
      owner = $app.findRecordById('_pb_users_auth_', ownerId)
    } catch (_) {
      throw new BadRequestError('Responsável não encontrado.')
    }
    if (!owner.getBool('verified')) {
      throw new BadRequestError('Responsável inativo (não verificado).')
    }

    // project_key duplicado bloqueado
    try {
      $app.findFirstRecordByData('projects', 'project_key', projectKey)
      throw new BadRequestError('Já existe projeto com esta chave.')
    } catch (err) {
      if (err && err.message && err.message.indexOf('Já existe projeto') >= 0) throw err
    }

    const col = $app.findCollectionByNameOrId('projects')
    const rec = new Record(col)
    rec.set('project_key', projectKey)
    rec.set('name', name)
    rec.set('client_id', clientId)
    rec.set('service_type_id', serviceTypeId)
    rec.set('owner_id', ownerId)
    rec.set('stage', stage)
    rec.set('priority', priority)
    rec.set('due_date', dueDate.replace('T', ' ').replace('Z', ''))
    rec.set('next_action', nextAction)
    rec.set('active', true)
    rec.set('created_by', auth.id)
    $app.save(rec)

    // Vínculo automático do criador como admin do projeto
    const membersCol = $app.findCollectionByNameOrId('project_members')
    const member = new Record(membersCol)
    member.set('user_id', auth.id)
    member.set('project_key', projectKey)
    member.set('project_role', 'admin')
    member.set('granted_by', auth.id)
    $app.save(member)

    // Auditoria
    const audit = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(audit)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'config_changed')
    log.set('project_key', projectKey)
    log.set('detail', 'projeto criado: ' + name)
    $app.save(log)

    return e.json(201, {
      id: rec.id,
      project_key: projectKey,
      name: name,
      stage: stage,
      priority: priority,
    })
  },
  $apis.requireAuth(),
)
