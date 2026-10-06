// T1.2 — Consultar auditoria: somente admin global. Sem segredos nos registros.
routerAdd(
  'GET',
  '/backend/v1/audit',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || auth.get('role') !== 'admin') {
      return e.forbiddenError('Somente administrador pode consultar a auditoria.')
    }

    const eventos = $app.findRecordsByFilter('audit_log', '', '-created', 50, 0)
    const resposta = []
    for (const ev of eventos) {
      resposta.push({
        id: ev.id,
        actor_email: ev.getString('actor_email'),
        action: ev.getString('action'),
        project_key: ev.getString('project_key'),
        detail: ev.getString('detail'),
        created: ev.getDateTime('created').string(),
      })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)
