import { useState, type FormEvent, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { useAuth, translateAuthError } from '@/contexts/AuthContext'
import { BeneraLogo } from '@/components/BeneraLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

export default function Index() {
  const navigate = useNavigate()
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  // Feedback e erros por campo
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  // Se já autenticado, vai direto para o dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [authLoading, isAuthenticated, navigate])

  // Validação em tempo real
  const validateEmail = (value: string): string | null => {
    if (!value.trim()) {
      return 'O email é obrigatório.'
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(value.trim())) {
      return 'Digite um endereço de email válido.'
    }
    return null
  }

  const validatePassword = (value: string): string | null => {
    if (!value) {
      return 'A senha é obrigatória.'
    }
    if (value.length < 8) {
      return 'A senha deve ter no mínimo 8 caracteres.'
    }
    return null
  }

  const handleEmailChange = (val: string) => {
    setEmail(val)
    if (hasSubmitted) {
      setEmailError(validateEmail(val))
    }
    if (generalError) setGeneralError(null)
  }

  const handlePasswordChange = (val: string) => {
    setPassword(val)
    if (hasSubmitted) {
      setPasswordError(validatePassword(val))
    }
    if (generalError) setGeneralError(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setHasSubmitted(true)
    setGeneralError(null)

    const eErr = validateEmail(email)
    const pErr = validatePassword(password)

    setEmailError(eErr)
    setPasswordError(pErr)

    if (eErr || pErr) {
      return
    }

    setIsSubmitting(true)

    try {
      await login(email, password, rememberMe)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = translateAuthError(err)
      setGeneralError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F8FAFC]">
      {/* ========================================================= */}
      {/* PAINEL ESQUERDO: ÁREA DE MARCA INSTITUCIONAL             */}
      {/* Desktop (45%), Tablet (35%), Oculto em Mobile (<768px)   */}
      {/* ========================================================= */}
      <aside
        className="hidden md:flex md:w-[35%] lg:w-[45%] relative flex-col justify-between p-8 lg:p-14 text-white overflow-hidden shadow-2xl animate-benera-left"
        style={{
          background: 'linear-gradient(145deg, #071F33 0%, #0B3556 50%, #0F456E 100%)',
        }}
      >
        {/* Camada sutil de textura/mesh corporativo */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 15% 20%, rgba(201, 162, 75, 0.4) 0%, transparent 40%),
                              radial-gradient(circle at 85% 80%, rgba(27, 94, 138, 0.8) 0%, transparent 50%)`,
          }}
        />

        {/* Linha decorativa geométrica de governança */}
        <div className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute -right-12 -bottom-12 w-72 h-72 rounded-full border border-[#C9A24B]/15 pointer-events-none" />

        {/* Topo: Logotipo Benera */}
        <div className="relative z-10">
          <BeneraLogo variant="light" size="lg" />
        </div>

        {/* Centro: Manchete e proposta de valor real do site institucional */}
        <div className="relative z-10 my-auto py-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[#E6C67A] text-xs font-semibold tracking-wider uppercase mb-5">
            <span className="w-2 h-2 rounded-full bg-[#C9A24B] animate-pulse" />
            Remuneração & Desenho Organizacional
          </div>

          <h1 className="text-2xl lg:text-[2.25rem] font-bold leading-[1.18] tracking-[-0.025em] text-white text-balance">
            Sua organização é um{' '}
            <span className="text-[#C9A24B] underline decoration-[#C9A24B]/40 underline-offset-4">
              motor
            </span>{' '}
            ou um freio para a sua estratégia?
          </h1>

          <p className="mt-5 text-sm lg:text-base text-slate-300/90 leading-relaxed max-w-lg font-normal">
            A profundidade técnica de uma grande consultoria com a agilidade de um time sênior
            especializado em destravar o potencial de pessoas e governança.
          </p>

          {/* Citação curta ou diferencial do sócio-fundador */}
          <div className="mt-6 p-4 rounded-xl bg-white/[0.05] border border-white/10 backdrop-blur-sm">
            <p className="text-xs lg:text-sm text-slate-200 italic font-light">
              &ldquo;Minha missão é provar que remuneração bem feita não precisa ser
              complicada.&rdquo;
            </p>
            <p className="mt-2 text-xs font-medium text-[#C9A24B]">
              — Fábio Forcassin, Sócio-Fundador
            </p>
          </div>
        </div>

        {/* Rodapé do Painel: 3 Indicadores de Confiança extraídos do site oficial */}
        <div className="relative z-10 pt-6 border-t border-white/15">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#C9A24B]/20 border border-[#C9A24B]/40 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-[#E6C67A]" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">Sócios Seniores</p>
                <p className="text-slate-400 text-[11px]">Atendimento direto</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#C9A24B]/20 border border-[#C9A24B]/40 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-[#E6C67A]" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">Retorno em 24h</p>
                <p className="text-slate-400 text-[11px]">Agilidade executiva</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#C9A24B]/20 border border-[#C9A24B]/40 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-[#E6C67A]" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">70+ Projetos</p>
                <p className="text-slate-400 text-[11px]">Casos entregues</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* PAINEL DIREITO: FORMULÁRIO DE LOGIN                      */}
      {/* Split-screen responsivo com textura sutil bg-grid-benera */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col justify-between items-center px-6 py-10 md:p-12 lg:p-16 bg-white md:bg-grid-benera relative min-h-screen md:min-h-0">
        {/* Espaçador flex para centralização perfeita */}
        <div className="w-full flex justify-center md:justify-end">
          <div className="text-xs text-slate-400 font-medium tracking-wide hidden sm:block">
            Ambiente Corporativo Seguro • TLS 1.3
          </div>
        </div>

        {/* Card do Formulário (max-w 400px) */}
        <div className="w-full max-w-[420px] my-auto py-4 animate-benera-form">
          {/* Em Mobile: Logotipo no topo do formulário */}
          <div className="flex md:hidden flex-col items-center justify-center mb-8">
            <BeneraLogo variant="dark" size="lg" />
            <div className="h-0.5 w-16 bg-[#C9A24B] mt-3 rounded-full" />
          </div>

          {/* Cabeçalho do Formulário */}
          <div className="text-left mb-8">
            <div className="inline-block px-2.5 py-1 rounded bg-[#0B3556]/5 text-[#0B3556] text-[11px] font-semibold tracking-wider uppercase mb-2">
              Sistema Interno
            </div>
            <h2 className="text-2xl lg:text-[1.75rem] font-bold text-[#0B3556] tracking-tight">
              Acesso ao Sistema
            </h2>
            <p className="mt-2 text-sm text-[#4B5563]">
              Entre com suas credenciais para acessar o painel de consultoria.
            </p>
          </div>

          {/* Alerta de Erro Geral do PocketBase (em vermelho sutil) */}
          {generalError && (
            <div
              role="alert"
              className="mb-6 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 text-sm animate-benera-shake"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-snug">{generalError}</div>
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Campo: Email */}
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex justify-between"
              >
                <span>Email Corporativo</span>
                {emailError && (
                  <span className="text-red-600 font-normal lowercase text-[11px]">
                    {emailError}
                  </span>
                )}
              </Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="seu@email.com"
                  className={`pl-10 h-11 text-sm bg-white transition-all duration-150 ${
                    emailError
                      ? 'border-red-500 focus-visible:ring-red-400 focus-visible:border-red-500'
                      : 'border-slate-300 hover:border-slate-400 focus-visible:border-[#0B3556] focus-visible:ring-[#0B3556]/20'
                  }`}
                  aria-invalid={!!emailError}
                />
              </div>
            </div>

            {/* Campo: Senha */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Senha
                </Label>
                {passwordError && (
                  <span className="text-red-600 font-normal text-[11px]">{passwordError}</span>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="••••••••"
                  className={`pl-10 pr-10 h-11 text-sm bg-white transition-all duration-150 ${
                    passwordError
                      ? 'border-red-500 focus-visible:ring-red-400 focus-visible:border-red-500'
                      : 'border-slate-300 hover:border-slate-400 focus-visible:border-[#0B3556] focus-visible:ring-[#0B3556]/20'
                  }`}
                  aria-invalid={!!passwordError}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Checkbox "Lembrar de mim" e Link "Esqueceu sua senha?" */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  className="border-slate-300 data-[state=checked]:bg-[#0B3556] data-[state=checked]:border-[#0B3556]"
                />
                <label
                  htmlFor="remember-me"
                  className="text-xs text-slate-600 font-medium cursor-pointer select-none"
                >
                  Lembrar de mim
                </label>
              </div>

              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-[#0B3556] hover:text-[#C9A24B] transition-colors duration-150 hover:underline"
              >
                Esqueceu sua senha?
              </Link>
            </div>

            {/* Botão Entrar */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 text-[15px] font-semibold text-white bg-[#0B3556] hover:bg-[#1B5E8A] active:bg-[#071F33] transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] rounded-lg mt-2"
              style={{
                boxShadow: '0 4px 14px 0 rgba(11, 53, 86, 0.25)',
              }}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Validando credenciais...</span>
                </span>
              ) : (
                <span>Entrar no Sistema</span>
              )}
            </Button>
          </form>

          {/* Dica de acesso padrão da consultoria (idempotente) */}
          <div className="mt-8 pt-5 border-t border-slate-200/80">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <div className="w-5 h-5 rounded-full bg-[#0B3556]/10 text-[#0B3556] flex items-center justify-center shrink-0 font-bold text-[10px]">
                i
              </div>
              <div className="leading-snug">
                <span className="font-semibold text-slate-800">Acesso Restrito:</span> O cadastro é
                gerenciado pelo RH e administração da Benera. Para acesso demo, use{' '}
                <code className="text-[#0B3556] font-mono bg-white px-1 py-0.5 rounded border border-slate-200">
                  fabio.forcassin@benera.com.br
                </code>{' '}
                /{' '}
                <code className="text-[#0B3556] font-mono bg-white px-1 py-0.5 rounded border border-slate-200">
                  Skip@Pass
                </code>
                .
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé institucional */}
        <footer className="w-full text-center pt-6 pb-2 text-xs text-slate-400">
          <p>© 2025 Benera Consultoria. Todos os direitos reservados.</p>
          <p className="text-[11px] text-slate-400/80 mt-1">
            Consultoria em Remuneração e Desenho Organizacional
          </p>
        </footer>
      </main>
    </div>
  )
}
