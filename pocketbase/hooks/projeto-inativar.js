// T1.4 — Inativar (arquivar) projeto preservando histórico (CA-1-011).
// PATCH /backend/v1/projects/{key}/inativar — somente admin/líder. Nunca deleta: só active=false.
routerAdd(
  'PATCH',
  '/backend/v1/projects/{key}/inativar',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || (auth.get('role') !== 'admin' && auth.get('role') !== 'lider')) {
      return e.forbiddenError('Somente administrador ou líder podem inativar projetos.')
    }

    const projectKey = e.request.pathValue('key')
    let p = null
    try {
      p = $app.findFirstRecordByData('projects', 'project_key', projectKey)
    } catch (_) {
      return e.notFoundError('Projeto não encontrado.')
    }

    if (!p.getBool('active')) {
      return e.json(200, { project_key: projectKey, message: 'Projeto já está inativo.' })
    }

    // Inativação: a linha e a timeline permanecem; só sai da lista de ativos
    p.set('active', false)
    try {
      $app.findFirstRecordByData('pipeline_stages', 'name', 'Encerrado')
      p.set('stage', 'Encerrado')
    } catch (_) {}
    $app.save(p)

    // Auditoria da inativação (CA-1-011)
    const audit = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(audit)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'project_archived')
    log.set('project_key', projectKey)
    log.set('detail', 'inativado preservando histórico (linha mantida)')
    $app.save(log)

    return e.json(200, { project_key: projectKey, active: false, stage: 'Encerrado' })
  },
  $apis.requireAuth(),
)
