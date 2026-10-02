// Listar convites pendentes: somente administrador. Sem dados sensíveis além de e-mail/papel/status.
routerAdd(
  'GET',
  '/backend/v1/invites',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || auth.get('role') !== 'admin') {
      return e.forbiddenError('Somente administrador pode listar convites.')
    }

    const pendentes = $app.findRecordsByFilter('invites', "accepted_at = ''", '-created', 50, 0)
    const resposta = []
    for (const inv of pendentes) {
      resposta.push({
        id: inv.id,
        email: inv.getString('email'),
        role: inv.getString('role'),
        expires_at: inv.getDateTime('expires_at').string(),
        created: inv.getDateTime('created').string(),
      })
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)
