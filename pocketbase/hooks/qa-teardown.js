// QA-TEARDOWN — Limpeza dos registros criados pelo banco de teste automatizado.
// POST /backend/v1/qa/teardown — SOMENTE admin.
// Guardas duras (falha fechada):
//   1. Exige prefixo explícito no corpo, no formato ^QA[A-Z0-9-]*$.
//   2. Só apaga registro cujo campo-chave comece com o prefixo E cujo criador seja
//      uma fixture (@example.invalid) — dado real nunca é elegível.
//   3. Nunca apaga audit_log: a auditoria é registro de verdade, fica.
// Existe para o harness de teste do piloto, não é rota de produção de cliente.
routerAdd(
  'POST',
  '/backend/v1/qa/teardown',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')
    if (auth.getString('role') !== 'admin') {
      return e.forbiddenError('Somente administrador pode executar a limpeza de QA.')
    }

    const data = new DynamicModel({ prefixo: '' })
    e.bindBody(data)
    const prefixo = (data.prefixo || '').trim().toUpperCase()
    if (!/^QA[A-Z0-9-]*$/.test(prefixo) || prefixo.length < 3) {
      throw new BadRequestError('Prefixo inválido (use QA + letras/números/hífen, mínimo 3).')
    }

    const ehFixture = (uid) => {
      if (!uid) return false
      try {
        const u = $app.findRecordById('_pb_users_auth_', uid)
        return u.getString('email').indexOf('@example.invalid') > 0
      } catch (_) {
        return false
      }
    }

    const apagados = {}
    const conta = (nome) => {
      apagados[nome] = (apagados[nome] || 0) + 1
    }

    // 1) projetos QA criados por fixture (filhos antes do pai)
    const projetos = $app.findRecordsByFilter('projects', 'id != ""', '-created', 500, 0)
    for (const p of projetos) {
      const chave = p.getString('project_key')
      if (chave.indexOf(prefixo) !== 0) continue
      if (!ehFixture(p.getString('created_by'))) continue

      try {
        const tarefas = $app.findRecordsByFilter('tasks', 'project_key = {:pk}', '', 500, 0, {
          pk: chave,
        })
        for (const t of tarefas) {
          const itens = $app.findRecordsByFilter('task_items', 'task_id = {:tid}', '', 500, 0, {
            tid: t.id,
          })
          for (const it of itens) {
            $app.delete(it)
            conta('task_items')
          }
        }
      } catch (_) {}

      const dependentes = [
        'handoffs',
        'apontamentos',
        'workspace_items',
        'project_members',
        'tasks',
      ]
      for (const col of dependentes) {
        try {
          const regs = $app.findRecordsByFilter(col, 'project_key = {:pk}', '', 500, 0, {
            pk: chave,
          })
          for (const r of regs) {
            $app.delete(r)
            conta(col)
          }
        } catch (_) {}
      }
      $app.delete(p)
      conta('projects')
    }

    // 2) clientes QA criados por fixture
    const clientes = $app.findRecordsByFilter('clients', 'id != ""', '-created', 500, 0)
    for (const c of clientes) {
      if (c.getString('name').toUpperCase().indexOf(prefixo) !== 0) continue
      if (!ehFixture(c.getString('created_by'))) continue
      $app.delete(c)
      conta('clients')
    }

    // 3) a auditoria da própria limpeza (audit_log nunca é apagada)
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(auditCol)
    log.set('actor_id', auth.id)
    log.set('actor_email', auth.getString('email'))
    log.set('action', 'qa_teardown')
    log.set('project_key', '')
    log.set(
      'detail',
      ('limpeza QA prefixo ' + prefixo + ': ' + JSON.stringify(apagados)).slice(0, 500),
    )
    $app.save(log)

    return e.json(200, { prefixo: prefixo, apagados: apagados })
  },
  $apis.requireAuth(),
)
