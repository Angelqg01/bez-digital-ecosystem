/**
 * Utilidades y helpers para BZ PureScan
 */

/**
 * Formatea una dirección blockchain
 */
export const formatAddress = (address, chars = 4) => {
    if (!address) return ''
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/**
 * Formatea un hash de transacción
 */
export const formatHash = (hash) => {
    return formatAddress(hash, 6)
}

/**
 * Convierte timestamp a formato legible
 */
export const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    // Menos de un minuto
    if (diff < 60000) return 'Hace unos segundos'

    // Menos de una hora
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `Hace ${minutes}m`

    // Menos de un día
    const hours = Math.floor(diff / 3600000)
    if (hours < 24) return `Hace ${hours}h`

    // Menos de una semana
    const days = Math.floor(diff / 86400000)
    if (days < 7) return `Hace ${days}d`

    // Formato de fecha
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

/**
 * Copia texto al portapapeles
 */
export const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch (err) {
        console.error('Error al copiar:', err)
        return false
    }
}

/**
 * Abre un enlace en nueva pestaña
 */
export const openInNewTab = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * Descargar archivo JSON
 */
export const downloadJSON = (data, filename = 'data.json') => {
    const element = document.createElement('a')
    element.setAttribute('href', `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`)
    element.setAttribute('download', filename)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
}

/**
 * Descargar CSV
 */
export const downloadCSV = (data, filename = 'data.csv') => {
    if (!data || data.length === 0) return

    const headers = Object.keys(data[0])
    const csv = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const value = row[header]
                return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
            }).join(',')
        )
    ].join('\n')

    const element = document.createElement('a')
    element.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`)
    element.setAttribute('download', filename)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
}

/**
 * Valida si es una dirección blockchain válida
 */
export const isValidAddress = (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Valida si es un hash válido
 */
export const isValidHash = (hash) => {
    return /^0x[a-fA-F0-9]{64}$/.test(hash)
}

/**
 * Formatea número con separadores de miles
 */
export const formatNumber = (num) => {
    return new Intl.NumberFormat('es-ES').format(num)
}

/**
 * Formatea cantidad con decimales
 */
export const formatAmount = (amount, decimals = 2) => {
    return parseFloat(amount).toLocaleString('es-ES', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })
}

/**
 * Genera un ID único
 */
export const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Ordena array por propiedad
 */
export const sortBy = (array, property, direction = 'asc') => {
    return [...array].sort((a, b) => {
        const aValue = a[property]
        const bValue = b[property]

        if (aValue === bValue) return 0
        if (direction === 'asc') {
            return aValue > bValue ? 1 : -1
        } else {
            return aValue < bValue ? 1 : -1
        }
    })
}

/**
 * Agrupa array por propiedad
 */
export const groupBy = (array, property) => {
    return array.reduce((grouped, item) => {
        const key = item[property]
        if (!grouped[key]) {
            grouped[key] = []
        }
        grouped[key].push(item)
        return grouped
    }, {})
}

/**
 * Filtra objetos por propiedades
 */
export const filterByProps = (array, filters) => {
    return array.filter(item =>
        Object.entries(filters).every(([key, value]) => {
            if (!value) return true
            return item[key]?.toString().toLowerCase().includes(value.toString().toLowerCase())
        })
    )
}

/**
 * Obtiene valor anidado de objeto
 */
export const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, prop) => current?.[prop], obj)
}

/**
 * Comprueba si el usuario está en navegador móvil
 */
export const isMobile = () => {
    return window.matchMedia('(max-width: 768px)').matches
}

/**
 * Espera N milisegundos
 */
export const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Reintentar función con backoff exponencial
 */
export const retryWithBackoff = async (fn, maxRetries = 3, delay = 1000) => {
    let lastError
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error
            if (i < maxRetries - 1) {
                await sleep(delay * Math.pow(2, i))
            }
        }
    }
    throw lastError
}

/**
 * Debounce helper
 */
export const debounce = (fn, delay = 500) => {
    let timeoutId

    return function debounced(...args) {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => fn(...args), delay)
    }
}

/**
 * Throttle helper
 */
export const throttle = (fn, limit = 1000) => {
    let inThrottle
    return function throttled(...args) {
        if (!inThrottle) {
            fn(...args)
            inThrottle = true
            setTimeout(() => inThrottle = false, limit)
        }
    }
}

export default {
    formatAddress,
    formatHash,
    formatTime,
    copyToClipboard,
    openInNewTab,
    downloadJSON,
    downloadCSV,
    isValidAddress,
    isValidHash,
    formatNumber,
    formatAmount,
    generateId,
    sortBy,
    groupBy,
    filterByProps,
    getNestedValue,
    isMobile,
    sleep,
    retryWithBackoff,
    debounce,
    throttle
}
