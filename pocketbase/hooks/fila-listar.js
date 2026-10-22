// T1.9 — Fila individual (CA-1-024): as PRÓPRIAS tarefas do usuário autenticado,
// em todos os projetos com vínculo, com contagens por estado.
// GET /backend/v1/minhas-tarefas — o filtro é SEMPRE o usuário do token (assignee_id
// = auth.id); parâmetro de usuário na query é IGNORADO (ninguém vê a fila de outro).
// Estados separados: pendentes, vencidas (fuso BRT, regra da T1.7), bloqueadas,
// concluídas. Tarefas de projeto inativo não aparecem (a fila mostra o executável).
// Sem evento de auditoria novo: a fila é LEITURA (CA-1-025 já coberto pelos eventos
// task_created/blocked/returned/completed da T1.7/T1.8).
routerAdd(
  'GET',
  '/backend/v1/minhas-tarefas',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const uid = auth.id

    // Escopo por vínculo (herdado da T1.2): só projetos onde o usuário é membro.
    const vinculos = $app.findRecordsByFilter(
      'project_members',
      'user_id = {:uid}',
      '-created',
      500,
      0,
      { uid: uid },
    )
    const chavesAtivas = {}
    for (const v of vinculos) chavesAtivas[v.getString('project_key')] = true

    // Projetos ativos (fila mostra o executável; inativo some da fila)
    const projetos = $app.findRecordsByFilter('projects', 'active = true', '-updated', 500, 0)
    const infoProjeto = {}
    for (const p of projetos) {
      const k = p.getString('project_key')
      if (!chavesAtivas[k]) continue
      infoProjeto[k] = {
        name: p.getString('name'),
        stage: p.getString('stage'),
      }
    }

    // Tarefas do próprio usuário (assignee_id = uid) — independente de query externa
    const tarefas = $app.findRecordsByFilter('tasks', 'assignee_id = {:uid}', '-created', 500, 0, {
      uid: uid,
    })

    const agoraStr = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const pendentes = []
    const vencidas = []
    const bloqueadas = []
    const concluidas = []
    let contPendentes = 0
    let contVencidas = 0
    let contBloqueadas = 0
    let contConcluidas = 0

    for (const t of tarefas) {
      const pk = t.getString('project_key')
      if (!infoProjeto[pk]) continue // sem vínculo ou projeto inativo → fora da fila

      const status = t.getString('status')
      const dueStr = t.getDateTime('due_date').string()
      const dueDia = dueStr.slice(0, 10)
      const atrasada = dueDia < agoraStr && status !== 'concluida'

      // Pendências obrigatórias do checklist (resumo)
      const itens = $app.findRecordsByFilter(
        'task_items',
        'task_id = {:tid} && obrigatorio = true && concluido = false',
        'ordem',
        100,
        0,
        { tid: t.id },
      )

      const item = {
        id: t.id,
        project_key: pk,
        project_name: infoProjeto[pk].name,
        project_stage: infoProjeto[pk].stage,
        titulo: t.getString('titulo'),
        descricao: t.getString('descricao'),
        due_date: dueDia,
        status: status,
        evidencia_esperada: t.getString('evidencia_esperada'),
        atrasada: atrasada,
        pendentes_obrigatorios: itens.length,
        bloqueio_motivo: t.getString('bloqueio_motivo'),
        bloqueio_dono: t.getString('bloqueio_dono'),
        bloqueio_revisao: t.getDateTime('bloqueio_revisao').string().slice(0, 10),
        retorno_motivo: t.getString('retorno_motivo'),
      }

      if (status === 'concluida') {
        concluidas.push(item)
        contConcluidas = contConcluidas + 1
      } else if (status === 'bloqueada') {
        bloqueadas.push(item)
        contBloqueadas = contBloqueadas + 1
      } else if (atrasada) {
        vencidas.push(item)
        contVencidas = contVencidas + 1
      } else {
        pendentes.push(item)
        contPendentes = contPendentes + 1
      }
    }

    return e.json(200, {
      contagens: {
        pendentes: contPendentes,
        vencidas: contVencidas,
        bloqueadas: contBloqueadas,
        concluidas: contConcluidas,
      },
      pendentes: pendentes,
      vencidas: vencidas,
      bloqueadas: bloqueadas,
      concluidas: concluidas,
    })
  },
  $apis.requireAuth(),
)
