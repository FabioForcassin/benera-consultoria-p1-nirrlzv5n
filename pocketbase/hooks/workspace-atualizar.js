// T1.10/T1.11 — Atualizar/inativar item de workspace.
// PATCH /backend/v1/workspace/{id} — escopo por vínculo ao projeto do item.
// Regras server-side:
//   nota/comentario/documento → conteúdo/título/origem editáveis (auditado: workspace_updated)
//   documento com origem_pendente → preencher origem_url COMPLETA o fallback
//     (origem_pendente=false, auditado: workspace_completado — CA-1-030)
//   entrega NÃO se edita (evidência de entrega aceita não se altera) — só inativar
//   inativação (active=false) preserva o registro e o evento (rollback da SPEC)
// Auditado: workspace_updated / workspace_completado / workspace_archived (CA-1-028/030).
// [reescrito v0.0.54]
routerAdd(
  'PATCH',
  '/backend/v1/workspace/{id}',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    let it = null
    try {
      it = $app.findRecordById('workspace_items', e.request.pathValue('id'))
    } catch (_) {
      return e.notFoundError('Item não encontrado.')
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
        logNeg.set('detail', 'atualizar workspace sem vínculo ao projeto')
        $app.save(logNeg)
        return e.forbiddenError('Você não tem vínculo com este projeto.')
      }
    }

    const data = new DynamicModel({
      titulo: '',
      conteudo: '',
      origem_url: '',
      origem_tipo: '',
      inativar: false,
    })
    e.bindBody(data)
    const novoTitulo = (data.titulo || '').trim()
    const novoConteudo = (data.conteudo || '').trim()
    const novaOrigem = (data.origem_url || '').trim()
    const novaOrigemTipo = (data.origem_tipo || '').trim()
    const inativar = data.inativar === true

    if (!novoTitulo && !novoConteudo && !novaOrigem && !novaOrigemTipo && !inativar) {
      throw new BadRequestError(
        'Nada para atualizar (informe título, conteúdo, origem ou inativar).',
      )
    }

    const tipo = it.getString('tipo')
    const eventos = []
    const tituloAnterior = it.getString('titulo')
    const eraPendente = it.getBool('origem_pendente')

    if (inativar) {
      it.set('active', false)
      $app.save(it)
      eventos.push('workspace_archived')
    } else {
      if (tipo === 'entrega') {
        throw new BadRequestError(
          'Entrega não se edita (evidência de entrega aceita é preservada) — registre nova entrega ou inative.',
        )
      }
      let mudou = false
      if (novoTitulo) {
        if (novoTitulo.length < 3) throw new BadRequestError('Título muito curto (mínimo 3).')
        it.set('titulo', novoTitulo.slice(0, 200))
        mudou = true
      }
      if (novoConteudo) {
        it.set('conteudo', novoConteudo.slice(0, 5000))
        mudou = true
      }
      if (novaOrigem) {
        it.set('origem_url', novaOrigem.slice(0, 500))
        mudou = true
      }
      if (novaOrigemTipo) {
        it.set('origem_tipo', novaOrigemTipo.slice(0, 50))
        mudou = true
      }
      // T1.11 (CA-1-030): origem preenchida em item pendente completa o fallback
      if (novaOrigem && eraPendente) {
        it.set('origem_pendente', false)
        mudou = true
      }
      if (mudou) {
        $app.save(it)
        eventos.push(eraPendente && novaOrigem ? 'workspace_completado' : 'workspace_updated')
      }
    }

    const auditCol = $app.findCollectionByNameOrId('audit_log')
    for (const ev of eventos) {
      const log = new Record(auditCol)
      log.set('actor_id', auth.id)
      log.set('actor_email', auth.getString('email'))
      log.set('action', ev)
      log.set('project_key', projectKey)
      let detail =
        tipo +
        ': ' +
        tituloAnterior +
        ' → ' +
        it.getString('titulo') +
        (inativar ? ' (inativado)' : '')
      if (ev === 'workspace_completado') {
        detail =
          tipo +
          ': ' +
          tituloAnterior +
          ' — origem completada manualmente (registro manual, sem integração automática)'
      }
      log.set('detail', detail)
      $app.save(log)
    }

    return e.json(200, {
      id: it.id,
      tipo: tipo,
      titulo: it.getString('titulo'),
      origem_pendente: it.getBool('origem_pendente'),
      active: it.getBool('active'),
    })
  },
  $apis.requireAuth(),
)
