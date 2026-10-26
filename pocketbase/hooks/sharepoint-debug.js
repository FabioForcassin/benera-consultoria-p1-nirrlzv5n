// T2.2 — debug mínimo: isolar a origem do SyntaxError no hook do SharePoint.
routerAdd(
  'GET',
  '/backend/v1/sharepoint/debug',
  (e) => {
    const etapas = []
    const auth = e.auth
    etapas.push('auth: ' + (auth ? 'ok' : 'null'))

    let rec = null
    try {
      rec = $app.findFirstRecordByData('ms_tokens', 'chave', 'graph')
      etapas.push('ms_tokens: ' + (rec ? 'registro ' + rec.id : 'vazio'))
    } catch (err) {
      etapas.push('ms_tokens: erro ' + err)
    }

    let secret = ''
    try {
      secret = $secrets.get('SHAREPOINT_REFRESH_TOKEN') || ''
      etapas.push('secret: ' + (secret ? 'presente (' + secret.length + ' chars)' : 'VAZIO'))
    } catch (err) {
      etapas.push('secret: erro ' + err)
    }

    let res = null
    try {
      res = $http.send({
        url: 'https://login.microsoftonline.com/95113c2b-7857-42d4-914b-b5ee6eb8b2a6/oauth2/v2.0/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:
          'client_id=' +
          encodeURIComponent('14d82eec-204b-4c2f-b7e8-296a70dab67e') +
          '&grant_type=refresh_token&refresh_token=' +
          encodeURIComponent(secret || (rec ? rec.getString('refresh_token') : '')) +
          '&scope=' +
          encodeURIComponent('https://graph.microsoft.com/Sites.Read.All offline_access'),
        timeout: 30,
      })
      etapas.push(
        'oauth: HTTP ' +
          res.statusCode +
          ' | body len: ' +
          (res.body ? res.body.length : 'null') +
          ' | json: ' +
          (res.json ? 'presente' : 'null'),
      )
      if (res.json) etapas.push('oauth json keys: ' + Object.keys(res.json).join(','))
    } catch (err) {
      etapas.push('oauth: EXCEÇÃO ' + err)
    }

    return e.json(200, { etapas: etapas })
  },
  $apis.requireAuth(),
)
