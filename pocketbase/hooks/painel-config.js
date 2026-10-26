// T1.14 — Configuração de métrica do painel (CA-1-036: mudança de métrica AUDITADA e REVERSÍVEL).
// GET /backend/v1/painel-config — leitura para admin (a UI mostra o valor atual).
// PUT /backend/v1/painel-config — só admin; valida limites (50–5000); auditado como
// config_changed com antes→depois. REVERSÍVEL: PUT de volta restaura o valor anterior —
// cada mudança fica na timeline da auditoria. Consultor/revisor levam 403 auditado.
routerAdd(
  'GET',
  '/backend/v1/painel-config',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')
    if (auth.getString('role') !== 'admin') {
      return e.forbiddenError('Somente administrador pode ver a configuração do painel.')
    }
    let cfg = null
    try {
      cfg = $app.findFirstRecordByData('painel_config', 'chave', 'corte_eventos')
    } catch (_) {
      return e.notFoundError('Configuração não encontrada.')
    }
    return e.json(200, {
      chave: cfg.getString('chave'),
      valor: Math.floor(Number(cfg.get('valor')) || 0),
      descricao: cfg.getString('descricao'),
      updated: cfg.getDateTime('updated').string(),
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'PUT',
  '/backend/v1/painel-config',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')
    const papel = auth.getString('role')
    if (papel !== 'admin') {
      const auditCol = $app.findCollectionByNameOrId('audit_log')
      const logNeg = new Record(auditCol)
      logNeg.set('actor_id', auth.id)
      logNeg.set('actor_email', auth.getString('email'))
      logNeg.set('action', 'access_denied')
      logNeg.set('project_key', '')
      logNeg.set(
        'detail',
        'mudança de configuração do painel negada — papel ' + papel + ' sem permissão',
      )
      $app.save(logNeg)
      return e.forbiddenError('Somente administrador pode alterar a configuração do painel.')
    }

    const data = new DynamicModel({ valor: 0 })
    e.bindBody(data)
    const valor = Math.floor(Number(data.valor) || 0)
    if (valor < 50 || valor > 5000) {
      throw new BadRequestError('Valor inválido — informe entre 50 e 5000.')
    }

    let cfg = null
    try {
      cfg = $app.findFirstRecordByData('painel_config', 'chave', 'corte_eventos')
    } catch (_) {
      return e.notFoundError('Configuração não encontrada.')
    }

    const antes = Math.floor(Number(cfg.get('valor')) || 0)
    if (antes === valor) {
      return e.json(200, {
        chave: cfg.getString('chave'),
        valor: valor,
        descricao: cfg.getString('descricao'),
        inalterado: true,
      })
    }

    cfg.set('valor', valor)
    cfg.set('updated_by', auth.id)
    $app.save(cfg)

    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(auditCol)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'config_changed')
    log.set('project_key', '')
    log.set(
      'detail',
      'painel_config.corte_eventos: ' +
        antes +
        ' → ' +
        valor +
        ' (reversível — PUT de volta restaura)',
    )
    $app.save(log)

    return e.json(200, {
      chave: cfg.getString('chave'),
      valor: valor,
      descricao: cfg.getString('descricao'),
      antes: antes,
    })
  },
  $apis.requireAuth(),
)
