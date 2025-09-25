const parseApiUrl = (url: string) => {
  try {
    const urlObj = new URL(url);
    const username = urlObj.username || import.meta.env.VITE_API_USERNAME || 'user';
    const password = urlObj.password || import.meta.env.VITE_API_PASSWORD || 'password';
    urlObj.username = '';
    urlObj.password = '';
    return {
      baseUrl: urlObj.toString(),
      username,
      password
    };
  } catch {
    return {
      baseUrl: url,
      username: import.meta.env.VITE_API_USERNAME || 'user',
      password: import.meta.env.VITE_API_PASSWORD || 'password'
    };
  }
};

const parsedApiConfig = parseApiUrl(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002');
const API_BASE_URL = parsedApiConfig.baseUrl;
const API_USERNAME = parsedApiConfig.username;
const API_PASSWORD = parsedApiConfig.password;

declare global {
  interface Window {
    demoAuthToken?: string
    demoUserData?: any
  }
}

export const apiConfig = {
  baseUrl: API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL,
  endpoints: {
    patients: `${API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL}/patients`,
    agents: `${API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL}/agents`,
    azureML: `${API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL}/azure-ml`,
    rag: `${API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL}/rag`,
    images: `${API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL}/images`,
    auth: `${API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL}/auth`
  }
}

export const apiCall = async (url: string, options: RequestInit = {}) => {
  try {
    const fullUrl = url.startsWith('http') ? url : `${apiConfig.baseUrl}${url}`;
    
    let token = null
    let tokenSource = 'none'
    
    try {
      token = localStorage.getItem('auth_token')
      if (token) {
        tokenSource = 'localStorage'
      }
    } catch (localStorageError) {
      console.warn('localStorage access failed:', localStorageError)
    }
    
    if (!token && window.demoAuthToken) {
      token = window.demoAuthToken
      tokenSource = 'window'
      console.log('Using fallback token from window object')
    }
    
    if (!token) {
      token = 'demo-token'
      tokenSource = 'hardcoded'
      console.log('Using hardcoded fallback token')
    }
    
    let authHeader = `Bearer ${token}`
    
    if (API_USERNAME && API_PASSWORD) {
      const credentials = btoa(`${API_USERNAME}:${API_PASSWORD}`)
      authHeader = `Basic ${credentials}`
      tokenSource = 'basic-auth'
    }

    const defaultHeaders = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      ...options.headers
    }

    console.log('API call:', { 
      url: fullUrl, 
      hasAuth: !!authHeader, 
      tokenSource,
      authType: authHeader.split(' ')[0],
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent.substring(0, 50) + '...'
    })

    const response = await fetch(fullUrl, {
      ...options,
      headers: defaultHeaders
    })

    if (!response.ok) {
      console.error('API call failed:', { 
        url: fullUrl, 
        status: response.status, 
        statusText: response.statusText,
        authType: authHeader.split(' ')[0],
        tokenSource,
        responseHeaders: Object.fromEntries(response.headers.entries())
      })
      
      if (response.status === 401) {
        console.error('Authentication failed - checking token sources:', {
          localStorage: !!localStorage.getItem('auth_token'),
          window: !!window.demoAuthToken,
          credentials: !!(API_USERNAME && API_PASSWORD)
        })
      }
    } else {
      console.log('API call successful:', { url: fullUrl, status: response.status, tokenSource })
    }

    return response
  } catch (error) {
    console.error('API call error:', { 
      url: fullUrl, 
      error: error instanceof Error ? error.message : String(error), 
      stack: error instanceof Error ? error.stack?.substring(0, 200) + '...' : 'No stack trace',
      timestamp: new Date().toISOString()
    })
    throw error
  }
}
