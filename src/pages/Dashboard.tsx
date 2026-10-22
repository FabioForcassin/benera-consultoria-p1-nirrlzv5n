import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  LogOut,
  User,
  UserPlus,
  FolderPlus,
  ListFilter,
  ShieldCheck,
  CheckCircle2,
  Building2,
  FolderKanban,
  Users,
  Settings,
  Bell,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { BeneraLogo } from '@/components/BeneraLogo'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function Dashboard() {
  const { user, isAuthenticated, isLoading, logout, isAdmin, role } = useAuth()
  const isLider = role === 'lider'
  const navigate = useNavigate()
  const [profileModalOpen, setProfileModalOpen] = useState(false)

  // Proteção da rota: se não autenticado após carregamento, redireciona para /
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isLoading, isAuthenticated, navigate])

  const handleLogout = () => {
    logout()
    navigate('/', { replace: true })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0B3556] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Carregando painel corporativo...
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return null
  }

  const userName = user.name || user.email.split('@')[0] || 'Usuário'

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Barra de Navegação Corporativa */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <BeneraLogo variant="dark" size="md" />
            <span className="hidden sm:inline-block h-5 w-px bg-slate-200" />
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Portal do Colaborador
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="text-xs font-semibold border-slate-200 text-slate-700 hover:text-[#0B3556] hover:bg-slate-50 gap-1.5"
            >
              <Link to="/fila">
                <ListFilter className="w-3.5 h-3.5" />
                <span>Minha fila</span>
              </Link>
            </Button>

            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-xs font-semibold border-slate-200 text-slate-700 hover:text-[#0B3556] hover:bg-slate-50 gap-1.5"
              >
                <Link to="/convites">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Convidar usuário</span>
                </Link>
              </Button>
            )}

            {(isAdmin || isLider) && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-xs font-semibold border-slate-200 text-slate-700 hover:text-[#0B3556] hover:bg-slate-50 gap-1.5"
              >
                <Link to="/projetos">
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Projetos</span>
                </Link>
              </Button>
            )}

            {!isAdmin && !isLider && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-xs font-semibold border-slate-200 text-slate-700 hover:text-[#0B3556] hover:bg-slate-50 gap-1.5"
              >
                <Link to="/projetos">
                  <ListFilter className="w-3.5 h-3.5" />
                  <span>Meus projetos</span>
                </Link>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setProfileModalOpen(true)}
              className="text-xs font-semibold border-slate-200 text-slate-700 hover:text-[#0B3556] hover:bg-slate-50 gap-1.5"
            >
              <User className="w-3.5 h-3.5" />
              <span>Editar perfil</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Banner de Boas-Vindas */}
        <div
          className="rounded-2xl p-6 md:p-10 text-white relative overflow-hidden shadow-xl"
          style={{
            background: 'linear-gradient(135deg, #071F33 0%, #0B3556 50%, #1B5E8A 100%)',
          }}
        >
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[#E6C67A] text-xs font-semibold tracking-wider uppercase mb-4 border border-white/10">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C9A24B]" />
              Sessão Autenticada
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">
              Bem-vindo, {userName}
            </h1>

            <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
              Você está conectado ao sistema de gestão e desenho organizacional da Benera
              Consultoria. Aqui são orquestrados os diagnósticos salariais, pesquisas de remuneração
              e arquitetura corporativa.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/10 text-xs font-mono text-slate-200">
                Email: {user.email}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Conta Verificada
              </span>
            </div>
          </div>

          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-10 translate-y-10">
            <BeneraLogo variant="light" size="lg" showTagline={false} />
          </div>
        </div>

        {/* Módulos do Sistema de Consultoria */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#0B3556]">
                Módulos de Remuneração e Desenho Organizacional
              </h2>
              <p className="text-xs text-slate-500">
                Acesso aos painéis de diagnóstico e governança
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-[#0B3556]/10 text-[#0B3556] flex items-center justify-center mb-4">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Benera Valor</h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Plano de cargos e salários competitivos, remuneração variável e incentivos de longo
                prazo.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-[#0B3556]">
                <span>Status: Operacional</span>
                <span className="text-[#C9A24B] font-semibold">Ativo</span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-[#0B3556]/10 text-[#0B3556] flex items-center justify-center mb-4">
                <FolderKanban className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Benera Estrutura</h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Arquitetura organizacional para agilidade decisória, otimização de spans e camadas.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-[#0B3556]">
                <span>Status: Operacional</span>
                <span className="text-[#C9A24B] font-semibold">Ativo</span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-[#0B3556]/10 text-[#0B3556] flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">Benera Ritmo & Cultura</h3>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Disciplina de execução, metas OKR, calibração de valores e engajamento.
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-[#0B3556]">
                <span>Status: Operacional</span>
                <span className="text-[#C9A24B] font-semibold">Ativo</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modal / Placeholder de Edição de Perfil */}
      <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#0B3556] flex items-center gap-2">
              <User className="w-5 h-5 text-[#C9A24B]" />
              <span>Editar Perfil</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Informações do usuário autenticado no sistema corporativo Benera.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Nome:</span>
                <span className="font-semibold text-slate-800">{user.name || 'Não informado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-semibold text-slate-800 font-mono">{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Perfil:</span>
                <span className="font-semibold text-[#0B3556]">
                  {(() => {
                    const roleLabels: Record<string, string> = {
                      admin: 'Administrador',
                      lider: 'Líder',
                      consultor: 'Consultor',
                      revisor: 'Revisor',
                    }
                    return roleLabels[user.role ?? ''] ?? 'Sem papel definido'
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ID do Usuário:</span>
                <span className="font-mono text-slate-400 text-[10px]">{user.id}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Alterações cadastrais e troca de email são processadas via central administrativa do
              Skip Cloud ou através do suporte interno pelo email{' '}
              <span className="font-semibold text-[#0B3556]">contato@benera.com.br</span>.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setProfileModalOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rodapé Corporativo */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p>© 2025 Benera Consultoria. Todos os direitos reservados.</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Ambiente restrito aos consultores e parceiros autorizados da Benera.
        </p>
      </footer>
    </div>
  )
}
