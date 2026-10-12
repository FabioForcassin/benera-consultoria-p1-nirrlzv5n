// T1.7 — Coleções de tarefas e itens de checklist (CA-1-019/020).
// Padrão T1.2: regras NULAS (acesso só via hooks server-side); status como TEXT
// com validação no hook (lição da 0009: SelectField novo não é editável no jsvm).
// task_items → tasks: relação resolvida APÓS salvar tasks (guardrail: coleção criada
// na mesma migração não resolve collectionId por nome).
migrate(
  (app) => {
    // 1) tasks: unidade de trabalho vinculada ao projeto, com responsável, prazo,
    //    status e evidência esperada.
    const tasks = new Collection({
      name: 'tasks',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'project_key', type: 'text', required: true, min: 1, max: 100 },
        {
          name: 'titulo',
          type: 'text',
          required: true,
          min: 3,
          max: 200,
        },
        { name: 'descricao', type: 'text', max: 2000 },
        {
          name: 'assignee_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'due_date', type: 'date' },
        {
          name: 'status',
          type: 'text',
          required: true,
          max: 20,
        },
        { name: 'evidencia_esperada', type: 'text', max: 500 },
        { name: 'created_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_task_project ON tasks (project_key)',
        'CREATE INDEX idx_task_assignee ON tasks (assignee_id)',
        'CREATE INDEX idx_task_status ON tasks (status)',
      ],
    })
    app.save(tasks)

    // 2) task_items: itens do checklist; obrigatorio=true trava a conclusão da tarefa.
    //    Relação para tasks resolvida pelo id real (coleção acabou de ser criada acima).
    const tasksId = app.findCollectionByNameOrId('tasks').id
    const items = new Collection({
      name: 'task_items',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'task_id',
          type: 'relation',
          collectionId: tasksId,
          required: true,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'titulo', type: 'text', required: true, min: 1, max: 200 },
        { name: 'obrigatorio', type: 'bool', required: true },
        { name: 'concluido', type: 'bool', required: true },
        { name: 'ordem', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_taskitem_task ON task_items (task_id)'],
    })
    app.save(items)

    console.log('T1.7: coleções tasks e task_items criadas (regras nulas, status TEXT)')
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('task_items'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('tasks'))
    } catch (_) {}
  },
)
