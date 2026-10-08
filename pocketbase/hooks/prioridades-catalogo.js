// T1.5+ — Catálogo de prioridades: listar (todos autenticados) e editar (admin).
routerAdd(
  'GET',
  '/backend/v1/priorities',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    if (!e.auth) return e.unauthorizedError('Autenticação necessária.')

    const prios = $app.findRecordsByFilter('priorities', 'active = true', 'ordem', 50, 0)
    const resposta = []
    for (const p of prios) {
      resposta.push({ id: p.id, name: p.getString('name'), value: p.getString('value') })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)

// PUT /backend/v1/priorities — substitui o catálogo (cria versão conceitual via auditoria)
routerAdd(
  'PUT',
  '/backend/v1/priorities',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || auth.get('role') !== 'admin') {
      return e.forbiddenError('Somente administrador pode configurar prioridades.')
    }

    const data = new DynamicModel({ items: '' })
    e.bindBody(data)

    let itens = []
    const raw = data.items
    if (typeof raw === 'string') {
      try {
        itens = JSON.parse(raw)
      } catch (_) {
        throw new BadRequestError('Formato inválido.')
      }
    } else if (Array.isArray(raw)) {
      itens = raw
    } else {
      throw new BadRequestError('Formato inválido.')
    }
    if (!Array.isArray(itens) || itens.length === 0) {
      throw new BadRequestError('Catálogo deve ter ao menos uma prioridade.')
    }

    const valores = {}
    for (const it of itens) {
      const nome = (it.name || '').trim()
      const valor = (it.value || '').trim().toLowerCase()
      if (nome.length < 2 || valor.length < 2)
        throw new BadRequestError('Prioridade sem nome/valor válidos.')
      if (valores[valor]) throw new BadRequestError('Valor duplicado: ' + valor)
      valores[valor] = true
      if (!it.ordem || it.ordem < 1) throw new BadRequestError('Ordem inválida para ' + nome + '.')
    }

    const col = $app.findCollectionByNameOrId('priorities')
    const antigos = $app.findRecordsByFilter('priorities', '', 'ordem', 100, 0)
    for (const a of antigos) $app.delete(a)
    for (const it of itens) {
      const rec = new Record(col)
      rec.set('name', (it.name || '').trim())
      rec.set('value', (it.value || '').trim().toLowerCase())
      rec.set('ordem', it.ordem)
      rec.set('active', true)
      $app.save(rec)
    }

    // Auditoria
    const audit = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(audit)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'config_changed')
    log.set('detail', 'catálogo de prioridades atualizado: ' + itens.map((i) => i.name).join(', '))
    $app.save(log)

    return e.json(200, { ok: true, total: itens.length })
  },
  $apis.requireAuth(),
)
