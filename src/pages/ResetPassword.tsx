import { useState, type FormEvent, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import { useAuth, translateAuthError } from '@/contexts/AuthContext'
import { BeneraLogo } from '@/components/BeneraLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const { confirmPasswordReset } = useAuth()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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
      setGeneralError('Token de redefinição não encontrado ou link inválido.')
      return
    }

    const pErr = validatePassword(password)
    const cErr = validateConfirm(passwordConfirm, password)

    setPasswordError(pErr)
    setConfirmError(cErr)

    if (pErr || cErr) return

    setIsSubmitting(true)
    try {
      await confirmPasswordReset(token, password, passwordConfirm)
      setIsSuccess(true)
    } catch (error) {
      setGeneralError(translateAuthError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center p-6 md:p-12 bg-white md:bg-grid-benera">
      {/* Topo com Logo */}
      <div className="w-full max-w-[440px] pt-4">
        <Link to="/" className="inline-block">
          <BeneraLogo variant="dark" size="md" />
        </Link>
      </div>

      {/* Card Central */}
      <div className="w-full max-w-[440px] my-auto py-8">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.06)] animate-benera-form">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#0B3556] tracking-tight">Definir nova senha</h1>
            <p className="mt-2 text-sm text-[#4B5563]">
              Escolha uma nova senha forte para acessar o sistema interno da Benera Consultoria.
            </p>
          </div>

          {!token && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <p className="font-semibold">Link incompleto</p>
              <p className="mt-1 text-xs">
                O token de segurança não foi informado na URL. Certifique-se de acessar o link
                exatamente como recebido por email.
              </p>
            </div>
          )}

          {isSuccess ? (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm leading-relaxed">
                  <p className="font-semibold text-emerald-900">Senha redefinida com sucesso!</p>
                  <p className="mt-1 text-emerald-800">
                    Sua nova credencial já está ativa. Por segurança, o sistema exige que você faça
                    login utilizando a nova senha cadastrada.
                  </p>
                </div>
              </div>

              <Button
                asChild
                className="w-full h-11 bg-[#0B3556] hover:bg-[#1B5E8A] text-white font-semibold rounded-lg shadow-md"
              >
                <Link to="/">Ir para a tela de Login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {generalError && (
                <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-2.5 text-sm">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-snug">{generalError}</div>
                </div>
              )}

              {/* Campo Nova Senha */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Nova Senha
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
              </div>

              {/* Campo Confirmar Nova Senha */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="passwordConfirm"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Confirmar Nova Senha
                  </Label>
                  {confirmError && (
                    <span className="text-red-600 font-normal text-[11px]">{confirmError}</span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <Input
                    id="passwordConfirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => {
                      setPasswordConfirm(e.target.value)
                      if (confirmError) setConfirmError(null)
                    }}
                    placeholder="Repita a nova senha"
                    className={`pl-10 pr-10 h-11 text-sm bg-white transition-all ${
                      confirmError
                        ? 'border-red-500 focus-visible:ring-red-400'
                        : 'border-slate-300 focus-visible:border-[#0B3556] focus-visible:ring-[#0B3556]/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !token}
                className="w-full h-11 text-[15px] font-semibold text-white bg-[#0B3556] hover:bg-[#1B5E8A] transition-all rounded-lg shadow-md"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Redefinindo senha...</span>
                  </span>
                ) : (
                  <span>Redefinir senha</span>
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

      {/* Rodapé */}
      <footer className="w-full text-center pb-4 text-xs text-slate-400">
        © 2025 Benera Consultoria. Todos os direitos reservados.
      </footer>
    </div>
  )
}
