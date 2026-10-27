// T3.2 — Análise IA server-side de transcrições (Fase 3, 100% nativo Skip).
// POST /backend/v1/workspace/{id}/analisar  — escopo por vínculo ao projeto do item.
// Chama $ai.chat (gateway da plataforma, alias 'fast') e grava a análise estruturada
// nos campos an_* do item (an_status: pendente → pronto/erro; an_modelo registra o alias).
// Saída esperada do modelo: JSON com resumo, decisoes[], compromissos[], riscos[], proximos[].
// Auditado: transcricao_analisada (com modelo e tamanho da análise) / transcricao_erro.
// Re-análise permitida (sobrescreve a anterior, auditada).
routerAdd(
  'POST',
  '/backend/v1/workspace/{id}/analisar',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    let it = null
    try {
      it = $app.findRecordById('workspace_items', e.request.pathValue('id'))
    } catch (_) {
      return e.notFoundError('Item não encontrado.')
    }
    const projectKey = it.getString('project_key')
    const papel = auth.getString('role')
    const podeGlobal = papel === 'admin' || papel === 'lider'

    const audit = (action, detail) => {
      try {
        const col = $app.findCollectionByNameOrId('audit_log')
        const log = new Record(col)
        log.set('actor_id', auth.id)
        log.set('actor_email', auth.getString('email'))
        log.set('action', action)
        log.set('project_key', projectKey)
        log.set('detail', String(detail).slice(0, 500))
        $app.save(log)
      } catch (_) {}
    }

    if (!podeGlobal) {
      const vinculos = $app.findRecordsByFilter(
        'project_members',
        'user_id = {:uid} && project_key = {:pk}',
        '-created',
        1,
        0,
        { uid: auth.id, pk: projectKey },
      )
      if (vinculos.length === 0) {
        audit('access_denied', 'analisar transcrição sem vínculo ao projeto')
        return e.forbiddenError('Você não tem vínculo com este projeto.')
      }
    }

    if (it.getString('tipo') !== 'transcricao') {
      throw new BadRequestError('Só transcrições podem ser analisadas.')
    }
    const texto = it.getString('conteudo')
    if (texto.length < 50) {
      throw new BadRequestError('Transcrição sem texto suficiente para analisar.')
    }

    // marca processando antes da chamada (evita análise dupla em clique duplo)
    const statusAnterior = it.getString('an_status')
    if (statusAnterior === 'processando') {
      return e.json(200, { aviso: 'Análise já em andamento.' })
    }
    it.set('an_status', 'processando')
    $app.save(it)

    const SYSTEM =
      'Você é analista sênior de uma consultoria de remuneração e desenho organizacional. ' +
      'Analise a transcrição de reunião de projeto e responda APENAS com JSON válido, sem texto fora do JSON, ' +
      'no formato: {"resumo": "resumo executivo em até 5 frases", ' +
      '"decisoes": ["decisão tomada — quem decidiu"], ' +
      '"compromissos": ["compromisso — responsável — prazo"], ' +
      '"riscos": ["risco ou ponto de atenção"], ' +
      '"proximos": ["próximo passo recomendado"]}. ' +
      'Se um campo não tiver conteúdo, devolva a lista vazia. Escreva em português do Brasil.'
    const USER = 'Transcrição da reunião:\n\n' + texto.slice(0, 12000)

    let resposta = ''
    try {
      const reply = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: USER },
        ],
      })
      resposta = (reply.choices[0].message.content || '').trim()
    } catch (errAi) {
      it.set('an_status', 'erro')
      $app.save(it)
      audit('transcricao_erro', 'análise falhou: ' + String(errAi).slice(0, 120))
      return e.json(200, {
        aviso: 'Análise indisponível agora (' + String(errAi).slice(0, 80) + ').',
      })
    }

    // extrai o JSON da resposta (tolera cercas de código)
    let json = resposta
    if (json.indexOf('{') >= 0) json = json.slice(json.indexOf('{'), json.lastIndexOf('}') + 1)
    let parsed = null
    try {
      parsed = JSON.parse(json)
    } catch (_) {
      parsed = null
    }
    if (!parsed || typeof parsed !== 'object') {
      it.set('an_status', 'erro')
      it.set('an_resumo', resposta.slice(0, 4000))
      $app.save(it)
      audit('transcricao_erro', 'resposta da IA não veio em JSON válido (guardada como resumo)')
      return e.json(200, {
        aviso: 'A análise veio em formato inesperado — texto guardado como resumo. Tente de novo.',
      })
    }

    const j = (v) => (Array.isArray(v) ? JSON.stringify(v) : String(v || ''))
    it.set('an_resumo', String(parsed.resumo || '').slice(0, 4000))
    it.set('an_decisoes', j(parsed.decisoes).slice(0, 8000))
    it.set('an_compromissos', j(parsed.compromissos).slice(0, 8000))
    it.set('an_riscos', j(parsed.riscos).slice(0, 4000))
    it.set('an_proximos', j(parsed.proximos).slice(0, 4000))
    it.set('an_status', 'pronto')
    it.set('an_modelo', 'fast')
    it.set('an_criado_em', new Date().toISOString().replace('T', ' ').slice(0, 19))
    $app.save(it)

    audit(
      'transcricao_analisada',
      'transcrição: ' +
        it.getString('titulo') +
        ' — modelo fast — resumo ' +
        String(parsed.resumo || '').length +
        ' chars' +
        (statusAnterior === 'pronto' ? ' (re-análise)' : ''),
    )

    return e.json(200, {
      ok: true,
      id: it.id,
      an_status: 'pronto',
      resumo: it.getString('an_resumo'),
      decisoes: it.getString('an_decisoes'),
      compromissos: it.getString('an_compromissos'),
      riscos: it.getString('an_riscos'),
      proximos: it.getString('an_proximos'),
    })
  },
  $apis.requireAuth(),
)
