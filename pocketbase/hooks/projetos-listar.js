// T1.3-fix — Listagem mínima de projetos ativos: alimenta o select de alocação.
// T1.4 substitui/estende esta rota: filtros, escopo por vínculo do consultor e campos do cartão 360.
routerAdd(
  'GET',
  '/backend/v1/projects',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || (auth.get('role') !== 'admin' && auth.get('role') !== 'lider')) {
      return e.forbiddenError('Somente administrador ou líder podem listar projetos.')
    }

    const projetos = $app.findRecordsByFilter('projects', 'active = true', 'project_key', 200, 0)
    const resposta = []
    for (const p of projetos) {
      resposta.push({
        project_key: p.getString('project_key'),
        name: p.getString('name'),
        stage: p.getString('stage'),
      })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)
