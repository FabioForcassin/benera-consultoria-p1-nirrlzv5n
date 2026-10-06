// T1.3 — Listar usuários ativos (para selecionar responsável): admin e líder.
routerAdd(
  'GET',
  '/backend/v1/users',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || (auth.get('role') !== 'admin' && auth.get('role') !== 'lider')) {
      return e.forbiddenError('Somente administrador ou líder podem listar usuários.')
    }

    const usuarios = $app.findRecordsByFilter('_pb_users_auth_', 'verified = true', 'name', 200, 0)
    const resposta = []
    for (const u of usuarios) {
      resposta.push({
        id: u.id,
        email: u.getString('email'),
        name: u.getString('name'),
        role: u.getString('role'),
      })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)
