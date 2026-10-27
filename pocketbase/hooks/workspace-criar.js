// T1.10/T1.11 — Criar item de workspace: nota interna, comentário, documento/link ou entrega.
// POST /backend/v1/projects/{key}/workspace — escopo por vínculo (padrão T1.7):
// admin/líder qualquer projeto; consultor/revisor com vínculo (senão 403 auditado).
// Validação por tipo (server-side, CA-1-026/027):
//   nota/comentario  → título + conteúdo obrigatórios
//   documento/link   → título obrigatório; SEM origem_url nasce com origem_pendente=true
//                      (fallback manual, CA-1-030 — registro manual, sem integração automática)
//   entrega          → título + destinatário + data obrigatórios; entregue_por = ator
// Auditado: workspace_created / entrega_registered (CA-1-028). [reescrito v0.0.54]
routerAdd(
  'POST',
  '/backend/v1/projects/{key}/workspace',
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
        logNeg.set('detail', 'criar item de workspace sem vínculo ao projeto')
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

    const data = new DynamicModel({
      tipo: '',
      titulo: '',
      conteudo: '',
      origem_url: '',
      origem_tipo: '',
      destinatario: '',
      data_entrega: '',
    })
    e.bindBody(data)

    const tipo = (data.tipo || '').trim().toLowerCase()
    const titulo = (data.titulo || '').trim()
    const conteudo = (data.conteudo || '').trim()
    const origemUrl = (data.origem_url || '').trim()
    const origemTipo = (data.origem_tipo || '').trim()
    const destinatario = (data.destinatario || '').trim()
    const dataEntrega = (data.data_entrega || '').trim()

    const tiposValidos = ['nota', 'comentario', 'documento', 'entrega', 'transcricao']
    if (tiposValidos.indexOf(tipo) < 0) {
      throw new BadRequestError(
        'Tipo inválido (use nota, comentario, documento, entrega ou transcricao).',
      )
    }

    const faltantes = []
    if (titulo.length < 3) faltantes.push('titulo')
    if (tipo === 'nota' || tipo === 'comentario') {
      if (conteudo.length < 3) faltantes.push('conteudo')
    }
    // T3.1: transcrição exige o texto (conteudo) — é a matéria-prima da análise
    if (tipo === 'transcricao') {
      if (conteudo.length < 50) {
        faltantes.push('conteudo')
      }
    }
    if (tipo === 'entrega') {
      if (!destinatario) faltantes.push('destinatario')
      if (!dataEntrega) faltantes.push('data_entrega')
    }
    if (faltantes.length > 0) {
      const errors = {}
      for (const f of faltantes) {
        errors[f] = new ValidationError('validation_required', 'Campo obrigatório.')
      }
      throw new BadRequestError('Campos obrigatórios faltando.', errors)
    }

    // T1.11 (CA-1-030): documento sem origem nasce PENDENTE (fallback manual) — não recusa.
    const origemPendente = tipo === 'documento' && !origemUrl

    const col = $app.findCollectionByNameOrId('workspace_items')
    const rec = new Record(col)
    rec.set('project_key', projectKey)
    rec.set('tipo', tipo)
    rec.set('titulo', titulo)
    rec.set('conteudo', conteudo.slice(0, 5000))
    rec.set('origem_url', origemUrl.slice(0, 500))
    rec.set('origem_tipo', origemTipo.slice(0, 50))
    rec.set('destinatario', destinatario.slice(0, 200))
    if (dataEntrega) {
      rec.set('data_entrega', dataEntrega.replace('T', ' ').replace('Z', ''))
    }
    rec.set('entregue_por', tipo === 'entrega' ? auth.getString('email').slice(0, 100) : '')
    rec.set('origem_pendente', origemPendente)
    rec.set('active', true)
    rec.set('created_by', auth.id)
    if (tipo === 'transcricao') {
      rec.set('an_status', 'pendente')
    }
    $app.save(rec)

    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(auditCol)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set(
      'action',
      tipo === 'entrega'
        ? 'entrega_registered'
        : tipo === 'transcricao'
          ? 'transcricao_criada'
          : 'workspace_created',
    )
    log.set('project_key', projectKey)
    log.set(
      'detail',
      tipo +
        ': ' +
        titulo +
        (tipo === 'entrega' ? ' → ' + destinatario : '') +
        (tipo === 'transcricao'
          ? ' (' + Math.round(conteudo.length / 100) + ' blocos de texto — análise pendente)'
          : '') +
        (origemPendente ? ' (origem pendente — registro manual, sem integração automática)' : ''),
    )
    $app.save(log)

    return e.json(201, {
      id: rec.id,
      project_key: projectKey,
      tipo: tipo,
      titulo: titulo,
      origem_pendente: origemPendente,
      active: true,
    })
  },
  $apis.requireAuth(),
)
