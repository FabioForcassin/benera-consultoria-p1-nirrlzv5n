// T1.2 — Conceder vínculo usuário↔projeto: somente admin global. Auditado.
routerAdd(
  'POST',
  '/backend/v1/members',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || auth.get('role') !== 'admin') {
      $app
        .logger()
        .warn(
          'acesso negado a membros',
          'action',
          'member_granted',
          'actor',
          auth ? auth.getString('email') : 'anonimo',
        )
      return e.forbiddenError('Somente administrador pode conceder acesso a projetos.')
    }

    const data = new DynamicModel({ user_id: '', project_key: '', project_role: '' })
    e.bindBody(data)

    const userId = (data.user_id || '').trim()
    const projectKey = (data.project_key || '').trim()
    const projectRole = (data.project_role || '').trim()
    const roles = ['admin', 'lider', 'consultor', 'revisor']

    if (!userId || !projectKey) {
      throw new BadRequestError('Usuário e projeto são obrigatórios.')
    }
    if (roles.indexOf(projectRole) < 0) {
      throw new BadRequestError('Papel de projeto inválido.')
    }

    // T1.3: a coleção projects existe — vínculo só é concedido a projeto real (bloqueia chave fantasma por typo)
    try {
      $app.findFirstRecordByData('projects', 'project_key', projectKey)
    } catch (_) {
      throw new BadRequestError('Projeto não encontrado para a chave informada.')
    }

    let target = null
    try {
      target = $app.findRecordById('_pb_users_auth_', userId)
    } catch (_) {
      throw new BadRequestError('Usuário não encontrado.')
    }

    // Idempotente: se já existe vínculo, atualiza o papel (não duplica)
    let member = null
    const existing = $app.findRecordsByFilter(
      'project_members',
      'user_id = {:uid} && project_key = {:pk}',
      '-created',
      1,
      0,
      { uid: userId, pk: projectKey },
    )
    if (existing.length > 0) {
      member = existing[0]
      member.set('project_role', projectRole)
    } else {
      const col = $app.findCollectionByNameOrId('project_members')
      member = new Record(col)
      member.set('user_id', userId)
      member.set('project_key', projectKey)
      member.set('project_role', projectRole)
    }
    member.set('granted_by', auth.id)
    $app.save(member)

    // Auditoria: ator + horário (created automático), sem segredos
    const audit = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(audit)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'member_granted')
    log.set('target_user', userId)
    log.set('project_key', projectKey)
    log.set('detail', 'papel=' + projectRole)
    $app.save(log)

    return e.json(201, {
      id: member.id,
      user_id: userId,
      project_key: projectKey,
      project_role: projectRole,
    })
  },
  $apis.requireAuth(),
)
