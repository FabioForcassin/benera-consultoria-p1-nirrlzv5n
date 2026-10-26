// T2.3 — Vínculo workspace ↔ SharePoint (CA-2-013..016).
// workspace_items ganha sp_caminho (caminho na biblioteca BENERA CORP) e sp_weburl
// (link permanente Graph). O vínculo resolve o caminho no Graph e grava webUrl em
// origem_url (origem_tipo = "SharePoint"), fechando o badge ORIGEM PENDENTE.
// Auditado como workspace_vinculado. Fallback manual (CA-1-030) preservado.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('workspace_items')
    if (!col.fields.getByName('sp_caminho')) {
      col.fields.add(new TextField({ name: 'sp_caminho', max: 300 }))
    }
    if (!col.fields.getByName('sp_weburl')) {
      col.fields.add(new URLField({ name: 'sp_weburl', max: 500 }))
    }
    app.save(col)

    const audit = app.findCollectionByNameOrId('audit_log')
    const actionField = audit.fields.getByName('action')
    const values = actionField.values
    if (values.indexOf('workspace_vinculado') < 0) values.push('workspace_vinculado')
    actionField.values = values
    app.save(audit)

    console.log('T2.3: sp_caminho/sp_weburl em workspace_items; audit workspace_vinculado')
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('workspace_items')
      col.fields.removeByName('sp_caminho')
      col.fields.removeByName('sp_weburl')
      app.save(col)
    } catch (_) {}
    try {
      const audit = app.findCollectionByNameOrId('audit_log')
      const actionField = audit.fields.getByName('action')
      actionField.values = actionField.values.filter((v) => v !== 'workspace_vinculado')
      app.save(audit)
    } catch (_) {}
  },
)
