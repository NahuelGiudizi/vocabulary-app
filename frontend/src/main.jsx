import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Use static app for production, full app for development
const IS_STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true';

// Dynamic import based on mode
const App = IS_STATIC_MODE
    ? React.lazy(() => import('./AppStatic.jsx'))
    : React.lazy(() => import('./App.jsx'));

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <React.Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        }>
            <App />
        </React.Suspense>
    </React.StrictMode>,
)
