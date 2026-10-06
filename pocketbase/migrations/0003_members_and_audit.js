// T1.2 — Estrutura de vínculo, revogação e auditoria (recorte independente do CRUD de projetos)
migrate(
  (app) => {
    // 1) project_members: vínculo usuário↔projeto com papel no projeto.
    //    Regras nulas = só superusuário via API direta; acesso real só via hooks server-side.
    const members = new Collection({
      name: 'project_members',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'user_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'project_key', type: 'text', required: true, min: 1, max: 100 },
        {
          name: 'project_role',
          type: 'select',
          values: ['admin', 'lider', 'consultor', 'revisor'],
          maxSelect: 1,
          required: true,
        },
        { name: 'granted_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_pm_user_project ON project_members (user_id, project_key)',
        'CREATE INDEX idx_pm_project ON project_members (project_key)',
      ],
    })
    app.save(members)

    // 2) audit_log: eventos de acesso com ator e horário, sem segredos.
    //    Somente superusuário via API; escrita real só pelos hooks.
    const audit = new Collection({
      name: 'audit_log',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'actor_id', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'actor_email', type: 'text', max: 255 },
        {
          name: 'action',
          type: 'select',
          values: [
            'invite_created',
            'invite_accepted',
            'member_granted',
            'member_revoked',
            'access_denied',
            'config_changed',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'target_user', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'project_key', type: 'text', max: 100 },
        { name: 'detail', type: 'text', max: 500 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audit_actor ON audit_log (actor_id)',
        'CREATE INDEX idx_audit_action ON audit_log (action)',
        'CREATE INDEX idx_audit_project ON audit_log (project_key)',
      ],
    })
    app.save(audit)

    console.log('T1.2: coleções project_members e audit_log criadas')
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('audit_log'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('project_members'))
    } catch (_) {}
  },
)
