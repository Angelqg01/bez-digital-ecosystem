import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error) {
    // Actualiza el estado para que el siguiente renderizado muestre la UI de fallback.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // También puedes registrar el error en un servicio de reporte de errores
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error("Error capturado por ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Puedes renderizar cualquier UI de fallback
      return (
        <div style={{
          backgroundColor: '#1a1d21',
          color: 'white',
          padding: '2rem',
          fontFamily: 'monospace',
          height: '100vh',
          overflow: 'auto'
        }}>
          <h1 style={{ color: '#ff4d4d', fontSize: '2rem' }}>Ha ocurrido un error en la aplicación.</h1>
          <p>Por favor, intenta refrescar la página. Si el problema persiste, contacta con el soporte.</p>
          <details style={{ marginTop: '2rem', whiteSpace: 'pre-wrap', backgroundColor: '#2c2c2c', padding: '1rem', borderRadius: '8px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Detalles del Error (para desarrolladores)</summary>
            {this.state.error && <p><strong>Error:</strong> {this.state.error.toString()}</p>}
            {this.state.errorInfo && <p><strong>Stack Trace:</strong> {this.state.errorInfo.componentStack}</p>}
          </details>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
