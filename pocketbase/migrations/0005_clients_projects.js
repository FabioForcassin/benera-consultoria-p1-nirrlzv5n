// T1.3 — Modelo de cliente, tipo de serviço e projeto (SPEC-1-002, CA-1-007)
// Matriz validada pelo champion (05/10/2026): admin e líder cadastram; consultor/revisor não.
migrate(
  (app) => {
    // 1) service_types: catálogo simples de tipos de serviço
    const serviceTypes = new Collection({
      name: 'service_types',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'name', type: 'text', required: true, min: 2, max: 100 },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_service_types_name ON service_types (name)'],
    })
    app.save(serviceTypes)

    // 2) clients: cadastro de clientes
    const clients = new Collection({
      name: 'clients',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'name', type: 'text', required: true, min: 2, max: 200 },
        { name: 'document', type: 'text', max: 32 },
        { name: 'active', type: 'bool' },
        { name: 'created_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_clients_name ON clients (name)'],
    })
    app.save(clients)

    // 3) projects: projeto com campos mínimos do cartão
    const clientsId = app.findCollectionByNameOrId('clients').id
    const serviceTypesId = app.findCollectionByNameOrId('service_types').id
    const projects = new Collection({
      name: 'projects',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'project_key', type: 'text', required: true, min: 3, max: 100 },
        { name: 'name', type: 'text', required: true, min: 2, max: 200 },
        {
          name: 'client_id',
          type: 'relation',
          collectionId: clientsId,
          required: true,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'service_type_id',
          type: 'relation',
          collectionId: serviceTypesId,
          required: true,
          maxSelect: 1,
        },
        {
          name: 'owner_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
        },
        {
          name: 'stage',
          type: 'select',
          values: ['Entrada', 'Kick-off', 'Diagnóstico', 'Entrega', 'Encerrado'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'priority',
          type: 'select',
          values: ['baixa', 'media', 'alta'],
          maxSelect: 1,
          required: true,
        },
        { name: 'due_date', type: 'date', required: true },
        { name: 'next_action', type: 'text', required: true, min: 3, max: 500 },
        { name: 'active', type: 'bool' },
        { name: 'created_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_projects_key ON projects (project_key)'],
    })
    app.save(projects)

    // 4) tipos de serviço iniciais (nomenclatura provisória — validação do champion pendente)
    const tipos = [
      'Diagnóstico',
      'Cargos e Salários',
      'Remuneração Variável',
      'Desenho Organizacional',
    ]
    for (const nome of tipos) {
      try {
        app.findFirstRecordByData('service_types', 'name', nome)
      } catch (_) {
        const rec = new Record(serviceTypes)
        rec.set('name', nome)
        rec.set('active', true)
        app.save(rec)
      }
    }

    // 5) fixture: cliente ACME-FIXTURE + projeto PROJ-F1-001 (exigidos pela SPEC)
    let acme = null
    try {
      acme = app.findFirstRecordByData('clients', 'name', 'ACME-FIXTURE')
    } catch (_) {
      acme = new Record(clients)
      acme.set('name', 'ACME-FIXTURE')
      acme.set('document', '00.000.000/0001-00')
      acme.set('active', true)
      app.save(acme)
    }

    const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'u-admin@example.invalid')
    if (admin) {
      try {
        app.findFirstRecordByData('projects', 'project_key', 'PROJ-F1-001')
      } catch (_) {
        const diag = app.findFirstRecordByData('service_types', 'name', 'Diagnóstico')
        const proj = new Record(projects)
        proj.set('project_key', 'PROJ-F1-001')
        proj.set('name', 'Projeto Piloto Fase 1')
        proj.set('client_id', acme.id)
        proj.set('service_type_id', diag.id)
        proj.set('owner_id', admin.id)
        proj.set('stage', 'Entrada')
        proj.set('priority', 'media')
        proj.set('due_date', '2026-12-31 23:59:59.000Z')
        proj.set('next_action', 'Agendar kick-off com o cliente')
        proj.set('active', true)
        proj.set('created_by', admin.id)
        app.save(proj)
      }
    }

    console.log('T1.3: coleções clients/service_types/projects criadas + fixture')
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('projects'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('clients'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('service_types'))
    } catch (_) {}
  },
)
