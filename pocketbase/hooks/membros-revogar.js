// T1.2 — Revogar vínculo usuário↔projeto: somente admin global. Auditado.
// Revogação efetiva: o vínculo some e a próxima requisição protegida é negada.
routerAdd(
  'DELETE',
  '/backend/v1/members/{id}',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || auth.get('role') !== 'admin') {
      $app
        .logger()
        .warn(
          'acesso negado a revogação',
          'action',
          'member_revoked',
          'actor',
          auth ? auth.getString('email') : 'anonimo',
        )
      return e.forbiddenError('Somente administrador pode revogar acesso a projetos.')
    }

    const id = e.request.pathValue('id')
    let member = null
    try {
      member = $app.findRecordById('project_members', id)
    } catch (_) {
      throw new NotFoundError('Vínculo não encontrado.')
    }

    const userId = member.getString('user_id')
    const projectKey = member.getString('project_key')

    $app.delete(member)

    // Auditoria da revogação
    const audit = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(audit)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'member_revoked')
    log.set('target_user', userId)
    log.set('project_key', projectKey)
    log.set('detail', 'vínculo removido')
    $app.save(log)

    return e.json(200, { revoked: true, id: id, project_key: projectKey })
  },
  $apis.requireAuth(),
)
