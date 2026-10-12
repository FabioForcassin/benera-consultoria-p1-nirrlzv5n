// T1.7-debug — Listar usuários para seleção de responsável.
// Admin/líder: lista completa (nome, email, papel).
// Consultor/revisor: lista PARCIAL apenas com nome e id — suficiente para o dropdown de
// responsável ao criar tarefa em projeto com vínculo (SPEC-1-004: consultor cria tarefa);
// NUNCA expõe email/papel (linha vermelha de segurança/LGPD).
routerAdd(
  'GET',
  '/backend/v1/users',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const papel = auth.getString('role')
    const escopoTotal = papel === 'admin' || papel === 'lider'

    const usuarios = $app.findRecordsByFilter('_pb_users_auth_', 'verified = true', 'name', 200, 0)
    const resposta = []
    for (const u of usuarios) {
      if (escopoTotal) {
        resposta.push({
          id: u.id,
          email: u.getString('email'),
          name: u.getString('name'),
          role: u.getString('role'),
        })
      } else {
        resposta.push({
          id: u.id,
          name: u.getString('name') || u.getString('email'),
          role: '',
        })
      }
    }
    return e.json(200, { items: resposta })
  },
  $apis.requireAuth(),
)
