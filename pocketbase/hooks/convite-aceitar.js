// Ativação de convite: usuário define a própria senha com token válido, único e não expirado.
// Papel vem do convite (nunca do corpo da requisição). Token nunca retorna em log/resposta.
routerAdd(
  'POST',
  '/backend/v1/invites/aceitar',
  (e) => {
    const data = new DynamicModel({ token: '', password: '' })
    e.bindBody(data)

    const token = (data.token || '').trim()
    const password = data.password || ''

    if (!token) throw new BadRequestError('Token de ativação ausente.')
    if (password.length < 8) {
      throw new BadRequestError('A senha deve ter no mínimo 8 caracteres.')
    }

    const hash = $security.sha256(token)
    let invite = null
    try {
      invite = $app.findFirstRecordByData('invites', 'token_hash', hash)
    } catch (_) {
      throw new BadRequestError('Convite inválido ou já utilizado.')
    }

    if (invite.getString('accepted_at') !== '') {
      throw new BadRequestError('Convite já utilizado.')
    }

    const exp = invite.getDateTime('expires_at')
    if (exp && exp.string() && new Date(exp.string()) < new Date()) {
      throw new BadRequestError('Convite expirado. Solicite um novo convite.')
    }

    // Usuário pode já existir (pré-criado administrativamente) ou ser criado agora
    let user = null
    try {
      user = $app.findAuthRecordByEmail('_pb_users_auth_', invite.getString('email'))
    } catch (_) {}

    if (!user) {
      const users = $app.findCollectionByNameOrId('_pb_users_auth_')
      user = new Record(users)
      user.setEmail(invite.getString('email'))
      user.set('name', invite.getString('email').split('@')[0])
    }

    user.setPassword(password)
    user.setVerified(true)
    user.set('role', invite.getString('role')) // papel SEMPRE do convite

    $app.runInTransaction((tx) => {
      tx.save(user)
      invite.set('accepted_at', new Date().toISOString().replace('T', ' ').replace('Z', ''))
      tx.save(invite)
    })

    // Resposta padrão de autenticação (token + record) sem expor o convite
    return $apis.recordAuthResponse(e, user)
  },
  $apis.requireGuestOnly(),
)
