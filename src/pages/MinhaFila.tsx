import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ListChecks, Clock, Ban, CheckCircle2, RefreshCw, FolderOpen, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { BeneraLogo } from '@/components/BeneraLogo'
import { Button } from '@/components/ui/button'

const VERSAO_BUILD = 'v0.0.48'

interface TarefaFila {
  id: string
  project_key: string
  project_name: string
  project_stage: string
  titulo: string
  descricao: string
  due_date: string
  status: string
  evidencia_esperada: string
  atrasada: boolean
  pendentes_obrigatorios: number
  bloqueio_motivo?: string
  bloqueio_dono?: string
  bloqueio_revisao?: string
  retorno_motivo?: string
}

interface Fila {
  contagens: {
    pendentes: number
    vencidas: number
    bloqueadas: number
    concluidas: number
  }
  pendentes: TarefaFila[]
  vencidas: TarefaFila[]
  bloqueadas: TarefaFila[]
  concluidas: TarefaFila[]
}

export default function MinhaFila() {
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const navigate = useNavigate()
  const [fila, setFila] = useState<Fila | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isLoading, isAuthenticated, navigate])

  const carregarFila = async () => {
    setCarregando(true)
    setErro('')
    try {
      const r = await (
        await import('@/lib/pocketbase/client')
      ).default.send('/backend/v1/minhas-tarefas', { method: 'GET' })
      setFila(r as Fila)
    } catch (err) {
      setErro('Não foi possível carregar sua fila. Tente novamente.')
      setFila(null)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      void carregarFila()
    }
  }, [isAuthenticated])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0B3556] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Carregando...
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  const userName = user.name || user.email.split('@')[0] || 'Usuário'

  const renderCard = (t: TarefaFila) => (
    <div
      key={t.id}
      className={`p-4 rounded-xl border bg-white ${
        t.status === 'bloqueada'
          ? 'border-red-300'
          : t.atrasada
            ? 'border-amber-300'
            : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#0B3556] flex items-center gap-2 flex-wrap">
            {t.titulo}
            {t.status === 'bloqueada' && (
              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-medium">
                bloqueada
              </span>
            )}
            {t.status === 'concluida' && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-medium">
                concluída
              </span>
            )}
            {t.atrasada && (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-medium">
                vencida
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {t.project_name} ({t.project_key}) · etapa: {t.project_stage} · prazo: {t.due_date}
          </div>
          {t.evidencia_esperada && (
            <div className="text-xs text-slate-500 mt-0.5">Evidência: {t.evidencia_esperada}</div>
          )}
          {t.status === 'bloqueada' && (
            <div className="text-xs text-red-700 mt-1">
              Bloqueio: {t.bloqueio_motivo} · Dono: {t.bloqueio_dono} · Revisão:{' '}
              {t.bloqueio_revisao}
            </div>
          )}
          {t.retorno_motivo && (
            <div className="text-xs text-amber-700 mt-1">Devolvida: {t.retorno_motivo}</div>
          )}
          {t.pendentes_obrigatorios > 0 && (
            <div className="text-xs text-slate-600 mt-1">
              {t.pendentes_obrigatorios} item(ns) obrigatório(s) pendente(s)
            </div>
          )}
        </div>
        <div className="shrink-0">
          <Link
            to="/projetos"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B3556] hover:text-[#1B5E8A]"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Abrir projeto
          </Link>
        </div>
      </div>
    </div>
  )

  const secao = (titulo: string, itens: TarefaFila[], icone: React.ReactNode, cor: string) => (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icone}
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: cor }}>
          {titulo} ({itens.length})
        </h3>
      </div>
      <div className="space-y-2">
        {itens.map(renderCard)}
        {itens.length === 0 && (
          <div className="text-xs text-slate-400">Nada aqui por enquanto.</div>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BeneraLogo variant="dark" size="md" />
            <span className="hidden sm:inline-block h-5 w-px bg-slate-200" />
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <ListChecks className="w-4 h-4" />
              Minha fila
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void carregarFila()}
              disabled={carregando}
              className="text-xs font-semibold border-slate-200 text-slate-700 hover:text-[#0B3556] gap-1.5"
            >
              {carregando ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-xs font-semibold border-slate-200 text-slate-700 hover:text-[#0B3556] gap-1.5"
            >
              <Link to="/dashboard">Painel</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout()
                navigate('/', { replace: true })
              }}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
            >
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Saudação + contagens */}
        <div
          className="rounded-2xl p-6 text-white relative overflow-hidden shadow-xl"
          style={{ background: 'linear-gradient(135deg, #071F33 0%, #0B3556 50%, #1B5E8A 100%)' }}
        >
          <h1 className="text-2xl font-bold tracking-tight">Fila de {userName}</h1>
          <p className="mt-1 text-slate-300 text-sm">
            Suas tarefas em todos os projetos com vínculo.
          </p>
          {fila && (
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white/10 backdrop-blur-md border border-white/10 p-4">
                <div className="text-2xl font-bold">{fila.contagens.pendentes}</div>
                <div className="text-xs text-slate-300 mt-0.5">Pendentes</div>
              </div>
              <div className="rounded-xl bg-amber-500/20 backdrop-blur-md border border-amber-400/30 p-4">
                <div className="text-2xl font-bold text-amber-300">{fila.contagens.vencidas}</div>
                <div className="text-xs text-amber-200 mt-0.5">Vencidas</div>
              </div>
              <div className="rounded-xl bg-red-500/20 backdrop-blur-md border border-red-400/30 p-4">
                <div className="text-2xl font-bold text-red-300">{fila.contagens.bloqueadas}</div>
                <div className="text-xs text-red-200 mt-0.5">Bloqueadas</div>
              </div>
              <div className="rounded-xl bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 p-4">
                <div className="text-2xl font-bold text-emerald-300">
                  {fila.contagens.concluidas}
                </div>
                <div className="text-xs text-emerald-200 mt-0.5">Concluídas</div>
              </div>
            </div>
          )}
        </div>

        {erro && (
          <div className="mt-6 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {erro}
          </div>
        )}

        {fila && (
          <div className="mt-8 space-y-8">
            {secao(
              'Vencidas',
              fila.vencidas,
              <Clock className="w-4 h-4 text-amber-600" />,
              '#B45309',
            )}
            {secao(
              'Bloqueadas',
              fila.bloqueadas,
              <Ban className="w-4 h-4 text-red-600" />,
              '#B91C1C',
            )}
            {secao(
              'Pendentes',
              fila.pendentes,
              <ListChecks className="w-4 h-4 text-[#0B3556]" />,
              '#0B3556',
            )}
            {secao(
              'Concluídas',
              fila.concluidas,
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
              '#047857',
            )}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        <span className="font-mono">{VERSAO_BUILD}</span> · © 2025 Benera Consultoria
      </footer>
    </div>
  )
}
