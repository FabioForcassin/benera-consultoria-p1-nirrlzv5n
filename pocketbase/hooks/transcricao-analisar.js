// T3.2 — Análise IA server-side de transcrições (Fase 3, 100% nativo Skip).
// POST /backend/v1/workspace/{id}/analisar — escopo por vínculo ao projeto do item.
// Chama $ai.chat (gateway da plataforma, alias 'fast') e grava a análise na coleção
// transcricao_analises (upsert por item_id — lição: coleção nova persiste; campo
// adicionado em coleção existente não). Re-análise permitida (sobrescreve, auditada).
// Auditado: transcricao_analisada (modelo + tamanho) / transcricao_erro.
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
      audit('transcricao_erro', 'resposta da IA não veio em JSON válido')
      return e.json(200, { aviso: 'A análise veio em formato inesperado. Tente de novo.' })
    }

    const j = (v) => (Array.isArray(v) ? JSON.stringify(v) : String(v || ''))
    const resumo = String(parsed.resumo || '').slice(0, 4000)
    const decisoes = j(parsed.decisoes).slice(0, 8000)
    const compromissos = j(parsed.compromissos).slice(0, 8000)
    const riscos = j(parsed.riscos).slice(0, 4000)
    const proximos = j(parsed.proximos).slice(0, 4000)
    const criadoEm = new Date().toISOString().replace('T', ' ').slice(0, 19)

    // upsert na coleção nova (1 registro por item)
    let rec = null
    try {
      rec = $app.findFirstRecordByData('transcricao_analises', 'item_id', it.id)
    } catch (_) {
      rec = null
    }
    const colAn = $app.findCollectionByNameOrId('transcricao_analises')
    if (!rec) rec = new Record(colAn)
    rec.set('item_id', it.id)
    rec.set('project_key', projectKey)
    rec.set('resumo', resumo)
    rec.set('decisoes', decisoes)
    rec.set('compromissos', compromissos)
    rec.set('riscos', riscos)
    rec.set('proximos', proximos)
    rec.set('status', 'pronto')
    rec.set('modelo', 'fast')
    rec.set('criado_em', criadoEm)
    $app.save(rec)

    // revalidação: relê do banco o que foi gravado
    let conferindo = null
    try {
      conferindo = $app.findFirstRecordByData('transcricao_analises', 'item_id', it.id)
    } catch (_) {
      conferindo = null
    }
    const gravado = conferindo ? conferindo.getString('status') : ''
    if (gravado !== 'pronto') {
      audit('transcricao_erro', 'persistência parcial da análise (status gravado vazio)')
      return e.json(200, {
        aviso: 'A análise foi gerada mas não conseguiu ser gravada. Tente de novo.',
      })
    }

    audit(
      'transcricao_analisada',
      'transcrição: ' +
        it.getString('titulo') +
        ' — modelo fast — resumo ' +
        resumo.length +
        ' chars',
    )

    return e.json(200, {
      ok: true,
      id: it.id,
      an_status: 'pronto',
      resumo: resumo,
      decisoes: decisoes,
      compromissos: compromissos,
      riscos: riscos,
      proximos: proximos,
    })
  },
  $apis.requireAuth(),
)
