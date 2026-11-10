// DESATIVADO em 10/11/2026 — QA-SEC.
//
// Esta rota (/backend/v1/sharepoint/debug) ficou acessível a QUALQUER usuário
// autenticado e executava um refresh OAuth real do Graph, devolvendo o diagnóstico
// da integração (presença e tamanho do segredo, resposta do provedor).
//
// Substituída por /backend/v1/sharepoint/diagnostico (sharepoint-diagnostico.js),
// que exige papel admin e audita a negativa.
//
// ATENÇÃO: como hook alterado não recarrega no pod e o routerAdd anterior persiste
// na instância viva, a rota antiga continua respondendo até o próximo restart.
// A versão que importa é a nova. Não reativar este arquivo.
