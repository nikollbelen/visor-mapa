import { useState } from "react";
import "./ContactModal.css";

interface ContactModalProps {
  isVisible: boolean;
  type: "print" | "save" | "email";
  onClose: () => void;
  onSubmit: (data: ContactData) => void;
}

interface ContactData {
  vendedor: { nombre: string; email: string };
  cliente: { nombre: string; email: string };
  fileName?: string; // Para el tipo "save"
}

const ContactModal = ({ isVisible, type, onClose, onSubmit }: ContactModalProps) => {
  const [contactData, setContactData] = useState<ContactData>({
    vendedor: { nombre: '', email: '' },
    cliente: { nombre: '', email: '' },
    fileName: ''
  });

  const [errors, setErrors] = useState({
    vendedor: { nombre: '', email: '' },
    cliente: { nombre: '', email: '' }
  });

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

  // Validar campo específico
  const validateField = (field: string, value: string, type: 'vendedor' | 'cliente') => {
    const newErrors = { ...errors };
    
    if (field === 'nombre') {
      if (value && !validateName(value)) {
        newErrors[type].nombre = 'El nombre solo puede contener letras y espacios';
      } else {
        newErrors[type].nombre = '';
      }
    } else if (field === 'email') {
      if (value && !validateEmail(value)) {
        newErrors[type].email = 'Ingrese un correo electrónico válido';
      } else {
        newErrors[type].email = '';
      }
    }
    
    setErrors(newErrors);
  };

  const handleSubmit = () => {
    // Validar todos los campos
    const hasErrors = errors.vendedor.nombre || errors.vendedor.email || 
                      errors.cliente.nombre || errors.cliente.email;
    
    if (hasErrors) {
      alert('Por favor corrija los errores antes de continuar');
      return;
    }

    // Validar que los campos requeridos no estén vacíos
    if (!contactData.vendedor.nombre || !contactData.vendedor.email || 
        !contactData.cliente.nombre || !contactData.cliente.email) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    onSubmit(contactData);
    onClose();
  };

  const getTitle = () => {
    switch (type) {
      case "print": return "Datos para la impresión";
      case "save": return "Guardar Cronograma";
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
          {type === "save" ? (
            <div className="contact-form">
              <p style={{textAlign: 'center', marginBottom: '20px', color: '#ccc'}}>¿Deseas guardar este cronograma como PDF?</p>
              <div className="form-section">
                <h4>Vendedor</h4>
                <div className="input-group">
                  <input
                    type="text"
                    className={`form-input ${errors.vendedor.nombre ? 'error' : ''}`}
                    placeholder="Nombre del vendedor"
                    value={contactData.vendedor.nombre}
                    onChange={(e) => {
                      setContactData({
                        ...contactData,
                        vendedor: { ...contactData.vendedor, nombre: e.target.value }
                      });
                      validateField('nombre', e.target.value, 'vendedor');
                    }}
                  />
                  {errors.vendedor.nombre && <div className="error-message">{errors.vendedor.nombre}</div>}
                  <input
                    type="email"
                    className={`form-input ${errors.vendedor.email ? 'error' : ''}`}
                    placeholder="Email del vendedor"
                    value={contactData.vendedor.email}
                    onChange={(e) => {
                      setContactData({
                        ...contactData,
                        vendedor: { ...contactData.vendedor, email: e.target.value }
                      });
                      validateField('email', e.target.value, 'vendedor');
                    }}
                  />
                  {errors.vendedor.email && <div className="error-message">{errors.vendedor.email}</div>}
                </div>
              </div>

              <div className="form-section">
                <h4>Cliente</h4>
                <div className="input-group">
                  <input
                    type="text"
                    className={`form-input ${errors.cliente.nombre ? 'error' : ''}`}
                    placeholder="Nombre del cliente"
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
                  <input
                    type="email"
                    className={`form-input ${errors.cliente.email ? 'error' : ''}`}
                    placeholder="Email del cliente"
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
            </div>
          ) : (
            <div className="contact-form">
              <div className="form-section">
                <h4>Vendedor</h4>
                <div className="input-group">
                  <input
                    type="text"
                    className={`form-input ${errors.vendedor.nombre ? 'error' : ''}`}
                    placeholder="Nombre del vendedor"
                    value={contactData.vendedor.nombre}
                    onChange={(e) => {
                      setContactData({
                        ...contactData,
                        vendedor: { ...contactData.vendedor, nombre: e.target.value }
                      });
                      validateField('nombre', e.target.value, 'vendedor');
                    }}
                  />
                  {errors.vendedor.nombre && <div className="error-message">{errors.vendedor.nombre}</div>}
                  <input
                    type="email"
                    className={`form-input ${errors.vendedor.email ? 'error' : ''}`}
                    placeholder="Email del vendedor"
                    value={contactData.vendedor.email}
                    onChange={(e) => {
                      setContactData({
                        ...contactData,
                        vendedor: { ...contactData.vendedor, email: e.target.value }
                      });
                      validateField('email', e.target.value, 'vendedor');
                    }}
                  />
                  {errors.vendedor.email && <div className="error-message">{errors.vendedor.email}</div>}
                </div>
              </div>

              <div className="form-section">
                <h4>Cliente</h4>
                <div className="input-group">
                  <input
                    type="text"
                    className={`form-input ${errors.cliente.nombre ? 'error' : ''}`}
                    placeholder="Nombre del cliente"
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
                  <input
                    type="email"
                    className={`form-input ${errors.cliente.email ? 'error' : ''}`}
                    placeholder="Email del cliente"
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