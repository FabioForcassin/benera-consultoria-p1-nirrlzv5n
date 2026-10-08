// T1.5+ — Editar cliente (nome/documento) com auditoria; admin/líder.
// PATCH /backend/v1/clients/{id}
routerAdd(
  'PATCH',
  '/backend/v1/clients/{id}',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || (auth.get('role') !== 'admin' && auth.get('role') !== 'lider')) {
      return e.forbiddenError('Somente administrador ou líder podem editar clientes.')
    }

    const clientId = e.request.pathValue('id')
    let c = null
    try {
      c = $app.findRecordById('clients', clientId)
    } catch (_) {
      return e.notFoundError('Cliente não encontrado.')
    }

    const data = new DynamicModel({ name: '', document: '' })
    e.bindBody(data)

    const mudancas = []
    const novoNome = (data.name || '').trim()
    if (novoNome && novoNome !== c.getString('name')) {
      if (novoNome.length < 2)
        throw new BadRequestError('Nome do cliente inválido (mínimo 2 caracteres).')
      // duplicado bloqueado
      try {
        $app.findFirstRecordByData('clients', 'name', novoNome)
        throw new BadRequestError('Já existe cliente com este nome.')
      } catch (err) {
        if (err && err.message && err.message.indexOf('Já existe cliente') >= 0) throw err
      }
      mudancas.push('nome: ' + c.getString('name') + ' → ' + novoNome)
      c.set('name', novoNome)
    }
    const novoDoc = (data.document || '').trim()
    if (novoDoc && novoDoc !== c.getString('document')) {
      mudancas.push('documento: ' + c.getString('document') + ' → ' + novoDoc)
      c.set('document', novoDoc)
    }

    if (mudancas.length === 0) {
      return e.json(200, { id: clientId, message: 'Nada a alterar.' })
    }

    $app.save(c)

    const audit = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(audit)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'config_changed')
    log.set('detail', ('cliente atualizado: ' + mudancas.join(' | ')).slice(0, 500))
    $app.save(log)

    return e.json(200, { id: clientId, altered: mudancas.length })
  },
  $apis.requireAuth(),
)
