// T2.4 — Upload auditado para a pasta do projeto (CA-2-017..020). [v2 reescrita p/ re-registro]
// Regra do dono (26/10): conexão/configuração do SharePoint = SÓ admin; o consultor
// NUNCA escolhe rede/destino — o destino é SEMPRE a pasta mapeada no projeto
// (projects.sp_folder). O hook nem aceita parâmetro de destino.
// Fluxo (padrão Graph upload session — binário não passa pelo JSVM):
//   1) POST /backend/v1/projects/{key}/sharepoint-upload  { nome, tamanho }
//      → valida escopo por vínculo + sp_folder mapeada + nome sanitizado +
//        tamanho ≤ 10 MB; cria upload session no Graph (dentro da pasta do
//        projeto); devolve { uploadUrl, caminho, item_id }.
//   2) O navegador faz PUT do binário direto na uploadUrl (uso único, expira).
//   3) POST /backend/v1/projects/{key}/sharepoint-upload-finalizar { item_id }
//      → confirma no Graph, grava sp_caminho/sp_weburl/origem_url, cria evento
//        workspace_upload na auditoria (ator, caminho, tamanho).
// A credencial nunca chega ao navegador; a uploadUrl é de uso único e expira.
routerAdd(
  'POST',
  '/backend/v1/projects/{key}/sharepoint-upload',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const projectKey = e.request.pathValue('key')
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
        audit('access_denied', 'upload SharePoint sem vínculo ao projeto')
        return e.forbiddenError('Você não tem vínculo com este projeto.')
      }
    }

    let p = null
    try {
      p = $app.findFirstRecordByData('projects', 'project_key', projectKey)
    } catch (_) {
      return e.notFoundError('Projeto não encontrado.')
    }

    // destino = pasta mapeada pelo admin — sem parâmetro de destino no request
    const pasta = p.getString('sp_folder').trim()
    if (!pasta) {
      audit('access_denied', 'upload SharePoint: projeto sem pasta mapeada (sp_folder)')
      return e.forbiddenError('O projeto não tem pasta mapeada no SharePoint. Solicite ao líder.')
    }

    const data = new DynamicModel({ nome: '', tamanho: 0 })
    e.bindBody(data)
    const nomeBruto = (data.nome || '').trim()
    const tamanho = Math.floor(Number(data.tamanho) || 0)

    // sanitização do nome: só caminho seguro, sem separadores
    if (
      !nomeBruto ||
      nomeBruto.indexOf('/') >= 0 ||
      nomeBruto.indexOf('\\') >= 0 ||
      nomeBruto.indexOf('..') >= 0
    ) {
      audit('access_denied', 'upload SharePoint: nome inválido: ' + nomeBruto.slice(0, 80))
      throw new BadRequestError('Nome de arquivo inválido.')
    }
    const nome = nomeBruto.slice(0, 150)
    if (tamanho <= 0 || tamanho > 10 * 1024 * 1024) {
      audit('access_denied', 'upload SharePoint: tamanho inválido (' + tamanho + ' B)')
      throw new BadRequestError('Arquivo deve ter entre 1 byte e 10 MB.')
    }

    // --- token (ms_tokens) com renovação via secret — padrão T2.2 ---
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
        audit('workspace_upload', 'upload falhou: renovação de token (transporte)')
        return e.json(200, { aviso: 'SharePoint indisponível agora (renovação).' })
      }
      if (res.statusCode !== 200) {
        audit('workspace_upload', 'upload falhou: renovação HTTP ' + res.statusCode)
        return e.json(200, {
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

    // --- cria o item de workspace PENDENTE (rastro nasce antes do binário) ---
    const wsCol = $app.findCollectionByNameOrId('workspace_items')
    const item = new Record(wsCol)
    item.set('project_key', projectKey)
    item.set('tipo', 'documento')
    item.set('titulo', nome)
    item.set('conteudo', '')
    item.set('origem_tipo', 'SharePoint')
    item.set('origem_pendente', true)
    item.set('active', true)
    item.set('created_by', auth.id)
    $app.save(item)

    // --- upload session no Graph, DENTRO da pasta do projeto ---
    const caminho = pasta + '/' + nome
    let res = null
    try {
      res = $http.send({
        url:
          GRAPH +
          '/drives/' +
          SITE_DRIVE_ID +
          '/root:/' +
          encodeURIComponent(caminho) +
          ':/createUploadSession',
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: { '@microsoft.graph.conflictBehavior': 'fail' },
        }),
        timeout: 30,
      })
    } catch (errG) {
      $app.delete(item)
      audit('workspace_upload', 'upload falhou: Graph indisponível (transporte)')
      return e.json(200, { aviso: 'SharePoint indisponível agora.' })
    }
    if (res.statusCode === 409) {
      $app.delete(item)
      return e.json(200, {
        aviso: 'Já existe um arquivo com este nome na pasta do projeto. Renomeie e tente de novo.',
      })
    }
    if (res.statusCode >= 400) {
      $app.delete(item)
      let msg = 'Graph HTTP ' + res.statusCode
      try {
        const j = res.json || {}
        if (j && j.error && j.error.message) msg = j.error.message
      } catch (_) {}
      audit('workspace_upload', 'upload falhou: ' + msg)
      return e.json(200, { aviso: 'Falha no SharePoint (' + msg + ').' })
    }
    const sess = res.json || {}
    if (!sess.uploadUrl) {
      $app.delete(item)
      return e.json(200, { aviso: 'SharePoint não devolveu sessão de upload.' })
    }

    return e.json(200, {
      item_id: item.id,
      caminho: caminho,
      uploadUrl: sess.uploadUrl,
      expira_em: sess.expirationDateTime || '',
    })
  },
  $apis.requireAuth(),
)

// --- finalização: confirma no Graph, grava vínculo e audita ---
routerAdd(
  'POST',
  '/backend/v1/projects/{key}/sharepoint-upload-finalizar',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const projectKey = e.request.pathValue('key')
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
        audit('access_denied', 'finalizar upload sem vínculo ao projeto')
        return e.forbiddenError('Você não tem vínculo com este projeto.')
      }
    }

    const data = new DynamicModel({ item_id: '' })
    e.bindBody(data)
    let item = null
    try {
      item = $app.findRecordById('workspace_items', (data.item_id || '').trim())
    } catch (_) {
      return e.notFoundError('Item de upload não encontrado.')
    }
    if (item.getString('project_key') !== projectKey) {
      audit('access_denied', 'finalizar upload: item de outro projeto')
      return e.forbiddenError('Item não pertence a este projeto.')
    }
    if (!item.getBool('origem_pendente')) {
      throw new BadRequestError('Upload já finalizado.')
    }

    const pasta = (() => {
      try {
        const p = $app.findFirstRecordByData('projects', 'project_key', projectKey)
        return p.getString('sp_folder').trim()
      } catch (_) {
        return ''
      }
    })()
    const caminho = pasta + '/' + item.getString('titulo')

    // --- token (mesmo padrão) ---
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
      if (!rt) throw new BadRequestError('Credencial do SharePoint não configurada.')
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
        return e.json(200, { aviso: 'SharePoint indisponível agora (renovação).' })
      }
      if (res.statusCode !== 200) {
        return e.json(200, {
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

    // --- confirma o arquivo no Graph (metadados + webUrl) ---
    let res = null
    try {
      res = $http.send({
        url:
          GRAPH +
          '/drives/' +
          SITE_DRIVE_ID +
          '/root:/' +
          encodeURIComponent(caminho) +
          '?$select=name,webUrl,size,file',
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        timeout: 30,
      })
    } catch (errG) {
      return e.json(200, { aviso: 'Não foi possível confirmar o arquivo no SharePoint.' })
    }
    if (res.statusCode === 404) {
      // binário nunca chegou — item pendente permanece para nova tentativa
      return e.json(200, {
        aviso: 'Arquivo não encontrado no SharePoint — o envio não foi concluído.',
      })
    }
    if (res.statusCode >= 400) {
      return e.json(200, { aviso: 'Falha ao confirmar o arquivo (HTTP ' + res.statusCode + ').' })
    }
    const meta = res.json || {}
    if (!meta.webUrl) {
      return e.json(200, { aviso: 'SharePoint não devolveu link do arquivo.' })
    }

    item.set('sp_caminho', caminho)
    item.set('sp_weburl', meta.webUrl)
    item.set('origem_url', meta.webUrl)
    item.set('origem_tipo', 'SharePoint')
    item.set('origem_pendente', false)
    $app.save(item)

    audit(
      'workspace_upload',
      'documento: ' +
        item.getString('titulo') +
        ' — ' +
        caminho +
        ' (' +
        (meta.size || 0) +
        ' B) → ' +
        meta.webUrl.slice(0, 100),
    )

    return e.json(200, {
      ok: true,
      id: item.id,
      sp_caminho: caminho,
      sp_weburl: meta.webUrl,
      tamanho: meta.size || 0,
    })
  },
  $apis.requireAuth(),
)
