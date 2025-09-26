/**
 * Kidney Stone Research Platform - Main Application Component
 * Developed by Gregory Katz (@gregorykatz_microsoft)
 * 
 * Purpose: Root component with tabbed interface for Dashboard, EMR Data, and Testing Interface
 * Dependencies: React, Tailwind CSS, custom UI components
 * Last Updated: September 26, 2025
 */


import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ThemeProvider } from '@/components/theme-provider'
import { Dashboard } from '@/components/Dashboard'
import { EMRData } from '@/components/EMRData'
import { TestingInterface } from '@/components/TestingInterface'
import { Button } from '@/components/ui/button'
import { LogOut, User } from 'lucide-react'
import './App.css'

declare global {
  interface Window {
    demoAuthToken?: string
    demoUserData?: any
  }
}

interface User {
  id: string
  username: string
  email: string
  role: string
}

function App() {
  const [user] = useState<User>({
    id: "demo-user",
    username: "Demo User",
    email: "demo@kidneystone.com",
    role: "Provider"
  })
  const [token] = useState<string>("demo-token")

  useEffect(() => {
    const initializeAuth = () => {
      try {
        const demoUser = {
          id: "demo-user",
          username: "Demo User", 
          email: "demo@kidneystone.com",
          role: "Provider"
        }
        const demoToken = "demo-token"
        
        try {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user_data')
        } catch (clearError) {
          console.warn('Could not clear existing localStorage:', clearError)
        }
        
        let attempts = 0
        const maxAttempts = 5
        
        const setCredentials = () => {
          try {
            localStorage.setItem('auth_token', demoToken)
            localStorage.setItem('user_data', JSON.stringify(demoUser))
            
            const storedToken = localStorage.getItem('auth_token')
            const storedUser = localStorage.getItem('user_data')
            
            if (storedToken === demoToken && storedUser) {
              console.log('Authentication bypass initialized successfully:', {
                tokenSet: !!storedToken,
                userSet: !!storedUser,
                attempt: attempts + 1,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                localStorage: typeof localStorage !== 'undefined'
              })
              return true
            } else {
              throw new Error('Verification failed - stored values do not match')
            }
          } catch (setError) {
            console.error('Failed to set credentials on attempt', attempts + 1, setError)
            return false
          }
        }
        
        while (attempts < maxAttempts) {
          if (setCredentials()) {
            break
          }
          attempts++
          if (attempts < maxAttempts) {
            setTimeout(() => {}, 200 * attempts)
          }
        }
        
        if (attempts >= maxAttempts) {
          console.error('Failed to set authentication credentials after', maxAttempts, 'attempts - using fallback')
          window.demoAuthToken = demoToken
          window.demoUserData = demoUser
          console.log('Using fallback in-memory authentication:', {
            windowToken: !!window.demoAuthToken,
            windowUser: !!window.demoUserData,
            timestamp: new Date().toISOString()
          })
        }
        
      } catch (error) {
        console.error('Authentication bypass failed completely:', error)
        window.demoAuthToken = "demo-token"
        window.demoUserData = {
          id: "demo-user",
          username: "Demo User", 
          email: "demo@kidneystone.com",
          role: "Provider"
        }
        console.log('Using emergency fallback authentication:', {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString()
        })
      }
    }
    
    initializeAuth()
    
    const timeoutId = setTimeout(() => {
      console.log('Running delayed authentication initialization')
      initializeAuth()
    }, 1000)
    
    return () => clearTimeout(timeoutId)
  }, [])

  const handleLogout = () => {
    window.location.reload()
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="kidney-stone-theme">
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-foreground">
                Kidney Stone Research Platform
              </h1>
              <span className="text-sm text-muted-foreground">
                Azure Foundry Multi-Agent System
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                <User className="h-4 w-4" />
                <span className="text-foreground">{user.username}</span>
                <span className="text-muted-foreground">({user.role})</span>
                <span className="text-xs text-green-500">●</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="dashboard" className="text-sm font-medium">
                Overall Dashboard
              </TabsTrigger>
              <TabsTrigger value="emr" className="text-sm font-medium">
                EMR Data & Demographics
              </TabsTrigger>
              <TabsTrigger value="testing" className="text-sm font-medium">
                Testing Interface
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6">
              <Dashboard token={token} />
            </TabsContent>

            <TabsContent value="emr" className="space-y-6">
              <EMRData token={token} />
            </TabsContent>

            <TabsContent value="testing" className="space-y-6">
              <TestingInterface token={token} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </ThemeProvider>
  )
}

export default App
