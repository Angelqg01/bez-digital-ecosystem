import { useState, useCallback, useEffect } from 'react'
import { runEdgeInference, analyzeWithGemini, syncToBlockchain } from '../api'

/**
 * Hook para gestionar el proceso completo de scanning
 */
export const useScanProcess = () => {
    const [scanning, setScanning] = useState(false)
    const [phase, setPhase] = useState('idle')
    const [progress, setProgress] = useState(0)
    const [results, setResults] = useState(null)
    const [error, setError] = useState(null)

    const startScan = useCallback(async (imageData = null) => {
        setScanning(true)
        setError(null)
        setProgress(0)

        try {
            // Edge AI
            setPhase('edge')
            setProgress(20)
            const edgeData = await runEdgeInference(imageData)
            setResults(prev => ({ ...prev, edge: edgeData }))

            // Gemini Analysis
            setPhase('gemini')
            setProgress(50)
            const geminiData = await analyzeWithGemini(edgeData)
            setResults(prev => ({ ...prev, gemini: geminiData }))

            // Blockchain Sync
            setPhase('blockchain')
            setProgress(75)
            const txData = await syncToBlockchain(geminiData)
            setResults(prev => ({ ...prev, tx: txData }))

            setPhase('done')
            setProgress(100)
        } catch (err) {
            console.error('Scan error:', err)
            setError(err.message)
            setPhase('error')
        } finally {
            setScanning(false)
        }
    }, [])

    const reset = useCallback(() => {
        setScanning(false)
        setPhase('idle')
        setProgress(0)
        setResults(null)
        setError(null)
    }, [])

    return {
        scanning,
        phase,
        progress,
        results,
        error,
        startScan,
        reset
    }
}

/**
 * Hook para gestionar búsquedas y filtros
 */
export const useSearch = (items = [], searchFields = []) => {
    const [query, setQuery] = useState('')
    const [filtered, setFiltered] = useState(items)

    useEffect(() => {
        if (!query.trim()) {
            setFiltered(items)
            return
        }

        const lowerQuery = query.toLowerCase()
        const result = items.filter(item =>
            searchFields.some(field => {
                const value = field.split('.').reduce((obj, key) => obj?.[key], item)
                return value?.toString().toLowerCase().includes(lowerQuery)
            })
        )

        setFiltered(result)
    }, [query, items, searchFields])

    return { query, setQuery, filtered }
}

/**
 * Hook para gestionar paginación
 */
export const usePagination = (items = [], itemsPerPage = 10) => {
    const [currentPage, setCurrentPage] = useState(1)
    const totalPages = Math.ceil(items.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedItems = items.slice(startIndex, endIndex)

    const goToPage = (page) => {
        const pageNum = Math.max(1, Math.min(page, totalPages))
        setCurrentPage(pageNum)
    }

    const nextPage = () => goToPage(currentPage + 1)
    const prevPage = () => goToPage(currentPage - 1)

    return {
        currentPage,
        totalPages,
        paginatedItems,
        goToPage,
        nextPage,
        prevPage,
        isFirstPage: currentPage === 1,
        isLastPage: currentPage === totalPages
    }
}

/**
 * Hook para manejo de localStorage con sincronización
 */
export const useLocalStorage = (key, initialValue) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key)
            return item ? JSON.parse(item) : initialValue
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error)
            return initialValue
        }
    })

    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value
            setStoredValue(valueToStore)
            window.localStorage.setItem(key, JSON.stringify(valueToStore))
        } catch (error) {
            console.warn(`Error writing to localStorage key "${key}":`, error)
        }
    }

    return [storedValue, setValue]
}

/**
 * Hook para async data fetching con caching
 */
export const useFetch = (fetchFn, dependencies = []) => {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let mounted = true

        const load = async () => {
            setLoading(true)
            setError(null)

            try {
                const result = await fetchFn()
                if (mounted) {
                    setData(result)
                }
            } catch (err) {
                if (mounted) {
                    setError(err)
                }
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        load()

        return () => {
            mounted = false
        }
    }, dependencies)

    const refetch = useCallback(async () => {
        setLoading(true)
        try {
            const result = await fetchFn()
            setData(result)
            setError(null)
        } catch (err) {
            setError(err)
        } finally {
            setLoading(false)
        }
    }, [fetchFn])

    return { data, loading, error, refetch }
}

/**
 * Hook para debouncing
 */
export const useDebounce = (value, delay = 500) => {
    const [debouncedValue, setDebouncedValue] = useState(value)

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => clearTimeout(handler)
    }, [value, delay])

    return debouncedValue
}

/**
 * Hook para notificaciones/toasts
 */
export const useToast = () => {
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = Math.random().toString(36).substr(2, 9)

        setToasts(prev => [...prev, { id, message, type }])

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id)
            }, duration)
        }

        return id
    }, [])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id))
    }, [])

    return { toasts, addToast, removeToast }
}

export default {
    useScanProcess,
    useSearch,
    usePagination,
    useLocalStorage,
    useFetch,
    useDebounce,
    useToast
}
