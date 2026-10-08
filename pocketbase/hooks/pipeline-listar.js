// T1.5 — Listar a esteira ativa (etapas ordenadas) e o histórico de versões.
// GET /backend/v1/pipeline — qualquer usuário autenticado vê a esteira (leitura).
// GET /backend/v1/pipeline/versions — somente admin.
routerAdd(
  'GET',
  '/backend/v1/pipeline',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    if (!e.auth) return e.unauthorizedError('Autenticação necessária.')

    const stages = $app.findRecordsByFilter('pipeline_stages', 'active = true', 'ordem', 50, 0)
    const resposta = []
    for (const s of stages) {
      let requires = []
      try {
        requires = JSON.parse(s.getString('entry_requires') || '[]')
      } catch (_) {
        requires = []
      }
      resposta.push({
        id: s.id,
        name: s.getString('name'),
        ordem: s.getInt('ordem'),
        entry_criteria: s.getString('entry_criteria'),
        entry_requires: requires,
      })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/pipeline/versions',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || auth.get('role') !== 'admin') {
      return e.forbiddenError('Somente administrador pode ver o histórico de versões.')
    }

    const versoes = $app.findRecordsByFilter('pipeline_versions', '', '-version', 50, 0)
    const resposta = []
    for (const v of versoes) {
      resposta.push({
        version: v.getInt('version'),
        diff: v.getString('diff'),
        active_version: v.getBool('active_version'),
        created_by: v.getString('created_by'),
        created: v.getDateTime('created').string(),
      })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)
