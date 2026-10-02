import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, UserPlus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
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

const PAPEIS: { value: Papel; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'lider', label: 'Líder' },
  { value: 'consultor', label: 'Consultor' },
  { value: 'revisor', label: 'Revisor' },
]

export default function PainelConvites() {
  const { isAdmin, criarConvite } = useAuth()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Papel>('consultor')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sucesso, setSucesso] = useState<string | null>(null)

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#0B3556]">Acesso restrito</h1>
          <p className="mt-2 text-sm text-slate-600">
            Somente administradores podem gerenciar convites de usuários.
          </p>
          <Button asChild className="mt-6 w-full h-11 bg-[#0B3556] hover:bg-[#1B5E8A] text-white">
            <Link to="/dashboard">Voltar ao painel</Link>
          </Button>
        </div>
      </div>
    )
  }

  const validateEmail = (val: string): string | null => {
    if (!val.trim()) return 'O email é obrigatório.'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(val.trim())) return 'Digite um email válido.'
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setGeneralError(null)
    setSucesso(null)

    const err = validateEmail(email)
    setEmailError(err)
    if (err) return

    setIsSubmitting(true)
    try {
      const res = await criarConvite(email.trim(), role)
      setSucesso(
        `Convite criado para ${res.email} como ${PAPEIS.find((p) => p.value === res.role)?.label ?? res.role}. ` +
          `Envie o link de ativação ao convidado: ${window.location.origin}/ativar-acesso?token=<TOKEN_DO_CONVITE>`,
      )
      setEmail('')
    } catch (error) {
      setGeneralError(translateAuthError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center p-6 md:p-12 bg-white md:bg-grid-benera">
      <div className="w-full max-w-[520px] pt-4">
        <Link to="/dashboard" className="inline-block">
          <BeneraLogo variant="dark" size="md" />
        </Link>
      </div>

      <div className="w-full max-w-[520px] my-auto py-8">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.06)] animate-benera-form">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#0B3556] tracking-tight flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-[#C9A24B]" />
              Convidar usuário
            </h1>
            <p className="mt-2 text-sm text-[#4B5563]">
              Administradores criam convites e definem o papel. O convidado ativa o acesso com um
              token único e define a própria senha.
            </p>
          </div>

          {sucesso && (
            <div className="mb-6 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-snug break-all">{sucesso}</div>
            </div>
          )}

          {generalError && (
            <div className="mb-6 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 text-sm">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-snug">{generalError}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="invite-email"
                className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex justify-between"
              >
                <span>Email do convidado</span>
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
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError(null)
                  }}
                  placeholder="convidado@empresa.com"
                  className={`pl-10 h-11 text-sm bg-white transition-all ${
                    emailError
                      ? 'border-red-500 focus-visible:ring-red-400'
                      : 'border-slate-300 focus-visible:border-[#0B3556] focus-visible:ring-[#0B3556]/20'
                  }`}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="invite-role"
                className="text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Papel do convidado
              </Label>
              <Select value={role} onValueChange={(v) => setRole(v as Papel)}>
                <SelectTrigger id="invite-role" className="w-full h-11 text-sm">
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  {PAPEIS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 text-[15px] font-semibold text-white bg-[#0B3556] hover:bg-[#1B5E8A] transition-all rounded-lg shadow-md"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Criando convite...</span>
                </span>
              ) : (
                <span>Criar convite</span>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200/80">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <div className="w-5 h-5 rounded-full bg-[#0B3556]/10 text-[#0B3556] flex items-center justify-center shrink-0 font-bold text-[10px]">
                i
              </div>
              <div className="leading-snug">
                O token de ativação é único, expira em 48h e nunca é armazenado em texto puro.
                Cadastro público permanece fechado.
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="w-full text-center pb-4 text-xs text-slate-400">
        © 2025 Benera Consultoria. Todos os direitos reservados.
      </footer>
    </div>
  )
}
