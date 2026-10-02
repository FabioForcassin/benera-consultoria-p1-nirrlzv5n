import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, Mail } from 'lucide-react'
import { useAuth, translateAuthError } from '@/contexts/AuthContext'
import { BeneraLogo } from '@/components/BeneraLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { confirmEmailVerification, requestVerification } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Para reenviar verificação caso token inválido
  const [resendEmail, setResendEmail] = useState('')
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)

  useEffect(() => {
    let mounted = true

    async function verify() {
      if (!token) {
        if (mounted) {
          setIsLoading(false)
          setErrorMessage('Nenhum código de verificação foi fornecido na URL.')
        }
        return
      }

      try {
        await confirmEmailVerification(token)
        if (mounted) {
          setIsSuccess(true)
          setIsLoading(false)
        }
      } catch (err) {
        if (mounted) {
          setIsSuccess(false)
          setErrorMessage(translateAuthError(err))
          setIsLoading(false)
        }
      }
    }

    verify()

    return () => {
      mounted = false
    }
  }, [token, confirmEmailVerification])

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resendEmail.trim()) return

    setIsResending(true)
    try {
      await requestVerification(resendEmail.trim())
      setResendSuccess(true)
    } catch (err) {
      setErrorMessage(translateAuthError(err))
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center p-6 md:p-12 bg-white md:bg-grid-benera">
      {/* Topo com Logo */}
      <div className="w-full max-w-[460px] pt-4">
        <Link to="/" className="inline-block">
          <BeneraLogo variant="dark" size="md" />
        </Link>
      </div>

      {/* Card Central */}
      <div className="w-full max-w-[460px] my-auto py-8">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.06)] animate-benera-form text-center">
          {isLoading ? (
            <div className="py-8 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-[#0B3556] mx-auto" />
              <h2 className="text-xl font-semibold text-[#0B3556]">Validando seu email...</h2>
              <p className="text-sm text-slate-500">
                Aguarde um instante enquanto confirmamos sua conta no sistema.
              </p>
            </div>
          ) : isSuccess ? (
            <div className="space-y-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-[#0B3556] tracking-tight">
                  Email verificado
                </h1>
                <p className="mt-2 text-sm text-[#4B5563] leading-relaxed">
                  Sua conta foi confirmada com sucesso! Você já tem permissão para acessar o sistema
                  interno da Benera Consultoria.
                </p>
              </div>

              <Button
                asChild
                className="w-full h-11 bg-[#0B3556] hover:bg-[#1B5E8A] text-white font-semibold rounded-lg shadow-md gap-2"
              >
                <Link to="/">
                  <span>Ir para o login</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-6 text-left">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
                <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
                <div>
                  <h3 className="font-semibold text-sm">Falha na verificação</h3>
                  <p className="text-xs text-red-600 mt-0.5">
                    {errorMessage || 'O link de verificação expirou ou é inválido.'}
                  </p>
                </div>
              </div>

              {resendSuccess ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                  <p className="font-semibold">Novo link enviado!</p>
                  <p className="text-xs mt-1">
                    Verifique sua caixa de entrada para ativar seu cadastro.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleResend} className="space-y-4 pt-2">
                  <p className="text-xs text-slate-600">
                    Deseja que enviemos um novo email de confirmação? Informe seu email corporativo
                    abaixo:
                  </p>
                  <div className="space-y-1">
                    <Label htmlFor="resend-email" className="text-xs font-semibold text-slate-700">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <Input
                        id="resend-email"
                        type="email"
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="pl-9 h-10 text-sm"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isResending || !resendEmail}
                    className="w-full h-10 bg-[#0B3556] hover:bg-[#1B5E8A] text-white text-sm font-semibold rounded-lg"
                  >
                    {isResending ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Reenviando...</span>
                      </span>
                    ) : (
                      <span>Reenviar email de verificação</span>
                    )}
                  </Button>
                </form>
              )}

              <div className="text-center pt-2">
                <Link
                  to="/"
                  className="text-xs font-semibold text-[#0B3556] hover:text-[#C9A24B] hover:underline"
                >
                  Voltar para a página de login
                </Link>
              </div>
            </div>
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
