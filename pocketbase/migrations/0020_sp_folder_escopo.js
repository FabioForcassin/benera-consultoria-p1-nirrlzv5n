// T2.2b — Escopo do SharePoint por projeto (regra do dono 26/10/2026):
// Maestro/admin acessa 100% da biblioteca; consultor/revisor enxerga SOMENTE
// as pastas dos projetos em que está alocado. Campo sp_folder no projeto =
// mapeamento "pasta no SharePoint" (ex.: "00 - STARIAN"), preenchido por admin/líder.
migrate(
  (app) => {
    const projects = app.findCollectionByNameOrId('projects')
    if (!projects.fields.getByName('sp_folder')) {
      projects.fields.add(
        new Field({
          name: 'sp_folder',
          type: 'text',
          max: 300,
        }),
      )
      app.save(projects)
    }
    console.log('T2.2b: campo sp_folder adicionado a projects')
  },
  (app) => {
    try {
      const projects = app.findCollectionByNameOrId('projects')
      if (projects.fields.getByName('sp_folder')) {
        projects.fields.removeByName('sp_folder')
        app.save(projects)
      }
    } catch (_) {}
  },
)
