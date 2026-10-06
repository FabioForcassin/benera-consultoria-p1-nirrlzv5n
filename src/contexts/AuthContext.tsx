import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { RecordModel } from 'pocketbase'
import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'

export type Papel = 'admin' | 'lider' | 'consultor' | 'revisor'

export interface UserRecord extends RecordModel {
  email: string
  name?: string
  avatar?: string
  verified?: boolean
  role?: Papel
}

export interface AuthContextType {
  user: UserRecord | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  role: Papel | null
  isAdmin: boolean
  isLider: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  logout: () => void
  requestPasswordReset: (email: string) => Promise<void>
  confirmPasswordReset: (token: string, password: string, passwordConfirm: string) => Promise<void>
  confirmEmailVerification: (token: string) => Promise<void>
  requestVerification: (email: string) => Promise<void>
  criarConvite: (
    email: string,
    role: Papel,
  ) => Promise<{ id: string; email: string; role: Papel; expires_at: string }>
  listarConvites: () => Promise<{
    items: { id: string; email: string; role: Papel; expires_at: string; created: string }[]
  }>
  aceitarConvite: (token: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const REMEMBER_KEY = 'benera_auth_remember'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(
    (pb.authStore.record as UserRecord | null) ?? null,
  )
  const [token, setToken] = useState<string | null>(pb.authStore.token || null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const rememberPref = localStorage.getItem(REMEMBER_KEY)
    if (rememberPref === 'false' && !sessionStorage.getItem('benera_session_active')) {
      pb.authStore.clear()
      setUser(null)
      setToken(null)
    }

    if (pb.authStore.isValid) {
      setUser((pb.authStore.record as UserRecord | null) ?? null)
      setToken(pb.authStore.token)
    } else {
      setUser(null)
      setToken(null)
    }
    setIsLoading(false)

    const unsubscribe = pb.authStore.onChange((newToken, model) => {
      setToken(newToken || null)
      setUser((model as UserRecord | null) ?? null)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string, rememberMe: boolean = true) => {
    const authData = await pb.collection('users').authWithPassword(email.trim(), password)

    if (rememberMe) {
      localStorage.setItem(REMEMBER_KEY, 'true')
      sessionStorage.removeItem('benera_session_active')
    } else {
      localStorage.setItem(REMEMBER_KEY, 'false')
      sessionStorage.setItem('benera_session_active', 'true')
    }

    setUser((authData.record as UserRecord | null) ?? null)
    setToken(authData.token)
  }

  const logout = () => {
    pb.authStore.clear()
    localStorage.removeItem(REMEMBER_KEY)
    sessionStorage.removeItem('benera_session_active')
    setUser(null)
    setToken(null)
  }

  const requestPasswordReset = async (email: string) => {
    await pb.collection('users').requestPasswordReset(email.trim())
  }

  const confirmPasswordReset = async (token: string, password: string, passwordConfirm: string) => {
    await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
    pb.authStore.clear()
    setUser(null)
    setToken(null)
  }

  const confirmEmailVerification = async (token: string) => {
    await pb.collection('users').confirmVerification(token)
  }

  const requestVerification = async (email: string) => {
    await pb.collection('users').requestVerification(email.trim())
  }

  const criarConvite = async (email: string, role: Papel) => {
    return await pb.send('/backend/v1/invites', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    })
  }

  const listarConvites = async () => {
    return await pb.send('/backend/v1/invites', { method: 'GET' })
  }

  const aceitarConvite = async (token: string, password: string) => {
    await pb.send('/backend/v1/invites/aceitar', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    })
  }

  const role = (user?.role as Papel | undefined) ?? null
  const isLider = role === 'lider'

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && pb.authStore.isValid,
        isLoading,
        role,
        isAdmin: role === 'admin',
        isLider,
        login,
        logout,
        requestPasswordReset,
        confirmPasswordReset,
        confirmEmailVerification,
        requestVerification,
        criarConvite,
        listarConvites,
        aceitarConvite,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

export function translateAuthError(error: unknown): string {
  if (error instanceof ClientResponseError) {
    const status = error.status
    const message = error.message || ''

    if (status === 400) {
      if (
        message.toLowerCase().includes('failed to authenticate') ||
        error.response?.message?.includes('Failed to authenticate')
      ) {
        return 'Email ou senha incorretos. Por favor, verifique suas credenciais.'
      }
      if (error.response?.data?.email?.message) {
        return `Email inválido: ${error.response.data.email.message}`
      }
      if (error.response?.data?.password?.message) {
        return `Senha inválida: ${error.response.data.password.message}`
      }
      if (message.toLowerCase().includes('token') || message.toLowerCase().includes('expired')) {
        return 'Link de redefinição ou verificação expirado ou inválido.'
      }
      return error.response?.message || 'Dados inválidos. Verifique os campos informados.'
    }

    if (status === 403) {
      return error.response?.message || 'Acesso não autorizado ou email pendente de verificação.'
    }

    if (status === 404) {
      return 'Usuário não encontrado com as informações fornecidas.'
    }

    if (status === 0) {
      return 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.'
    }

    return (
      error.response?.message ||
      error.message ||
      'Ocorreu um erro no servidor. Tente novamente mais tarde.'
    )
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Ocorreu um erro inesperado. Tente novamente.'
}
