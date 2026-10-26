import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Folder, FileText, Search, RefreshCw, ExternalLink, ChevronRight } from 'lucide-react'
import { BeneraLogo } from '@/components/BeneraLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import pb from '@/lib/pocketbase/client'

const VERSAO_BUILD = 'v0.0.64'

interface ItemSP {
  nome: string
  pasta: boolean
  tamanho: number
  modificado: string
  caminho: string
  webUrl: string
}

const fmtTam = (b: number) =>
  b >= 1048576
    ? `${(b / 1048576).toFixed(1)} MB`
    : b >= 1024
      ? `${Math.round(b / 1024)} KB`
      : b
        ? `${b} B`
        : ''

export default function SharePointBrowser() {
  const [caminho, setCaminho] = useState('')
  const [itens, setItens] = useState<ItemSP[]>([])
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const carregar = async (novoCaminho: string, novaBusca = '') => {
    setCarregando(true)
    setErro('')
    setAviso('')
    try {
      const params = new URLSearchParams()
      if (novoCaminho) params.set('caminho', novoCaminho)
      if (novaBusca) params.set('busca', novaBusca)
      const qs = params.toString()
      const d = (await pb.send('/backend/v1/sharepoint/listar' + (qs ? '?' + qs : ''), {
        method: 'GET',
      })) as { itens: ItemSP[]; aviso?: string; total: number }
      setItens(d.itens || [])
      if (d.aviso) setAviso(d.aviso)
    } catch (err) {
      const msg = (err as { response?: { message?: string } })?.response?.message || ''
      setErro(msg || 'Não foi possível listar o SharePoint.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregar('')
  }, [])

  const partes = caminho ? caminho.split('/') : []

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BeneraLogo variant="dark" size="sm" />
            <span className="hidden sm:inline-block h-5 w-px bg-slate-200" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              SharePoint — BENERA CORP
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
        {/* Breadcrumb */}
        <div className="p-3 rounded-xl bg-white border border-slate-200 mb-4 flex items-center gap-1 flex-wrap text-xs">
          <button
            className={`px-2 py-1 rounded ${caminho === '' ? 'font-semibold text-[#0B3556]' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => {
              setCaminho('')
              setBusca('')
              void carregar('')
            }}
          >
            Raiz
          </button>
          {partes.map((p, i) => {
            const alvo = partes.slice(0, i + 1).join('/')
            return (
              <span key={alvo} className="flex items-center gap-1">
                <ChevronRight className="w-3 h-3 text-slate-300" />
                <button
                  className={`px-2 py-1 rounded ${i === partes.length - 1 ? 'font-semibold text-[#0B3556]' : 'text-slate-500 hover:bg-slate-50'}`}
                  onClick={() => {
                    setCaminho(alvo)
                    setBusca('')
                    void carregar(alvo)
                  }}
                >
                  {p}
                </button>
              </span>
            )
          })}
        </div>

        {/* Busca */}
        <div className="p-3 rounded-xl bg-white border border-slate-200 mb-4 flex items-center gap-2">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome em toda a biblioteca..."
            className="h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void carregar(caminho, busca)
            }}
          />
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            disabled={carregando}
            onClick={() => void carregar(caminho, busca)}
          >
            <Search className="w-3.5 h-3.5" /> Buscar
          </Button>
          {busca && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() => {
                setBusca('')
                void carregar(caminho)
              }}
            >
              Limpar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={carregando}
            onClick={() => void carregar(caminho, busca)}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {erro && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {erro}
          </div>
        )}
        {aviso && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            {aviso}
          </div>
        )}

        {/* Lista */}
        <div className="p-4 rounded-xl bg-white border border-slate-200">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3">
            {busca ? `Resultados da busca (${itens.length})` : `Conteúdo (${itens.length} itens)`}
          </div>
          <div className="space-y-1.5">
            {itens.map((i) => (
              <div
                key={i.caminho}
                className="p-2.5 rounded-lg border border-slate-100 bg-white flex items-center gap-3 hover:bg-slate-50"
              >
                {i.pasta ? (
                  <Folder className="w-4 h-4 text-[#F36C22] shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                {i.pasta ? (
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setCaminho(i.caminho)
                      setBusca('')
                      void carregar(i.caminho)
                    }}
                  >
                    <div className="text-sm font-medium text-[#0B3556] truncate">{i.nome}</div>
                    <div className="text-[11px] text-slate-400">pasta · {i.modificado || '—'}</div>
                  </button>
                ) : (
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-700 truncate">{i.nome}</div>
                    <div className="text-[11px] text-slate-400">
                      {fmtTam(i.tamanho) || '—'} · {i.modificado || '—'} · {i.caminho}
                    </div>
                  </div>
                )}
                {i.webUrl && (
                  <a
                    href={i.webUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[11px] text-slate-400 hover:text-[#0B3556] inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> abrir
                  </a>
                )}
              </div>
            ))}
            {!carregando && itens.length === 0 && !erro && (
              <div className="text-xs text-slate-400 py-2">
                {busca ? 'Nenhum resultado para a busca.' : 'Pasta vazia.'}
              </div>
            )}
            {carregando && <div className="text-xs text-slate-400 py-2">Carregando...</div>}
          </div>
        </div>

        <p className="mt-4 text-[11px] text-slate-400">
          Navegação server-side — a credencial do SharePoint nunca chega ao navegador. Consultas
          auditadas (sharepoint_consulta).
        </p>
      </main>
    </div>
  )
}
