import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, RefreshCw, AlertTriangle, Ban, Archive, Download } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { BeneraLogo } from '@/components/BeneraLogo'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import pb from '@/lib/pocketbase/client'

const VERSAO_BUILD = 'v0.0.63'

interface Agg {
  name: string
  total: number
  atrasados: number
  bloqueados: number
}
interface ItemPainel {
  project_key: string
  name: string
  stage: string
  priority: string
  owner_email: string
  due_date: string
  atrasado: boolean
  bloqueado: boolean
  encerrado: boolean
  ciclo_dias: number
  touch_min: number
  touch_dias: number
  espera_dias: number
  incompleto: boolean
}
interface Painel {
  totais: { ativos: number; atrasados: number; bloqueados: number; encerrados: number }
  porEtapa: Agg[]
  porResponsavel: Agg[]
  porPrioridade: Agg[]
  lista: ItemPainel[]
  totalLista: number
}
interface ExportResponse {
  formato: string
  linhas: number
  gerado_em: string
  filtros: string
  conteudo: string
}
interface ConfigResponse {
  chave: string
  valor: number
  descricao: string
  updated?: string
}

export default function PainelOperacional() {
  const { user, isAdmin, isLider } = useAuth()
  const [dados, setDados] = useState<Painel | null>(null)
  const [opcoes, setOpcoes] = useState<{
    etapas: string[]
    prioridades: string[]
    owners: { id: string; email: string }[]
  }>({ etapas: [], prioridades: [], owners: [] })
  const [fEtapa, setFEtapa] = useState('')
  const [fPrioridade, setFPrioridade] = useState('')
  const [fOwner, setFOwner] = useState('')
  const [fAtraso, setFAtraso] = useState(false)
  const [fBloqueio, setFBloqueio] = useState(false)
  const [fEncerrados, setFEncerrados] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  // T1.14: exportação + config
  const [exportando, setExportando] = useState<'' | 'csv' | 'json'>('')
  const [hashInfo, setHashInfo] = useState<{
    formato: string
    linhas: number
    hash: string
    gerado_em: string
  } | null>(null)
  const [erroExport, setErroExport] = useState('')
  const [configCorte, setConfigCorte] = useState<number | null>(null)

  // T1.12-fix: overrides explícitos — o setTimeout com closure antigo buscava com o
  // estado ainda vazio (filtro mudava o rótulo mas não os totais). A busca recebe o
  // novo valor na hora, sem depender do estado atrasado do render.
  type Overrides = {
    etapa?: string
    prioridade?: string
    owner?: string
    atraso?: boolean
    bloqueio?: boolean
    encerrados?: boolean
  }
  const carregar = async (inicial = false, over?: Overrides) => {
    setCarregando(true)
    setErro('')
    try {
      const etapa = over?.etapa !== undefined ? over.etapa : fEtapa
      const prioridade = over?.prioridade !== undefined ? over.prioridade : fPrioridade
      const owner = over?.owner !== undefined ? over.owner : fOwner
      const atraso = over?.atraso !== undefined ? over.atraso : fAtraso
      const bloqueio = over?.bloqueio !== undefined ? over.bloqueio : fBloqueio
      const encerrados = over?.encerrados !== undefined ? over.encerrados : fEncerrados
      const params = new URLSearchParams()
      if (etapa) params.set('etapa', etapa)
      if (prioridade) params.set('prioridade', prioridade)
      if (owner) params.set('owner', owner)
      if (atraso) params.set('atraso', '1')
      if (bloqueio) params.set('bloqueio', '1')
      if (encerrados) params.set('encerrados', '1')
      const qs = params.toString()
      const d = (await pb.send('/backend/v1/painel' + (qs ? '?' + qs : ''), {
        method: 'GET',
      })) as Painel
      setDados(d)
      if (inicial) {
        const uniq = (xs: string[]) => Array.from(new Set(xs.filter(Boolean)))
        setOpcoes({
          etapas: uniq(d.lista.map((i) => i.stage)),
          prioridades: uniq(d.lista.map((i) => i.priority)),
          owners: d.lista
            .map((i) => ({ id: i.owner_id, email: i.owner_email }))
            .filter((o, idx, arr) => o.id && arr.findIndex((x) => x.id === o.id) === idx),
        })
      }
    } catch {
      setErro('Não foi possível carregar o painel operacional.')
    } finally {
      setCarregando(false)
    }
  }

  // T1.14: config do corte (admin) — exibida no painel; edição via API auditada
  useEffect(() => {
    if (!isAdmin) return
    pb.send('/backend/v1/painel-config', { method: 'GET' })
      .then((c) => setConfigCorte((c as ConfigResponse).valor))
      .catch(() => setConfigCorte(null))
  }, [isAdmin])

  useEffect(() => {
    void carregar(true)
  }, [])

  // T1.14: exportação sanitizada e auditada (CA-1-034/035/036).
  // O arquivo só é montado no navegador após a resposta 200 completa — nada parcial.
  // Hash SHA-256 do conteúdo exibido após o download (evidência de integridade).
  const exportar = async (formato: 'csv' | 'json') => {
    setExportando(formato)
    setErroExport('')
    try {
      const params = new URLSearchParams()
      params.set('formato', formato)
      if (fEtapa) params.set('etapa', fEtapa)
      if (fPrioridade) params.set('prioridade', fPrioridade)
      if (fOwner) params.set('owner', fOwner)
      if (fAtraso) params.set('atraso', '1')
      if (fBloqueio) params.set('bloqueio', '1')
      if (fEncerrados) params.set('encerrados', '1')
      const r = (await pb.send('/backend/v1/exportar?' + params.toString(), {
        method: 'GET',
      })) as ExportResponse
      const mime = formato === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8'
      const blob = new Blob([r.conteudo], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const hoje = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `painel-operacional-${hoje}.${formato}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      // hash SHA-256 do conteúdo recebido
      let hash = '—'
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(r.conteudo))
        hash = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      } catch (_) {
        hash = 'indisponível neste navegador'
      }
      setHashInfo({
        formato: r.formato,
        linhas: r.linhas,
        hash: hash,
        gerado_em: r.gerado_em,
      })
    } catch {
      setErroExport('Não foi possível exportar. Verifique sua permissão (somente admin/líder).')
    } finally {
      setExportando('')
    }
  }

  const limparFiltros = () => {
    setFEtapa('')
    setFPrioridade('')
    setFOwner('')
    setFAtraso(false)
    setFBloqueio(false)
    setFEncerrados(false)
    void carregar(true, {
      etapa: '',
      prioridade: '',
      owner: '',
      atraso: false,
      bloqueio: false,
      encerrados: false,
    })
  }

  const filtroAtivo = fEtapa || fPrioridade || fOwner || fAtraso || fBloqueio || fEncerrados
  const podeExportar = isAdmin || isLider

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BeneraLogo variant="dark" size="sm" />
            <span className="hidden sm:inline-block h-5 w-px bg-slate-200" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Painel operacional
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400">{VERSAO_BUILD}</span>
            <Button variant="outline" size="sm" asChild className="text-xs">
              <Link to="/dashboard">Voltar ao painel</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Totais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Projetos ativos', v: dados?.totais.ativos, cor: 'text-[#0B3556]' },
            { label: 'Atrasados', v: dados?.totais.atrasados, cor: 'text-amber-600' },
            { label: 'Com bloqueio', v: dados?.totais.bloqueados, cor: 'text-red-600' },
            { label: 'Encerrados', v: dados?.totais.encerrados, cor: 'text-slate-500' },
          ].map((c) => (
            <div key={c.label} className="p-4 rounded-xl bg-white border border-slate-200">
              <div className={`text-2xl font-bold ${c.cor}`}>{c.v ?? '—'}</div>
              <div className="text-xs text-slate-500 mt-1">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 mb-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600">Etapa</label>
              <Select
                value={fEtapa || 'todas'}
                onValueChange={(v) => {
                  const nv = v === 'todas' ? '' : v
                  setFEtapa(nv)
                  void carregar(false, { etapa: nv })
                }}
              >
                <SelectTrigger className="w-40 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {opcoes.etapas.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600">Prioridade</label>
              <Select
                value={fPrioridade || 'todas'}
                onValueChange={(v) => {
                  const nv = v === 'todas' ? '' : v
                  setFPrioridade(nv)
                  void carregar(false, { prioridade: nv })
                }}
              >
                <SelectTrigger className="w-40 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {opcoes.prioridades.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-600">Responsável</label>
              <Select
                value={fOwner || 'todos'}
                onValueChange={(v) => {
                  const nv = v === 'todos' ? '' : v
                  setFOwner(nv)
                  void carregar(false, { owner: nv })
                }}
              >
                <SelectTrigger className="w-48 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {opcoes.owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {[
              { label: 'Só atrasados', v: fAtraso, set: setFAtraso },
              { label: 'Só bloqueados', v: fBloqueio, set: setFBloqueio },
              { label: 'Incluir encerrados', v: fEncerrados, set: setFEncerrados },
            ].map((t) => (
              <button
                key={t.label}
                onClick={() => {
                  const nv = !t.v
                  t.set(nv)
                  void carregar(false, {
                    atraso: t.label === 'Só atrasados' ? nv : undefined,
                    bloqueio: t.label === 'Só bloqueados' ? nv : undefined,
                    encerrados: t.label === 'Incluir encerrados' ? nv : undefined,
                  })
                }}
                className={`px-3 py-2 rounded-md text-xs font-medium border ${
                  t.v
                    ? 'bg-[#0B3556] text-white border-[#0B3556]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void carregar()}
              className="gap-1.5 text-xs"
              disabled={carregando}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {filtroAtivo && (
              <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-xs">
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {erro && (
          <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {erro}
          </div>
        )}

        {/* Tabelas de agregação */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
          {[
            { titulo: 'Por etapa', rows: dados?.porEtapa },
            { titulo: 'Por responsável', rows: dados?.porResponsavel },
            { titulo: 'Por prioridade', rows: dados?.porPrioridade },
          ].map((t) => (
            <div key={t.titulo} className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3">
                {t.titulo}
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 text-left">
                    <th className="pb-2 font-medium">Nome</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                    <th className="pb-2 font-medium text-right">Atras.</th>
                    <th className="pb-2 font-medium text-right">Bloq.</th>
                  </tr>
                </thead>
                <tbody>
                  {(t.rows || []).map((r) => (
                    <tr key={r.name} className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-700">{r.name}</td>
                      <td className="py-1.5 text-right font-semibold text-[#0B3556]">{r.total}</td>
                      <td
                        className={`py-1.5 text-right ${r.atrasados ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}
                      >
                        {r.atrasados}
                      </td>
                      <td
                        className={`py-1.5 text-right ${r.bloqueados ? 'text-red-600 font-semibold' : 'text-slate-400'}`}
                      >
                        {r.bloqueados}
                      </td>
                    </tr>
                  ))}
                  {(!t.rows || t.rows.length === 0) && (
                    <tr>
                      <td colSpan={4} className="py-2 text-slate-400">
                        Sem dados no filtro atual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Tempo e baseline (T1.13) + exportação (T1.14) */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 mb-5">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Tempo e baseline (piloto)
            </div>
            {podeExportar && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  disabled={exportando !== ''}
                  onClick={() => void exportar('csv')}
                >
                  <Download className="w-3.5 h-3.5" />
                  {exportando === 'csv' ? 'Exportando...' : 'Exportar CSV'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  disabled={exportando !== ''}
                  onClick={() => void exportar('json')}
                >
                  <Download className="w-3.5 h-3.5" />
                  {exportando === 'json' ? 'Exportando...' : 'Exportar JSON'}
                </Button>
              </div>
            )}
          </div>
          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="text-slate-400 text-left">
                <th className="pb-2 font-medium">Projeto</th>
                <th className="pb-2 font-medium text-right">Ciclo (d)</th>
                <th className="pb-2 font-medium text-right">Touch (d)</th>
                <th className="pb-2 font-medium text-right">Espera (d)</th>
                <th className="pb-2 font-medium text-right">Touch (min)</th>
                <th className="pb-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {(dados?.lista || []).map((i) => (
                <tr key={i.project_key} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-700 font-semibold">{i.project_key}</td>
                  <td className="py-1.5 text-right text-[#0B3556]">{i.ciclo_dias}</td>
                  <td className="py-1.5 text-right text-[#0B3556]">{i.touch_dias}</td>
                  <td className="py-1.5 text-right text-slate-500">{i.espera_dias}</td>
                  <td className="py-1.5 text-right text-slate-500">{i.touch_min}</td>
                  <td className="py-1.5">
                    {i.incompleto ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                        INCOMPLETO (sem apontamento)
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
                        completo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {(!dados || dados.totalLista === 0) && (
                <tr>
                  <td colSpan={6} className="py-2 text-slate-400">
                    Sem projetos no filtro atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {hashInfo && (
            <div className="mb-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
              <div className="font-semibold text-emerald-800 mb-1">
                Exportação {hashInfo.formato.toUpperCase()} concluída — {hashInfo.linhas} linhas ·
                gerada em {hashInfo.gerado_em}
              </div>
              <div className="text-emerald-700 break-all">
                <span className="font-semibold">SHA-256:</span> {hashInfo.hash}
              </div>
              <div className="text-emerald-600 mt-1">
                Exportação auditada (export_realizada) · células de texto sanitizadas antes da
                entrega.
              </div>
            </div>
          )}
          {erroExport && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {erroExport}
            </div>
          )}
          {dados?.baseline && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="font-semibold text-[#0B3556]">{dados.baseline.tipo}</div>
              <div className="text-slate-600">
                Período: {dados.baseline.periodo_inicio} → {dados.baseline.periodo_fim} (
                {dados.baseline.periodo_dias} dias) · Relógio: {dados.baseline.relogio}
              </div>
              <div className="text-slate-600">
                Amostra: {dados.baseline.amostra.projetos} projetos ·{' '}
                {dados.baseline.amostra.apontamentos_ativos} apontamentos ·{' '}
                {dados.baseline.amostra.eventos_auditoria} eventos ({dados.baseline.amostra.corte})
              </div>
              {isAdmin && configCorte !== null && (
                <div className="text-slate-500">
                  Configuração: corte da amostra = {configCorte} registros por fonte · mudança
                  auditada e reversível (config_changed)
                </div>
              )}
              <div className="pt-1 border-t border-slate-200">
                <div className="font-semibold text-slate-700 mb-1">Limitações</div>
                <ul className="list-disc list-inside text-slate-500 space-y-0.5">
                  {dados.baseline.limitacoes.map((l, idx) => (
                    <li key={idx}>{l}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Lista de projetos */}
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Projetos {filtroAtivo ? '(filtrados)' : ''} {dados ? `(${dados.totalLista})` : ''}
            </div>
          </div>
          <div className="space-y-2">
            {(dados?.lista || []).map((i) => (
              <div
                key={i.project_key}
                className="p-3 rounded-lg border border-slate-200 bg-white flex flex-wrap items-center gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[#0B3556]">
                    {i.project_key} <span className="font-normal text-slate-600">— {i.name}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {i.stage} · {i.priority} · {i.owner_email}
                    {i.due_date ? ` · prazo ${i.due_date}` : ' · sem prazo'}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {i.atrasado && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold">
                      <AlertTriangle className="w-3 h-3" /> ATRASADO
                    </span>
                  )}
                  {i.bloqueado && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold">
                      <Ban className="w-3 h-3" /> BLOQUEADO
                    </span>
                  )}
                  {i.encerrado && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold">
                      <Archive className="w-3 h-3" /> ENCERRADO
                    </span>
                  )}
                </div>
              </div>
            ))}
            {dados && dados.totalLista === 0 && (
              <div className="text-xs text-slate-400">
                Nenhum projeto no filtro atual. Ajuste os filtros ou inclua os encerrados.
              </div>
            )}
            {!dados && !erro && <div className="text-xs text-slate-400">Carregando painel...</div>}
          </div>
        </div>

        <p className="mt-4 text-[11px] text-slate-400">
          Métricas calculadas a partir dos eventos do piloto. Consulta e exportação são auditadas
          (painel_consulta / export_realizada); exportação disponível para admin e líder, com
          células sanitizadas antes da entrega.
        </p>
      </main>
    </div>
  )
}
