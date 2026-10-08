// T1.5 — Editar a esteira: cria NOVA VERSÃO com diff; nunca reescreve histórico (CA-1-013).
// PUT /backend/v1/pipeline — somente admin. Body: { stages: [{name, ordem, entry_criteria, entry_requires}] }
routerAdd(
  'PUT',
  '/backend/v1/pipeline',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || auth.get('role') !== 'admin') {
      return e.forbiddenError('Somente administrador pode configurar a esteira.')
    }

    const data = new DynamicModel({ stages: '' })
    e.bindBody(data)

    let novasEtapas = []
    const raw = data.stages
    if (typeof raw === 'string') {
      try {
        novasEtapas = JSON.parse(raw)
      } catch (_) {
        throw new BadRequestError('Formato inválido da esteira.')
      }
    } else if (Array.isArray(raw)) {
      novasEtapas = raw
    } else {
      throw new BadRequestError('Formato inválido da esteira.')
    }
    if (!Array.isArray(novasEtapas) || novasEtapas.length === 0) {
      throw new BadRequestError('Esteira deve ter ao menos uma etapa.')
    }

    // Validações: nome, ordem única e critérios conhecidos
    const nomes = {}
    const ordens = {}
    const camposValidos = ['kickoff_date']
    for (const s of novasEtapas) {
      const nome = (s.name || '').trim()
      if (nome.length < 2) throw new BadRequestError('Etapa sem nome válida (mínimo 2 caracteres).')
      if (nomes[nome]) throw new BadRequestError('Etapa duplicada: ' + nome)
      nomes[nome] = true
      const ordem = s.ordem
      if (!ordem || ordem < 1)
        throw new BadRequestError('Ordem inválida para a etapa ' + nome + '.')
      if (ordens[ordem]) throw new BadRequestError('Ordem duplicada: ' + ordem)
      ordens[ordem] = true
      const requires = s.entry_requires || []
      if (!Array.isArray(requires))
        throw new BadRequestError('entry_requires inválido na etapa ' + nome + '.')
      for (const r of requires) {
        if (camposValidos.indexOf(r) < 0) {
          throw new BadRequestError('Critério desconhecido "' + r + '" na etapa ' + nome + '.')
        }
      }
    }

    // Versão nova
    const existentes = $app.findRecordsByFilter('pipeline_versions', '', '-version', 1, 0)
    const novaVersao = (existentes.length > 0 ? existentes[0].getInt('version') : 0) + 1

    // Diff mínimo contra a versão ativa anterior
    let diff = 'versão ' + novaVersao + ' criada'
    try {
      const ativaAnterior = $app.findRecordsByFilter(
        'pipeline_versions',
        'active_version = true',
        '-version',
        1,
        0,
      )
      if (ativaAnterior.length > 0) {
        const anterior = JSON.parse(ativaAnterior[0].getString('stages_json') || '[]')
        const resumoAnterior = anterior.map((s) => s.ordem + '.' + s.name).join(' → ')
        const resumoNovo = novasEtapas.map((s) => s.ordem + '.' + s.name).join(' → ')
        if (resumoAnterior !== resumoNovo) {
          diff = resumoAnterior + '  ⟶  ' + resumoNovo
        }
      }
    } catch (_) {
      // diff fica no texto padrão
    }

    // Desativa a versão anterior (flag) — o registro permanece (histórico nunca reescrito)
    const ativas = $app.findRecordsByFilter('pipeline_versions', 'active_version = true', '', 50, 0)
    for (const a of ativas) {
      a.set('active_version', false)
      $app.save(a)
    }

    // Grava nova versão ativa
    const versionsCol = $app.findCollectionByNameOrId('pipeline_versions')
    const v = new Record(versionsCol)
    v.set('version', novaVersao)
    v.set('stages_json', JSON.stringify(novasEtapas))
    v.set('diff', diff.slice(0, 1000))
    v.set('active_version', true)
    v.set('created_by', auth.id)
    $app.save(v)

    // Reescreve pipeline_stages com a nova configuração (estado corrente da esteira)
    const antigos = $app.findRecordsByFilter('pipeline_stages', '', 'ordem', 200, 0)
    for (const a of antigos) $app.delete(a)
    const stagesCol = $app.findCollectionByNameOrId('pipeline_stages')
    for (const s of novasEtapas) {
      const rec = new Record(stagesCol)
      rec.set('name', (s.name || '').trim())
      rec.set('ordem', s.ordem)
      rec.set('entry_criteria', (s.entry_criteria || '').trim().slice(0, 500))
      rec.set('entry_requires', JSON.stringify(s.entry_requires || []))
      rec.set('active', true)
      $app.save(rec)
    }

    // Auditoria
    const audit = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(audit)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'pipeline_updated')
    log.set('detail', ('nova versão ' + novaVersao + ': ' + diff).slice(0, 500))
    $app.save(log)

    return e.json(201, { version: novaVersao, diff: diff.slice(0, 1000) })
  },
  $apis.requireAuth(),
)
