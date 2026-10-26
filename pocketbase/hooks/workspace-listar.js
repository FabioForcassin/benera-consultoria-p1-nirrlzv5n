// T1.10/T1.11 — Listar itens de workspace do projeto com escopo por vínculo (padrão da carteira):
// admin/líder veem tudo; consultor/revisor só projetos com vínculo (senão 403 auditado).
// Retorna itens ATIVOS agrupados por tipo (nota/comentario/documento/entrega),
// com origem_pendente para o fallback manual (CA-1-030). [reescrito v0.0.54]
routerAdd(
  'GET',
  '/backend/v1/projects/{key}/workspace',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const projectKey = e.request.pathValue('key')
    const papel = auth.getString('role')
    const escopoTotal = papel === 'admin' || papel === 'lider'

    if (!escopoTotal) {
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
        logNeg.set('detail', 'listar workspace sem vínculo ao projeto')
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

    const itens = $app.findRecordsByFilter(
      'workspace_items',
      'project_key = {:pk} && active = true',
      '-created',
      200,
      0,
      { pk: projectKey },
    )

    const notas = []
    const comentarios = []
    const documentos = []
    const entregas = []
    for (const it of itens) {
      const item = {
        id: it.id,
        tipo: it.getString('tipo'),
        titulo: it.getString('titulo'),
        conteudo: it.getString('conteudo'),
        origem_url: it.getString('origem_url'),
        origem_tipo: it.getString('origem_tipo'),
        origem_pendente: it.getBool('origem_pendente'),
        sp_caminho: it.getString('sp_caminho'),
        sp_weburl: it.getString('sp_weburl'),
        destinatario: it.getString('destinatario'),
        data_entrega: it.getDateTime('data_entrega').string().slice(0, 10),
        entregue_por: it.getString('entregue_por'),
        created: it.getDateTime('created').string(),
      }
      const tipo = item.tipo
      if (tipo === 'nota') notas.push(item)
      else if (tipo === 'comentario') comentarios.push(item)
      else if (tipo === 'documento') documentos.push(item)
      else if (tipo === 'entrega') entregas.push(item)
    }

    return e.json(200, {
      notas: notas,
      comentarios: comentarios,
      documentos: documentos,
      entregas: entregas,
      total: notas.length + comentarios.length + documentos.length + entregas.length,
    })
  },
  $apis.requireAuth(),
)
