// T2.3 — Vínculo documento workspace ↔ arquivo SharePoint (CA-2-013..016).
// POST /backend/v1/workspace/{id}/vincular-sharepoint  { caminho: "00 - STARIAN/..." }
// Regras (server-side):
//   - escopo por vínculo ao projeto do item (padrão T1.10);
//   - consultor/revisor: caminho DEVE estar dentro da(s) pasta(s) do projeto
//     (projects.sp_folder — regra T2.2b); admin/líder qualquer caminho;
//   - caminho fora do escopo → 403 auditado (access_denied);
//   - caminho inexistente → 404 limpo;
//   - resolve no Graph (drive BENERACORP), grava sp_caminho + sp_weburl +
//     origem_url = webUrl + origem_tipo = "SharePoint" + origem_pendente = false;
//   - item já vinculado → 400 (desvincule/inative antes — vínculo não se sobrescreve);
//   - auditado como workspace_vinculado (ator, caminho, webUrl).
routerAdd(
  'POST',
  '/backend/v1/workspace/{id}/vincular-sharepoint',
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
        audit('access_denied', 'vincular workspace ao SharePoint sem vínculo ao projeto')
        return e.forbiddenError('Você não tem vínculo com este projeto.')
      }
    }

    const data = new DynamicModel({ caminho: '' })
    e.bindBody(data)
    const caminho = (data.caminho || '').trim()

    if (caminho.indexOf('..') >= 0 || (caminho && caminho.charAt(0) === '/')) {
      audit('access_denied', 'vínculo SharePoint: caminho inválido: ' + caminho.slice(0, 80))
      throw new BadRequestError('Caminho inválido.')
    }
    if (!caminho) throw new BadRequestError('Informe o caminho do arquivo no SharePoint.')

    // escopo T2.2b: consultor/revisor só dentro da(s) pasta(s) do projeto
    if (!podeGlobal) {
      let p = null
      try {
        p = $app.findFirstRecordByData('projects', 'project_key', projectKey)
      } catch (_) {
        p = null
      }
      const pasta = p ? p.getString('sp_folder').trim() : ''
      if (!pasta) {
        audit('access_denied', 'vínculo SharePoint: projeto sem pasta mapeada (sp_folder)')
        return e.forbiddenError('O projeto não tem pasta mapeada no SharePoint. Solicite ao líder.')
      }
      const dentro = caminho === pasta || caminho.indexOf(pasta + '/') === 0
      if (!dentro) {
        audit('access_denied', 'vínculo SharePoint fora do escopo: ' + caminho.slice(0, 80))
        return e.forbiddenError('Este arquivo está fora do escopo do projeto.')
      }
    }

    if (it.getBool('origem_pendente') === false && it.getString('sp_caminho')) {
      throw new BadRequestError('Item já vinculado ao SharePoint — inative-o e crie outro.')
    }
    if (it.getString('tipo') !== 'documento') {
      throw new BadRequestError('Só documentos podem ser vinculados ao SharePoint.')
    }

    // --- token (ms_tokens) com renovação via secret — mesmo padrão do navegador ---
    const TENANT_ID = '95113c2b-7857-42d4-914b-b5ee6eb8b2a6'
    const CLIENT_ID = '14d82eec-204b-4c2f-b7e8-296a70dab67e'
    const GRAPH = 'https://graph.microsoft.com/v1.0'
    const SITE_DRIVE_ID = 'b!Q-f1bATuyU6wp7pfPIHS_-EVCSdET_hGk5x5003WuSnAgTGiCiHTTZMfj4srMeo-'
    const ESCOPO =
      'https://graph.microsoft.com/Sites.Read.All https://graph.microsoft.com/Files.ReadWrite https://graph.microsoft.com/Sites.ReadWrite.All offline_access'

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
        audit('workspace_vinculado', 'vínculo falhou: renovação de token (transporte)')
        return e.json(200, { vinculado: false, aviso: 'SharePoint indisponível agora.' })
      }
      if (res.statusCode !== 200) {
        audit('workspace_vinculado', 'vínculo falhou: renovação HTTP ' + res.statusCode)
        return e.json(200, {
          vinculado: false,
          aviso: 'Credencial do SharePoint precisa de renovação (HTTP ' + res.statusCode + ').',
        })
      }
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

    // --- resolve o caminho no Graph (metadados + webUrl permanente) ---
    let res = null
    try {
      res = $http.send({
        url:
          GRAPH +
          '/drives/' +
          SITE_DRIVE_ID +
          '/root:/' +
          encodeURIComponent(caminho) +
          '?$select=name,webUrl,size,file,folder',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 30,
      })
    } catch (errG) {
      audit('workspace_vinculado', 'vínculo falhou: Graph indisponível (transporte)')
      return e.json(200, { vinculado: false, aviso: 'SharePoint indisponível agora.' })
    }
    if (res.statusCode === 404) {
      return e.notFoundError('Arquivo não encontrado no SharePoint.')
    }
    if (res.statusCode >= 400) {
      let msg = 'Graph HTTP ' + res.statusCode
      try {
        const j = res.json || {}
        if (j && j.error && j.error.message) msg = j.error.message
      } catch (_) {}
      audit('workspace_vinculado', 'vínculo falhou: ' + msg)
      return e.json(200, { vinculado: false, aviso: 'Falha no SharePoint (' + msg + ').' })
    }
    const meta = res.json || {}
    if (!meta.webUrl) {
      return e.json(200, { vinculado: false, aviso: 'SharePoint não devolveu link do arquivo.' })
    }

    // --- grava o vínculo e fecha o badge ORIGEM PENDENTE ---
    it.set('sp_caminho', caminho)
    it.set('sp_weburl', meta.webUrl)
    it.set('origem_url', meta.webUrl)
    it.set('origem_tipo', 'SharePoint')
    it.set('origem_pendente', false)
    $app.save(it)

    audit(
      'workspace_vinculado',
      'documento: ' + it.getString('titulo') + ' — ' + caminho + ' → ' + meta.webUrl.slice(0, 120),
    )

    return e.json(200, {
      vinculado: true,
      id: it.id,
      sp_caminho: caminho,
      sp_weburl: meta.webUrl,
      origem_pendente: false,
    })
  },
  $apis.requireAuth(),
)
