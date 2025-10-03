import { useEffect, useState } from 'react';
import { addMonths, format, parse, isValid, isBefore, startOfDay } from 'date-fns';
import './LotInfoModal.css';

interface LotInfoModalProps {
  isVisible?: boolean;
  onClose?: () => void;
  loteData?: any;
}

const LotInfoModal = ({ isVisible = false, onClose, loteData }: LotInfoModalProps) => {
  // Debug: Log lotData to see what data is being passed
  console.log('LotInfoModal - loteData recibido:', loteData);
  const [showQuotation, setShowQuotation] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  
  // Payment schedule states
  const [paymentMethod, setPaymentMethod] = useState('credito_hipotecario');
  const [separation, setSeparation] = useState({ amount: 0, percentage: 0, enabled: false });
  const [initial, setInitial] = useState({ amount: 0, percentage: 0 });
  const [mortgageCredit, setMortgageCredit] = useState({ amount: 0, percentage: 0 });
  const [finalBalance, setFinalBalance] = useState({ amount: 0, percentage: 0 });
  const [numberOfInstallments, setNumberOfInstallments] = useState(2);
  const [equivalentInstallments, setEquivalentInstallments] = useState(true);
  const [firstPaymentDate, setFirstPaymentDate] = useState('');
  // const [lastPaymentDate, setLastPaymentDate] = useState(''); // Removed - now calculated automatically
  const [schedule, setSchedule] = useState<any[]>([]);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [dateError, setDateError] = useState<string>('');
  const [calculatedFinalDate, setCalculatedFinalDate] = useState<string>('');
  // const [savedSchedule, setSavedSchedule] = useState<any[]>([]); // Removed - not needed
  // Datos por defecto si no hay datos del lote
  const defaultLotData = {
    lot: 'Lote sin identificar',
    status: 'Disponible',
    price: '$ 0',
    area: '0.00 m²',
    boundaries: {
      left: '0.00ML',
      right: '0.00ML',
      front: '0.00ML',
      back: '0.00ML'
    }
  };

  // Usar datos del lote si están disponibles, sino usar datos por defecto
  const lotData = loteData ? {
    lot: loteData.direccion || 'Lote sin identificar',
    status: loteData.estado || 'Disponible',
    price: loteData.precio ? `$ ${loteData.precio.toLocaleString()}` : '$ 0',
    area: loteData.area || '0.00 m²',
    boundaries: {
      left: '0.00ML',
      right: '0.00ML',
      front: '0.00ML',
      back: '0.00ML'
    }
  } : defaultLotData;

  const handleClose = () => {
    setShowQuotation(false); // Reset to lot info when closing
    onClose?.();
  };

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'amount' | 'percentage') => {
    const value = e.target.value;
    const price = loteData?.precio || 445000;
    
    if (type === 'amount') {
      const amount = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
      setDiscountAmount(amount);
      setDiscountPercentage((amount / price) * 100);
    } else {
      const percentage = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
      setDiscountPercentage(percentage);
      setDiscountAmount((percentage / 100) * price);
    }
    
    // No recalcular automáticamente para evitar bucles
    // El usuario debe presionar "Generar Cronograma" manualmente
  };

  const handlePaymentMethodChange = (method: string) => {
    console.log('Cambiando modalidad a:', method);
    setPaymentMethod(method);
    
    // Reset all payment fields when changing method
    setSeparation({ amount: 0, percentage: 0, enabled: false });
    setInitial({ amount: 0, percentage: 0 });
    setMortgageCredit({ amount: 0, percentage: 0 });
    setFinalBalance({ amount: 0, percentage: 0 });
    setNumberOfInstallments(0);
    setEquivalentInstallments(true);
    setFirstPaymentDate('');
    setSchedule([]);
    setNeedsUpdate(false);
    setDateError('');
    setCalculatedFinalDate('');
  };

  // Debug: Log when paymentMethod changes
  useEffect(() => {
    console.log('paymentMethod cambió a:', paymentMethod);
  }, [paymentMethod]);

  const calculateSchedule = () => {
    console.log('=== INICIANDO calculateSchedule ===');
    console.log('Schedule ANTES de calculateSchedule:', schedule);
    console.log('Schedule ANTES tiene', schedule.length, 'elementos');
    console.log('Schedule ANTES elementos:', schedule.map(item => item.item));
    const finalPrice = (loteData?.precio || 445000) - discountAmount;
    
    const newSchedule: any[] = [];
    
    if (paymentMethod === 'credito_hipotecario') {
      // Modalidad: Crédito Hipotecario
      console.log('Calculando cronograma para credito_hipotecario');
      console.log('paymentMethod actual:', paymentMethod);
      
      // Agregar separación si está habilitada
      if (separation.enabled && separation.percentage > 0) {
        console.log('Agregando Separación:', separation);
        newSchedule.push({
          item: 'Separación',
          date: firstPaymentDate,
          percentage: separation.percentage,
          amount: separation.amount,
          isEdited: false
        });
      }
      
      // Buscar o agregar inicial
      if (initial.percentage > 0) {
        console.log('Agregando Inicial:', initial);
        newSchedule.push({
          item: 'Inicial',
          date: firstPaymentDate,
          percentage: initial.percentage,
          amount: initial.amount,
          isEdited: false
        });
      }
      
      // Calcular porcentajes ya definidos (separación + inicial + CH)
      const definedPercentage = separation.percentage + initial.percentage + mortgageCredit.percentage;
      
      // Calcular el porcentaje restante para las cuotas
      const remainingPercentage = 100 - definedPercentage;
      
      if (remainingPercentage < 0) {
        console.warn('Los porcentajes definidos exceden el 100%');
        return;
      }
      
      // Agregar cuotas
      if (numberOfInstallments > 0) {
        const installmentPercentage = equivalentInstallments 
          ? remainingPercentage / numberOfInstallments 
          : remainingPercentage / numberOfInstallments;
        
        for (let i = 1; i <= numberOfInstallments; i++) {
          const installmentDate = calculateInstallmentDate(firstPaymentDate, i);
          newSchedule.push({
            item: `Cuota ${i}`,
            date: installmentDate,
            percentage: installmentPercentage,
            amount: (installmentPercentage / 100) * finalPrice,
            isEdited: false
          });
        }
      }
      
      // Agregar crédito hipotecario si está definido
      if (mortgageCredit.percentage > 0) {
        const creditDate = calculateInstallmentDate(firstPaymentDate, numberOfInstallments + 1);
        newSchedule.push({
          item: 'Crédito Hipotecario',
          date: creditDate,
          percentage: mortgageCredit.percentage,
          amount: mortgageCredit.amount,
          isEdited: false
        });
      }
    } else if (paymentMethod === 'credito_directo') {
      // Modalidad: Crédito Directo
      
      // Agregar separación si está habilitada
      if (separation.enabled && separation.percentage > 0) {
        newSchedule.push({
          item: 'Separación',
          date: firstPaymentDate,
          percentage: separation.percentage,
          amount: separation.amount,
          isEdited: false
        });
      }
      
      // Buscar o agregar inicial
      if (initial.percentage > 0) {
        console.log('Agregando Inicial:', initial);
        newSchedule.push({
          item: 'Inicial',
          date: firstPaymentDate,
          percentage: initial.percentage,
          amount: initial.amount,
          isEdited: false
        });
      }
      
      // Calcular porcentajes ya definidos (separación + inicial)
      const definedPercentage = separation.percentage + initial.percentage;
      
      // Calcular el porcentaje restante para las cuotas
      const remainingPercentage = 100 - definedPercentage;
      
      if (remainingPercentage < 0) {
        console.warn('Los porcentajes definidos exceden el 100%');
        return;
      }
      
      // Agregar cuotas
      if (numberOfInstallments > 0) {
        const installmentPercentage = equivalentInstallments 
          ? remainingPercentage / numberOfInstallments 
          : remainingPercentage / numberOfInstallments;
        
        for (let i = 1; i <= numberOfInstallments; i++) {
          const installmentDate = calculateInstallmentDate(firstPaymentDate, i);
          newSchedule.push({
            item: `Cuota ${i}`,
            date: installmentDate,
            percentage: installmentPercentage,
            amount: (installmentPercentage / 100) * finalPrice,
            isEdited: false
          });
        }
      }
    } else if (paymentMethod === 'contado') {
      // Modalidad: Contado
      
      // Agregar separación si está habilitada
      if (separation.enabled && separation.percentage > 0) {
        newSchedule.push({
          item: 'Separación',
          date: firstPaymentDate,
          percentage: separation.percentage,
          amount: separation.amount,
          isEdited: false
        });
      }
      
      // Buscar o agregar inicial
      if (initial.percentage > 0) {
        console.log('Agregando Inicial:', initial);
        newSchedule.push({
          item: 'Inicial',
          date: firstPaymentDate,
          percentage: initial.percentage,
          amount: initial.amount,
          isEdited: false
        });
      }
      
      // Agregar pago saldo final
      if (finalBalance.percentage > 0) {
        newSchedule.push({
          item: 'Pago Saldo Final',
          date: firstPaymentDate,
          percentage: finalBalance.percentage,
          amount: finalBalance.amount,
          isEdited: false
        });
      }
    }
    
    console.log('Schedule final:', newSchedule.map(item => ({ item: item.item, percentage: item.percentage })));
    setSchedule(newSchedule);
    setNeedsUpdate(false);
    
    // Log después de setSchedule para ver si se modifica
    setTimeout(() => {
      console.log('Schedule DESPUÉS de setSchedule:', schedule);
      console.log('Schedule DESPUÉS tiene', schedule.length, 'elementos');
      console.log('Schedule DESPUÉS elementos:', schedule.map(item => item.item));
    }, 100);
    
    // Actualizar fecha final calculada
    if (paymentMethod === 'credito_directo' && numberOfInstallments > 0) {
      const finalDate = calculateFinalPaymentDate(firstPaymentDate, numberOfInstallments);
      setCalculatedFinalDate(finalDate);
    }
  };

  const calculateInstallmentDate = (startDate: string, installmentIndex: number): string => {
    if (!startDate) return '';
    
    try {
      // Parsear fecha de inicio (formato dd/mm/aaaa)
      const parsedDate = parse(startDate, 'dd/MM/yyyy', new Date());
      
      if (!isValid(parsedDate)) {
        console.error('Invalid start date format');
        return '';
      }
      
      // Agregar meses usando date-fns para manejar casos especiales
      const installmentDate = addMonths(parsedDate, installmentIndex);
      
      // Formatear de vuelta a dd/mm/aaaa
      return format(installmentDate, 'dd/MM/yyyy');
    } catch (error) {
      console.error('Error calculating installment date:', error);
      return '';
    }
  };

  const validateStartDate = (dateString: string): { isValid: boolean; error?: string } => {
    if (!dateString) {
      return { isValid: false, error: 'Fecha de inicio requerida' };
    }

    try {
      const parsedDate = parse(dateString, 'dd/MM/yyyy', new Date());
      
      if (!isValid(parsedDate)) {
        return { isValid: false, error: 'Formato de fecha inválido (dd/mm/aaaa)' };
      }

      const today = startOfDay(new Date());
      const currentYear = new Date().getFullYear();
      const dateYear = parsedDate.getFullYear();

      // No puede ser de un año anterior
      if (dateYear < currentYear) {
        return { isValid: false, error: 'La fecha no puede ser de un año anterior' };
      }

      // No puede ser hoy o en el pasado
      if (isBefore(parsedDate, today) || parsedDate.getTime() === today.getTime()) {
        return { isValid: false, error: 'La fecha debe ser en el futuro' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Error al validar la fecha' };
    }
  };

  const calculateFinalPaymentDate = (startDate: string, numberOfInstallments: number): string => {
    if (!startDate || numberOfInstallments <= 0) return '';
    
    try {
      const parsedDate = parse(startDate, 'dd/MM/yyyy', new Date());
      if (!isValid(parsedDate)) return '';
      
      // La fecha final es la última cuota (número de cuotas - 1 meses después)
      const finalDate = addMonths(parsedDate, numberOfInstallments - 1);
      return format(finalDate, 'dd/MM/yyyy');
    } catch (error) {
      console.error('Error calculating final payment date:', error);
      return '';
    }
  };

  const generateSchedule = () => {
    console.log('=== EJECUTANDO generateSchedule ===');
    calculateSchedule();
    setNeedsUpdate(false);
  };

  const updateSchedule = () => {
    if (equivalentInstallments) {
      // Si son equivalentes, recalcular todo
      calculateSchedule();
    } else {
      // Si no son equivalentes, mantener los valores editados y solo recalcular fechas
      const newSchedule = schedule.map((item, index) => ({
        ...item,
        date: calculateInstallmentDate(firstPaymentDate, index)
      }));
      setSchedule(newSchedule);
      // Los valores editados se mantienen sin recalcular
    }
    setNeedsUpdate(false);
  };

  const handleFieldChange = (_field: string) => {
    console.log('=== EJECUTANDO handleFieldChange ===', _field);
    setNeedsUpdate(true);
    // No llamar calculateSchedule automáticamente para evitar bucles
    // El usuario debe presionar "Generar Cronograma" manualmente
  };

  const handleInstallmentChange = (index: number, field: 'percentage' | 'amount', value: number) => {
    if (equivalentInstallments) return; // No permitir cambios si son equivalentes
    
    const newSchedule = [...schedule];
    const finalPrice = (loteData?.precio || 445000) - discountAmount;
    
    // Actualizar la cuota modificada
    newSchedule[index] = {
      ...newSchedule[index],
      [field]: value,
      isEdited: true // Marcar como editada
    };
    
    // Si cambió el porcentaje, calcular el monto
    if (field === 'percentage') {
      newSchedule[index].amount = (value / 100) * finalPrice;
    }
    // Si cambió el monto, calcular el porcentaje
    else if (field === 'amount') {
      newSchedule[index].percentage = (value / finalPrice) * 100;
    }
    
    // SIEMPRE recalcular las demás cuotas para mantener el total del 100%
    recalculateRemainingInstallments(newSchedule, finalPrice);
    
    setSchedule(newSchedule);
    setNeedsUpdate(true);
  };

  const recalculateRemainingInstallments = (schedule: any[], finalPrice: number) => {
    console.log('=== EJECUTANDO recalculateRemainingInstallments ===');
    // Calcular el porcentaje total de TODOS los elementos en el schedule
    const totalSchedulePercentage = schedule.reduce((total, item) => {
      return total + (item.percentage || 0);
    }, 0);
    
    // Calcular el porcentaje restante para distribuir
    const remainingPercentage = 100 - totalSchedulePercentage;
    
    console.log('Recalculando cuotas:', {
      totalSchedulePercentage,
      remainingPercentage,
      schedule: schedule.map(item => ({ item: item.item, percentage: item.percentage, isEdited: item.isEdited }))
    });
    
    // Buscar cuotas que no han sido editadas
    const uneditedInstallments = schedule.filter(item => !item.isEdited);
    
    if (uneditedInstallments.length > 0) {
      const distributionPerInstallment = remainingPercentage / uneditedInstallments.length;
      
      schedule.forEach((item, index) => {
        // Si es una cuota no editada, recalcular
        if (!item.isEdited) {
          schedule[index].percentage = distributionPerInstallment;
          schedule[index].amount = (distributionPerInstallment / 100) * finalPrice;
        }
      });
    }
  };

  // Función removida - no se necesita recálculo automático para cuotas no equivalentes

  const handleDateChange = (value: string) => {
    setFirstPaymentDate(value);
    
    // Solo validar si la fecha está completa (formato dd/mm/aaaa)
    if (value.length === 10 && value.includes('/')) {
      const validation = validateStartDate(value);
      setDateError(validation.isValid ? '' : validation.error || '');
      
      // Calcular fecha final automáticamente solo si es válida
      if (validation.isValid) {
        const finalDate = calculateFinalPaymentDate(value, numberOfInstallments);
        setCalculatedFinalDate(finalDate);
        
        // Recalcular fechas de cuotas si ya hay un cronograma
        if (schedule.length > 0) {
          const newSchedule = schedule.map((item, index) => ({
            ...item,
            date: calculateInstallmentDate(value, index)
          }));
          setSchedule(newSchedule);
        }
      } else {
        setCalculatedFinalDate('');
      }
    } else {
      // Limpiar errores mientras se escribe
      setDateError('');
      setCalculatedFinalDate('');
    }
    
    setNeedsUpdate(true);
  };

  const handleQuotationClick = () => {
    if (isAnimating) return; // Prevent multiple clicks during animation
    
    setIsAnimating(true);
    
    // First apply the rotation (add flip class)
    const modal = document.querySelector('.lot-modal');
    if (modal) {
      modal.classList.add('flip');
      
      // Wait for half the animation to complete, then change content
      setTimeout(() => {
        setShowQuotation(true);
      }, 400); // Half of animation duration (0.8s / 2)
      
      // Wait for full animation to complete
      setTimeout(() => {
        setIsAnimating(false);
      }, 800); // Full animation duration
    }
  };

  const handleBackToLot = () => {
    if (isAnimating) return; // Prevent multiple clicks during animation
    
    setIsAnimating(true);
    
    // First apply the rotation (remove flip class)
    const modal = document.querySelector('.lot-modal');
    if (modal) {
      modal.classList.remove('flip');
      
      // Wait for half the animation to complete, then change content
      setTimeout(() => {
        setShowQuotation(false);
      }, 400); // Half of animation duration (0.8s / 2)
      
      // Wait for full animation to complete
      setTimeout(() => {
        setIsAnimating(false);
      }, 800); // Full animation duration
    }
  };


  useEffect(() => {
  }, [isVisible, loteData]);

  return (
    <div 
      className="lot-modal background-container border-container"
      id="modalOverlay"
      style={{ display: isVisible ? 'flex' : 'none' }}
    >
      {/* Cara frontal - Información del lote */}
      <div className="lot-modal-front" style={{ display: showQuotation ? 'none' : 'flex' }}>
        <a 
          className="lot-modal-back-link" 
          href="#" 
          onClick={(e) => { e.preventDefault(); handleClose(); }}
        >
          <i className="fas fa-arrow-left"></i>
          <span>Volver</span>
        </a>
        
        <div className="lot-modal-header">
          <div className="lot-modal-logo">
            <img src="/images/logo_mikonos.png" alt="Mykonos Residencial Playa" />
          </div>
        </div>

        <div className="lot-modal-content">
          <div className="lot-identification">
            <div className="lot-box">
              <span id="modalLot">{lotData.lot}</span>
            </div>
            <div className="lot-status-badge" id="modalStatus">{lotData.status}</div>
          </div>

          <div className="lot-property-details">
            <div className="lot-detail-row">
              <span className="lot-detail-label">Precio</span>
              <span className="lot-detail-value" id="modalPrice">{lotData.price}</span>
            </div>
            <div className="lot-detail-row">
              <span className="lot-detail-label">Área</span>
              <span className="main-detail-value" id="modalArea">{lotData.area}</span>
            </div>
          </div>

          <div className="lot-boundaries-section">
            <h3 className="lot-boundaries-title">Colindancias</h3>
            <div className="lot-boundaries-card">
              <div className="lot-boundary-item">
                <div className="lot-boundary-icon">
                  <img src="/images/lote/izquierda.svg" alt="Izquierda" className="lot-boundary-icon-svg" />
                </div>
                <span className="lot-boundary-label">Izquierda</span>
                <span className="lot-boundary-value" id="modalLeft">{lotData.boundaries?.left || 'N/A'}</span>
              </div>
              <div className="lot-boundary-item">
                <div className="lot-boundary-icon">
                  <img src="/images/lote/derecha.svg" alt="Derecha" className="lot-boundary-icon-svg" />
                </div>
                <span className="lot-boundary-label">Derecha</span>
                <span className="lot-boundary-value" id="modalRight">{lotData.boundaries?.right || 'N/A'}</span>
              </div>
              <div className="lot-boundary-item">
                <div className="lot-boundary-icon">
                  <img src="/images/lote/frente.svg" alt="Frente" className="lot-boundary-icon-svg" />
                </div>
                <span className="lot-boundary-label">Frente</span>
                <span className="lot-boundary-value" id="modalFront">{lotData.boundaries?.front || 'N/A'}</span>
              </div>
              <div className="lot-boundary-item">
                <div className="lot-boundary-icon">
                  <img src="/images/lote/fondo.svg" alt="Fondo" className="lot-boundary-icon-svg" />
                </div>
                <span className="lot-boundary-label">Fondo</span>
                <span className="lot-boundary-value" id="modalBack">{lotData.boundaries?.back || 'N/A'}</span>
              </div>
            </div>
          </div>

          <button className="lot-whatsapp-btn" onClick={handleQuotationClick}>
            <i className="fa-brands fa-whatsapp"></i>
            <span>Cotización de lote</span>
          </button>
        </div>
      </div>

      {/* Cara trasera - Cotización */}
      <div className="lot-modal-back" style={{ display: showQuotation ? 'flex' : 'none' }}>
        <a 
          className="lot-modal-back-link" 
          href="#" 
          onClick={(e) => { e.preventDefault(); handleBackToLot(); }}
        >
          <i className="fas fa-arrow-left"></i>
          <span>Volver</span>
        </a>

        <div className="quotation-header">
          <div className="quotation-title">
            <span>Cotización de lote</span>
          </div>
          <button className="quotation-close-btn" onClick={handleClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="lot-modal-content">
          {/* Detalles del lote */}
          <div className="quotation-details-section">
            <div className="quotation-table">
              <div className="quotation-table-header">
                <div className="quotation-header-cell">Item</div>
                <div className="quotation-header-cell">Etapa</div>
                <div className="quotation-header-cell">Unidad</div>
                <div className="quotation-header-cell">Monto</div>
                <div className="quotation-header-cell">Descuento</div>
              </div>
              <div className="quotation-table-row">
                <div className="quotation-cell item-name">Lote</div>
                <div className="quotation-cell item-value">Etapa 1</div>
                <div className="quotation-cell item-value">
                  {(() => {
                    // Parse format "Mz. E - Lote 7" to "E7"
                    if (loteData?.direccion) {
                      const match = loteData.direccion.match(/Mz\.\s*([A-Z])\s*-\s*Lote\s*(\d+)/);
                      if (match) {
                        return `${match[1]}${match[2]}`;
                      }
                    }
                    // Fallback to manzana + numero if available
                    if (loteData?.manzana && loteData?.numero) {
                      return `${loteData.manzana}${loteData.numero}`;
                    }
                    return 'M4';
                  })()}
                </div>
                <div className="quotation-cell item-value">
                  ${loteData?.precio ? loteData.precio.toLocaleString() : '445,000.00'}
                </div>
                <div className="quotation-cell">
                  <div className="discount-badges">
                    <input 
                      type="text" 
                      className="discount-input" 
                      placeholder="$ 0.00"
                      value={discountAmount > 0 ? `$ ${discountAmount.toLocaleString()}` : ''}
                      onChange={(e) => handleDiscountChange(e, 'amount')}
                    />
                    <input 
                      type="text" 
                      className="discount-input" 
                      placeholder="0.00%"
                      value={discountPercentage > 0 ? `${discountPercentage.toFixed(2)}%` : ''}
                      onChange={(e) => handleDiscountChange(e, 'percentage')}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="discount-row">
              <div className="discount-label">dsto:</div>
              <div className="discount-value">
                <span>$</span>
                <span>-{discountAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="total-row">
              <div className="total-label">Total:</div>
              <div className="total-value">
                $ {((loteData?.precio || 445000) - discountAmount).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Cronograma de Pago */}
          <div className="payment-schedule-section">
            <div className="section-header">
              <h2 className="section-title">Cronograma de Pago</h2>
              <button className="clear-link">Limpiar</button>
            </div>

            <div className="payment-form">
              <div className="form-group">
                <label className="form-label">Modalidad de Pago</label>
                <select 
                  className="form-select" 
                  value={paymentMethod}
                  onChange={(e) => handlePaymentMethodChange(e.target.value)}
                >
                  <option value="credito_hipotecario">Crédito Hipotecario</option>
                  <option value="credito_directo">Crédito Directo</option>
                  <option value="contado">Contado</option>
                </select>
              </div>

              {/* Campos condicionales según modalidad */}
              <div style={{color: 'white', margin: '10px 0'}}>
                Modalidad actual: {paymentMethod}
              </div>
              {paymentMethod === 'credito_hipotecario' && (
                <>
                  <div className="form-group">
                    <label className="form-label">
                      Separación
                      <input 
                        type="checkbox" 
                        className="checkbox" 
                        checked={separation.enabled}
                        onChange={(e) => {
                          setSeparation({...separation, enabled: e.target.checked});
                          setNeedsUpdate(true);
                        }}
                      />
                    </label>
                    {separation.enabled && (
                      <div className="input-group">
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="0.00 USD"
                          value={separation.amount > 0 ? `${separation.amount.toLocaleString()} USD` : ''}
                          onChange={(e) => {
                            const amount = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                            const percentage = (amount / ((loteData?.precio || 445000) - discountAmount)) * 100;
                            setSeparation({amount, percentage, enabled: true});
                            handleFieldChange('separation');
                          }}
                        />
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="0.00 %"
                          value={separation.percentage > 0 ? `${separation.percentage.toFixed(2)} %` : ''}
                          onChange={(e) => {
                            const percentage = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                            const amount = (percentage / 100) * ((loteData?.precio || 445000) - discountAmount);
                            setSeparation({amount, percentage, enabled: true});
                            handleFieldChange('separation');
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Inicial</label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="0.00 USD"
                        value={initial.amount > 0 ? `${initial.amount.toLocaleString()} USD` : ''}
                        onChange={(e) => {
                          console.log('=== CAMBIANDO INPUT INICIAL ===');
                          console.log('Schedule ANTES de setInitial:', schedule);
                          const amount = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                          const percentage = (amount / ((loteData?.precio || 445000) - discountAmount)) * 100;
                          console.log('Nuevo initial:', {amount, percentage});
                          setInitial({amount, percentage});
                          handleFieldChange('initial');
                          
                          // Log después de setInitial para ver si se modifica el schedule
                          setTimeout(() => {
                            console.log('Schedule DESPUÉS de setInitial:', schedule);
                          }, 100);
                        }}
                      />
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="0.00 %"
                        value={initial.percentage > 0 ? `${initial.percentage.toFixed(2)} %` : ''}
                        onChange={(e) => {
                          const percentage = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                          const amount = (percentage / 100) * ((loteData?.precio || 445000) - discountAmount);
                          setInitial({amount, percentage});
                          handleFieldChange('initial');
                          
                          // Log después de setInitial para ver si se modifica el schedule
                          setTimeout(() => {
                            console.log('Schedule DESPUÉS de setInitial:', schedule);
                          }, 100);
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Crédito Hipotecario</label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="0.00 USD"
                        value={mortgageCredit.amount > 0 ? `${mortgageCredit.amount.toLocaleString()} USD` : ''}
                        onChange={(e) => {
                          const amount = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                          const percentage = (amount / ((loteData?.precio || 445000) - discountAmount)) * 100;
                          setMortgageCredit({amount, percentage});
                          handleFieldChange('mortgageCredit');
                        }}
                      />
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="0.00 %"
                        value={mortgageCredit.percentage > 0 ? `${mortgageCredit.percentage.toFixed(2)} %` : ''}
                        onChange={(e) => {
                          const percentage = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                          const amount = (percentage / 100) * ((loteData?.precio || 445000) - discountAmount);
                          setMortgageCredit({amount, percentage});
                          handleFieldChange('mortgageCredit');
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Carta de Aprobación</label>
                    <button className="upload-btn">Subir Archivo</button>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Número de Cuotas</label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="2 cuotas"
                        value={numberOfInstallments > 0 ? `${numberOfInstallments} cuotas` : ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                          setNumberOfInstallments(value);
                          setNeedsUpdate(true);
                        }}
                      />
                      <div className="checkbox-label">
                        <span>Cuotas Equivalentes</span>
                        <input 
                          type="checkbox" 
                          className="checkbox" 
                          checked={equivalentInstallments}
                          onChange={(e) => {
                            setEquivalentInstallments(e.target.checked);
                            setNeedsUpdate(true);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Primer y Último Pago</label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        className={`date-input ${dateError ? 'error' : ''}`}
                        placeholder="dd/mm/aaaa"
                        value={firstPaymentDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                      />
                      <input 
                        type="text" 
                        className="date-input readonly"
                        placeholder="dd/mm/aaaa"
                        value={calculatedFinalDate}
                        readOnly
                      />
                    </div>
                    {dateError && <div className="date-error-message">{dateError}</div>}
                    {calculatedFinalDate && !dateError && (
                      <div className="calculated-date-display">
                        Fecha final calculada: {calculatedFinalDate}
                      </div>
                    )}
                  </div>

                </>
              )}

              {paymentMethod === 'credito_directo' && (
                <>
                  <div className="form-group">
                    <label className="form-label">
                      Separación
                      <input 
                        type="checkbox" 
                        className="checkbox" 
                        checked={separation.enabled}
                        onChange={(e) => {
                          setSeparation({...separation, enabled: e.target.checked});
                          setNeedsUpdate(true);
                        }}
                      />
                    </label>
                    {separation.enabled && (
                      <div className="input-group">
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="0.00 USD"
                          value={separation.amount > 0 ? `${separation.amount.toLocaleString()} USD` : ''}
                          onChange={(e) => {
                            const amount = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                            const percentage = (amount / ((loteData?.precio || 445000) - discountAmount)) * 100;
                            setSeparation({amount, percentage, enabled: true});
                            handleFieldChange('separation');
                          }}
                        />
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="0.00 %"
                          value={separation.percentage > 0 ? `${separation.percentage.toFixed(2)} %` : ''}
                          onChange={(e) => {
                            const percentage = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                            const amount = (percentage / 100) * ((loteData?.precio || 445000) - discountAmount);
                            setSeparation({amount, percentage, enabled: true});
                            handleFieldChange('separation');
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Inicial</label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="0.00 USD"
                        value={initial.amount > 0 ? `${initial.amount.toLocaleString()} USD` : ''}
                        onChange={(e) => {
                          console.log('=== CAMBIANDO INPUT INICIAL ===');
                          console.log('Schedule ANTES de setInitial:', schedule);
                          const amount = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                          const percentage = (amount / ((loteData?.precio || 445000) - discountAmount)) * 100;
                          console.log('Nuevo initial:', {amount, percentage});
                          setInitial({amount, percentage});
                          handleFieldChange('initial');
                          
                          // Log después de setInitial para ver si se modifica el schedule
                          setTimeout(() => {
                            console.log('Schedule DESPUÉS de setInitial:', schedule);
                          }, 100);
                        }}
                      />
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="0.00 %"
                        value={initial.percentage > 0 ? `${initial.percentage.toFixed(2)} %` : ''}
                        onChange={(e) => {
                          const percentage = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                          const amount = (percentage / 100) * ((loteData?.precio || 445000) - discountAmount);
                          setInitial({amount, percentage});
                          handleFieldChange('initial');
                          
                          // Log después de setInitial para ver si se modifica el schedule
                          setTimeout(() => {
                            console.log('Schedule DESPUÉS de setInitial:', schedule);
                          }, 100);
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Número de Cuotas</label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="2 cuotas"
                        value={numberOfInstallments > 0 ? `${numberOfInstallments} cuotas` : ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                          setNumberOfInstallments(value);
                          setNeedsUpdate(true);
                        }}
                      />
                      <div className="checkbox-label">
                        <span>Cuotas Equivalentes</span>
                        <input 
                          type="checkbox" 
                          className="checkbox" 
                          checked={equivalentInstallments}
                          onChange={(e) => {
                            setEquivalentInstallments(e.target.checked);
                            setNeedsUpdate(true);
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Primer y Último Pago</label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        className={`date-input ${dateError ? 'error' : ''}`}
                        placeholder="dd/mm/aaaa"
                        value={firstPaymentDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                      />
                      <input 
                        type="text" 
                        className="date-input readonly"
                        placeholder="dd/mm/aaaa"
                        value={calculatedFinalDate}
                        readOnly
                      />
                    </div>
                    {dateError && <div className="date-error-message">{dateError}</div>}
                    {calculatedFinalDate && !dateError && (
                      <div className="calculated-date-display">
                        Fecha final calculada: {calculatedFinalDate}
                      </div>
                    )}
                  </div>
                </>
              )}

              {paymentMethod === 'contado' && (
                <>
                  <div className="form-group">
                    <label className="form-label">
                      Separación
                      <input 
                        type="checkbox" 
                        className="checkbox" 
                        checked={separation.enabled}
                        onChange={(e) => {
                          setSeparation({...separation, enabled: e.target.checked});
                          setNeedsUpdate(true);
                        }}
                      />
                    </label>
                    {separation.enabled && (
                      <div className="input-group">
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="0.00 USD"
                          value={separation.amount > 0 ? `${separation.amount.toLocaleString()} USD` : ''}
                          onChange={(e) => {
                            const amount = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                            const percentage = (amount / ((loteData?.precio || 445000) - discountAmount)) * 100;
                            setSeparation({amount, percentage, enabled: true});
                            handleFieldChange('separation');
                          }}
                        />
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="0.00 %"
                          value={separation.percentage > 0 ? `${separation.percentage.toFixed(2)} %` : ''}
                          onChange={(e) => {
                            const percentage = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                            const amount = (percentage / 100) * ((loteData?.precio || 445000) - discountAmount);
                            setSeparation({amount, percentage, enabled: true});
                            handleFieldChange('separation');
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Inicial</label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="0.00 USD"
                        value={initial.amount > 0 ? `${initial.amount.toLocaleString()} USD` : ''}
                        onChange={(e) => {
                          console.log('=== CAMBIANDO INPUT INICIAL ===');
                          console.log('Schedule ANTES de setInitial:', schedule);
                          const amount = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                          const percentage = (amount / ((loteData?.precio || 445000) - discountAmount)) * 100;
                          console.log('Nuevo initial:', {amount, percentage});
                          setInitial({amount, percentage});
                          handleFieldChange('initial');
                          
                          // Log después de setInitial para ver si se modifica el schedule
                          setTimeout(() => {
                            console.log('Schedule DESPUÉS de setInitial:', schedule);
                          }, 100);
                        }}
                      />
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="0.00 %"
                        value={initial.percentage > 0 ? `${initial.percentage.toFixed(2)} %` : ''}
                        onChange={(e) => {
                          const percentage = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                          const amount = (percentage / 100) * ((loteData?.precio || 445000) - discountAmount);
                          setInitial({amount, percentage});
                          handleFieldChange('initial');
                          
                          // Log después de setInitial para ver si se modifica el schedule
                          setTimeout(() => {
                            console.log('Schedule DESPUÉS de setInitial:', schedule);
                          }, 100);
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Pago Saldo Final</label>
                    <div className="input-group">
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="0.00 USD"
                        value={finalBalance.amount > 0 ? `${finalBalance.amount.toLocaleString()} USD` : ''}
                        onChange={(e) => {
                          const amount = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                          const percentage = (amount / ((loteData?.precio || 445000) - discountAmount)) * 100;
                          setFinalBalance({amount, percentage});
                          handleFieldChange('finalBalance');
                        }}
                      />
                    </div>
                  </div>
                </>
              )}


              <button 
                className={`generate-schedule-btn ${needsUpdate ? 'update-btn' : ''}`}
                onClick={() => {
                  console.log('=== BOTÓN CLICKEADO ===', { needsUpdate, firstPaymentDate, numberOfInstallments, dateError });
                  if (needsUpdate) {
                    updateSchedule();
                  } else {
                    generateSchedule();
                  }
                }}
                disabled={!firstPaymentDate || numberOfInstallments === 0 || !!dateError}
              >
                {needsUpdate ? 'Actualizar Cronograma' : 'Generar Cronograma'}
              </button>
            </div>

            {/* Tabla de Cronograma Generado */}
            <div className="schedule-table">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{textAlign: 'center'}}>Fecha</th>
                    <th style={{textAlign: 'center'}}>Porcentaje</th>
                    <th style={{textAlign: 'right'}}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {separation.enabled && separation.amount > 0 && (
                    <tr>
                      <td>Separación</td>
                      <td style={{textAlign: 'center'}}>
                        <input type="text" className="input-date" placeholder="dd/mm/aaaa" />
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <input type="text" className="input-percent" value={`${separation.percentage.toFixed(2)}%`} readOnly />
                      </td>
                      <td style={{textAlign: 'right'}}>
                        <input type="text" className="input-amount" value={`${separation.amount.toLocaleString()} USD`} readOnly />
                      </td>
                    </tr>
                  )}
                  

                  {schedule.map((item, index) => (
                    <tr key={index}>
                      <td>{item.item}</td>
                      <td style={{textAlign: 'center'}}>
                        <input 
                          type="text" 
                          className="input-date" 
                          placeholder="dd/mm/aaaa"
                          value={item.date}
                          onChange={(e) => {
                            const newSchedule = [...schedule];
                            newSchedule[index].date = e.target.value;
                            setSchedule(newSchedule);
                          }}
                        />
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <input 
                          type="text" 
                          className={`input-percent ${item.isEquivalent ? 'readonly' : ''}`}
                          value={`${item.percentage.toFixed(2)}%`}
                          readOnly={item.isEquivalent}
                          onChange={(e) => {
                            if (!item.isEquivalent) {
                              const percentage = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                              handleInstallmentChange(index, 'percentage', percentage);
                            }
                          }}
                        />
                      </td>
                      <td style={{textAlign: 'right'}}>
                        <input 
                          type="text" 
                          className={`input-amount ${item.isEquivalent ? 'readonly' : ''}`}
                          value={`${item.amount.toLocaleString()} USD`}
                          readOnly={item.isEquivalent}
                          onChange={(e) => {
                            if (!item.isEquivalent) {
                              const amount = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                              handleInstallmentChange(index, 'amount', amount);
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ))}

                  {mortgageCredit.amount > 0 && (
                    <tr>
                      <td className="muted">Desembolso CH</td>
                      <td style={{textAlign: 'center'}}>
                        <input type="text" className="input-date muted" placeholder="dd/mm/aaaa" />
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <input type="text" className="input-percent muted" value={`${mortgageCredit.percentage.toFixed(2)}%`} readOnly />
                      </td>
                      <td style={{textAlign: 'right'}}>
                        <input type="text" className="input-amount muted" value={`${mortgageCredit.amount.toLocaleString()} USD`} readOnly />
                      </td>
                    </tr>
                  )}

                  <tr className="total-row">
                    <td colSpan={2}><strong>TOTAL</strong></td>
                    <td style={{textAlign: 'center'}}><strong>100%</strong></td>
                    <td style={{textAlign: 'right'}}>
                      <strong>${((loteData?.precio || 445000) - discountAmount).toLocaleString()} USD</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Funcionalidades */}
            <div className="functionalities">
              <h3>Funcionalidades</h3>
              <div className="function-buttons">
                <button className="function-btn">Imprimir</button>
                <button className="function-btn">Guardar</button>
                <button className="function-btn">Enviar por correo</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LotInfoModal;
