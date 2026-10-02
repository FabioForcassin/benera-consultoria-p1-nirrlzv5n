import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Loader2, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth, translateAuthError } from '@/contexts/AuthContext'
import { BeneraLogo } from '@/components/BeneraLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AceitarConvite() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { aceitarConvite } = useAuth()

  const tokenParam = searchParams.get('token') || ''
  const [token, setToken] = useState(tokenParam)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const validatePassword = (val: string): string | null => {
    if (!val) return 'A senha é obrigatória.'
    if (val.length < 8) return 'A senha deve ter no mínimo 8 caracteres.'
    return null
  }

  const validateConfirm = (val: string, original: string): string | null => {
    if (!val) return 'A confirmação de senha é obrigatória.'
    if (val !== original) return 'As senhas não coincidem.'
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setGeneralError(null)

    if (!token) {
      setGeneralError('Token de ativação não informado.')
      return
    }

    const pErr = validatePassword(password)
    const cErr = validateConfirm(passwordConfirm, password)
    setPasswordError(pErr)
    setConfirmError(cErr)
    if (pErr || cErr) return

    setIsSubmitting(true)
    try {
      await aceitarConvite(token, password)
      setIsSuccess(true)
      setTimeout(() => navigate('/dashboard', { replace: true }), 1800)
    } catch (err) {
      setGeneralError(translateAuthError(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center p-6 md:p-12 bg-white md:bg-grid-benera">
      <div className="w-full max-w-[440px] pt-4">
        <Link to="/" className="inline-block">
          <BeneraLogo variant="dark" size="md" />
        </Link>
      </div>

      <div className="w-full max-w-[440px] my-auto py-8">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.06)] animate-benera-form">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#0B3556] tracking-tight">Ativar acesso</h1>
            <p className="mt-2 text-sm text-[#4B5563]">
              Defina sua senha para concluir o convite recebido da Benera Consultoria.
            </p>
          </div>

          {!token && (
            <div className="mb-6">
              <Label htmlFor="token" className="text-xs font-semibold text-slate-700">
                Token do convite
              </Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Cole aqui o token recebido"
                className="mt-1.5 h-11 text-sm"
              />
            </div>
          )}

          {isSuccess ? (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm leading-relaxed">
                  <p className="font-semibold text-emerald-900">Conta ativada com sucesso!</p>
                  <p className="mt-1 text-emerald-800">
                    Você já está autenticado. Redirecionando para o painel...
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {generalError && (
                <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-2.5 text-sm">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-snug">{generalError}</div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Nova senha
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (passwordError) setPasswordError(null)
                    }}
                    placeholder="Mínimo 8 caracteres"
                    className={`pl-10 pr-10 h-11 text-sm bg-white transition-all ${
                      passwordError
                        ? 'border-red-500 focus-visible:ring-red-400'
                        : 'border-slate-300 focus-visible:border-[#0B3556] focus-visible:ring-[#0B3556]/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordError && <span className="text-red-600 text-[11px]">{passwordError}</span>}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="passwordConfirm"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Confirmar nova senha
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <Input
                    id="passwordConfirm"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => {
                      setPasswordConfirm(e.target.value)
                      if (confirmError) setConfirmError(null)
                    }}
                    placeholder="Repita a nova senha"
                    className={`pl-10 h-11 text-sm bg-white transition-all ${
                      confirmError
                        ? 'border-red-500 focus-visible:ring-red-400'
                        : 'border-slate-300 focus-visible:border-[#0B3556] focus-visible:ring-[#0B3556]/20'
                    }`}
                  />
                </div>
                {confirmError && <span className="text-red-600 text-[11px]">{confirmError}</span>}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 text-[15px] font-semibold text-white bg-[#0B3556] hover:bg-[#1B5E8A] transition-all rounded-lg shadow-md"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Ativando acesso...</span>
                  </span>
                ) : (
                  <span>Ativar acesso</span>
                )}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/"
                  className="text-xs font-semibold text-slate-500 hover:text-[#0B3556] hover:underline transition-colors"
                >
                  Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>

      <footer className="w-full text-center pb-4 text-xs text-slate-400">
        © 2025 Benera Consultoria. Todos os direitos reservados.
      </footer>
    </div>
  )
}
