// adapta-divida: links de e-mail apontam para preview enquanto produção não está publicada; remover este hook quando a produção for publicada (gatilho: isPublished=true no Skip 63138)
// Corrige {RESET_URL}/{CONFIRMATION_URL} que resolvem para o host de produção não publicado (404).
onMailerRecordPasswordResetSend((e) => {
  const prodHost = 'https://login-benera-consultoria-955b4.goskip.app'
  const previewHost = 'https://login-benera-consultoria-955b4--preview.goskip.app'
  if (e.message && e.message.html && e.message.html.indexOf(prodHost) >= 0) {
    e.message.html = e.message.html.split(prodHost).join(previewHost)
  }
  e.next()
})

onMailerRecordVerificationSend((e) => {
  const prodHost = 'https://login-benera-consultoria-955b4.goskip.app'
  const previewHost = 'https://login-benera-consultoria-955b4--preview.goskip.app'
  if (e.message && e.message.html && e.message.html.indexOf(prodHost) >= 0) {
    e.message.html = e.message.html.split(prodHost).join(previewHost)
  }
  e.next()
})
