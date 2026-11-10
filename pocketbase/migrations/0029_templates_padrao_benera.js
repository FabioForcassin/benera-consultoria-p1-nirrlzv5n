// TPL-2 — Conteúdo dos templates padrão da Benera.
//
// Origem do roteiro (não é invenção):
//   - DESENHO ORGANIZACIONAL: proposta real "Org Design — Diretoria Industrial"
//     (artifacts/Proposta - Org Design - Dir Industrial 030226_update.pdf):
//     cronograma de 18 semanas, 3 macrofases (Imersão/Diagnóstico 6sem →
//     Construção/Desenho 7sem → Recomendação/Entrega 3sem) e os entregáveis
//     por fase (diagnóstico, TO BE, gap analysis, competitividade externa,
//     job evaluation, DE-PARA).
//   - CARGOS E SALÁRIOS: roteiro de 18 tarefas usado na simulação de 10/11,
//     que seguiu as 6 etapas clássicas (kick-off, coleta, entrevistas,
//     avaliação, pesquisa/tabela, entrega).
//   - DIAGNÓSTICO e REMUNERAÇÃO VARIÁVEL: derivados das mesmas fases, com as
//     tarefas próprias de cada frente.
//
// Regra de prazo: cada tarefa tem `folga_semanas` (semanas após o início do
// projeto) e `duracao_semanas`. O prazo real é calculado na aplicação —
// o consultor não digita data tarefa por tarefa.
//
// Idempotente: se o template já existe (pelo nome), não duplica.
migrate(
  (app) => {
    const tipos = {}
    try {
      const sts = app.findRecordsByFilter('service_types', 'id != ""', 'name', 50, 0)
      for (const s of sts) tipos[s.getString('name')] = s.id
    } catch (err) {
      console.log('TPL-2: não consegui ler service_types: ' + err)
      return
    }

    // ------------------------------------------------------------------ C&S
    const TPL_CARGOS = {
      nome: 'Cargos e Salários — padrão Benera',
      tipo: 'Cargos e Salários',
      descricao:
        'Roteiro completo de um projeto de C&S: kick-off, coleta, entrevistas, ' +
        'avaliação de cargos, pesquisa e tabela salarial, entrega. 14 semanas.',
      duracao: 14,
      itens: [
        // --- 1. Kick-off (semana 0-1)
        {
          t: 'Reunião de kick-off com o cliente',
          e: 'Entrada',
          folga: 1,
          dur: 1,
          ev: 'Ata da reunião com escopo, cronograma e responsáveis',
          ob: true,
          check: [
            'Agendar a reunião',
            'Enviar pauta com antecedência',
            'Registrar a ata na plataforma',
          ],
        },
        {
          t: 'Confirmar escopo, cronograma e pontos focais',
          e: 'Kick-off',
          folga: 1,
          dur: 1,
          ev: 'Cronograma validado por escrito pelo cliente',
          ob: true,
          check: [
            'Validar escopo por escrito',
            'Definir interlocutor do cliente',
            'Confirmar datas das entrevistas',
          ],
        },
        // --- 2. Coleta (semana 1-3)
        {
          t: 'Receber organograma atualizado',
          e: 'Kick-off',
          folga: 2,
          dur: 1,
          ev: 'Organograma vigente em arquivo, com áreas e gestores',
          ob: true,
          check: ['Solicitar ao RH', 'Conferir se todas as áreas estão presentes'],
        },
        {
          t: 'Receber base de colaboradores (cargos e salários)',
          e: 'Kick-off',
          folga: 3,
          dur: 1,
          ev: 'Base com cargo, salário, admissão e área por colaborador',
          ob: true,
          check: ['Solicitar ao RH', 'Conferir campos obrigatórios', 'Anonimizar se necessário'],
        },
        {
          t: 'Receber descrições de cargo existentes',
          e: 'Kick-off',
          folga: 3,
          dur: 1,
          ev: 'Descrições de cargo disponíveis, ou lista de lacunas',
          ob: false,
          check: ['Solicitar descrições', 'Levantar quais cargos não têm descrição'],
        },
        // --- 3. Diagnóstico / entrevistas (semana 3-6)
        {
          t: 'Entrevistar RH (dono do processo)',
          e: 'Diagnóstico',
          folga: 4,
          dur: 1,
          ev: 'Roteiro preenchido e principais dores levantadas',
          ob: true,
          check: ['Agendar entrevista', 'Aplicar roteiro', 'Registrar achados na plataforma'],
        },
        {
          t: 'Entrevistar gestores-chave',
          e: 'Diagnóstico',
          folga: 5,
          dur: 2,
          ev: 'Mínimo de 3 entrevistas registradas com achados consolidados',
          ob: true,
          check: [
            'Selecionar gestores com o RH',
            'Agendar as entrevistas',
            'Realizar e registrar cada uma',
          ],
        },
        {
          t: 'Consolidar diagnóstico e hipóteses',
          e: 'Diagnóstico',
          folga: 6,
          dur: 1,
          ev: 'Documento de diagnóstico com vulnerabilidades e oportunidades priorizadas',
          ob: true,
          check: [
            'Consolidar achados',
            'Priorizar por impacto e urgência',
            'Validar hipóteses com o RH',
          ],
        },
        // --- 4. Avaliação de cargos (semana 6-9)
        {
          t: 'Aplicar metodologia de avaliação de cargos',
          e: 'Diagnóstico',
          folga: 8,
          dur: 2,
          ev: 'Planilha de avaliação com score e grade por cargo',
          ob: true,
          check: [
            'Listar cargos a avaliar',
            'Aplicar os fatores da metodologia',
            'Revisar casos de fronteira',
          ],
        },
        {
          t: 'Calibrar cargos com o comitê do cliente',
          e: 'Diagnóstico',
          folga: 9,
          dur: 1,
          ev: 'Ata de calibração com ajustes justificados',
          ob: true,
          check: ['Convocar comitê', 'Apresentar avaliações', 'Registrar justificativas de ajuste'],
        },
        {
          t: 'Gerar estrutura de cargos e grades',
          e: 'Diagnóstico',
          folga: 9,
          dur: 1,
          ev: 'Estrutura de cargos com grades e níveis definidos',
          ob: true,
          check: ['Montar a matriz cargo × grade', 'Validar com o RH'],
        },
        // --- 5. Pesquisa e tabela (semana 9-12)
        {
          t: 'Definir benchmark de mercado',
          e: 'Entrega',
          folga: 10,
          dur: 1,
          ev: 'Definição das fontes e critérios de comparação',
          ob: true,
          check: [
            'Escolher fontes de pesquisa',
            'Definir critérios de matching',
            'Validar com o cliente',
          ],
        },
        {
          t: 'Cruzar dados internos com mercado',
          e: 'Entrega',
          folga: 11,
          dur: 1,
          ev: 'Planilha de comparação interno × mercado por cargo',
          ob: true,
          check: ['Consolidar dados internos', 'Aplicar matching de mercado', 'Identificar gaps'],
        },
        {
          t: 'Montar tabela salarial por faixa',
          e: 'Entrega',
          folga: 12,
          dur: 1,
          ev: 'Tabela salarial com faixas mínima, média e máxima por grade',
          ob: true,
          check: [
            'Definir amplitude das faixas',
            'Posicionar os cargos',
            'Validar aderência ao mercado',
          ],
        },
        // --- 6. Entrega (semana 12-14)
        {
          t: 'Montar apresentação executiva',
          e: 'Entrega',
          folga: 13,
          dur: 1,
          ev: 'Apresentação final revisada e aprovada internamente',
          ob: true,
          check: ['Montar o deck', 'Revisar com o sócio responsável'],
        },
        {
          t: 'Apresentar resultados para a diretoria',
          e: 'Entrega',
          folga: 14,
          dur: 1,
          ev: 'Apresentação realizada com registro de presença',
          ob: true,
          check: ['Agendar apresentação', 'Apresentar', 'Registrar dúvidas e próximos passos'],
        },
        {
          t: 'Entregar relatório final e materiais',
          e: 'Entrega',
          folga: 14,
          dur: 1,
          ev: 'Relatório e planilhas entregues na plataforma, com aceite do cliente',
          ob: true,
          check: [
            'Gerar relatório',
            'Subir os arquivos na plataforma',
            'Registrar o aceite do cliente',
          ],
        },
      ],
    }

    // ------------------------------------------------------- ORG DESIGN
    const TPL_ORGDESIGN = {
      nome: 'Desenho Organizacional — padrão Benera',
      tipo: 'Desenho Organizacional',
      descricao:
        'Roteiro da proposta real de Org Design: 18 semanas em 3 macrofases — ' +
        'Imersão/Diagnóstico (6 sem), Construção/Desenho (7 sem), ' +
        'Recomendação/Entrega (3 sem), com job evaluation e competitividade externa.',
      duracao: 18,
      itens: [
        // --- FASE 1: IMERSÃO E DIAGNÓSTICO (S1-S6)
        {
          t: 'Planejamento e kick-off do projeto',
          e: 'Entrada',
          folga: 1,
          dur: 1,
          ev: 'Plano de trabalho e cronograma validados com o cliente',
          ob: true,
          check: [
            'Reunião de kick-off',
            'Validar cronograma de 18 semanas',
            'Definir pontos focais',
          ],
        },
        {
          t: 'Imersão nos documentos existentes (estratégia, números, referências)',
          e: 'Kick-off',
          folga: 2,
          dur: 2,
          ev: 'Matriz de documentos analisados com lacunas identificadas',
          ob: true,
          check: ['Levantar documentos', 'Ler e catalogar', 'Registrar lacunas'],
        },
        {
          t: 'Entrevistas com executivos de RH',
          e: 'Diagnóstico',
          folga: 4,
          dur: 2,
          ev: 'Mínimo de 5 entrevistas registradas com achados',
          ob: true,
          check: ['Agendar as entrevistas', 'Aplicar roteiro', 'Registrar cada uma na plataforma'],
        },
        {
          t: 'Entrevistas com líderes do negócio',
          e: 'Diagnóstico',
          folga: 6,
          dur: 3,
          ev: 'Entrevistas com lideres registradas e consolidadas',
          ob: true,
          check: ['Mapear os líderes com o RH', 'Agendar por bloco', 'Registrar cada entrevista'],
        },
        {
          t: 'Diagnóstico AS IS da estrutura e macro atribuições',
          e: 'Diagnóstico',
          folga: 6,
          dur: 2,
          ev: 'Diagnóstico com estrutura atual, processos e pilares estratégicos',
          ob: true,
          check: [
            'Mapear estrutura atual',
            'Levantar macro atribuições',
            'Identificar processos críticos',
          ],
        },
        {
          t: 'Mapeamento de vulnerabilidades e oportunidades',
          e: 'Diagnóstico',
          folga: 6,
          dur: 1,
          ev: 'Matriz de vulnerabilidades priorizada por impacto e urgência',
          ob: true,
          check: ['Listar vulnerabilidades', 'Priorizar por impacto', 'Validar com RH'],
        },
        // --- FASE 2: DESENHO (S7-S13)
        {
          t: 'Construção de cenários e alternativas de estrutura (TO BE)',
          e: 'Diagnóstico',
          folga: 9,
          dur: 3,
          ev: 'Cenários de estrutura com vantagens e desvantagens',
          ob: true,
          check: ['Desenhar cenário A', 'Desenhar cenário B', 'Comparar impactos'],
        },
        {
          t: 'Desenho organizacional TO BE por área',
          e: 'Diagnóstico',
          folga: 11,
          dur: 2,
          ev: 'Organograma TO BE com níveis, títulos e macro processos',
          ob: true,
          check: ['Desenhar por área', 'Definir níveis e títulos', 'Validar coerência de layers'],
        },
        {
          t: 'Análise de layers, span of control e carreira',
          e: 'Diagnóstico',
          folga: 11,
          dur: 2,
          ev: 'Análise de camadas e amplitude de gestão com recomendações',
          ob: true,
          check: ['Medir layers atuais', 'Calcular span', 'Recomendar ajustes'],
        },
        {
          t: 'Gap analysis e impacto financeiro',
          e: 'Diagnóstico',
          folga: 12,
          dur: 1,
          ev: 'Gap entre AS IS e TO BE com impacto financeiro estimado',
          ob: true,
          check: ['Comparar AS IS × TO BE', 'Estimar custo de transição', 'Registrar premissas'],
        },
        {
          t: 'Avaliação de cargos (job evaluation)',
          e: 'Diagnóstico',
          folga: 13,
          dur: 2,
          ev: 'Cargos avaliados com peso relativo e grade',
          ob: true,
          check: ['Listar posições', 'Aplicar metodologia', 'Calibrar com o cliente'],
        },
        // --- FASE 3: RECOMENDAÇÃO (S14-S18)
        {
          t: 'Análise de competitividade externa (mercado)',
          e: 'Entrega',
          folga: 15,
          dur: 2,
          ev: 'Comparação com mercado e posicionamento por cargo crítico',
          ob: true,
          check: [
            'Definir benchmark',
            'Cruzar cargo a cargo',
            'Identificar gaps de competitividade',
          ],
        },
        {
          t: 'Recomendações de remuneração para cargos críticos',
          e: 'Entrega',
          folga: 16,
          dur: 1,
          ev: 'Recomendação de alternativas de atração e retenção',
          ob: true,
          check: ['Identificar cargos críticos', 'Propor alternativas', 'Estimar impacto'],
        },
        {
          t: 'DE-PARA de cargos e pessoas',
          e: 'Entrega',
          folga: 16,
          dur: 1,
          ev: 'Mapa DE-PARA atual × proposto por pessoa',
          ob: true,
          check: ['Listar atual', 'Mapear proposto', 'Validar enquadramento'],
        },
        {
          t: 'Apresentação final e recomendações',
          e: 'Entrega',
          folga: 17,
          dur: 1,
          ev: 'Apresentação executiva realizada com aceite',
          ob: true,
          check: ['Montar o deck', 'Revisar internamente', 'Apresentar e registrar aceite'],
        },
        {
          t: 'Transferência de conhecimento e encerramento',
          e: 'Entrega',
          folga: 18,
          dur: 1,
          ev: 'Materiais entregues e equipe do cliente capacitada',
          ob: true,
          check: [
            'Entregar todos os arquivos',
            'Rodar sessão de transferência',
            'Registrar encerramento',
          ],
        },
      ],
    }

    // ------------------------------------------------------- DIAGNÓSTICO
    const TPL_DIAG = {
      nome: 'Diagnóstico — padrão Benera',
      tipo: 'Diagnóstico',
      descricao:
        'Roteiro enxuto de diagnóstico: imersão, entrevistas, consolidação e ' +
        'apresentação de achados. 6 semanas.',
      duracao: 6,
      itens: [
        {
          t: 'Kick-off e alinhamento de expectativas',
          e: 'Entrada',
          folga: 1,
          dur: 1,
          ev: 'Ata de kick-off com escopo e cronograma',
          ob: true,
          check: ['Agendar kick-off', 'Validar escopo', 'Registrar ata'],
        },
        {
          t: 'Levantar documentos e dados existentes',
          e: 'Kick-off',
          folga: 2,
          dur: 1,
          ev: 'Lista de documentos analisados e lacunas',
          ob: true,
          check: ['Solicitar documentos', 'Catalogar', 'Registrar lacunas'],
        },
        {
          t: 'Entrevistar RH e gestores-chave',
          e: 'Diagnóstico',
          folga: 4,
          dur: 2,
          ev: 'Entrevistas registradas com achados',
          ob: true,
          check: ['Agendar', 'Aplicar roteiro', 'Registrar na plataforma'],
        },
        {
          t: 'Consolidar achados e priorizar',
          e: 'Diagnóstico',
          folga: 5,
          dur: 1,
          ev: 'Documento de diagnóstico com priorização',
          ob: true,
          check: ['Consolidar', 'Priorizar por impacto', 'Validar hipóteses'],
        },
        {
          t: 'Apresentar diagnóstico ao cliente',
          e: 'Entrega',
          folga: 6,
          dur: 1,
          ev: 'Apresentação realizada com aceite',
          ob: true,
          check: ['Montar apresentação', 'Apresentar', 'Registrar next steps'],
        },
      ],
    }

    // ---------------------------------------------- REMUNERAÇÃO VARIÁVEL
    const TPL_RV = {
      nome: 'Remuneração Variável — padrão Benera',
      tipo: 'Remuneração Variável',
      descricao:
        'Roteiro de desenho de RV de curto prazo: diagnóstico, desenho do modelo, ' +
        'metas e indicadores, simulação e implantação. 12 semanas.',
      duracao: 12,
      itens: [
        {
          t: 'Kick-off e alinhamento do modelo comercial',
          e: 'Entrada',
          folga: 1,
          dur: 1,
          ev: 'Ata com escopo, públicos elegíveis e premissas',
          ob: true,
          check: ['Agendar', 'Definir públicos', 'Registrar premissas'],
        },
        {
          t: 'Diagnóstico da RV atual',
          e: 'Kick-off',
          folga: 3,
          dur: 2,
          ev: 'Mapa da RV atual com distorções identificadas',
          ob: true,
          check: ['Levantar regras atuais', 'Mapear pagamentos', 'Identificar distorções'],
        },
        {
          t: 'Definir indicadores e metas por público',
          e: 'Diagnóstico',
          folga: 6,
          dur: 2,
          ev: 'Matriz de indicadores com pesos e metas',
          ob: true,
          check: ['Escolher indicadores', 'Definir pesos', 'Validar metas com o cliente'],
        },
        {
          t: 'Desenhar o modelo de remuneração variável',
          e: 'Diagnóstico',
          folga: 8,
          dur: 2,
          ev: 'Modelo com fórmulas, gatilhos e tetos',
          ob: true,
          check: ['Desenhar as fórmulas', 'Definir gatilhos e tetos', 'Validar com o RH'],
        },
        {
          t: 'Simular cenários de custo e payout',
          e: 'Entrega',
          folga: 10,
          dur: 1,
          ev: 'Simulação de custo em cenários conservador, base e otimista',
          ob: true,
          check: ['Rodar cenários', 'Calcular custo total', 'Apresentar ao cliente'],
        },
        {
          t: 'Apresentar e aprovar o modelo',
          e: 'Entrega',
          folga: 11,
          dur: 1,
          ev: 'Modelo aprovado pela diretoria',
          ob: true,
          check: ['Montar apresentação', 'Apresentar', 'Registrar aprovação'],
        },
        {
          t: 'Regular e documentar o programa',
          e: 'Entrega',
          folga: 12,
          dur: 1,
          ev: 'Regulamento do programa e materiais de comunicação',
          ob: true,
          check: ['Redigir regulamento', 'Validar com jurídico', 'Entregar materiais'],
        },
      ],
    }

    const TEMPLATES = [TPL_CARGOS, TPL_ORGDESIGN, TPL_DIAG, TPL_RV]

    for (const tpl of TEMPLATES) {
      const serviceId = tipos[tpl.tipo]
      if (!serviceId) {
        console.log('TPL-2: tipo de serviço não encontrado — ' + tpl.tipo)
        continue
      }

      // idempotente: pula se já existe template com o mesmo nome
      let existente = null
      try {
        existente = app.findFirstRecordByData('task_templates', 'nome', tpl.nome)
      } catch (_) {
        existente = null
      }
      if (existente) {
        console.log('TPL-2: já existe — ' + tpl.nome)
        continue
      }

      const colT = app.findCollectionByNameOrId('task_templates')
      const rec = new Record(colT)
      rec.set('nome', tpl.nome)
      rec.set('descricao', tpl.descricao)
      rec.set('service_type_id', serviceId)
      rec.set('duracao_semanas', tpl.duracao)
      rec.set('ativo', true)
      app.save(rec)

      const colI = app.findCollectionByNameOrId('task_template_items')
      let ordem = 1
      for (const it of tpl.itens) {
        const item = new Record(colI)
        item.set('template_id', rec.id)
        item.set('ordem', ordem)
        item.set('titulo', it.t)
        item.set('descricao', '')
        item.set('etapa', it.e)
        item.set('folga_semanas', it.folga)
        item.set('duracao_semanas', it.dur)
        item.set('evidencia_esperada', it.ev)
        item.set('obrigatorio', it.ob)
        item.set(
          'checklist',
          JSON.stringify(
            (it.check || []).map(function (c) {
              return { titulo: c, obrigatorio: true }
            }),
          ),
        )
        item.set('ativo', true)
        app.save(item)
        ordem = ordem + 1
      }
      console.log('TPL-2: criado ' + tpl.nome + ' com ' + tpl.itens.length + ' tarefas')
    }
  },
  (app) => {
    // down: remove os templates padrão (itens primeiro)
    const nomes = [
      'Cargos e Salários — padrão Benera',
      'Desenho Organizacional — padrão Benera',
      'Diagnóstico — padrão Benera',
      'Remuneração Variável — padrão Benera',
    ]
    for (const nome of nomes) {
      let rec = null
      try {
        rec = app.findFirstRecordByData('task_templates', 'nome', nome)
      } catch (_) {
        rec = null
      }
      if (!rec) continue
      try {
        const itens = app.findRecordsByFilter(
          'task_template_items',
          'template_id = {:tid}',
          '',
          500,
          0,
          { tid: rec.id },
        )
        for (const i of itens) app.delete(i)
      } catch (_) {}
      app.delete(rec)
    }
  },
)
