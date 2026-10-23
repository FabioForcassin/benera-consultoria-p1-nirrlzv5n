// T1.13 — Criar apontamento de touch time (CA-1-032).
// POST /backend/v1/projects/{key}/apontamentos — escopo por vínculo (padrão workspace):
// admin/líder qualquer projeto; consultor/revisor com vínculo (senão 403 auditado).
// Validação server-side: minutos 1–600, motivo obrigatório (3–300).
// Etapa default = etapa atual do projeto (se não informada).
// APPEND-ONLY: não existe edição — correção é novo apontamento; inativação preserva
// registro e evento (apontamento_archived). Auditado: apontamento_created.
routerAdd(
  'POST',
  '/backend/v1/projects/{key}/apontamentos',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const projectKey = e.request.pathValue('key')
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
        logNeg.set('detail', 'criar apontamento sem vínculo ao projeto')
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

    const data = new DynamicModel({ minutos: 0, motivo: '', etapa: '' })
    e.bindBody(data)

    const minutos = Math.floor(Number(data.minutos) || 0)
    const motivo = (data.motivo || '').trim()
    let etapa = (data.etapa || '').trim()
    if (!etapa) etapa = p.getString('stage')

    const faltantes = []
    if (!minutos || minutos < 1 || minutos > 600) faltantes.push('minutos')
    if (motivo.length < 3) faltantes.push('motivo')
    if (faltantes.length > 0) {
      const errors = {}
      for (const f of faltantes) {
        errors[f] = new ValidationError(
          'validation_required',
          f === 'minutos' ? 'Informe minutos entre 1 e 600.' : 'Campo obrigatório.',
        )
      }
      throw new BadRequestError('Campos inválidos no apontamento.', errors)
    }

    const col = $app.findCollectionByNameOrId('apontamentos')
    const rec = new Record(col)
    rec.set('project_key', projectKey)
    rec.set('minutos', minutos)
    rec.set('motivo', motivo.slice(0, 300))
    rec.set('etapa', etapa.slice(0, 100))
    rec.set('actor_id', auth.id)
    rec.set('actor_email', auth.getString('email'))
    rec.set('active', true)
    $app.save(rec)

    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(auditCol)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'apontamento_created')
    log.set('project_key', projectKey)
    log.set(
      'detail',
      'touch time: ' + minutos + ' min — ' + motivo.slice(0, 80) + ' (' + etapa + ')',
    )
    $app.save(log)

    return e.json(201, {
      id: rec.id,
      project_key: projectKey,
      minutos: minutos,
      motivo: motivo,
      etapa: etapa,
      actor_email: auth.getString('email'),
      active: true,
    })
  },
  $apis.requireAuth(),
)
