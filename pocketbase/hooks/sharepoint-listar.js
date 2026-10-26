// T2.2b — Navegador de arquivos do SharePoint COM ESCOPO POR PROJETO (CA-2-009..012).
// GET /backend/v1/sharepoint/listar?caminho=...&busca=... — tudo SERVER-SIDE:
// o token Graph vive na coleção ms_tokens (regras nulas) + secret SHAREPOINT_REFRESH_TOKEN
// e NUNCA aparece em código, log ou resposta (CA-2-008).
// LIÇÃO JSVM: top-level declarations não são visíveis dentro do callback — TODA a
// lógica (constantes, auditoria, token, Graph) vive INLINE no corpo da rota.
// Regra do dono (26/10/2026): admin/líder = biblioteca inteira; consultor/revisor =
// SOMENTE as pastas dos projetos em que está alocado (projects.sp_folder).
// - Consultor sem vínculo → 403 auditado.
// - Consultor com vínculos mas nenhum projeto com sp_folder → 403 auditado
//   ("nenhum projeto seu tem pasta mapeada").
// - Consultor: raiz da resposta = menu dos projetos dele (escopo:true); caminho
//   fora do escopo → 403 auditado; busca filtrada ao escopo (CA-2-012).
// Sanitização: caminho com ".." ou começando com "/" → 400.
// Cada consulta auditada como sharepoint_consulta (ator, modo, nº de itens).
routerAdd(
  'GET',
  '/backend/v1/sharepoint/listar',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    // --- constantes (inline por causa do scoping do JSVM) ---
    const TENANT_ID = '95113c2b-7857-42d4-914b-b5ee6eb8b2a6'
    const CLIENT_ID = '14d82eec-204b-4c2f-b7e8-296a70dab67e' // Microsoft Graph Command Line Tools (oficial MS)
    const GRAPH = 'https://graph.microsoft.com/v1.0'
    const SITE_DRIVE_ID = 'b!Q-f1bATuyU6wp7pfPIHS_-EVCSdET_hGk5x5003WuSnAgTGiCiHTTZMfj4srMeo-'
    const ESCOPO =
      'https://graph.microsoft.com/Sites.Read.All https://graph.microsoft.com/Files.ReadWrite https://graph.microsoft.com/Sites.ReadWrite.All offline_access'

    const audit = (action, detail, pk) => {
      try {
        const col = $app.findCollectionByNameOrId('audit_log')
        const log = new Record(col)
        log.set('actor_id', auth.id)
        log.set('actor_email', auth.getString('email'))
        log.set('action', action)
        log.set('project_key', pk || '')
        log.set('detail', String(detail).slice(0, 500))
        $app.save(log)
      } catch (_) {}
    }

    // --- permissão + escopo ---
    const papel = auth.getString('role')
    const podeGlobal = papel === 'admin' || papel === 'lider'
    let escopos = [] // pastas permitidas p/ consultor/revisor
    if (!podeGlobal) {
      const vinculos = $app.findRecordsByFilter(
        'project_members',
        'user_id = {:uid} && project_key != ""',
        '-created',
        100,
        0,
        { uid: auth.id },
      )
      if (vinculos.length === 0) {
        audit('access_denied', 'navegador SharePoint sem vínculo a nenhum projeto', '')
        return e.forbiddenError('Você não tem vínculo com nenhum projeto.')
      }
      // resolve a pasta de cada projeto vinculado (sp_folder)
      const chaves = []
      for (const v of vinculos) {
        const k = v.getString('project_key')
        if (chaves.indexOf(k) < 0) chaves.push(k)
      }
      for (const k of chaves) {
        let p = null
        try {
          p = $app.findFirstRecordByData('projects', 'project_key', k)
        } catch (_) {
          p = null
        }
        if (p) {
          const pasta = p.getString('sp_folder').trim()
          if (pasta) escopos.push(pasta)
        }
      }
      if (escopos.length === 0) {
        audit(
          'access_denied',
          'navegador SharePoint: nenhum projeto vinculado tem pasta mapeada (sp_folder)',
          '',
        )
        return e.forbiddenError(
          'Nenhum dos seus projetos tem pasta mapeada no SharePoint. Solicite ao líder.',
        )
      }
    }

    // --- parâmetros (defensivo: duas formas de acessar a URL) ---
    let caminho = ''
    let busca = ''
    try {
      const q = e.request.url.query()
      caminho = (q.get('caminho') || '').trim()
      busca = (q.get('busca') || '').trim()
    } catch (_) {
      try {
        const q2 = e.request.url().query()
        caminho = (q2.get('caminho') || '').trim()
        busca = (q2.get('busca') || '').trim()
      } catch (_) {}
    }

    // --- sanitização de caminho ---
    if (caminho.indexOf('..') >= 0 || (caminho && caminho.charAt(0) === '/')) {
      audit(
        'access_denied',
        'caminho inválido no navegador SharePoint: ' + caminho.slice(0, 80),
        '',
      )
      throw new BadRequestError('Caminho inválido.')
    }

    // --- controle de escopo do caminho (consultor/revisor) ---
    if (!podeGlobal && caminho) {
      const dentro = escopos.some((p) => caminho === p || caminho.indexOf(p + '/') === 0)
      if (!dentro) {
        audit('access_denied', 'navegador SharePoint fora do escopo: ' + caminho.slice(0, 80), '')
        return e.forbiddenError('Esta pasta está fora do escopo dos seus projetos.')
      }
    }

    // --- token corrente (ms_tokens) com renovação via secret ---
    const agora = Math.floor(Date.now() / 1000)
    let rec = null
    try {
      rec = $app.findFirstRecordByData('ms_tokens', 'chave', 'graph')
    } catch (_) {
      rec = null
    }
    let token = ''
    if (rec) {
      const exp = rec.getInt('expira_em') || 0
      const at = rec.getString('access_token')
      if (at && exp - 120 > agora) token = at
    }
    if (!token) {
      const rt =
        rec && rec.getString('refresh_token')
          ? rec.getString('refresh_token')
          : $secrets.get('SHAREPOINT_REFRESH_TOKEN')
      if (!rt)
        throw new BadRequestError('Credencial do SharePoint não configurada (secret ausente).')
      const body =
        'client_id=' +
        encodeURIComponent(CLIENT_ID) +
        '&grant_type=refresh_token&refresh_token=' +
        encodeURIComponent(rt) +
        '&scope=' +
        encodeURIComponent(ESCOPO)
      let res = null
      try {
        res = $http.send({
          url: 'https://login.microsoftonline.com/' + TENANT_ID + '/oauth2/v2.0/token',
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body,
          timeout: 30,
        })
      } catch (errT) {
        audit('sharepoint_consulta', 'renovação de token falhou (transporte)', '')
        return e.json(200, {
          itens: [],
          modo: 'listar',
          aviso: 'SharePoint indisponível agora (falha de rede na renovação).',
        })
      }
      if (res.statusCode !== 200) {
        audit('sharepoint_consulta', 'renovação de token falhou: HTTP ' + res.statusCode, '')
        return e.json(200, {
          itens: [],
          modo: 'listar',
          aviso: 'Credencial do SharePoint precisa de renovação (HTTP ' + res.statusCode + ').',
        })
      }
      // res.body é bytes no JSVM — usar res.json (já parseado)
      const tok = res.json || {}
      if (!tok.access_token) throw new BadRequestError('Resposta OAuth sem access_token.')
      token = tok.access_token
      if (rec) {
        rec.set('access_token', tok.access_token)
        if (tok.refresh_token) rec.set('refresh_token', tok.refresh_token)
        rec.set('expira_em', agora + (tok.expires_in || 3600))
        $app.save(rec)
      } else {
        const col = $app.findCollectionByNameOrId('ms_tokens')
        const novo = new Record(col)
        novo.set('chave', 'graph')
        novo.set('access_token', tok.access_token)
        novo.set('refresh_token', tok.refresh_token || rt)
        novo.set('expira_em', agora + (tok.expires_in || 3600))
        $app.save(novo)
      }
    }

    // --- helper Graph (inline) ---
    const graphGet = (path, params) => {
      let url = GRAPH + path
      if (params) url += '?' + params
      let res = null
      try {
        res = $http.send({
          url: url,
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
          timeout: 30,
        })
      } catch (errT) {
        return { status: 0, data: null, erro: 'falha de rede' }
      }
      if (res.statusCode === 404) return { status: 404, data: null }
      if (res.statusCode >= 400) {
        let msg = 'Graph HTTP ' + res.statusCode
        try {
          const j = res.json || {}
          if (j && j.error && j.error.message) msg = j.error.message
        } catch (_) {}
        return { status: res.statusCode, data: null, erro: msg }
      }
      return { status: 200, data: res.json || {} }
    }

    // --- listar ou buscar ---
    const itens = []
    let modo = 'listar'
    // prefixo da raiz do drive p/ derivar caminho do webUrl (Graph search NÃO devolve
    // parentReference.path — comportamento confirmado; caminho vem do webUrl decodificado)
    let rootPrefix = ''
    const obterRootPrefix = () => {
      if (rootPrefix) return rootPrefix
      const rr = graphGet('/drives/' + SITE_DRIVE_ID + '/root', '$select=webUrl')
      if (rr.status === 200 && rr.data && rr.data.webUrl) {
        try {
          rootPrefix = decodeURIComponent(rr.data.webUrl) + '/'
        } catch (_) {
          rootPrefix = rr.data.webUrl + '/'
        }
      }
      return rootPrefix
    }
    if (busca) {
      modo = 'buscar'
      const q = busca.replace(/'/g, "''")
      const r = graphGet(
        '/drives/' + SITE_DRIVE_ID + "/root/search(q='" + encodeURIComponent(q) + "')",
        '$select=name,webUrl,folder,file,size,lastModifiedDateTime,parentReference&$top=200',
      )
      if (r.status === 200 && r.data && r.data.value) {
        for (const i of r.data.value) {
          // caminho completo: parentReference.path quando existe; senão deriva do webUrl
          let caminhoCompleto = ''
          const pr = i.parentReference || {}
          if (pr.path) {
            const parentPath = pr.path.split('root:')
            const parent = parentPath.length > 1 ? parentPath[1].replace(/^\//, '') : ''
            caminhoCompleto = (parent ? parent + '/' : '') + i.name
          } else if (i.webUrl) {
            const prefixo = obterRootPrefix()
            let dec = i.webUrl
            try {
              dec = decodeURIComponent(i.webUrl)
            } catch (_) {}
            if (prefixo && dec.indexOf(prefixo) === 0) {
              caminhoCompleto = dec.slice(prefixo.length)
            }
          }
          // filtro de escopo: consultor/revisor só vê resultados dentro das pastas dele
          // (caminho não derivável = fora, fail closed)
          if (!podeGlobal) {
            const dentro = escopos.some(
              (p) => caminhoCompleto === p || caminhoCompleto.indexOf(p + '/') === 0,
            )
            if (!dentro) continue
          }
          itens.push({
            nome: i.name,
            pasta: !!i.folder,
            tamanho: i.size || 0,
            modificado: (i.lastModifiedDateTime || '').slice(0, 10),
            caminho: caminhoCompleto,
            webUrl: i.webUrl || '',
          })
        }
      } else if (r.status !== 200) {
        audit('sharepoint_consulta', 'busca falhou: ' + (r.erro || r.status), '')
        return e.json(200, {
          itens: [],
          modo: modo,
          aviso: 'Busca indisponível agora (' + (r.erro || r.status) + ').',
        })
      }
    } else {
      // consultor/revisor na raiz: NÃO lista a biblioteca (anti-enumeração) —
      // a resposta devolve só o menu dos projetos (escopos); a UI pede a escolha.
      if (!podeGlobal && !caminho) {
        audit('sharepoint_consulta', 'raiz — menu de escopo — ' + escopos.length + ' projetos', '')
        return e.json(200, {
          itens: [],
          modo: modo,
          caminho: '',
          busca: '',
          total: 0,
          escopo: true,
          escopos: escopos,
          aviso: 'Selecione um dos seus projetos acima para navegar.',
        })
      }
      const base = caminho
        ? '/drives/' + SITE_DRIVE_ID + '/root:/' + encodeURIComponent(caminho) + ':/children'
        : '/drives/' + SITE_DRIVE_ID + '/root/children'
      const r = graphGet(base, '$select=name,webUrl,folder,file,size,lastModifiedDateTime&$top=200')
      if (r.status === 404) return e.notFoundError('Caminho não encontrado no SharePoint.')
      if (r.status !== 200) {
        audit('sharepoint_consulta', 'listagem falhou: ' + (r.erro || r.status), '')
        return e.json(200, {
          itens: [],
          modo: modo,
          aviso: 'SharePoint indisponível agora (' + (r.erro || r.status) + ').',
        })
      }
      for (const i of r.data.value || []) {
        itens.push({
          nome: i.name,
          pasta: !!i.folder,
          tamanho: i.size || 0,
          modificado: (i.lastModifiedDateTime || '').slice(0, 10),
          caminho: (caminho ? caminho + '/' : '') + i.name,
          webUrl: i.webUrl || '',
        })
      }
      itens.sort((a, b) => {
        if (a.pasta !== b.pasta) return a.pasta ? -1 : 1
        return a.nome.toLowerCase() < b.nome.toLowerCase() ? -1 : 1
      })
    }

    audit(
      'sharepoint_consulta',
      modo +
        ' — caminho: ' +
        (caminho || 'raiz') +
        ' — ' +
        itens.length +
        ' itens' +
        (busca ? ' — busca: ' + busca.slice(0, 60) : ''),
      caminho ? caminho.split('/')[0] : '',
    )
    return e.json(200, {
      itens: itens,
      modo: modo,
      caminho: caminho,
      busca: busca,
      total: itens.length,
      escopo: !podeGlobal,
      escopos: podeGlobal ? [] : escopos,
    })
  },
  $apis.requireAuth(),
)
