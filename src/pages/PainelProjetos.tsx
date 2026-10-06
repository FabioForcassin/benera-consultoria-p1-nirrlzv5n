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

const ETAPAS = ['Entrada', 'Kick-off', 'Diagnóstico', 'Entrega', 'Encerrado']
const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
]

export default function PainelProjetos() {
  const { isAdmin, isLider, criarConvite } = useAuth()
  const podeCadastrar = isAdmin || isLider

  // Estado: aba ativa
  const [aba, setAba] = useState<'projeto' | 'cliente' | 'membros'>('projeto')

  // Formulário de cliente
  const [clienteNome, setClienteNome] = useState('')
  const [clienteDoc, setClienteDoc] = useState('')
  const [clienteMsg, setClienteMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Formulário de projeto
  const [projKey, setProjKey] = useState('')
  const [projNome, setProjNome] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
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

  const carregarCatalogos = async () => {
    if (clientes.length > 0) return
    try {
      const [c, s, u] = await Promise.all([
        pb.send('/backend/v1/clients', { method: 'GET' }),
        pb.send('/backend/v1/service-types', { method: 'GET' }),
        pb.send('/backend/v1/users', { method: 'GET' }),
      ])
      setClientes((c as { items: Cliente[] }).items)
      setServicos((s as { items: Servico[] }).items)
      setUsuarios((u as { items: Usuario[] }).items)
    } catch (_) {}
  }

  if (!podeCadastrar) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#0B3556]">Acesso restrito</h1>
          <p className="mt-2 text-sm text-slate-600">
            Somente administradores e líderes podem cadastrar clientes e projetos.
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
    } catch (err) {
      setProjMsg({ ok: false, text: translateAuthError(err) })
    } finally {
      setCarregando(false)
    }
  }

  const concederVinculo = async (e: FormEvent) => {
    e.preventDefault()
    setMembroMsg(null)
    if (!membroUserId || !membroProjKey.trim()) {
      setMembroMsg({ ok: false, text: 'Selecione o usuário e informe a chave do projeto.' })
      return
    }
    setCarregando(true)
    try {
      await pb.send('/backend/v1/members', {
        method: 'POST',
        body: JSON.stringify({
          user_id: membroUserId,
          project_key: membroProjKey.trim().toUpperCase(),
          project_role: membroRole,
        }),
      })
      setMembroMsg({
        ok: true,
        text: `Vínculo concedido: ${usuarios.find((u) => u.id === membroUserId)?.email ?? 'usuário'} como ${membroRole} no projeto ${membroProjKey.trim().toUpperCase()}.`,
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
        if (id !== 'cliente') carregarCatalogos()
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

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center p-6 md:p-12 bg-white md:bg-grid-benera">
      <div className="w-full max-w-[640px] pt-4 flex items-center justify-between">
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

      <div className="w-full max-w-[640px] my-auto py-8">
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabBtn('projeto', 'Novo projeto', <FolderPlus className="w-4 h-4" />)}
          {tabBtn('cliente', 'Novo cliente', <Building2 className="w-4 h-4" />)}
          {tabBtn('membros', 'Alocar membro', <UserPlus className="w-4 h-4" />)}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.06)] animate-benera-form">
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
                Conceda acesso de um usuário a um projeto. A revogação também fica aqui (em breve:
                listagem com botão de revogar).
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
                      Chave do projeto *
                    </Label>
                    <Input
                      value={membroProjKey}
                      onChange={(e) => setMembroProjKey(e.target.value)}
                      placeholder="PROJ-F1-001"
                      className="h-11 text-sm"
                    />
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

      <footer className="w-full text-center pb-4 text-xs text-slate-400">
        © 2025 Benera Consultoria. Todos os direitos reservados.
      </footer>
    </div>
  )
}
