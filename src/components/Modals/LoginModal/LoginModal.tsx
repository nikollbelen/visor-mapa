import { useState, useEffect } from "react";
import "./LoginModal.css";

interface LoginModalProps {
  isVisible: boolean;
  onClose: () => void;
  onLogin: (user: SellerData) => void;
}

interface SellerData {
  id: string;
  nombre: string;
  email: string;
  password?: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

const LoginModal = ({ isVisible, onClose, onLogin }: LoginModalProps) => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });

  const [errors, setErrors] = useState({
    email: '',
    password: '',
    login: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [sellers, setSellers] = useState<SellerData[]>([]);

  // Cargar sellers desde la API
  useEffect(() => {
    fetch('https://api.apico.dev/v1/gE2H1N/1vL47XFQKS6ajoKccemle7MYYDStFVawgnopVpfzz-UA/values/sellers')
      .then(res => res.json())
      .then((apiData) => {
        // Transformar los datos de la API al formato esperado
        const sellersData: SellerData[] = apiData.values.map((row: any) => ({
          id: row[0],
          nombre: row[1],
          email: row[2],
          password: row[3] // Agregamos la contraseña para validación
        }));
        setSellers(sellersData);
      })
      .catch((error) => {
        console.error('Error cargando sellers:', error);
        setSellers([]);
      });
  }, []);

  // Validar email
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validar campo específico
  const validateField = (field: string, value: string) => {
    const newErrors = { ...errors };
    
    if (field === 'email') {
      newErrors.email = value && !validateEmail(value)
        ? 'Ingrese un correo electrónico válido'
        : '';
    } else if (field === 'password') {
      newErrors.password = value && value.length < 6
        ? 'La contraseña debe tener al menos 6 caracteres'
        : '';
    }
    
    setErrors(newErrors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Limpiar errores anteriores
    setErrors({ email: '', password: '', login: '' });
    
    // Validar campos
    const hasErrors = !!(errors.email || errors.password);
    
    if (hasErrors || !credentials.email || !credentials.password) {
      alert('Por favor complete todos los campos correctamente');
      return;
    }

    setIsLoading(true);
    
    try {
      // Buscar el usuario en la lista de sellers
      const user = sellers.find(seller => 
        seller.email.toLowerCase() === credentials.email.toLowerCase() &&
        seller.password === credentials.password
      );
      
      if (user) {
        // Login exitoso
        onLogin(user);
        onClose();
        
        // Limpiar formulario
        setCredentials({ email: '', password: '' });
      } else {
        // Credenciales incorrectas
        setErrors(prev => ({ 
          ...prev, 
          login: 'Correo electrónico o contraseña incorrectos' 
        }));
      }
    } catch (error) {
      console.error('Error en login:', error);
      setErrors(prev => ({ 
        ...prev, 
        login: 'Error al iniciar sesión. Por favor, intente nuevamente.' 
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof LoginCredentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
    validateField(field, value);
  };

  if (!isVisible) return null;

  return (
    <div className="login-modal-overlay">
      <div className="login-modal">
        <div className="login-modal-header">
          <h2 className="login-modal-title">Iniciar Sesión</h2>
          <button className="login-modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="login-modal-content">
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-section">
              <h4>Credenciales</h4>
              <div className="input-group">
                <input
                  type="email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  placeholder="Correo electrónico"
                  value={credentials.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={isLoading}
                />
                {errors.email && <div className="error-message">{errors.email}</div>}
                
                <input
                  type="password"
                  className={`form-input ${errors.password ? 'error' : ''}`}
                  placeholder="Contraseña"
                  value={credentials.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  disabled={isLoading}
                />
                {errors.password && <div className="error-message">{errors.password}</div>}
              </div>
            </div>

            {/* Mensaje de error de login */}
            {errors.login && (
              <div className="login-error">
                <i className="fas fa-exclamation-triangle"></i>
                {errors.login}
              </div>
            )}
          </form>
        </div>

        <div className="login-modal-footer">
          <button 
            className="btn-secondary" 
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Iniciando...
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
