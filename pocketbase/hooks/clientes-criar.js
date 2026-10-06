// T1.3 — Criar cliente: admin e líder (matriz validada). Consultor/revisor negados.
routerAdd(
  'POST',
  '/backend/v1/clients',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || (auth.get('role') !== 'admin' && auth.get('role') !== 'lider')) {
      return e.forbiddenError('Somente administrador ou líder podem cadastrar clientes.')
    }

    const data = new DynamicModel({ name: '', document: '' })
    e.bindBody(data)

    const name = (data.name || '').trim()
    const document = (data.document || '').trim()

    if (name.length < 2) {
      throw new BadRequestError('Nome do cliente é obrigatório (mínimo 2 caracteres).')
    }

    // Cliente duplicado bloqueado
    try {
      $app.findFirstRecordByData('clients', 'name', name)
      throw new BadRequestError('Já existe cliente com este nome.')
    } catch (err) {
      if (err && err.message && err.message.indexOf('Já existe cliente') >= 0) throw err
    }

    const col = $app.findCollectionByNameOrId('clients')
    const rec = new Record(col)
    rec.set('name', name)
    if (document) rec.set('document', document)
    rec.set('active', true)
    rec.set('created_by', auth.id)
    $app.save(rec)

    // Auditoria
    const audit = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(audit)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'config_changed')
    log.set('detail', 'cliente criado: ' + name)
    $app.save(log)

    return e.json(201, { id: rec.id, name: name, document: document })
  },
  $apis.requireAuth(),
)
