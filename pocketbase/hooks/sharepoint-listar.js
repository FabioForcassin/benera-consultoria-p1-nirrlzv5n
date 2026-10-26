// T2.2 — Navegador de arquivos do SharePoint (CA-2-005..008).
// GET /backend/v1/sharepoint/listar?caminho=...&busca=... — tudo SERVER-SIDE:
// o token Graph vive na coleção ms_tokens (regras nulas) + secret SHAREPOINT_REFRESH_TOKEN
// e NUNCA aparece em código, log ou resposta (CA-2-008).
// Permissão (CA-2-007): admin/líder qualquer; consultor/revisor com ≥1 vínculo ativo
// em project_members; sem vínculo → 403 auditado (access_denied).
// Sanitização: caminho com ".." ou começando com "/" → 400.
// Busca: Graph search por nome, devolvendo caminho completo (CA-2-006).
// Cada consulta auditada como sharepoint_consulta (ator, modo, nº de itens).
// Erro do Graph → mensagem visível sem stack; caminho inexistente → 404 limpo.
const TENANT_ID = '95113c2b-7857-42d4-914b-b5ee6eb8b2a6'
const CLIENT_ID = '14d82eec-204b-4c2f-b7e8-296a70dab67e' // Microsoft Graph Command Line Tools (oficial MS)
const GRAPH = 'https://graph.microsoft.com/v1.0'
const SITE_DRIVE_ID = 'b!Q-f1bATuyU6wp7pfPIHS_-EVCSdET_hGk5x5003WuSnAgTGiCiHTTZMfj4srMeo-'
const ESCOPO =
  'https://graph.microsoft.com/Sites.Read.All https://graph.microsoft.com/Files.ReadWrite https://graph.microsoft.com/Sites.ReadWrite.All offline_access'

function auditLog(e, auth, action, detail) {
  try {
    const col = $app.findCollectionByNameOrId('audit_log')
    const log = new Record(col)
    log.set('actor_id', auth ? auth.id : '')
    log.set('actor_email', auth ? auth.getString('email') : '')
    log.set('action', action)
    log.set('project_key', '')
    log.set('detail', String(detail).slice(0, 500))
    $app.save(log)
  } catch (err) {
    // auditoria nunca derruba a requisição
  }
}

// Token corrente: usa ms_tokens se válido; senão renova via refresh (secret) e
// persiste o novo par (o Azure rotaciona o refresh a cada uso).
function getToken() {
  let rec = null
  try {
    rec = $app.findFirstRecordByData('ms_tokens', 'chave', 'graph')
  } catch (_) {
    rec = null
  }
  const agora = Math.floor(Date.now() / 1000)
  if (rec) {
    const exp = rec.getInt('expira_em') || 0
    const at = rec.getString('access_token')
    if (at && exp - 120 > agora) return at
  }
  // renova
  const secret = $secrets.get('SHAREPOINT_REFRESH_TOKEN')
  const rt = rec && rec.getString('refresh_token') ? rec.getString('refresh_token') : secret
  if (!rt) throw new BadRequestError('Credencial do SharePoint não configurada (secret ausente).')
  const body =
    'client_id=' +
    encodeURIComponent(CLIENT_ID) +
    '&grant_type=refresh_token&refresh_token=' +
    encodeURIComponent(rt) +
    '&scope=' +
    encodeURIComponent(ESCOPO)
  const res = $http.send({
    url: 'https://login.microsoftonline.com/' + TENANT_ID + '/oauth2/v2.0/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body,
    timeout: 30,
  })
  if (res.statusCode !== 200) {
    throw new BadRequestError(
      'Falha ao renovar credencial do SharePoint (HTTP ' + res.statusCode + ').',
    )
  }
  const tok = JSON.parse(res.body)
  if (!tok.access_token) throw new BadRequestError('Resposta OAuth sem access_token.')
  const expira = agora + (tok.expires_in || 3600)
  if (rec) {
    rec.set('access_token', tok.access_token)
    if (tok.refresh_token) rec.set('refresh_token', tok.refresh_token)
    rec.set('expira_em', expira)
    $app.save(rec)
  } else {
    const col = $app.findCollectionByNameOrId('ms_tokens')
    const novo = new Record(col)
    novo.set('chave', 'graph')
    novo.set('access_token', tok.access_token)
    novo.set('refresh_token', tok.refresh_token || rt)
    novo.set('expira_em', expira)
    $app.save(novo)
  }
  return tok.access_token
}

function graphGet(token, path, params) {
  let url = GRAPH + path
  if (params) url += '?' + params
  const res = $http.send({
    url: url,
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    timeout: 30,
  })
  if (res.statusCode === 404) return { status: 404, data: null }
  if (res.statusCode >= 400) {
    let msg = 'Graph HTTP ' + res.statusCode
    try {
      const j = JSON.parse(res.body)
      if (j && j.error && j.error.message) msg = j.error.message
    } catch (_) {}
    return { status: res.statusCode, data: null, erro: msg }
  }
  return { status: 200, data: JSON.parse(res.body) }
}

routerAdd(
  'GET',
  '/backend/v1/sharepoint/listar',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    const papel = auth.getString('role')
    const podeGlobal = papel === 'admin' || papel === 'lider'
    if (!podeGlobal) {
      // consultor/revisor: precisa de ≥1 vínculo ativo em project_members
      const vinculos = $app.findRecordsByFilter(
        'project_members',
        'user_id = {:uid}',
        '-created',
        1,
        0,
        { uid: auth.id },
      )
      if (vinculos.length === 0) {
        auditLog(e, auth, 'access_denied', 'navegador SharePoint sem vínculo a nenhum projeto')
        return e.forbiddenError('Você não tem vínculo com nenhum projeto.')
      }
    }

    // parâmetros (defensivo: duas formas de acessar a URL)
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

    // sanitização de caminho
    if (caminho.indexOf('..') >= 0 || (caminho && caminho.charAt(0) === '/')) {
      auditLog(
        e,
        auth,
        'access_denied',
        'caminho inválido no navegador SharePoint: ' + caminho.slice(0, 80),
      )
      throw new BadRequestError('Caminho inválido.')
    }

    const token = getToken()
    let itens = []
    let modo = 'listar'

    if (busca) {
      modo = 'buscar'
      const q = busca.replace(/'/g, "''")
      const r = graphGet(
        token,
        '/drives/' + SITE_DRIVE_ID + "/root/search(q='" + encodeURIComponent(q) + "')",
        '$select=name,webUrl,folder,file,size,lastModifiedDateTime,parentReference&$top=50',
      )
      if (r.status === 200 && r.data && r.data.value) {
        for (const i of r.data.value) {
          const parent = ((i.parentReference || {}).path || '').split('root:')[-1] || ''
          itens.push({
            nome: i.name,
            pasta: !!i.folder,
            tamanho: i.size || 0,
            modificado: (i.lastModifiedDateTime || '').slice(0, 10),
            caminho: (parent ? parent + '/' : '') + i.name,
            webUrl: i.webUrl || '',
          })
        }
      } else if (r.status !== 200) {
        auditLog(e, auth, 'sharepoint_consulta', 'busca falhou: ' + (r.erro || r.status))
        return e.json(200, {
          itens: [],
          modo: modo,
          aviso: 'Busca indisponível agora (' + (r.erro || r.status) + ').',
        })
      }
    } else {
      const base = caminho
        ? '/drives/' + SITE_DRIVE_ID + '/root:/' + encodeURIComponent(caminho)
        : '/drives/' + SITE_DRIVE_ID + '/root'
      const r = graphGet(
        token,
        base + (caminho ? ':/children' : '/children'),
        '$select=name,webUrl,folder,file,size,lastModifiedDateTime&$top=200',
      )
      if (r.status === 404) return e.notFoundError('Caminho não encontrado no SharePoint.')
      if (r.status !== 200) {
        auditLog(e, auth, 'sharepoint_consulta', 'listagem falhou: ' + (r.erro || r.status))
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
      itens.sort((a, b) =>
        a.pasta === b.pasta
          ? a.nome.toLowerCase() < b.nome.toLowerCase()
            ? -1
            : 1
          : a.pasta
            ? -1
            : 1,
      )
    }

    auditLog(
      e,
      auth,
      'sharepoint_consulta',
      modo +
        ' — caminho: ' +
        (caminho || 'raiz') +
        ' — ' +
        itens.length +
        ' itens' +
        (busca ? ' — busca: ' + busca.slice(0, 60) : ''),
    )
    return e.json(200, {
      itens: itens,
      modo: modo,
      caminho: caminho,
      busca: busca,
      total: itens.length,
    })
  },
  $apis.requireAuth(),
)
