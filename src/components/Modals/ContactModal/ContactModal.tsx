import { useEffect, useState } from "react";
import "./ContactModal.css";

interface ContactModalProps {
  isVisible: boolean;
  type: "print" | "save" | "email";
  onClose: () => void;
  onSubmit: (data: ContactData) => void;
  currentUser?: {id: string; nombre: string; email: string} | null;
}

interface ContactData {
  vendedorId?: string;
  vendedor?: { id?: string; nombre: string; email: string };
  cliente: { nombre: string; apellido?: string; dni?: string; email: string; telefono?: string };
  fileName?: string; // Para el tipo "save"
}

interface SellerData {
  id: string;
  nombre: string;
  email: string;
}

const ContactModal = ({ isVisible, type, onClose, onSubmit, currentUser }: ContactModalProps) => {
  const [contactData, setContactData] = useState<ContactData>({
    vendedorId: currentUser?.id || '',
    vendedor: currentUser ? { 
      id: currentUser.id, 
      nombre: currentUser.nombre, 
      email: currentUser.email 
    } : { id: '', nombre: '', email: '' },
    cliente: { nombre: '', email: '', telefono: '' },
    fileName: ''
  });

  const [sellers, setSellers] = useState<SellerData[]>([]);

  const [errors, setErrors] = useState({
    vendedorId: '',
    cliente: { nombre: '', apellido: '', dni: '', email: '', telefono: '' }
  });

  // Actualizar datos de vendedor cuando cambie currentUser
  useEffect(() => {
    if (currentUser) {
      setContactData(prev => ({
        ...prev,
        vendedorId: currentUser.id,
        vendedor: { 
          id: currentUser.id, 
          nombre: currentUser.nombre, 
          email: currentUser.email 
        }
      }));
    } else {
      setContactData(prev => ({
        ...prev,
        vendedorId: '',
        vendedor: { id: '', nombre: '', email: '' }
      }));
    }
  }, [currentUser]);

  // Validar email
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validar nombre (solo letras y espacios)
  const validateName = (name: string) => {
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    return nameRegex.test(name);
  };

  // Validar teléfono
  const validatePhone = (phone: string) => {
    const phoneRegex = /^[0-9+\-()\s]{6,20}$/;
    return phoneRegex.test(phone);
  };

  // Validar DNI (solo dígitos, 8-12 aprox.)
  const validateDni = (dni: string) => {
    const dniRegex = /^\d{8,12}$/;
    return dniRegex.test(dni);
  };

  // Validar campo específico
  const validateField = (field: string, value: string, type: 'vendedorId' | 'cliente') => {
    const newErrors: typeof errors = JSON.parse(JSON.stringify(errors));
    if (type === 'vendedorId') {
      newErrors.vendedorId = value ? '' : 'Ingrese el ID del vendedor';
    } else {
      if (field === 'nombre') {
        newErrors.cliente.nombre = value && !validateName(value)
          ? 'El nombre solo puede contener letras y espacios'
          : '';
      } else if (field === 'apellido') {
        newErrors.cliente.apellido = value && !validateName(value)
          ? 'El apellido solo puede contener letras y espacios'
          : '';
      } else if (field === 'dni') {
        newErrors.cliente.dni = value && !validateDni(value)
          ? 'Ingrese un DNI válido'
          : '';
      } else if (field === 'email') {
        newErrors.cliente.email = value && !validateEmail(value)
          ? 'Ingrese un correo electrónico válido'
          : '';
      } else if (field === 'telefono') {
        newErrors.cliente.telefono = value && !validatePhone(value)
          ? 'Ingrese un teléfono válido'
          : '';
      }
    }
    setErrors(newErrors);
  };

  // Cargar vendedores desde la API de Apico
  useEffect(() => {
    fetch('https://api.apico.dev/v1/gE2H1N/1vL47XFQKS6ajoKccemle7MYYDStFVawgnopVpfzz-UA/values/sellers')
      .then(res => res.json())
      .then((apiData) => {
        // Transformar los datos de la API al formato esperado
        const sellersData: SellerData[] = apiData.values.map((row: any) => ({
          id: row[0],
          nombre: row[1],
          email: row[2]
        }));
        setSellers(sellersData);
      })
      .catch(() => setSellers([]));
  }, []);

  // Actualizar datos de vendedor al cambiar el ID
  useEffect(() => {
    if (!contactData.vendedorId) return;
    const found = sellers.find(s => s.id === contactData.vendedorId);
    if (found) {
      setContactData(prev => ({
        ...prev,
        vendedor: { id: found.id, nombre: found.nombre, email: found.email }
      }));
    }
  }, [contactData.vendedorId, sellers]);

  const handleSubmit = () => {
    // Validar todos los campos (solo cliente, nunca vendedor)
    const hasErrors = !!(errors.cliente.nombre || errors.cliente.apellido || errors.cliente.dni || errors.cliente.email || errors.cliente.telefono);
    
    if (hasErrors) {
      alert('Por favor corrija los errores antes de continuar');
      return;
    }

    // Validar que los campos requeridos no estén vacíos
    const hasRequiredFields = contactData.cliente.nombre && contactData.cliente.apellido && contactData.cliente.dni && contactData.cliente.email;

    if (!hasRequiredFields) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    onSubmit(contactData);
    onClose();
  };

  const getTitle = () => {
    switch (type) {
      case "print": return "Datos para imprimir";
      case "save": return "Guardar Cronograma (PDF)";
      case "email": return "Datos para envío por correo";
      default: return "Datos de contacto";
    }
  };

  const getSubmitText = () => {
    switch (type) {
      case "print": return "Imprimir";
      case "save": return "Guardar PDF";
      case "email": return "Copiar datos del email";
      default: return "Enviar";
    }
  };

  if (!isVisible) return null;

  return (
    <div className="contact-modal-overlay">
      <div className="contact-modal">
        <div className="contact-modal-header">
          <h2 className="contact-modal-title">{getTitle()}</h2>
          <button className="contact-modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="contact-modal-content">
          {(type === "print" || type === "save") ? (
            <div className="contact-form">
              {/* Solo mostrar información del vendedor si está logueado */}
              {currentUser && (
                <div className="form-section">
                  <h4>Vendedor</h4>
                  <div style={{ 
                    padding: '12px 16px', 
                    background: 'rgba(16, 185, 129, 0.1)', 
                    border: '1px solid #10b981', 
                    borderRadius: '8px',
                    color: '#10b981',
                    fontSize: '14px'
                  }}>
                    <strong>{currentUser.nombre}</strong>{currentUser.email}
                  </div>
                </div>
              )}

              <div className="form-section">
                <h4>Cliente</h4>
                <div className="input-grid two-cols">
                  <div>
                    <input
                      type="text"
                      className={`form-input ${errors.cliente.nombre ? 'error' : ''}`}
                      placeholder="Ingresar nombre"
                      value={contactData.cliente.nombre}
                      onChange={(e) => {
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, nombre: e.target.value }
                        });
                        validateField('nombre', e.target.value, 'cliente');
                      }}
                    />
                    {errors.cliente.nombre && <div className="error-message">{errors.cliente.nombre}</div>}
                  </div>
                  <div>
                    <input
                      type="text"
                      className={`form-input ${errors.cliente.apellido ? 'error' : ''}`}
                      placeholder="Ingresar Apellido"
                      value={contactData.cliente.apellido || ''}
                      onChange={(e) => {
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, apellido: e.target.value }
                        });
                        validateField('apellido', e.target.value, 'cliente');
                      }}
                    />
                    {errors.cliente.apellido && <div className="error-message">{errors.cliente.apellido}</div>}
                  </div>
                  <div>
                    <input
                      type="text"
                      className={`form-input ${errors.cliente.dni ? 'error' : ''}`}
                      placeholder="Ingresar DNI"
                      value={contactData.cliente.dni || ''}
                      onChange={(e) => {
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, dni: e.target.value }
                        });
                        validateField('dni', e.target.value, 'cliente');
                      }}
                    />
                    {errors.cliente.dni && <div className="error-message">{errors.cliente.dni}</div>}
                  </div>
                  <div>
                    <input
                      type="tel"
                      className={`form-input ${errors.cliente.telefono ? 'error' : ''}`}
                      placeholder="Celular"
                      value={contactData.cliente.telefono}
                      onChange={(e) => {
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, telefono: e.target.value }
                        });
                        validateField('telefono', e.target.value, 'cliente');
                      }}
                    />
                    {errors.cliente.telefono && <div className="error-message">{errors.cliente.telefono}</div>}
                  </div>
                </div>
                <div className="input-group">
                  <input
                    type="email"
                    className={`form-input ${errors.cliente.email ? 'error' : ''}`}
                    placeholder="Ingresar correo electrónico"
                    value={contactData.cliente.email}
                    onChange={(e) => {
                      setContactData({
                        ...contactData,
                        cliente: { ...contactData.cliente, email: e.target.value }
                      });
                      validateField('email', e.target.value, 'cliente');
                    }}
                  />
                  {errors.cliente.email && <div className="error-message">{errors.cliente.email}</div>}
                </div>
              </div>

              {type === 'save' && (
                <div className="form-section">
                  <h4>Nombre del archivo</h4>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej: Cronograma_Lote_123"
                    value={contactData.fileName || ''}
                    onChange={(e) => setContactData({
                      ...contactData,
                      fileName: e.target.value
                    })}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="contact-form">
              {/* Solo mostrar información del vendedor si está logueado */}
              {currentUser && (
                <div className="form-section">
                  <h4>Vendedor</h4>
                  <div style={{ 
                    padding: '12px 16px', 
                    background: 'rgba(16, 185, 129, 0.1)', 
                    border: '1px solid #10b981', 
                    borderRadius: '8px',
                    color: '#10b981',
                    fontSize: '14px'
                  }}>
                    <strong>{currentUser.nombre}</strong>{currentUser.email}
                  </div>
                </div>
              )}

              <div className="form-section">
                <h4>Cliente</h4>
                <div className="input-grid two-cols">
                  <div>
                    <input
                      type="text"
                      className={`form-input ${errors.cliente.nombre ? 'error' : ''}`}
                      placeholder="Ingresar nombre"
                      value={contactData.cliente.nombre}
                      onChange={(e) => {
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, nombre: e.target.value }
                        });
                        validateField('nombre', e.target.value, 'cliente');
                      }}
                    />
                    {errors.cliente.nombre && <div className="error-message">{errors.cliente.nombre}</div>}
                  </div>
                  <div>
                    <input
                      type="text"
                      className={`form-input ${errors.cliente.apellido ? 'error' : ''}`}
                      placeholder="Ingresar Apellido"
                      value={contactData.cliente.apellido || ''}
                      onChange={(e) => {
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, apellido: e.target.value }
                        });
                        validateField('apellido', e.target.value, 'cliente');
                      }}
                    />
                    {errors.cliente.apellido && <div className="error-message">{errors.cliente.apellido}</div>}
                  </div>
                </div>
                <div className="input-grid two-cols">
                  <div>
                    <input
                      type="text"
                      className={`form-input ${errors.cliente.dni ? 'error' : ''}`}
                      placeholder="Ingresar DNI"
                      value={contactData.cliente.dni || ''}
                      onChange={(e) => {
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, dni: e.target.value }
                        });
                        validateField('dni', e.target.value, 'cliente');
                      }}
                    />
                    {errors.cliente.dni && <div className="error-message">{errors.cliente.dni}</div>}
                  </div>
                  <div>
                    <input
                      type="tel"
                      className={`form-input ${errors.cliente.telefono ? 'error' : ''}`}
                      placeholder="Celular"
                      value={contactData.cliente.telefono}
                      onChange={(e) => {
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, telefono: e.target.value }
                        });
                        validateField('telefono', e.target.value, 'cliente');
                      }}
                    />
                    {errors.cliente.telefono && <div className="error-message">{errors.cliente.telefono}</div>}
                  </div>
                </div>
                <div className="input-group">
                  <input
                    type="email"
                    className={`form-input ${errors.cliente.email ? 'error' : ''}`}
                    placeholder="Ingresar correo electrónico"
                    value={contactData.cliente.email}
                    onChange={(e) => {
                      setContactData({
                        ...contactData,
                        cliente: { ...contactData.cliente, email: e.target.value }
                      });
                      validateField('email', e.target.value, 'cliente');
                    }}
                  />
                  {errors.cliente.email && <div className="error-message">{errors.cliente.email}</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="contact-modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleSubmit}>
            {getSubmitText()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactModal;