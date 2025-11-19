import { useEffect, useState } from "react";
import "./ContactModal.css";

interface ContactModalProps {
  isVisible: boolean;
  type: "print" | "save" | "email";
  onClose: () => void;
  onSubmit: (data: ContactData) => void;
  currentUser?: {id: string; full_name?: string; email: string} | null;
  quotationCode?: string; // Código de cotización para usar como nombre de archivo
}

interface ContactData {
  vendedorId?: string;
  vendedor?: { id?: string; full_name?: string; email: string };
  cliente: { nombre: string; apellido?: string; tipoDocumento?: string; dni?: string; email: string; codigoPais?: string; telefono?: string };
  fileName?: string; // Para el tipo "save"
  validity?: { days: number; from: string; to: string };
}

interface SellerData {
  id: string;
  nombre: string;
  email: string;
}

const ContactModal = ({ isVisible, type, onClose, onSubmit, currentUser, quotationCode }: ContactModalProps) => {
  const [contactData, setContactData] = useState<ContactData>({
    vendedorId: currentUser?.id || '',
    vendedor: currentUser ? { 
      id: currentUser.id, 
      full_name: currentUser.full_name,
      email: currentUser.email 
    } : { id: '', email: '' },
    cliente: { nombre: '', email: '', tipoDocumento: 'DNI', codigoPais: '+51', telefono: '' },
    fileName: '',
    validity: (() => {
      const today = new Date();
      const toDdMmYyyy = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      const days = 7;
      const to = new Date(today);
      to.setDate(today.getDate() + (days - 1));
      return {
        days,
        from: toDdMmYyyy(today),
        to: toDdMmYyyy(to)
      };
    })()
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
          full_name: currentUser.full_name,
          email: currentUser.email 
        }
      }));
    } else {
      setContactData(prev => ({
        ...prev,
        vendedorId: '',
        vendedor: { id: '', email: '' }
      }));
    }
  }, [currentUser]);

  // Actualizar fileName con el código de cotización cuando el modal se abre y hay código disponible
  useEffect(() => {
    if (isVisible && quotationCode && type === 'save') {
      // Siempre establecer el código de cotización si está disponible, tiene prioridad sobre el nombre generado
      setContactData(prev => {
        // Verificar si el fileName actual no es un código de cotización
        const currentFileName = prev.fileName || '';
        const isQuotationCode = currentFileName.match(/^COT-\d{4}-\d{3}$/) || currentFileName === quotationCode;
        
        // Si no es un código de cotización o está vacío, establecer el quotationCode
        if (!isQuotationCode || currentFileName === '') {
          return {
            ...prev,
            fileName: quotationCode
          };
        }
        return prev;
      });
    } else if (!isVisible) {
      // Resetear fileName cuando el modal se cierra
      setContactData(prev => ({
        ...prev,
        fileName: ''
      }));
    }
  }, [isVisible, quotationCode, type]);

  // Validar email
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validar nombre (solo letras y espacios)
  const validateName = (name: string) => {
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s-]+$/;
    return nameRegex.test(name);
  };

  // Validar teléfono según el país seleccionado
  const validatePhone = (phone: string, countryCode: string = '+51') => {
    const country = codigosPais.find(p => p.code === countryCode) || codigosPais[0];
    const requiredDigits = country.digits;
    const numbersOnly = phone.replace(/\D/g, '');
    return numbersOnly.length === requiredDigits;
  };

  const documentRules = [
    { value: 'DNI', label: 'DNI', digits: 8 },
    { value: 'RUC', label: 'RUC', digits: 11 },
    { value: 'CE', label: 'Carné de Extranjería', digits: 12 },
    { value: 'Pasaporte', label: 'Pasaporte', digits: 12 },
  ] as const;

  const getDocumentRule = (value?: string) => {
    return documentRules.find(rule => rule.value === value) || documentRules[0];
  };

  const validateDocument = (documentNumber: string, tipoDocumento?: string) => {
    const { digits } = getDocumentRule(tipoDocumento);
    const regex = new RegExp(`^\\d{${digits}}$`);
    return regex.test(documentNumber);
  };

  // Códigos de país con sus limitantes específicas
  const codigosPais = [
    { code: '+51', country: 'Perú', flag: '🇵🇪', digits: 9, format: 'XXX XXX XXX' },
    { code: '+52', country: 'México', flag: '🇲🇽', digits: 10, format: '(XXX) XXX XXXX' },
    { code: '+54', country: 'Argentina', flag: '🇦🇷', digits: 10, format: 'XXX XXXX XXXX' },
    { code: '+55', country: 'Brasil', flag: '🇧🇷', digits: 11, format: '(XX) XXXXX-XXXX' },
    { code: '+56', country: 'Chile', flag: '🇨🇱', digits: 9, format: 'X XXXX XXXX' },
    { code: '+57', country: 'Colombia', flag: '🇨🇴', digits: 10, format: '(XXX) XXX XXXX' },
    { code: '+34', country: 'España', flag: '🇪🇸', digits: 9, format: 'XXX XXX XXX' },
    { code: '+1', country: 'USA/Can', flag: '🇺🇸', digits: 10, format: '(XXX) XXX-XXXX' },
  ];

  // Formatear teléfono con espaciado automático según el país
  const formatPhoneInput = (value: string, countryCode: string = '+51'): string => {
    // Encontrar las configuraciones del país
    const country = codigosPais.find(p => p.code === countryCode) || codigosPais[0];
    const maxDigits = country.digits;
    
    // Remover todo excepto números
    const numbers = value.replace(/\D/g, '');
    // Limitar según el país
    const limited = numbers.slice(0, maxDigits);
    
    // Formatear según el patrón del país
    const format = country.format;
    
    if (format === '(XXX) XXX XXXX' || format === '(XXX) XXX-XXXX') {
      // México, Colombia, USA/Canadá
      return limited.replace(/(\d{1,3})(\d{3})(\d{4})(\d*)/, (_, g1, g2, g3) => 
        `${g1} ${g2} ${g3}`.trim()
      );
    } else if (format === 'XXX XXXX XXXX') {
      // Argentina
      return limited.replace(/(\d{3})(\d{4})(\d{4})(\d*)/, (_, g1, g2, g3) => 
        `${g1} ${g2} ${g3}`.trim()
      );
    } else if (format === '(XX) XXXXX-XXXX') {
      // Brasil
      return limited.replace(/(\d{2})(\d{5})(\d{4})(\d*)/, (_, g1, g2, g3) => 
        `${g1} ${g2}-${g3}`.trim()
      );
    } else if (format === 'X XXXX XXXX') {
      // Chile
      return limited.replace(/(\d{1})(\d{4})(\d{4})(\d*)/, (_, g1, g2, g3) => 
        `${g1} ${g2} ${g3}`.trim()
      );
    } else {
      // Perú, España - formato por defecto XXX XXX XXX
      return limited.replace(/(\d{1,3})(\d{3})(\d{3})(\d*)/, (_, g1, g2, g3, g4) => {
        if (g4) return `${g1} ${g2} ${g3} ${g4}`;
        if (g3 && g3.length === 3) return `${g1} ${g2} ${g3}`;
        if (g2 && g2.length === 3) return `${g1} ${g2}`;
        return g1;
      });
    }
  };

  // Limitar solo a números (sin espacios)
  const handleNumericInput = (value: string): string => {
    return value.replace(/\D/g, '');
  };

  // Limitar solo a letras (con espacios permitidos)
  const handleLetterInput = (value: string): string => {
    // Remover números y caracteres especiales excepto espacios y guiones
    return value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s-]/g, '');
  };

  // Auto-generar nombre de archivo
  const generateFileName = (): string => {
    const clienteNombre = contactData.cliente.nombre || '';
    const clienteApellido = contactData.cliente.apellido || '';
    const fecha = new Date().toISOString().split('T')[0];
    const cleanName = `${clienteNombre}_${clienteApellido}_${fecha}`.trim().replace(/\s+/g, '_');
    return cleanName || 'Documento_' + fecha;
  };

  // Recalcular fechas de vigencia cuando cambie los días
  const recalcValidityDates = (days: number) => {
    if (!days || days <= 0) {
      setContactData(prev => ({
        ...prev,
        validity: {
          days: 0,
          from: '',
          to: ''
        }
      }));
      return;
    }
    const today = new Date();
    const toDdMmYyyy = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const to = new Date(today);
    // Día de creación cuenta como día 1 ⇒ sumar (days - 1)
    to.setDate(today.getDate() + (days - 1));
    setContactData(prev => ({
      ...prev,
      validity: {
        days,
        from: toDdMmYyyy(today),
        to: toDdMmYyyy(to)
      }
    }));
  };

  // Validar campo específico
  const validateField = (
    field: string,
    value: string,
    type: 'vendedorId' | 'cliente',
    options?: { countryCode?: string; documentType?: string }
  ) => {
    const { countryCode, documentType } = options || {};
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
        const rule = getDocumentRule(documentType || contactData.cliente.tipoDocumento);
        newErrors.cliente.dni = value && !validateDocument(value, rule.value)
          ? `Ingrese ${rule.digits} dígitos`
          : '';
      } else if (field === 'email') {
        newErrors.cliente.email = value && !validateEmail(value)
          ? 'Ingrese un correo electrónico válido'
          : '';
      } else if (field === 'telefono') {
        const code = countryCode || contactData.cliente.codigoPais || '+51';
        const country = codigosPais.find(p => p.code === code);
        const requiredDigits = country?.digits || 9;
        newErrors.cliente.telefono = value && !validatePhone(value, code)
          ? `Ingrese ${requiredDigits} dígitos`
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

  // Auto-generar nombre de archivo cuando cambian nombre o apellido
  useEffect(() => {
    if (type === 'save' && (contactData.cliente.nombre || contactData.cliente.apellido)) {
      const currentFileName = contactData.fileName || '';
      // No sobrescribir si ya hay un código de cotización (formato COT-YYYY-XXX) o si coincide con quotationCode
      const isQuotationCode = currentFileName.match(/^COT-\d{4}-\d{3}$/) || currentFileName === quotationCode;
      
      if (!isQuotationCode) {
        const autoFileName = generateFileName();
        // Solo actualizar si no hay un nombre personalizado o es el nombre generado automáticamente
        if (!currentFileName || currentFileName === '' || currentFileName.match(/^Documento_/)) {
          setContactData(prev => ({
            ...prev,
            fileName: autoFileName
          }));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactData.cliente.nombre, contactData.cliente.apellido, type, quotationCode]);

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
      case "print": return "Imprimir cronograma";
      case "save": return "Guardar cronograma";
      case "email": return "Enviar por correo";
      default: return "Datos de contacto";
    }
  };

  const getSubmitText = () => {
    switch (type) {
      case "print": return "Imprimir";
      case "save": return "Guardar PDF";
      case "email": return "Enviar";
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
        <div className="contact-modal-divider"></div>

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
                    <strong>{currentUser.full_name}</strong>  {currentUser.email}
                  </div>
                </div>
              )}

              <div className="form-section">
                <h4>Cliente</h4>
                <div>
                  <div>
                    <label className="input-label">Nombre*</label>
                    <input
                      type="text"
                      className={`form-input ${errors.cliente.nombre ? 'error' : ''}`}
                      placeholder="Solo letras"
                      value={contactData.cliente.nombre}
                      onChange={(e) => {
                        const cleaned = handleLetterInput(e.target.value);
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, nombre: cleaned }
                        });
                        validateField('nombre', cleaned, 'cliente');
                      }}
                    />
                    {errors.cliente.nombre && <div className="error-message">{errors.cliente.nombre}</div>}
                  </div>
                  <div>
                    <label className="input-label">Apellido*</label>
                    <input
                      type="text"
                      className={`form-input ${errors.cliente.apellido ? 'error' : ''}`}
                      placeholder="Solo letras"
                      value={contactData.cliente.apellido || ''}
                      onChange={(e) => {
                        const cleaned = handleLetterInput(e.target.value);
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, apellido: cleaned }
                        });
                        validateField('apellido', cleaned, 'cliente');
                      }}
                    />
                    {errors.cliente.apellido && <div className="error-message">{errors.cliente.apellido}</div>}
                  </div>
                </div>
                <div className="input-grid two-cols">
                  <div>
                    <label className="input-label">Tipo de Documento*</label>
                    <select
                      className="form-input"
                      value={contactData.cliente.tipoDocumento || 'DNI'}
                      onChange={(e) => {
                        const newTipo = e.target.value;
                        const rule = getDocumentRule(newTipo);
                        const trimmedDocument = handleNumericInput(contactData.cliente.dni || '').slice(0, rule.digits);
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, tipoDocumento: newTipo, dni: trimmedDocument }
                        });
                        validateField('dni', trimmedDocument, 'cliente', { documentType: newTipo });
                      }}
                    >
                      {documentRules.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">N° de Documento*</label>
                    <input
                      type="text"
                      className={`form-input ${errors.cliente.dni ? 'error' : ''}`}
                      placeholder={`${getDocumentRule(contactData.cliente.tipoDocumento).digits} dígitos`}
                      value={contactData.cliente.dni || ''}
                      maxLength={getDocumentRule(contactData.cliente.tipoDocumento).digits}
                      onChange={(e) => {
                        const rule = getDocumentRule(contactData.cliente.tipoDocumento);
                        const cleaned = handleNumericInput(e.target.value).slice(0, rule.digits);
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, dni: cleaned }
                        });
                        validateField('dni', cleaned, 'cliente', { documentType: rule.value });
                      }}
                    />
                    {errors.cliente.dni && <div className="error-message">{errors.cliente.dni}</div>}
                  </div>
                  <div>
                    <label className="input-label">Código de País*</label>
                    <select
                      className="form-input"
                      value={contactData.cliente.codigoPais || '+51'}
                      onChange={(e) => {
                        setContactData({
                          ...contactData,
                          cliente: { 
                            ...contactData.cliente, 
                            codigoPais: e.target.value,
                            telefono: '' // Limpiar teléfono al cambiar país
                          }
                        });
                      }}
                    >
                      {codigosPais.map(({ code, country, flag }) => (
                        <option key={code} value={code}>{flag} {code} {country}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Celular*</label>
                    <input
                      type="tel"
                      className={`form-input ${errors.cliente.telefono ? 'error' : ''}`}
                      placeholder={`${codigosPais.find(p => p.code === contactData.cliente.codigoPais)?.digits || 9} dígitos`}
                      value={contactData.cliente.telefono || ''}
                      maxLength={20}
                      onChange={(e) => {
                        const cleaned = handleNumericInput(e.target.value);
                        const countryCode = contactData.cliente.codigoPais || '+51';
                        const formatted = formatPhoneInput(cleaned, countryCode);
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, telefono: formatted }
                        });
                        validateField('telefono', formatted, 'cliente', { countryCode });
                      }}
                    />
                    {errors.cliente.telefono && <div className="error-message">{errors.cliente.telefono}</div>}
                  </div>
                </div>
                <div className="input-group" style={{ gap: 0 }}>
                  <label className="input-label">Email*</label>
                  <input
                    type="email"
                    className={`form-input ${errors.cliente.email ? 'error' : ''}`}
                    placeholder="correo@ejemplo.com"
                    value={contactData.cliente.email}
                    onChange={(e) => {
                      setContactData({
                        ...contactData,
                        cliente: { ...contactData.cliente, email: e.target.value.replace(/\s/g, '') }
                      });
                      validateField('email', e.target.value.replace(/\s/g, ''), 'cliente');
                    }}
                  />
                  {errors.cliente.email && <div className="error-message">{errors.cliente.email}</div>}
                </div>

                {/* Vigencia (ancho completo) */}
                <div className="input-group" style={{ gap: 0 }}>
                  <label className="input-label">Vigencia</label>
                  <div className="input-suffix-wrap">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\\d*"
                      className="form-input"
                      placeholder="7"
                      value={contactData.validity?.days ? String(contactData.validity.days) : ''}
                      onChange={(e) => {
                        const onlyNums = e.target.value.replace(/\D/g, '');
                        const daysNum = onlyNums ? parseInt(onlyNums, 10) : 0;
                        recalcValidityDates(daysNum);
                      }}
                    />
                    <span className="input-suffix">días</span>
                  </div>
                </div>

                {/* Fechas (una sola fila) */}
                <div style={{ marginTop: '12px' }} className="input-grid two-cols">
                  <div>
                    <label className="input-label">Desde</label>
                    <input
                      type="text"
                      className="form-input"
                      value={contactData.validity?.from || ''}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="input-label">Hasta</label>
                    <input
                      type="text"
                      className="form-input"
                      value={contactData.validity?.to || ''}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {type === 'save' && (
                <div className="form-section">
                  <h4>Nombre del archivo</h4>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={quotationCode || "Se genera automáticamente"}
                    value={contactData.fileName !== '' ? contactData.fileName : (quotationCode || generateFileName())}
                    onChange={(e) => {
                      setContactData({
                        ...contactData,
                        fileName: e.target.value
                      });
                    }}
                  />
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Puede editar el nombre antes de guardar
                  </p>
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
                    <strong>{currentUser.full_name}</strong>{currentUser.email}
                  </div>
                </div>
              )}

              <div className="form-section">
                <h4>Cliente</h4>
                <div className="input-grid two-cols">
                  <div>
                    <label className="input-label">Nombre*</label>
                    <input
                      type="text"
                      className={`form-input ${errors.cliente.nombre ? 'error' : ''}`}
                      placeholder="Solo letras"
                      value={contactData.cliente.nombre}
                      onChange={(e) => {
                        const cleaned = handleLetterInput(e.target.value);
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, nombre: cleaned }
                        });
                        validateField('nombre', cleaned, 'cliente');
                      }}
                    />
                    {errors.cliente.nombre && <div className="error-message">{errors.cliente.nombre}</div>}
                  </div>
                  <div>
                    <label className="input-label">Apellido*</label>
                    <input
                      type="text"
                      className={`form-input ${errors.cliente.apellido ? 'error' : ''}`}
                      placeholder="Solo letras"
                      value={contactData.cliente.apellido || ''}
                      onChange={(e) => {
                        const cleaned = handleLetterInput(e.target.value);
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, apellido: cleaned }
                        });
                        validateField('apellido', cleaned, 'cliente');
                      }}
                    />
                    {errors.cliente.apellido && <div className="error-message">{errors.cliente.apellido}</div>}
                  </div>
                  <div>
                    <label className="input-label">Tipo de Documento*</label>
                    <select
                      className="form-input"
                      value={contactData.cliente.tipoDocumento || 'DNI'}
                      onChange={(e) => {
                        const newTipo = e.target.value;
                        const rule = getDocumentRule(newTipo);
                        const trimmedDocument = handleNumericInput(contactData.cliente.dni || '').slice(0, rule.digits);
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, tipoDocumento: newTipo, dni: trimmedDocument }
                        });
                        validateField('dni', trimmedDocument, 'cliente', { documentType: newTipo });
                      }}
                    >
                      {documentRules.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">N° de Documento*</label>
                    <input
                      type="text"
                      className={`form-input ${errors.cliente.dni ? 'error' : ''}`}
                      placeholder={`${getDocumentRule(contactData.cliente.tipoDocumento).digits} dígitos`}
                      value={contactData.cliente.dni || ''}
                      maxLength={getDocumentRule(contactData.cliente.tipoDocumento).digits}
                      onChange={(e) => {
                        const rule = getDocumentRule(contactData.cliente.tipoDocumento);
                        const cleaned = handleNumericInput(e.target.value).slice(0, rule.digits);
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, dni: cleaned }
                        });
                        validateField('dni', cleaned, 'cliente', { documentType: rule.value });
                      }}
                    />
                    {errors.cliente.dni && <div className="error-message">{errors.cliente.dni}</div>}
                  </div>
                  <div>
                    <label className="input-label">Código de País*</label>
                    <select
                      className="form-input"
                      value={contactData.cliente.codigoPais || '+51'}
                      onChange={(e) => {
                        setContactData({
                          ...contactData,
                          cliente: { 
                            ...contactData.cliente, 
                            codigoPais: e.target.value,
                            telefono: '' // Limpiar teléfono al cambiar país
                          }
                        });
                      }}
                    >
                      {codigosPais.map(({ code, country, flag, digits }) => (
                        <option key={code} value={code}>{flag} {code} {country} ({digits} dígitos)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Celular*</label>
                    <input
                      type="tel"
                      className={`form-input ${errors.cliente.telefono ? 'error' : ''}`}
                      placeholder={`${codigosPais.find(p => p.code === contactData.cliente.codigoPais)?.digits || 9} dígitos`}
                      value={contactData.cliente.telefono || ''}
                      maxLength={20}
                      onChange={(e) => {
                        const cleaned = handleNumericInput(e.target.value);
                        const countryCode = contactData.cliente.codigoPais || '+51';
                        const formatted = formatPhoneInput(cleaned, countryCode);
                        setContactData({
                          ...contactData,
                          cliente: { ...contactData.cliente, telefono: formatted }
                        });
                        validateField('telefono', formatted, 'cliente', { countryCode });
                      }}
                    />
                    {errors.cliente.telefono && <div className="error-message">{errors.cliente.telefono}</div>}
                  </div>
                </div>
                <div className="input-group" style={{ gap: 0 }}>
                  <label className="input-label">Email*</label>
                  <input
                    type="email"
                    className={`form-input ${errors.cliente.email ? 'error' : ''}`}
                    placeholder="correo@ejemplo.com"
                    value={contactData.cliente.email}
                    onChange={(e) => {
                      setContactData({
                        ...contactData,
                        cliente: { ...contactData.cliente, email: e.target.value.replace(/\s/g, '') }
                      });
                      validateField('email', e.target.value.replace(/\s/g, ''), 'cliente');
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