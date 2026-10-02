import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth, translateAuthError } from '@/contexts/AuthContext'
import { BeneraLogo } from '@/components/BeneraLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const validate = (val: string): string | null => {
    if (!val.trim()) return 'O email corporativo é obrigatório.'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(val.trim())) return 'Digite um email válido.'
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setGeneralError(null)

    const err = validate(email)
    setEmailError(err)
    if (err) return

    setIsSubmitting(true)
    try {
      await requestPasswordReset(email)
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
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0B3556] transition-colors mb-4 group"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Voltar para o login</span>
            </Link>

            <h1 className="text-2xl font-bold text-[#0B3556] tracking-tight">Recuperar senha</h1>
            <p className="mt-2 text-sm text-[#4B5563]">
              Informe seu email cadastrado e enviaremos um link para você redefinir sua senha com
              segurança.
            </p>
          </div>

          {/* Feedback de Sucesso */}
          {isSuccess ? (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-sm leading-relaxed">
                  <p className="font-semibold text-emerald-900">Instruções enviadas com sucesso!</p>
                  <p className="mt-1 text-emerald-800">
                    Se o endereço <strong className="font-semibold">{email}</strong> estiver
                    cadastrado em nosso sistema, você receberá um email em instantes com o link de
                    redefinição.
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                Não recebeu? Verifique sua caixa de spam ou lixo eletrônico. Se precisar, você pode{' '}
                <button
                  type="button"
                  onClick={() => setIsSuccess(false)}
                  className="text-[#0B3556] font-semibold underline hover:text-[#C9A24B]"
                >
                  tentar novamente com outro email
                </button>
                .
              </div>

              <Button
                asChild
                className="w-full h-11 bg-[#0B3556] hover:bg-[#1B5E8A] text-white font-semibold rounded-lg"
              >
                <Link to="/">Retornar para o Login</Link>
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
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (emailError) setEmailError(null)
                    }}
                    placeholder="seu@email.com"
                    className={`pl-10 h-11 text-sm bg-white transition-all ${
                      emailError
                        ? 'border-red-500 focus-visible:ring-red-400'
                        : 'border-slate-300 focus-visible:border-[#0B3556] focus-visible:ring-[#0B3556]/20'
                    }`}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 text-[15px] font-semibold text-white bg-[#0B3556] hover:bg-[#1B5E8A] transition-all rounded-lg shadow-md"
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Enviando link...</span>
                  </span>
                ) : (
                  <span>Enviar link de recuperação</span>
                )}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/"
                  className="text-xs font-semibold text-[#0B3556] hover:text-[#C9A24B] hover:underline transition-colors"
                >
                  Lembrou sua senha? Voltar ao login
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
