// QA-SEC — Fecha a rota de diagnóstico do SharePoint.
// A rota /backend/v1/sharepoint/debug nasceu como instrumento de depuração (T2.2) e
// ficou aberta a QUALQUER autenticado: um revisor (papel mínimo) dispara um refresh
// OAuth real e lê o diagnóstico da integração — inclusive presença e tamanho do segredo.
//
// Correção: passa a exigir papel admin. Não é removida porque ainda serve ao
// diagnóstico quando o Graph falha — mas só para quem pode configurar a integração.
//
// LIÇÃO APLICADA: hook alterado não recarrega no pod → arquivo novo (diagnostico) com
// OUTRO caminho; o antigo fica inerte na prática (o routerAdd anterior persiste).
routerAdd(
  'GET',
  '/backend/v1/sharepoint/diagnostico',
  (e) => {
    if (e.hasSuperuserAuth()) return e.next()
    const auth = e.auth
    if (!auth) return e.unauthorizedError('Autenticação necessária.')

    // Antes: qualquer autenticado. Agora: só admin (configuração da integração é dele).
    const papel = auth.getString('role')
    if (papel !== 'admin') {
      const auditCol = $app.findCollectionByNameOrId('audit_log')
      const logNeg = new Record(auditCol)
      logNeg.set('actor_id', auth.id)
      logNeg.set('actor_email', auth.getString('email'))
      logNeg.set('action', 'access_denied')
      logNeg.set('project_key', '')
      logNeg.set(
        'detail',
        'diagnóstico do SharePoint negado — papel ' + papel + ' sem alçada de integração',
      )
      $app.save(logNeg)
      return e.forbiddenError('Somente administrador pode diagnosticar a integração.')
    }

    const etapas = []
    etapas.push('auth: admin ok')

    let rec = null
    try {
      rec = $app.findFirstRecordByData('ms_tokens', 'chave', 'graph')
      etapas.push('ms_tokens: ' + (rec ? 'registro presente' : 'vazio'))
    } catch (err) {
      etapas.push('ms_tokens: erro ' + String(err).slice(0, 120))
    }

    let secret = ''
    try {
      secret = $secrets.get('SHAREPOINT_REFRESH_TOKEN') || ''
      // Não revela o tamanho exato do segredo (dava pista sobre a credencial)
      etapas.push('secret: ' + (secret ? 'presente' : 'VAZIO'))
    } catch (err) {
      etapas.push('secret: erro ' + String(err).slice(0, 120))
    }

    try {
      const res = $http.send({
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
      etapas.push('oauth: HTTP ' + res.statusCode)
      if (res.json) {
        etapas.push('oauth: json presente')
        // Só o veredito, nunca o conteúdo do token
        if (res.json.error) etapas.push('oauth erro: ' + String(res.json.error).slice(0, 80))
      }
    } catch (err) {
      etapas.push('oauth: EXCEÇÃO ' + String(err).slice(0, 120))
    }

    return e.json(200, { papel: papel, etapas: etapas })
  },
  $apis.requireAuth(),
)
