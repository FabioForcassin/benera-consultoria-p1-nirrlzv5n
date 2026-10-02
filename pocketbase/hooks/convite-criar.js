// Convite: somente administrador (role=admin) cria convite com papel.
// Token único, hash no banco, expiração, uso único. Nenhum segredo em log/resposta.
routerAdd(
  'POST',
  '/backend/v1/invites',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth || auth.get('role') !== 'admin') {
      return e.forbiddenError('Somente administrador pode convidar usuários.')
    }

    const data = new DynamicModel({ email: '', role: '' })
    e.bindBody(data)

    const email = (data.email || '').trim().toLowerCase()
    const role = (data.role || '').trim()
    const roles = ['admin', 'lider', 'consultor', 'revisor']

    if (!email || email.indexOf('@') < 1) {
      throw new BadRequestError('Email de convite inválido.')
    }
    if (roles.indexOf(role) < 0) {
      throw new BadRequestError('Papel inválido para convite.')
    }

    // E-mail duplicado: já existe usuário ativo com esse e-mail
    try {
      $app.findAuthRecordByEmail('_pb_users_auth_', email)
      throw new BadRequestError('Já existe usuário ativo com este e-mail.')
    } catch (err) {
      if (err && err.message && err.message.indexOf('Já existe usuário') >= 0) throw err
      // não encontrado: segue
    }

    // Convite pendente duplicado para o mesmo e-mail
    const pendentes = $app.findRecordsByFilter(
      'invites',
      "email = {:email} && accepted_at = ''",
      '-created',
      1,
      0,
      { email: email },
    )
    if (pendentes.length > 0) {
      throw new BadRequestError('Já existe convite pendente para este e-mail.')
    }

    const token = $security.randomString(48)
    const expires = new Date()
    expires.setHours(expires.getHours() + 48)

    const col = $app.findCollectionByNameOrId('invites')
    const rec = new Record(col)
    rec.set('email', email)
    rec.set('role', role)
    rec.set('token_hash', $security.sha256(token))
    rec.set('expires_at', expires.toISOString().replace('T', ' ').replace('Z', ''))
    rec.set('invited_by', auth.id)
    $app.save(rec)

    // Nunca devolver o token na resposta (evita vazamento em log/evidência)
    return e.json(201, { id: rec.id, email: email, role: role, expires_at: expires.toISOString() })
  },
  $apis.requireAuth(),
)
