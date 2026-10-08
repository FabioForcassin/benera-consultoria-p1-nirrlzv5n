// T1.5 — Restaurar versão anterior da esteira (CA-1-018).
// POST /backend/v1/pipeline/restore/{version} — somente admin. Cria nova versão com o conteúdo restaurado
// (o histórico nunca é apagado nem reescrito).
routerAdd(
  'POST',
  '/backend/v1/pipeline/restore/{version}',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || auth.get('role') !== 'admin') {
      return e.forbiddenError('Somente administrador pode restaurar versões.')
    }

    const alvo = parseInt(e.request.pathValue('version'))
    if (!alvo || alvo < 1) throw new BadRequestError('Versão inválida.')

    let snapshot = null
    try {
      snapshot = $app.findFirstRecordByData('pipeline_versions', 'version', alvo)
    } catch (_) {
      return e.notFoundError('Versão não encontrada.')
    }

    const stagesData = JSON.parse(snapshot.getString('stages_json') || '[]')
    if (!Array.isArray(stagesData) || stagesData.length === 0) {
      throw new BadRequestError('Versão sem conteúdo restaurável.')
    }

    // Nova versão com o conteúdo da versão alvo
    const existentes = $app.findRecordsByFilter('pipeline_versions', '', '-version', 1, 0)
    const novaVersao = (existentes.length > 0 ? existentes[0].getInt('version') : 0) + 1

    const ativas = $app.findRecordsByFilter('pipeline_versions', 'active_version = true', '', 50, 0)
    for (const a of ativas) {
      a.set('active_version', false)
      $app.save(a)
    }

    const versionsCol = $app.findCollectionByNameOrId('pipeline_versions')
    const v = new Record(versionsCol)
    v.set('version', novaVersao)
    v.set('stages_json', snapshot.getString('stages_json'))
    v.set('diff', 'restauração da versão ' + alvo)
    v.set('active_version', true)
    v.set('created_by', auth.id)
    $app.save(v)

    // Reescreve pipeline_stages
    const antigos = $app.findRecordsByFilter('pipeline_stages', '', 'ordem', 200, 0)
    for (const a of antigos) $app.delete(a)
    const stagesCol = $app.findCollectionByNameOrId('pipeline_stages')
    for (const s of stagesData) {
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
    log.set('detail', 'rollback: versão ' + novaVersao + ' restaurada a partir da versão ' + alvo)
    $app.save(log)

    return e.json(200, { version: novaVersao, restored_from: alvo })
  },
  $apis.requireAuth(),
)
