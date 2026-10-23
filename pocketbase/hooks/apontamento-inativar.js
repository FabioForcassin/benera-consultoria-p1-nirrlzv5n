// T1.13 — Inativar apontamento (append-only: não se edita, não se apaga).
// PATCH /backend/v1/apontamentos/{id} — escopo por vínculo ao projeto do apontamento.
// Só aceita { inativar: true } — qualquer outra mutação é recusada (append-only).
// Inativação preserva registro e evento (rollback da SPEC). Auditado: apontamento_archived.
routerAdd(
  'PATCH',
  '/backend/v1/apontamentos/{id}',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    let it = null
    try {
      it = $app.findRecordById('apontamentos', e.request.pathValue('id'))
    } catch (_) {
      return e.notFoundError('Apontamento não encontrado.')
    }
    const projectKey = it.getString('project_key')
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
        logNeg.set('detail', 'atualizar apontamento sem vínculo ao projeto')
        $app.save(logNeg)
        return e.forbiddenError('Você não tem vínculo com este projeto.')
      }
    }

    const data = new DynamicModel({ inativar: false })
    e.bindBody(data)
    const inativar = data.inativar === true

    if (!inativar) {
      throw new BadRequestError(
        'Apontamento é append-only: não se edita. Registre novo apontamento para corrigir ou inative com inativar=true.',
      )
    }

    if (!it.getBool('active')) {
      return e.json(200, { id: it.id, active: false, message: 'Já está inativo.' })
    }

    it.set('active', false)
    $app.save(it)

    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(auditCol)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'apontamento_archived')
    log.set('project_key', projectKey)
    log.set(
      'detail',
      'touch time inativado: ' +
        it.getInt('minutos') +
        ' min — ' +
        it.getString('motivo').slice(0, 80),
    )
    $app.save(log)

    return e.json(200, { id: it.id, active: false })
  },
  $apis.requireAuth(),
)
