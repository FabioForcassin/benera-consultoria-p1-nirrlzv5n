import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  FolderPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  ArrowLeft,
  ListFilter,
  Archive,
  Pencil,
  RefreshCw,
} from 'lucide-react'
import { useAuth, translateAuthError, type Papel } from '@/contexts/AuthContext'
import { BeneraLogo } from '@/components/BeneraLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import pb from '@/lib/pocketbase/client'

interface Cliente {
  id: string
  name: string
  document: string
}
interface Servico {
  id: string
  name: string
}
interface Usuario {
  id: string
  email: string
  name: string
  role: Papel
}
interface Projeto {
  project_key: string
  name: string
  stage: string
  priority: string
  due_date: string
  next_action: string
  owner_id: string
  atrasado: boolean
}
interface Cartao {
  project_key: string
  name: string
  client_name: string
  service_name: string
  stage: string
  priority: string
  due_date: string
  next_action: string
  owner_id: string
  active: boolean
}
interface EventoTimeline {
  id: string
  actor_email: string
  action: string
  detail: string
  created: string
}

const ETAPAS = ['Entrada', 'Kick-off', 'Diagnóstico', 'Entrega', 'Encerrado']
const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
]

const PAPEIS_PROJETO: Record<string, string> = {
  admin: 'Administrador',
  lider: 'Líder',
  consultor: 'Consultor',
  revisor: 'Revisor',
}

export default function PainelProjetos() {
  const { isAdmin, isLider, user } = useAuth()
  const podeCadastrar = isAdmin || isLider
  // Consultor e revisor entram na página: veem só a Carteira (escopo por vínculo, aplicado no servidor).
  const podeVerCarteira = !!user

  // Estado: aba ativa
  const [aba, setAba] = useState<'projeto' | 'cliente' | 'membros' | 'carteira'>('carteira')

  // Carteira (listagem + filtros)
  const [lista, setLista] = useState<Projeto[]>([])
  const [fEtapa, setFEtapa] = useState('')
  const [fPrioridade, setFPrioridade] = useState('')
  const [fAtraso, setFAtraso] = useState(false)
  const [fOwner, setFOwner] = useState('')
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregandoLista, setCarregandoLista] = useState(false)

  // Formulário de cliente
  const [clienteNome, setClienteNome] = useState('')
  const [clienteDoc, setClienteDoc] = useState('')
  const [clienteMsg, setClienteMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Formulário de projeto
  const [projKey, setProjKey] = useState('')
  const [projNome, setProjNome] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [clienteId, setClienteId] = useState('')
  const [servicoId, setServicoId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [etapa, setEtapa] = useState('Entrada')
  const [prioridade, setPrioridade] = useState('media')
  const [prazo, setPrazo] = useState('')
  const [proximaAcao, setProximaAcao] = useState('')
  const [projMsg, setProjMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [carregando, setCarregando] = useState(false)

  // Gestão de membros
  const [membroUserId, setMembroUserId] = useState('')
  const [membroProjKey, setMembroProjKey] = useState('')
  const [membroRole, setMembroRole] = useState<Papel>('consultor')
  const [membroMsg, setMembroMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [projetos, setProjetos] = useState<Projeto[]>([])

  // Cartão 360
  const [cartaoAberto, setCartaoAberto] = useState<Projeto | null>(null)
  const [cartao, setCartao] = useState<Cartao | null>(null)
  const [timeline, setTimeline] = useState<EventoTimeline[]>([])
  const [editPrioridade, setEditPrioridade] = useState('')
  const [editPrazo, setEditPrazo] = useState('')
  const [editOwner, setEditOwner] = useState('')
  const [editAcao, setEditAcao] = useState('')
  const [editMsg, setEditMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const carregarCatalogos = async () => {
    if (clientes.length > 0) return
    try {
      const [c, s, u, p] = await Promise.all([
        pb.send('/backend/v1/clients', { method: 'GET' }),
        pb.send('/backend/v1/service-types', { method: 'GET' }),
        pb.send('/backend/v1/users', { method: 'GET' }),
        pb.send('/backend/v1/projects', { method: 'GET' }),
      ])
      setClientes((c as { items: Cliente[] }).items)
      setServicos((s as { items: Servico[] }).items)
      setUsuarios((u as { items: Usuario[] }).items)
      setProjetos((p as { items: Projeto[] }).items)
    } catch {
      // Catálogos ficam vazios; os selects mostram placeholder e o usuário recarrega a página.
    }
  }

  const carregarCarteira = async () => {
    setCarregandoLista(true)
    try {
      const params = new URLSearchParams()
      if (fEtapa) params.set('etapa', fEtapa)
      if (fPrioridade) params.set('prioridade', fPrioridade)
      if (fAtraso) params.set('atraso', '1')
      if (fOwner) params.set('owner', fOwner)
      const r = await pb.send(
        '/backend/v1/projects' + (params.toString() ? '?' + params.toString() : ''),
        {
          method: 'GET',
        },
      )
      setLista((r as { items: Projeto[] }).items)
    } catch {
      setLista([])
    } finally {
      setCarregandoLista(false)
    }
  }

  const abrirCartao = async (p: Projeto) => {
    setCartaoAberto(p)
    setCartao(null)
    setTimeline([])
    setEditMsg(null)
    try {
      const [c, t] = await Promise.all([
        pb.send('/backend/v1/projects/' + p.project_key, { method: 'GET' }),
        pb.send('/backend/v1/projects/' + p.project_key + '/timeline', { method: 'GET' }),
      ])
      setCartao(c as Cartao)
      setTimeline((t as { items: EventoTimeline[] }).items)
      setEditPrioridade((c as Cartao).priority)
      setEditPrazo((c as Cartao).due_date)
      setEditAcao((c as Cartao).next_action)
      if (usuarios.length === 0) {
        try {
          const u = await pb.send('/backend/v1/users', { method: 'GET' })
          setUsuarios((u as { items: Usuario[] }).items)
        } catch {
          // Sem lista de usuários: edição de responsável fica indisponível.
        }
      }
      setEditOwner((c as Cartao).owner_id)
    } catch {
      setCartao(null)
      setEditMsg({ ok: false, text: 'Não foi possível abrir o cartão do projeto.' })
    }
  }

  const salvarEdicao = async () => {
    if (!cartao) return
    setEditMsg(null)
    setCarregando(true)
    try {
      await pb.send('/backend/v1/projects/' + cartao.project_key, {
        method: 'PATCH',
        body: JSON.stringify({
          priority: editPrioridade,
          due_date: editPrazo,
          owner_id: editOwner,
          next_action: editAcao,
        }),
      })
      setEditMsg({ ok: true, text: 'Alteração salva e registrada na auditoria.' })
      const t = await pb.send('/backend/v1/projects/' + cartao.project_key + '/timeline', {
        method: 'GET',
      })
      setTimeline((t as { items: EventoTimeline[] }).items)
      await carregarCarteira()
    } catch (err) {
      setEditMsg({ ok: false, text: translateAuthError(err) })
    } finally {
      setCarregando(false)
    }
  }

  const inativar = async () => {
    if (!cartao) return
    setEditMsg(null)
    setCarregando(true)
    try {
      await pb.send('/backend/v1/projects/' + cartao.project_key + '/inativar', { method: 'PATCH' })
      setEditMsg({ ok: true, text: 'Projeto inativado. Histórico preservado na timeline.' })
      const t = await pb.send('/backend/v1/projects/' + cartao.project_key + '/timeline', {
        method: 'GET',
      })
      setTimeline((t as { items: EventoTimeline[] }).items)
      await carregarCarteira()
    } catch (err) {
      setEditMsg({ ok: false, text: translateAuthError(err) })
    } finally {
      setCarregando(false)
    }
  }

  if (!podeVerCarteira) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#0B3556]">Acesso restrito</h1>
          <p className="mt-2 text-sm text-slate-600">
            Faça login para ver sua carteira de projetos.
          </p>
          <Button asChild className="mt-6 w-full h-11 bg-[#0B3556] hover:bg-[#1B5E8A] text-white">
            <Link to="/dashboard">Voltar ao painel</Link>
          </Button>
        </div>
      </div>
    )
  }

  const cadastrarCliente = async (e: FormEvent) => {
    e.preventDefault()
    setClienteMsg(null)
    if (clienteNome.trim().length < 2) {
      setClienteMsg({ ok: false, text: 'Nome do cliente é obrigatório (mínimo 2 caracteres).' })
      return
    }
    setCarregando(true)
    try {
      await pb.send('/backend/v1/clients', {
        method: 'POST',
        body: JSON.stringify({ name: clienteNome.trim(), document: clienteDoc.trim() }),
      })
      setClienteMsg({ ok: true, text: `Cliente "${clienteNome.trim()}" cadastrado com sucesso.` })
      setClienteNome('')
      setClienteDoc('')
      setClientes([])
    } catch (err) {
      setClienteMsg({ ok: false, text: translateAuthError(err) })
    } finally {
      setCarregando(false)
    }
  }

  const criarProjeto = async (e: FormEvent) => {
    e.preventDefault()
    setProjMsg(null)
    await carregarCatalogos()

    const faltando: string[] = []
    if (!projKey.trim()) faltando.push('Chave do projeto')
    if (projNome.trim().length < 2) faltando.push('Nome do projeto')
    if (!clienteId) faltando.push('Cliente')
    if (!servicoId) faltando.push('Tipo de serviço')
    if (!ownerId) faltando.push('Responsável')
    if (!prazo) faltando.push('Prazo')
    if (proximaAcao.trim().length < 3) faltando.push('Próxima ação')
    if (faltando.length > 0) {
      setProjMsg({ ok: false, text: 'Campos obrigatórios faltando: ' + faltando.join(', ') })
      return
    }

    setCarregando(true)
    try {
      await pb.send('/backend/v1/projects', {
        method: 'POST',
        body: JSON.stringify({
          project_key: projKey.trim().toUpperCase(),
          name: projNome.trim(),
          client_id: clienteId,
          service_type_id: servicoId,
          owner_id: ownerId,
          stage: etapa,
          priority: prioridade,
          due_date: prazo,
          next_action: proximaAcao.trim(),
        }),
      })
      setProjMsg({
        ok: true,
        text: `Projeto "${projNome.trim()}" criado com sucesso! Você é o admin do projeto.`,
      })
      setProjKey('')
      setProjNome('')
      setClienteId('')
      setServicoId('')
      setOwnerId('')
      setEtapa('Entrada')
      setPrioridade('media')
      setPrazo('')
      setProximaAcao('')
      setProjetos([])
    } catch (err) {
      setProjMsg({ ok: false, text: translateAuthError(err) })
    } finally {
      setCarregando(false)
    }
  }

  const concederVinculo = async (e: FormEvent) => {
    e.preventDefault()
    setMembroMsg(null)
    if (!membroUserId || !membroProjKey) {
      setMembroMsg({ ok: false, text: 'Selecione o usuário e o projeto.' })
      return
    }
    setCarregando(true)
    try {
      await pb.send('/backend/v1/members', {
        method: 'POST',
        body: JSON.stringify({
          user_id: membroUserId,
          project_key: membroProjKey,
          project_role: membroRole,
        }),
      })
      setMembroMsg({
        ok: true,
        text: `Vínculo concedido: ${usuarios.find((u) => u.id === membroUserId)?.email ?? 'usuário'} como ${membroRole} no projeto ${membroProjKey}.`,
      })
      setMembroUserId('')
      setMembroProjKey('')
      setMembroRole('consultor')
    } catch (err) {
      setMembroMsg({ ok: false, text: translateAuthError(err) })
    } finally {
      setCarregando(false)
    }
  }

  const tabBtn = (id: typeof aba, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => {
        setAba(id)
        if (id === 'carteira') void carregarCarteira()
        if (id === 'projeto' || id === 'membros') void carregarCatalogos()
      }}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
        aba === id
          ? 'bg-[#0B3556] text-white shadow-md'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  )

  const prioridadeLabel = (p: string) => (p === 'alta' ? 'Alta' : p === 'baixa' ? 'Baixa' : 'Média')

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center p-6 md:p-12 bg-white md:bg-grid-benera">
      <div className="w-full max-w-[860px] pt-4 flex items-center justify-between">
        <Link to="/dashboard" className="inline-block">
          <BeneraLogo variant="dark" size="md" />
        </Link>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0B3556] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao painel
        </Link>
      </div>

      <div className="w-full max-w-[860px] my-auto py-8">
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabBtn('carteira', 'Carteira', <ListFilter className="w-4 h-4" />)}
          {podeCadastrar && tabBtn('projeto', 'Novo projeto', <FolderPlus className="w-4 h-4" />)}
          {podeCadastrar && tabBtn('cliente', 'Novo cliente', <Building2 className="w-4 h-4" />)}
          {podeCadastrar && tabBtn('membros', 'Alocar membro', <UserPlus className="w-4 h-4" />)}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.06)] animate-benera-form">
          {aba === 'carteira' && (
            <>
              <h1 className="text-2xl font-bold text-[#0B3556] tracking-tight mb-2">
                Carteira de projetos
              </h1>
              <p className="text-sm text-[#4B5563] mb-6">
                Clique em um projeto para abrir o cartão 360. Filtre por etapa, prioridade e atraso.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
                <Select value={fEtapa} onValueChange={setFEtapa}>
                  <SelectTrigger className="w-full h-10 text-sm">
                    <SelectValue placeholder="Etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as etapas</SelectItem>
                    {ETAPAS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={fPrioridade} onValueChange={setFPrioridade}>
                  <SelectTrigger className="w-full h-10 text-sm">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as prioridades</SelectItem>
                    {PRIORIDADES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={fOwner} onValueChange={setFOwner}>
                  <SelectTrigger className="w-full h-10 text-sm">
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os responsáveis</SelectItem>
                    {usuarios.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant={fAtraso ? 'default' : 'outline'}
                  onClick={() => setFAtraso(!fAtraso)}
                  className="h-10 text-sm gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  {fAtraso ? 'Só atrasados' : 'Incluir atrasados'}
                </Button>
              </div>

              <div className="flex gap-2 mb-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void carregarCarteira()}
                  className="gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Atualizar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFEtapa('')
                    setFPrioridade('')
                    setFAtraso(false)
                    setFOwner('')
                  }}
                  className="gap-2 text-slate-500"
                >
                  Limpar filtros
                </Button>
              </div>

              {carregandoLista ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-[#0B3556]" />
                </div>
              ) : lista.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-500">
                  Nenhum projeto encontrado com os filtros atuais.
                </div>
              ) : (
                <div className="space-y-3">
                  {lista.map((p) => (
                    <button
                      key={p.project_key}
                      type="button"
                      onClick={() => void abrirCartao(p)}
                      className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-[#0B3556] hover:shadow-md transition-all bg-white"
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="font-semibold text-[#0B3556] text-sm">
                            {p.project_key} — {p.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Próxima ação: {p.next_action}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                            {p.stage}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                              p.priority === 'alta'
                                ? 'bg-red-100 text-red-700'
                                : p.priority === 'media'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {prioridadeLabel(p.priority)}
                          </span>
                          {p.atrasado && (
                            <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-xs font-semibold">
                              Atrasado
                            </span>
                          )}
                          <span className="text-xs text-slate-400">Prazo: {p.due_date}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {aba === 'projeto' && (
            <>
              <h1 className="text-2xl font-bold text-[#0B3556] tracking-tight mb-2">
                Novo projeto
              </h1>
              <p className="text-sm text-[#4B5563] mb-6">
                Preencha os campos obrigatórios. Você será o admin do projeto criado.
              </p>

              {projMsg && (
                <div
                  className={`mb-6 p-3.5 rounded-lg flex items-start gap-3 text-sm ${
                    projMsg.ok
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {projMsg.ok ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-snug">{projMsg.text}</div>
                </div>
              )}

              <form onSubmit={criarProjeto} noValidate className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Chave do projeto *
                    </Label>
                    <Input
                      value={projKey}
                      onChange={(e) => setProjKey(e.target.value)}
                      placeholder="PROJ-XXX-001"
                      className="h-11 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Nome do projeto *
                    </Label>
                    <Input
                      value={projNome}
                      onChange={(e) => setProjNome(e.target.value)}
                      placeholder="Diagnóstico de remuneração"
                      className="h-11 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Cliente *
                    </Label>
                    <Select value={clienteId} onValueChange={setClienteId}>
                      <SelectTrigger className="w-full h-11 text-sm">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientes.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Tipo de serviço *
                    </Label>
                    <Select value={servicoId} onValueChange={setServicoId}>
                      <SelectTrigger className="w-full h-11 text-sm">
                        <SelectValue placeholder="Selecione o serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        {servicos.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Responsável *
                    </Label>
                    <Select value={ownerId} onValueChange={setOwnerId}>
                      <SelectTrigger className="w-full h-11 text-sm">
                        <SelectValue placeholder="Selecione o responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        {usuarios.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name || u.email} ({u.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Prazo *
                    </Label>
                    <Input
                      type="date"
                      value={prazo}
                      onChange={(e) => setPrazo(e.target.value)}
                      className="h-11 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Etapa *
                    </Label>
                    <Select value={etapa} onValueChange={setEtapa}>
                      <SelectTrigger className="w-full h-11 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ETAPAS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Prioridade *
                    </Label>
                    <Select value={prioridade} onValueChange={setPrioridade}>
                      <SelectTrigger className="w-full h-11 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORIDADES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Próxima ação *
                  </Label>
                  <Input
                    value={proximaAcao}
                    onChange={(e) => setProximaAcao(e.target.value)}
                    placeholder="Ex.: Agendar kick-off com o cliente"
                    className="h-11 text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={carregando}
                  className="w-full h-11 text-[15px] font-semibold text-white bg-[#0B3556] hover:bg-[#1B5E8A] transition-all rounded-lg shadow-md"
                >
                  {carregando ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Criando projeto...</span>
                    </span>
                  ) : (
                    <span>Criar projeto</span>
                  )}
                </Button>
              </form>
            </>
          )}

          {aba === 'cliente' && (
            <>
              <h1 className="text-2xl font-bold text-[#0B3556] tracking-tight mb-2">
                Novo cliente
              </h1>
              <p className="text-sm text-[#4B5563] mb-6">
                Cadastre o cliente para vinculá-lo a projetos.
              </p>

              {clienteMsg && (
                <div
                  className={`mb-6 p-3.5 rounded-lg flex items-start gap-3 text-sm ${
                    clienteMsg.ok
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {clienteMsg.ok ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-snug">{clienteMsg.text}</div>
                </div>
              )}

              <form onSubmit={cadastrarCliente} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Nome do cliente *
                  </Label>
                  <Input
                    value={clienteNome}
                    onChange={(e) => setClienteNome(e.target.value)}
                    placeholder="Razão social ou nome fantasia"
                    className="h-11 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Documento (CNPJ)
                  </Label>
                  <Input
                    value={clienteDoc}
                    onChange={(e) => setClienteDoc(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="h-11 text-sm"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={carregando}
                  className="w-full h-11 text-[15px] font-semibold text-white bg-[#0B3556] hover:bg-[#1B5E8A] transition-all rounded-lg shadow-md"
                >
                  {carregando ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Cadastrando...</span>
                    </span>
                  ) : (
                    <span>Cadastrar cliente</span>
                  )}
                </Button>
              </form>
            </>
          )}

          {aba === 'membros' && (
            <>
              <h1 className="text-2xl font-bold text-[#0B3556] tracking-tight mb-2">
                Alocar membro no projeto
              </h1>
              <p className="text-sm text-[#4B5563] mb-6">
                Selecione o projeto da lista cadastrada e conceda acesso a um usuário.
              </p>

              {membroMsg && (
                <div
                  className={`mb-6 p-3.5 rounded-lg flex items-start gap-3 text-sm ${
                    membroMsg.ok
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {membroMsg.ok ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-snug">{membroMsg.text}</div>
                </div>
              )}

              <form onSubmit={concederVinculo} noValidate className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Usuário *
                  </Label>
                  <Select value={membroUserId} onValueChange={setMembroUserId}>
                    <SelectTrigger className="w-full h-11 text-sm">
                      <SelectValue placeholder="Selecione o usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {usuarios.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.email} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Projeto *
                    </Label>
                    <Select value={membroProjKey} onValueChange={setMembroProjKey}>
                      <SelectTrigger className="w-full h-11 text-sm">
                        <SelectValue placeholder="Selecione o projeto" />
                      </SelectTrigger>
                      <SelectContent>
                        {projetos.map((p) => (
                          <SelectItem key={p.project_key} value={p.project_key}>
                            {p.name ? `${p.project_key} — ${p.name}` : p.project_key}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Papel no projeto *
                    </Label>
                    <Select value={membroRole} onValueChange={(v) => setMembroRole(v as Papel)}>
                      <SelectTrigger className="w-full h-11 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="lider">Líder</SelectItem>
                        <SelectItem value="consultor">Consultor</SelectItem>
                        <SelectItem value="revisor">Revisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={carregando}
                  className="w-full h-11 text-[15px] font-semibold text-white bg-[#0B3556] hover:bg-[#1B5E8A] transition-all rounded-lg shadow-md"
                >
                  {carregando ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Concedendo...</span>
                    </span>
                  ) : (
                    <span>Conceder acesso</span>
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Cartão 360 (dialog) */}
      <Dialog open={!!cartaoAberto} onOpenChange={(open) => !open && setCartaoAberto(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B3556] flex items-center gap-2">
              <Pencil className="w-5 h-5 text-[#C9A24B]" />
              <span>
                {cartao ? `${cartao.project_key} — ${cartao.name}` : cartaoAberto?.project_key}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {cartao ? `${cartao.client_name} · ${cartao.service_name}` : 'Carregando...'}
            </DialogDescription>
          </DialogHeader>

          {cartao ? (
            <div className="space-y-5 py-1">
              {/* Campos do cartão */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Etapa</div>
                  <div className="font-semibold text-[#0B3556] mt-0.5">{cartao.stage}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Prioridade</div>
                  <div className="font-semibold text-[#0B3556] mt-0.5">
                    {prioridadeLabel(cartao.priority)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Prazo</div>
                  <div className="font-semibold text-[#0B3556] mt-0.5">{cartao.due_date}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 col-span-2 sm:col-span-3">
                  <div className="text-slate-500">Próxima ação</div>
                  <div className="font-semibold text-[#0B3556] mt-0.5">{cartao.next_action}</div>
                </div>
              </div>

              {editMsg && (
                <div
                  className={`p-3.5 rounded-lg flex items-start gap-3 text-sm ${
                    editMsg.ok
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-700'
                  }`}
                >
                  {editMsg.ok ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  )}
                  <div className="leading-snug">{editMsg.text}</div>
                </div>
              )}

              {/* Edição (admin/líder) */}
              <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Editar projeto
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">Prioridade</Label>
                    <Select value={editPrioridade} onValueChange={setEditPrioridade}>
                      <SelectTrigger className="w-full h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORIDADES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">Prazo</Label>
                    <Input
                      type="date"
                      value={editPrazo}
                      onChange={(e) => setEditPrazo(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">Responsável</Label>
                    <Select value={editOwner} onValueChange={setEditOwner}>
                      <SelectTrigger className="w-full h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {usuarios.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name || u.email} ({u.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-600">Próxima ação</Label>
                    <Input
                      value={editAcao}
                      onChange={(e) => setEditAcao(e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => void salvarEdicao()}
                    disabled={carregando}
                    className="gap-2 bg-[#0B3556] hover:bg-[#1B5E8A] text-white"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Salvar alterações
                  </Button>
                  {cartao.active && (
                    <Button
                      onClick={() => void inativar()}
                      disabled={carregando}
                      variant="outline"
                      className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Archive className="w-4 h-4" />
                      Inativar projeto
                    </Button>
                  )}
                </div>
              </div>

              {/* Timeline (auditoria) */}
              <div className="p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3">
                  Histórico (auditoria)
                </div>
                <div className="space-y-2">
                  {timeline.map((ev) => (
                    <div key={ev.id} className="text-xs flex gap-3 items-start">
                      <span className="text-slate-400 whitespace-nowrap font-mono">
                        {ev.created.slice(0, 16)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium whitespace-nowrap">
                        {ev.action}
                      </span>
                      <span className="text-slate-600 leading-snug">
                        {ev.detail} — {ev.actor_email}
                      </span>
                    </div>
                  ))}
                  {timeline.length === 0 && (
                    <div className="text-xs text-slate-400">Nenhum evento registrado.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#0B3556]" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
