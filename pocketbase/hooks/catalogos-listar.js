// T1.3 — Listar clientes e tipos de serviço (para os formulários): qualquer usuário autenticado.
routerAdd(
  'GET',
  '/backend/v1/clients',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    if (!e.auth) return e.unauthorizedError('Autenticação necessária.')

    const clientes = $app.findRecordsByFilter('clients', 'active = true', 'name', 200, 0)
    const resposta = []
    for (const c of clientes) {
      resposta.push({ id: c.id, name: c.getString('name'), document: c.getString('document') })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)

routerAdd(
  'GET',
  '/backend/v1/service-types',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    if (!e.auth) return e.unauthorizedError('Autenticação necessária.')

    const tipos = $app.findRecordsByFilter('service_types', 'active = true', 'name', 100, 0)
    const resposta = []
    for (const t of tipos) {
      resposta.push({ id: t.id, name: t.getString('name') })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)
