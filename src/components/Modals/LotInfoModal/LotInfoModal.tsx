import { useEffect, useState } from "react";
import {
  addMonths,
  format,
  parse,
  isValid,
  isBefore,
  startOfDay,
} from "date-fns";
import jsPDF from 'jspdf';
import "./LotInfoModal.css";
import ContactModal from "../ContactModal/ContactModal";

interface LotInfoModalProps {
  isVisible?: boolean;
  onClose?: () => void;
  loteData?: any;
  currentUser?: {id: string; full_name?: string; email: string} | null;
}

const LotInfoModal = ({
  isVisible = false,
  onClose,
  loteData,
  currentUser,
}: LotInfoModalProps) => {
  const [showQuotation, setShowQuotation] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [userState, setUserState] = useState(currentUser);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [maxDiscount, setMaxDiscount] = useState<number | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [quotationNotes, setQuotationNotes] = useState('');

  useEffect(() => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    const projectId = import.meta.env.VITE_PROJECT_ID;
    if (!apiBaseUrl || !projectId) return;
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/settings/project/${projectId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      signal: controller.signal
    })
      .then(res => res.json())
      .then((data) => {
        const rawMax = data?.data?.max_discount;
        const parsed = typeof rawMax === 'number' ? rawMax : parseFloat(rawMax);
        if (!isNaN(parsed)) {
          setMaxDiscount(parsed);
        }
        if (data?.data?.quotation_notes) {
          setQuotationNotes(data.data.quotation_notes);
        }
      })
      .catch(() => {
        setMaxDiscount(null);
        setQuotationNotes('');
      });
    return () => controller.abort();
  }, []);

  // Sincronizar el estado del usuario cuando cambie la prop
  useEffect(() => {
    setUserState(currentUser);
  }, [currentUser]);

  // Debug: Log user state changes
  useEffect(() => {
  }, [userState]);

  const formatLotLabel = (direccion?: string, phase?: string) => {
    const normalizedPhase = (phase || '').toString().replace(/^\s*etapa\s+/i, '').trim();
    const stageText = normalizedPhase ? `Etapa ${normalizedPhase}` : '';
  
    if (!direccion) {
      return stageText ? `${stageText} - Lote sin identificar` : 'Lote sin identificar';
    }
  
    const match = direccion.match(/Mz\.\s*([A-Za-z0-9]+)\s*-\s*(?:Lote|Lt\.?)\s*(\d+)/i);
    let unitText: string;
  
    if (match) {
      const manzana = match[1].toUpperCase();
      const lote = match[2];
      unitText = `Mz. ${manzana} Lt. ${lote}`;
    } else {
      unitText = direccion.replace(/Lote/gi, 'Lt.');
    }
  
    return stageText ? `${stageText} - ${unitText}` : unitText;
  };

  // Función para obtener solo la parte del lote sin la etapa (para mostrar en el modal)
  const getLotWithoutPhase = (lotString: string): string => {
    // Remover "Etapa X - " del inicio si existe (maneja números romanos y arábigos)
    return lotString.replace(/^Etapa\s+[IVX0-9]+\s*-\s*/i, '').trim();
  };

  // Payment schedule states
  const [paymentMethod, setPaymentMethod] = useState("credito_directo");
  const [separation, setSeparation] = useState({
    amount: 0,
    percentage: 0,
    enabled: false,
  });
  const [initial, setInitial] = useState({ amount: 0, percentage: 0 });
  const [mortgageCredit, setMortgageCredit] = useState({
    amount: 0,
    percentage: 0,
  });
  const [finalBalance, setFinalBalance] = useState({
    amount: 0,
    percentage: 0,
    date: "",
  });
  const [numberOfInstallments, setNumberOfInstallments] = useState(2);
  const [equivalentInstallments, setEquivalentInstallments] = useState(true);
  const [firstPaymentDate, setFirstPaymentDate] = useState("");
  // const [lastPaymentDate, setLastPaymentDate] = useState(''); // Removed - now calculated automatically
  const [schedule, setSchedule] = useState<any[]>([]);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [dateError, setDateError] = useState<string>("");
  const [calculatedFinalDate, setCalculatedFinalDate] = useState<string>("");
  // const [savedSchedule, setSavedSchedule] = useState<any[]>([]); // Removed - not needed
  
  // Estados para funcionalidades de botones
  const [showContactModal, setShowContactModal] = useState(false);
  const [modalType, setModalType] = useState<"print" | "save" | "email">("print");
  const [functionalitiesEnabled, setFunctionalitiesEnabled] = useState(false);
  
  // Estados para rastrear si ya se guardó y los datos guardados
  const [hasBeenSaved, setHasBeenSaved] = useState(false);
  const [lastSavedData, setLastSavedData] = useState<any>(null);
  const [quotationCodeForModal, setQuotationCodeForModal] = useState<string | undefined>(undefined);
  
  // Estados para manejar el focus de inputs formateados
  const [focusedInputs, setFocusedInputs] = useState<{[key: string]: boolean}>({});
  // Datos por defecto si no hay datos del lote
  const defaultLotData = {
    lot: formatLotLabel("Lote sin identificar", "1"),
    status: "Disponible",
    price: "$0.00",
    area: "0.00 m²",
    boundaries: {
      left: "0.00ML",
      right: "0.00ML",
      front: "0.00ML",
      back: "0.00ML",
    },
    phase: "1",
    id: undefined,
  };

  // Usar datos del lote si están disponibles, sino usar datos por defecto

  useEffect(() => {
    // Habilitar funcionalidades solo cuando los inputs requeridos estén completos
    let enabled = true;
    // Debe existir un cronograma generado
    if (!schedule || schedule.length === 0) enabled = false;
    // Si no es contado, validar fecha inicial, número de cuotas y errores de fecha
    if (enabled && paymentMethod !== "contado") {
      if (!firstPaymentDate || !!dateError) enabled = false;
      if (numberOfInstallments <= 0) enabled = false;
    }
    // Validar fechas para Separación si está activa (>0%)
    if (enabled && separation?.enabled && separation.percentage > 0) {
      const sep = schedule.find((s) => s.item === "Separación");
      if (!sep || !sep.date) enabled = false;
    }
    // Validar fecha para Inicial si aplica (>0%)
    if (enabled && initial?.percentage > 0) {
      const ini = schedule.find((s) => s.item === "Inicial");
      if (!ini || !ini.date) enabled = false;
    }
    setFunctionalitiesEnabled(enabled);
  }, [
    schedule,
    paymentMethod,
    firstPaymentDate,
    dateError,
    numberOfInstallments,
    separation?.enabled,
    separation?.percentage,
    initial?.percentage
  ]);
  const lotData = loteData
    ? {
        lot: formatLotLabel(loteData.direccion, loteData.phase || "1"),
        status: loteData.estado || "Disponible",
        price: loteData.precio
          ? (() => {
              const formatted = loteData.precio.toFixed(2);
              const parts = formatted.split('.');
              parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
              return `$${parts.join('.')}`;
            })()
          : "$0.00",
        area: loteData.area || "0.00 m²",
        boundaries: {
          left: loteData.boundaries?.left || "0.00ML",
          right: loteData.boundaries?.right || "0.00ML",
          front: loteData.boundaries?.front || "0.00ML",
          back: loteData.boundaries?.back || "0.00ML",
        },
        phase: loteData.phase || "1",
        id: loteData.id,
      }
    : defaultLotData;
  const normalizedLotStatus = (lotData.status || "").toLowerCase();
  const statusColorConfig: Record<string, { background: string; border: string }> = {
    disponible: {
      background: "rgba(29, 183, 121, 0.2)",
      border: "#1DB779",
    },
    reservado: {
      background: "rgba(251, 224, 73, 0.2)",
      border: "#FBE049",
    },
    negociacion: {
      background: "rgba(255, 165, 0, 0.2)",
      border: "#FFA500",
    },
    vendido: {
      background: "rgba(251, 73, 73, 0.2)",
      border: "#FB4949",
    },
  };
  const statusColors = statusColorConfig[normalizedLotStatus] || statusColorConfig.vendido;
  const statusDisplayMap: Record<string, string> = {
    disponible: "Disponible",
    reservado: "Reservado",
    negociacion: "Negociación",
    vendido: "Vendido",
  };
  const statusLabel =
    statusDisplayMap[normalizedLotStatus] || (typeof lotData.status === "string" ? lotData.status : "Vendido");

  // Constantes para la API de cotizaciones
  const BASE_API = import.meta.env.VITE_API_BASE_URL;
  const PROJECT_ID = import.meta.env.VITE_PROJECT_ID; // ID del proyecto Mikonos
  const LOT_ID = loteData?.id; // ID del lote actual desde la API

  const handleClose = () => {
    setShowQuotation(false); // Reset to lot info when closing
    // Resetear estados de guardado cuando se cierra el modal
    setHasBeenSaved(false);
    setLastSavedData(null);
    setQuotationCodeForModal(undefined);
    onClose?.();
  };

  // Funciones para manejar el formato dinámico de inputs
  const handleInputFocus = (inputId: string) => {
    setFocusedInputs(prev => ({ ...prev, [inputId]: true }));
  };

  // Función para manejar el blur específico de cada input
  const handleDecimalBlur = (inputId: string, setter: (value: number) => void) => {
    const rawValue = rawInputValues[inputId];
    if (rawValue !== undefined) {
      const cleanValue = rawValue.replace(/[^0-9.]/g, '');
      
      // Si hay un valor válido, redondearlo a 2 decimales
      if (cleanValue !== '' && cleanValue !== '.') {
        const numValue = parseFloat(cleanValue);
        if (!isNaN(numValue)) {
          const roundedValue = Math.round(numValue * 100) / 100;
          setter(roundedValue);
        }
      }
    }
    
    // Limpiar el valor raw
    setRawInputValues(prev => {
      const newValues = { ...prev };
      delete newValues[inputId];
      return newValues;
    });
    
    // Quitar el foco
    setFocusedInputs(prev => ({ ...prev, [inputId]: false }));
  };

  // Función simple para inputs que no necesitan procesamiento especial
  const handleInputBlur = (inputId: string) => {
    setFocusedInputs(prev => ({ ...prev, [inputId]: false }));
  };

  // Función para redondear a 2 decimales solo si tiene más de 2 decimales
  const roundToTwoDecimals = (value: number): number => {
    const rounded = Math.round(value * 100) / 100;
    return rounded;
  };

  // Función para formatear fechas - acepta múltiples formatos y siempre retorna dd/mm/aaaa
  const formatDateInput = (input: string): string => {
    if (!input) return '';
    
    // Limpiar el input de caracteres no numéricos excepto /
    const cleanInput = input.replace(/[^0-9/]/g, '');
    
    // Si está vacío, retornar vacío
    if (!cleanInput) return '';
    
    // Detectar el formato y convertir a dd/mm/aaaa
    let day = '';
    let month = '';
    let year = '';
    
    // Caso 1: dd/mm/aa o dd/mm/aaaa
    if (cleanInput.includes('/')) {
      const parts = cleanInput.split('/');
      if (parts.length >= 2) {
        day = parts[0].padStart(2, '0');
        month = parts[1].padStart(2, '0');
        if (parts[2]) {
          year = parts[2];
          // Si tiene 2 dígitos, asumir 20xx
          if (year.length === 2) {
            year = '20' + year;
          }
        }
      }
    }
    // Caso 2: ddmmaa o ddmmaaaa (sin separadores)
    else {
      const numbers = cleanInput.replace(/\D/g, '');
      
      if (numbers.length === 4) {
        // ddmmaa
        day = numbers.substring(0, 2);
        month = numbers.substring(2, 4);
        year = '2024'; // Año actual por defecto
      } else if (numbers.length === 5) {
        // ddmmaa (5 dígitos: dd/mm/aa)
        day = numbers.substring(0, 2);
        month = numbers.substring(2, 4);
        year = '20' + numbers.substring(4, 5);
      } else if (numbers.length === 6) {
        // ddmmaa
        day = numbers.substring(0, 2);
        month = numbers.substring(2, 4);
        year = '20' + numbers.substring(4, 6);
      } else if (numbers.length === 8) {
        // ddmmaaaa
        day = numbers.substring(0, 2);
        month = numbers.substring(2, 4);
        year = numbers.substring(4, 8);
      }
    }
    
    // Validar que tengamos los componentes necesarios
    if (day && month && year) {
      // Validar rangos básicos
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      
    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 2000) {
      const candidate = new Date(yearNum, monthNum - 1, dayNum);
      if (isNaN(candidate.getTime())) {
        return '';
      }
      return `${day}/${month}/${year}`;
    }
    }
    
    // Si no se puede formatear correctamente, retornar vacío para invalidar la fecha
    return '';
  };

  const toDateInputValue = (displayDate?: string | null): string => {
    if (!displayDate) return '';
    const [day, month, year] = displayDate.split('/');
    if (!day || !month || !year) return '';
    const paddedDay = day.padStart(2, '0');
    const paddedMonth = month.padStart(2, '0');
    const paddedYear = year.padStart(4, '0');
    return `${paddedYear}-${paddedMonth}-${paddedDay}`;
  };

  const fromDateInputValue = (inputValue?: string | null): string => {
    if (!inputValue) return '';
    const [year, month, day] = inputValue.split('-');
    if (!year || !month || !day) return '';
    const paddedDay = day.padStart(2, '0');
    const paddedMonth = month.padStart(2, '0');
    return `${paddedDay}/${paddedMonth}/${year}`;
  };

  // Función para obtener la fecha de hoy en formato yyyy-MM-dd para el atributo min
  const getTodayDateInput = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Función para validar fecha según el tipo de item (Separación/Inicial vs Cuotas)
  const validateScheduleDate = (
    dateString: string,
    itemName: string
  ): { isValid: boolean; error?: string } => {
    if (!dateString) {
      return { isValid: false, error: "Fecha requerida" };
    }

    try {
      const parsedDate = parse(dateString, "dd/MM/yyyy", new Date());
      if (!isValid(parsedDate)) {
        return {
          isValid: false,
          error: "Formato de fecha inválido (dd/mm/aaaa)",
        };
      }

      const today = startOfDay(new Date());
      if (isBefore(parsedDate, today)) {
        return { isValid: false, error: "La fecha debe ser hoy o en el futuro" };
      }

      // Si no hay fecha de primer pago, solo validar que sea hoy o futuro
      if (!firstPaymentDate) {
        return { isValid: true };
      }

      const firstPaymentParsed = parse(firstPaymentDate, "dd/MM/yyyy", new Date());
      if (!isValid(firstPaymentParsed)) {
        return { isValid: true }; // Si la fecha de primer pago es inválida, permitir cualquier fecha válida
      }

      const isSeparacionOrInicial = itemName === "Separación" || itemName === "Inicial";
      const isCuota1 = itemName === "Cuota 1";
      const isCuota = itemName.startsWith("Cuota");

      if (isSeparacionOrInicial) {
        // Separación e Inicial deben ser ANTES de la fecha de primer pago
        if (!isBefore(parsedDate, firstPaymentParsed)) {
          return {
            isValid: false,
            error: `La fecha debe ser anterior a la fecha de primer pago (${firstPaymentDate})`,
          };
        }
      } else if (isCuota1) {
        // Cuota 1: puede ser cualquier fecha válida (hoy o futuro), se convertirá en la nueva referencia
        // No necesita validación adicional más allá de que sea hoy o futuro
        return { isValid: true };
      } else if (isCuota) {
        // Las cuotas 2, 3, etc. deben ser POSTERIORES o IGUALES a la fecha de primer pago
        if (isBefore(parsedDate, firstPaymentParsed)) {
          return {
            isValid: false,
            error: `La fecha debe ser posterior o igual a la fecha de primer pago (${firstPaymentDate})`,
          };
        }
      }

      return { isValid: true };
    } catch {
      return { isValid: false, error: "Error al validar la fecha" };
    }
  };

  // Función para obtener el min/max según el tipo de item
  const getDateInputMinMax = (itemName: string): { min?: string; max?: string } => {
    const today = getTodayDateInput();
    
    if (!firstPaymentDate) {
      return { min: today };
    }

    const firstPaymentInput = toDateInputValue(firstPaymentDate);
    if (!firstPaymentInput) {
      return { min: today };
    }

    const isSeparacionOrInicial = itemName === "Separación" || itemName === "Inicial";
    const isCuota1 = itemName === "Cuota 1";
    const isCuota = itemName.startsWith("Cuota");

    if (isSeparacionOrInicial) {
      // Separación e Inicial: máximo es un día antes de firstPaymentDate
      const firstPaymentParsed = parse(firstPaymentDate, "dd/MM/yyyy", new Date());
      if (isValid(firstPaymentParsed)) {
        const maxDate = new Date(firstPaymentParsed);
        maxDate.setDate(maxDate.getDate() - 1);
        const year = maxDate.getFullYear();
        const month = String(maxDate.getMonth() + 1).padStart(2, '0');
        const day = String(maxDate.getDate()).padStart(2, '0');
        return { min: today, max: `${year}-${month}-${day}` };
      }
    } else if (isCuota1) {
      // Cuota 1: puede ser cualquier fecha desde hoy (se convertirá en la nueva referencia)
      return { min: today };
    } else if (isCuota) {
      // Cuotas 2, 3, etc.: mínimo es firstPaymentDate
      return { min: firstPaymentInput };
    }

    return { min: today };
  };

  const getFormattedValue = (value: number, type: 'usd' | 'percentage' | 'cuotas', inputId: string) => {
    const isFocused = focusedInputs[inputId];
    const rawValue = rawInputValues[inputId];
    
    if (isFocused && rawValue !== undefined) {
      // Cuando está enfocado y hay un valor raw, mostrar exactamente lo que escribió el usuario
      return rawValue;
    } else if (isFocused) {
      // Cuando está enfocado pero no hay valor raw, mostrar solo el número sin formato
      switch (type) {
        case 'usd':
        case 'percentage':
          return value > 0 ? value.toFixed(2) : '';
        case 'cuotas':
          return value > 0 ? value.toString() : '';
        default:
          return value > 0 ? value.toString() : '';
      }
    } else {
      // Cuando no está enfocado, mostrar con formato según las reglas
      switch (type) {
        case 'usd':
          if (value > 0) {
            // Redondear a 2 decimales y formatear
            const rounded = Math.round(value * 100) / 100;
            return `${rounded.toFixed(2)} USD`;
          }
          return '';
        case 'percentage':
          if (value > 0) {
            // Redondear a 2 decimales y formatear
            const rounded = Math.round(value * 100) / 100;
            return `${rounded.toFixed(2)} %`;
          }
          return '';
        case 'cuotas':
          return value > 0 ? `${value} cuotas` : '';
        default:
          return value > 0 ? Math.round(value * 100) / 100 : '';
      }
    }
  };

  const getBasePrice = () => {
    const price = loteData?.precio;
    if (typeof price === 'number') return price;
    const parsed = price ? parseFloat(price) : NaN;
    return !isNaN(parsed) ? parsed : 445000;
  };

  const validateDiscountValue = (percentage: number) => {
    if (percentage < 0) {
      setDiscountError('El descuento no puede ser negativo');
      return false;
    }
    if (maxDiscount !== null && percentage > maxDiscount) {
      setDiscountError(`El descuento máximo permitido es ${maxDiscount}%`);
      return false;
    }
    setDiscountError('');
    return true;
  };

  const applyDiscountFromAmount = (amount: number) => {
    const priceBase = getBasePrice();
    const percentage = priceBase ? (amount / priceBase) * 100 : 0;
    if (!validateDiscountValue(percentage)) return;
    setDiscountAmount(amount);
    setDiscountPercentage(percentage);
    handleFieldChange("discount");
  };

  const applyDiscountFromPercentage = (percentage: number) => {
    if (!validateDiscountValue(percentage)) return;
    const priceBase = getBasePrice();
    const amount = (percentage / 100) * priceBase;
    setDiscountPercentage(percentage);
    setDiscountAmount(amount);
    handleFieldChange("discount");
  };

  const handleDiscountChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "amount" | "percentage"
  ) => {
    if (type === "amount") {
      handleDecimalInput(e.target.value, 'discount-amount', (amount) => {
        applyDiscountFromAmount(amount);
      });
    } else {
      handleDecimalInput(e.target.value, 'discount-percentage', (percentage) => {
        applyDiscountFromPercentage(percentage);
      });
    }
  };

  const handlePaymentMethodChange = (method: string) => {
    setPaymentMethod(method);

    // Reset all payment fields when changing method
    setSeparation({ amount: 0, percentage: 0, enabled: false });
    setInitial({ amount: 0, percentage: 0 });
    setMortgageCredit({ amount: 0, percentage: 0 });
    setFinalBalance({ amount: 0, percentage: 0, date: "" });
    setNumberOfInstallments(0);
    setEquivalentInstallments(true);
    setFirstPaymentDate("");
    setSchedule([]);
    setNeedsUpdate(false);
    setDateError("");
    setCalculatedFinalDate("");
  };

  // Debug: Log when paymentMethod changes
  useEffect(() => {
  }, [paymentMethod]);

  // Función auxiliar para calcular montos de manera precisa
  // Función para redondear porcentajes a máximo 3 decimales
  const roundPercentage = (percentage: number) => {
    return Math.round(percentage * 1000) / 1000;
  };


  // Función para validar entrada de decimales mientras se escribe
  const validateDecimalInput = (value: string): boolean => {
    // Solo permitir números y punto decimal
    const cleanValue = value.replace(/[^0-9.]/g, '');
    
    // Si el valor original contiene caracteres no permitidos, bloquear
    if (value !== cleanValue) {
      return false;
    }
    
    // Permitir valores vacíos o que empiecen con punto
    if (cleanValue === '' || cleanValue === '.') {
      return true;
    }
    
    // Verificar que no haya múltiples puntos decimales
    const dotCount = (cleanValue.match(/\./g) || []).length;
    if (dotCount > 1) {
      return false;
    }
    
    // Si hay punto decimal, verificar que no tenga más de 2 decimales
    if (cleanValue.includes('.')) {
      const parts = cleanValue.split('.');
      if (parts[1] && parts[1].length > 2) {
        return false;
      }
    }
    
    return true;
  };

  // Función para extraer número de la entrada
  const extractNumber = (value: string): number => {
    const cleanValue = value.replace(/[^0-9.]/g, '');
    
    // Si está vacío, devolver 0
    if (cleanValue === '') {
      return 0;
    }
    
    // Si solo tiene un punto, devolver 0 pero permitir que se mantenga
    if (cleanValue === '.') {
      return 0;
    }
    
    const numValue = parseFloat(cleanValue);
    return isNaN(numValue) ? 0 : numValue;
  };

  // Estados para manejar valores raw de los inputs
  const [rawInputValues, setRawInputValues] = useState<{[key: string]: string}>({});

  // Función para manejar el valor del input mientras se escribe
  const handleDecimalInput = (value: string, inputId: string, setter: (value: number) => void) => {
    if (validateDecimalInput(value)) {
      // Guardar el valor raw para mostrar mientras se escribe
      setRawInputValues(prev => ({
        ...prev,
        [inputId]: value
      }));
      
      const cleanValue = value.replace(/[^0-9.]/g, '');
      
      // Si está vacío o solo tiene un punto, no actualizar el estado numérico
      if (cleanValue === '' || cleanValue === '.') {
        return;
      }
      
      const numValue = extractNumber(value);
      setter(numValue);
    }
  };

  const calculatePreciseAmounts = (items: any[], finalPrice: number) => {
    if (items.length === 0) return items;
    
    // Calcular montos para todos los items excepto el último
    let totalCalculatedAmount = 0;
    const result = [...items];
    
    for (let i = 0; i < result.length - 1; i++) {
      result[i].amount = roundToTwoDecimals((result[i].percentage / 100) * finalPrice);
      totalCalculatedAmount += result[i].amount;
    }
    
    // Para el último item, calcular el monto restante
    if (result.length > 0) {
      const lastIndex = result.length - 1;
      result[lastIndex].amount = roundToTwoDecimals(finalPrice - totalCalculatedAmount);
    }
    
    return result;
  };

  // Función auxiliar para validar porcentajes (máximo 100%)
  const validatePercentage = (value: number): number => {
    return roundPercentage(Math.min(Math.max(value, 0), 100));
  };

  const calculateSchedule = () => {
    const finalPrice = (loteData?.precio || 445000) - discountAmount;

    const newSchedule: any[] = [];

    if (paymentMethod === "credito_hipotecario") {

      // Agregar separación si está habilitada
      if (separation.enabled && separation.percentage > 0) {
        // Buscar si ya existe una separación con fecha en el schedule actual
        const existingSeparacion = schedule.find(item => item.item === "Separación");
        newSchedule.push({
          item: "Separación",
          date: existingSeparacion?.isEditedDate ? existingSeparacion.date : (existingSeparacion?.date || ""), // Preservar fecha editada
          lastValidDate: existingSeparacion?.lastValidDate,
          percentage: existingSeparacion ? existingSeparacion.percentage : separation.percentage,
          amount: existingSeparacion ? existingSeparacion.amount : separation.amount,
          isEdited: false,
        });
      }

      // Buscar o agregar inicial
      if (initial.percentage > 0) {
        // Buscar si ya existe una inicial con fecha en el schedule actual
        const existingInicial = schedule.find(item => item.item === "Inicial");
        newSchedule.push({
          item: "Inicial",
          date: existingInicial?.isEditedDate ? existingInicial.date : (existingInicial?.date || ""), // Preservar fecha editada
          lastValidDate: existingInicial?.lastValidDate,
          percentage: existingInicial ? existingInicial.percentage : initial.percentage,
          amount: existingInicial ? existingInicial.amount : initial.amount,
          isEdited: false,
        });
      }

      // Calcular porcentajes ya definidos (separación + inicial + CH)
      const definedPercentage =
        (separation.enabled ? separation.percentage : 0) + initial.percentage + mortgageCredit.percentage;

      // Calcular el porcentaje restante para las cuotas
      const remainingPercentage = 100 - definedPercentage;

      if (remainingPercentage < 0) {
        console.warn("Los porcentajes definidos exceden el 100%");
        return;
      }

      // Agregar cuotas
      if (numberOfInstallments > 0) {
        const installmentPercentage = equivalentInstallments
          ? remainingPercentage / numberOfInstallments
          : remainingPercentage / numberOfInstallments;

        for (let i = 1; i <= numberOfInstallments; i++) {
          const existing = schedule.find(s => s.item === `Cuota ${i}`);
          const installmentDate = existing?.isEditedDate ? existing.date : calculateInstallmentDate(firstPaymentDate, i);
          newSchedule.push({
            item: `Cuota ${i}`,
            date: installmentDate,
            percentage: roundPercentage(installmentPercentage),
            amount: (installmentPercentage / 100) * finalPrice,
            isEdited: false,
            isEquivalent: equivalentInstallments,
            isEditedDate: existing?.isEditedDate || false,
          });
        }
      }

      // Agregar crédito hipotecario si está definido
      if (mortgageCredit.percentage > 0) {
        const creditDate = calculateInstallmentDate(
          firstPaymentDate,
          numberOfInstallments + 1
        );
        newSchedule.push({
          item: "Crédito Hipotecario",
          date: creditDate,
          percentage: mortgageCredit.percentage,
          amount: mortgageCredit.amount,
          isEdited: false,
        });
      }
    } else if (paymentMethod === "credito_directo") {
      // Modalidad: Crédito Directo

      // Agregar separación si está habilitada
      if (separation.enabled && separation.percentage > 0) {
        // Buscar si ya existe una separación con fecha en el schedule actual
        const existingSeparacion = schedule.find(item => item.item === "Separación");
        newSchedule.push({
          item: "Separación",
          date: existingSeparacion?.date || "", // Preservar fecha existente o vacío
          percentage: separation.percentage,
          amount: separation.amount,
          isEdited: false,
        });
      }

      // Buscar o agregar inicial
      if (initial.percentage > 0) {
        // Buscar si ya existe una inicial con fecha en el schedule actual
        const existingInicial = schedule.find(item => item.item === "Inicial");
        newSchedule.push({
          item: "Inicial",
          date: existingInicial?.date || "", // Preservar fecha existente o vacío
          percentage: initial.percentage,
          amount: initial.amount,
          isEdited: false,
        });
      }

      // Calcular porcentajes ya definidos (separación + inicial)
      const definedPercentage = (separation.enabled ? separation.percentage : 0) + initial.percentage;

      // Calcular el porcentaje restante para las cuotas
      const remainingPercentage = 100 - definedPercentage;

      if (remainingPercentage < 0) {
        console.warn("Los porcentajes definidos exceden el 100%");
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
            percentage: roundPercentage(installmentPercentage),
            amount: (installmentPercentage / 100) * finalPrice,
            isEdited: false,
            isEquivalent: equivalentInstallments,
          });
        }
      }
    } else if (paymentMethod === "contado") {
      // Modalidad: Contado

      // Agregar separación si está habilitada
      if (separation.enabled && separation.percentage > 0) {
        // Buscar si ya existe una separación con fecha en el schedule actual
        const existingSeparacion = schedule.find(item => item.item === "Separación");
        newSchedule.push({
          item: "Separación",
          date: existingSeparacion?.date || "", // Preservar fecha existente o vacío
          percentage: separation.percentage,
          amount: separation.amount,
          isEdited: false,
        });
      }

      // Buscar o agregar inicial
      if (initial.percentage > 0) {
        // Buscar si ya existe una inicial con fecha en el schedule actual
        const existingInicial = schedule.find(item => item.item === "Inicial");
        newSchedule.push({
          item: "Inicial",
          date: existingInicial?.date || "", // Preservar fecha existente o vacío
          percentage: initial.percentage,
          amount: initial.amount,
          isEdited: false,
        });
      }

      // Calcular porcentaje restante para saldo final
      const usedPercentage = newSchedule.reduce((total, item) => total + item.percentage, 0);
      const remainingPercentage = 100 - usedPercentage;
      
      // Agregar pago saldo final (automático o manual)
      if (remainingPercentage > 0) {
        newSchedule.push({
          item: "Pago Saldo Final",
          date: finalBalance.date || "Inmediato",
          percentage: remainingPercentage,
          amount: (remainingPercentage / 100) * finalPrice,
          isEdited: false,
        });
      }
    }
    // Aplicar cálculo preciso de montos
    const preciseSchedule = calculatePreciseAmounts(newSchedule, finalPrice);
    setSchedule(preciseSchedule);
    setNeedsUpdate(false);

    // Actualizar fecha final calculada
    if (paymentMethod === "credito_directo" && numberOfInstallments > 0) {
      const finalDate = calculateFinalPaymentDate(
        firstPaymentDate,
        numberOfInstallments
      );
      setCalculatedFinalDate(finalDate);
    }
  };

  const calculateInstallmentDate = (
    startDate: string,
    installmentIndex: number
  ): string => {
    if (!startDate) return "";

    try {
      // Parsear fecha de inicio (formato dd/mm/aaaa)
      const parsedDate = parse(startDate, "dd/MM/yyyy", new Date());

      if (!isValid(parsedDate)) {
        console.error("Invalid start date format");
        return "";
      }

      // Agregar meses usando date-fns para manejar casos especiales
      // La primera cuota (index 1) debe usar la fecha de inicio directamente
      const installmentDate = addMonths(parsedDate, installmentIndex - 1);

      // Formatear de vuelta a dd/mm/aaaa
      return format(installmentDate, "dd/MM/yyyy");
    } catch (error) {
      console.error("Error calculating installment date:", error);
      return "";
    }
  };

  const validateStartDate = (
    dateString: string
  ): { isValid: boolean; error?: string } => {
    if (!dateString) {
      return { isValid: false, error: "Fecha de inicio requerida" };
    }

    try {
      // Intentar parsear con formato dd/mm/aaaa
      const parsedDate = parse(dateString, "dd/MM/yyyy", new Date());

      if (!isValid(parsedDate)) {
        return {
          isValid: false,
          error: "Formato de fecha inválido (dd/mm/aaaa)",
        };
      }

      const today = startOfDay(new Date());
      const currentYear = new Date().getFullYear();
      const dateYear = parsedDate.getFullYear();

      // No puede ser de un año anterior
      if (dateYear < currentYear) {
        return {
          isValid: false,
          error: "La fecha no puede ser de un año anterior",
        };
      }

      // No puede ser en el pasado (pero sí puede ser hoy)
      if (isBefore(parsedDate, today)) {
        return { isValid: false, error: "La fecha debe ser hoy o en el futuro" };
      }

      return { isValid: true };
    } catch {
      return { isValid: false, error: "Error al validar la fecha" };
    }
  };

  const calculateFinalPaymentDate = (
    startDate: string,
    numberOfInstallments: number
  ): string => {
    if (!startDate || numberOfInstallments <= 0) return "";

    try {
      const parsedDate = parse(startDate, "dd/MM/yyyy", new Date());
      if (!isValid(parsedDate)) return "";

      // La fecha final es la última cuota (número de cuotas - 1 meses después)
      const finalDate = addMonths(parsedDate, numberOfInstallments - 1);
      return format(finalDate, "dd/MM/yyyy");
    } catch (error) {
      console.error("Error calculating final payment date:", error);
      return "";
    }
  };

  const generateSchedule = () => {
    // Sincronizar estados superiores desde la tabla para Separación e Inicial
    syncSeparationAndInitialFromSchedule();
    
    // Si ya hay un cronograma y hay cuotas editadas, preservar los datos editados
    if (schedule.length > 0 && !equivalentInstallments) {
      const hasEditedCuotas = schedule.some(item => 
        item.item.startsWith("Cuota") && item.isEdited
      );
      
      if (hasEditedCuotas) {
        // Solo recalcular fechas y mantener valores editados
        const newSchedule = schedule.map((item, index) => ({
          ...item,
          date: item.isEditedDate ? item.date : calculateInstallmentDate(firstPaymentDate, index),
          lastValidDate: item.lastValidDate,
          isEquivalent: equivalentInstallments,
        }));
        setSchedule(newSchedule);
        setNeedsUpdate(false);
        return;
      }
    }
    
    // Si no hay cuotas editadas o son equivalentes, regenerar todo
    calculateSchedule();
    setNeedsUpdate(false);
  };

  const updateSchedule = () => {
    // Sincronizar estados superiores desde la tabla para Separación e Inicial
    syncSeparationAndInitialFromSchedule();
    if (equivalentInstallments) {
      // Si son equivalentes, recalcular todo
      calculateSchedule();
    } else {
      // Si no son equivalentes, mantener los valores editados y solo recalcular fechas
      const newSchedule = schedule.map((item, index) => ({
        ...item,
        date: item.isEditedDate ? item.date : calculateInstallmentDate(firstPaymentDate, index),
        lastValidDate: item.lastValidDate,
        isEquivalent: equivalentInstallments, // Actualizar propiedad isEquivalent
      }));
      setSchedule(newSchedule);
      // Los valores editados se mantienen sin recalcular
    }
    setNeedsUpdate(false);
  };

  const syncSeparationAndInitialFromSchedule = () => {
    try {
      const sep = schedule.find((s) => s.item === "Separación");
      if (sep) {
        const percentage = Math.max(0, Math.min(100, Number(sep.percentage) || 0));
        const amount = Math.max(0, Number(sep.amount) || 0);
        setSeparation({ amount, percentage, enabled: percentage > 0 });
      }

      const ini = schedule.find((s) => s.item === "Inicial");
      if (ini) {
        const percentage = Math.max(0, Math.min(100, Number(ini.percentage) || 0));
        const amount = Math.max(0, Number(ini.amount) || 0);
        setInitial({ amount, percentage });
      }
    } catch {
      // No-op: sincronización defensiva
    }
  };

  const handleFieldChange = (_field?: string) => {
    if (_field) {
      setNeedsUpdate(true);
    }
  };

  const handleInstallmentChange = (
    index: number,
    field: "percentage" | "amount",
    value: number
  ) => {
    // Si son equivalentes, solo bloquear edición en filas de Cuota; permitir Separación/Inicial
    if (equivalentInstallments && /^Cuota\s/.test(schedule[index]?.item || '')) return;

    const newSchedule = [...schedule];
    const finalPrice = (loteData?.precio || 445000) - discountAmount;

    // Validar porcentaje si es necesario
    const validatedValue = field === "percentage" ? validatePercentage(value) : value;

    // Actualizar la cuota modificada
    newSchedule[index] = {
      ...newSchedule[index],
      [field]: validatedValue,
      isEdited: true, // Marcar como editada
    };

    // Si cambió el porcentaje, calcular el monto
    if (field === "percentage") {
      newSchedule[index].amount = (validatedValue / 100) * finalPrice;
    }
    // Si cambió el monto, calcular el porcentaje
    else if (field === "amount") {
      newSchedule[index].percentage = validatePercentage((value / finalPrice) * 100);
    }

    // SIEMPRE recalcular las demás cuotas para mantener el total del 100%
    recalculateRemainingInstallments(newSchedule, finalPrice);

    setSchedule(newSchedule);
    setNeedsUpdate(true);

    // Si la fila es Separación o Inicial, sincronizar inputs superiores inmediatamente
    const editedItem = newSchedule[index];
    if (editedItem?.item === "Separación") {
      const syncPercentage = Math.max(0, Math.min(100, Number(editedItem.percentage) || 0));
      const syncAmount = Math.max(0, Number(editedItem.amount) || 0);
      setSeparation({ amount: syncAmount, percentage: syncPercentage, enabled: syncPercentage > 0 });
    } else if (editedItem?.item === "Inicial") {
      const syncPercentage = Math.max(0, Math.min(100, Number(editedItem.percentage) || 0));
      const syncAmount = Math.max(0, Number(editedItem.amount) || 0);
      setInitial({ amount: syncAmount, percentage: syncPercentage });
    }
  };

  const recalculateRemainingInstallments = (
    schedule: any[],
    finalPrice: number
  ) => {
    // Calcular el porcentaje ya ocupado por items fijos y cuotas editadas
    let usedPercentage = 0;
    
    // Sumar items fijos (separación, inicial, crédito hipotecario, etc.)
    schedule.forEach((item) => {
      if (!item.item.startsWith("Cuota")) {
        usedPercentage += item.percentage || 0;
      }
    });
    
    // Sumar cuotas editadas
    schedule.forEach((item) => {
      if (item.item.startsWith("Cuota") && item.isEdited) {
        usedPercentage += item.percentage || 0;
      }
    });
    
    // Agregar items externos que no están en el schedule
    if (mortgageCredit.percentage > 0) {
      usedPercentage += mortgageCredit.percentage;
    }
    if (finalBalance.percentage > 0) {
      usedPercentage += finalBalance.percentage;
    }
    
    // Calcular el porcentaje restante para distribuir entre cuotas no editadas
    const remainingPercentage = 100 - usedPercentage;

    // Buscar solo CUOTAS que no han sido editadas (no tocar separación, inicial, crédito hipotecario, etc.)
    const uneditedInstallments = schedule.filter((item) => 
      !item.isEdited && item.item.startsWith("Cuota")
    );

    if (uneditedInstallments.length > 0) {
      const distributionPerInstallment =
        remainingPercentage / uneditedInstallments.length;

      // Calcular montos para todas las cuotas no editadas excepto la última
      const uneditedIndices: number[] = [];
      schedule.forEach((item, index) => {
        if (!item.isEdited && item.item.startsWith("Cuota")) {
          uneditedIndices.push(index);
        }
      });

      // Calcular montos para todas las cuotas excepto la última
      let totalCalculatedAmount = 0;
      for (let i = 0; i < uneditedIndices.length - 1; i++) {
        const index = uneditedIndices[i];
        schedule[index].percentage = roundPercentage(distributionPerInstallment);
        schedule[index].amount = roundToTwoDecimals((distributionPerInstallment / 100) * finalPrice);
        totalCalculatedAmount += schedule[index].amount;
      }

      // Para la última cuota, calcular el monto restante para que la suma sea exacta
      if (uneditedIndices.length > 0) {
        const lastIndex = uneditedIndices[uneditedIndices.length - 1];
        schedule[lastIndex].percentage = roundPercentage(distributionPerInstallment);
        
        // Calcular el monto restante para que la suma total sea exacta
        const remainingAmount = roundToTwoDecimals(finalPrice - totalCalculatedAmount);
        schedule[lastIndex].amount = remainingAmount;
      }
    }
  };

  // Función removida - no se necesita recálculo automático para cuotas no equivalentes

  const handleDateChange = (value: string) => {
    // Solo guardar el valor sin formatear mientras se escribe
    setFirstPaymentDate(value);
    
    // Limpiar errores mientras se escribe
    setDateError("");
    setCalculatedFinalDate("");
    
    setNeedsUpdate(true);
  };

  const handleDateBlur = (value: string) => {
    const trimmedValue = value.trim();
    // Formatear la fecha cuando se desenfoca
    const formattedDate = formatDateInput(value);
    setFirstPaymentDate(formattedDate);
    
    // Solo validar si la fecha está completa y formateada
    if (formattedDate && formattedDate.length === 10 && formattedDate.includes("/")) {
      const validation = validateStartDate(formattedDate);
      setDateError(validation.isValid ? "" : validation.error || "");

      // Calcular fecha final automáticamente solo si es válida
      if (validation.isValid) {
        const finalDate = calculateFinalPaymentDate(
          formattedDate,
          numberOfInstallments
        );
        setCalculatedFinalDate(finalDate);

        // Recalcular fechas de cuotas si ya hay un cronograma
        if (schedule.length > 0) {
          const newSchedule = schedule.map((item, index) => ({
            ...item,
            date: calculateInstallmentDate(formattedDate, index),
          }));
          setSchedule(newSchedule);
        }
      } else {
        setCalculatedFinalDate("");
      }
    } else {
      // Si no está completa, limpiar todo y mostrar mensaje descriptivo
      if (!trimmedValue) {
        setDateError("Fecha de inicio requerida");
      } else {
        setDateError("Ingrese una fecha válida en formato dd/mm/aaaa");
      }
      setCalculatedFinalDate("");
    }
  };

  const handleWhatsAppClick = async () => {
    try {
      // Obtener un agente aleatorio desde la API
      const response = await fetch(`${BASE_API}/users/random-agent/${PROJECT_ID}`, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });

      if (!response.ok) {
        throw new Error('Error al obtener agente aleatorio');
      }

      const result = await response.json();
      
      if (!result.success || !result.data) {
        alert('No hay agentes disponibles en este momento. Por favor, intente más tarde.');
        return;
      }

      const agent = result.data;
      
      // Verificar que el agente tenga número de teléfono
      if (!agent.phone) {
        alert('El agente no tiene número de teléfono disponible.');
        return;
      }

      // Crear mensaje para WhatsApp
      const loteInfo = lotData?.lot || 'N/A';
      const agentName = agent.full_name || 'agente';
      const message = `Hola ${agentName}, me interesa obtener más información sobre el lote ${loteInfo}. Por favor, contácteme.`;
      const encodedMessage = encodeURIComponent(message);
      
      // Limpiar el número de teléfono (remover espacios, guiones, etc.)
      const cleanPhone = agent.phone.replace(/\D/g, '');
      
      // Usar el número de teléfono del agente
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
      
      // Abrir WhatsApp en una nueva ventana
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Error al obtener agente aleatorio:', error);
      alert('Error al conectar con el servicio. Por favor, intente más tarde.');
    }
  };


  // Funciones auxiliares para formatear datos
  const formatPrice = (price: string | number): string => {
    // Si es un string, intentar parsear
    const numPrice = typeof price === 'string' 
      ? parseFloat(price.replace(/[^0-9.-]/g, ''))
      : price;
    
    if (isNaN(numPrice)) return '$0.00';
    
    // Formatear con comas para miles y punto decimal
    const formatted = numPrice.toFixed(2);
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `$${parts.join('.')}`;
  };

  const formatPhone = (phone: string, countryCode: string = '+51'): string => {
    if (!phone) return '';
    // Remover caracteres no numéricos (el phone ya viene con el formato desde el ContactModal)
    // Si viene con espacios, mantenerlo, si no, formatearlo
    if (phone.includes(' ')) {
      // Ya está formateado con espacios
      return `${countryCode} ${phone}`;
    }
    // Formatear si es necesario
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 9) {
      const number = digits.slice(0, 9);
      const formatted = `${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}`;
      return `${countryCode} ${formatted}`;
    }
    return phone;
  };

  const formatClientName = (cliente: any): string => {
    const nombre = cliente?.nombre || '';
    const apellido = cliente?.apellido || '';
    return `${nombre} ${apellido}`.trim();
  };

  const formatClientDocument = (cliente: any): string => {
    const type = cliente?.tipoDocumento || '';
    const number = cliente?.dni || '';
    if (!type && !number) return '';
    if (!type) return number;
    if (!number) return type;
    return `${type}: ${number}`;
  };

  const formatAmount = (amount: number): string => {
    const formatted = amount.toFixed(2);
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `$${parts.join('.')}`;
  };

  // Función para generar PDF mejorado que se parezca al HTML de impresión
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const generatePDFWithText = async (contactData: any): Promise<Blob> => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 20;

    // Configuración de colores (similar al HTML)
    const colors = {
      primary: '#2d2d2d',
      secondary: '#444',
      text: '#333',
      lightGray: '#666',
      background: '#ffffff',
      border: '#ddd',
      totalBg: '#e8f5e8'
    };

    // Header con fondo azul del tamaño del logo + padding
    const headerPadding = 5; // 0.5rem en mm
    const targetLogoHeight = 15; // 2rem ≈ 20 mm
    let headerHeight = headerPadding * 2 + 20;
    try {
      const logoImage = await loadImage('/images/logo_mikonos.png');
      const aspectRatio = logoImage.width / (logoImage.height || 1) || 1;
      const logoHeight = targetLogoHeight;
      const logoWidth = logoHeight * aspectRatio;
      headerHeight = logoHeight + headerPadding * 2;
      const headerWidth = logoWidth + headerPadding * 2;
      const headerX = (pageWidth - headerWidth) / 2;
      const headerY = 0;
      const cornerRadius = 6;
      pdf.setFillColor('#1C284C');
      pdf.roundedRect(headerX, headerY, headerWidth, headerHeight, cornerRadius, cornerRadius, 'F');
      // Cubrir la parte superior para que quede plana
      pdf.rect(headerX, headerY, headerWidth, cornerRadius, 'F');
      // Cubrir borde superior para que quede recto
      pdf.setFillColor('#1C284C');
      pdf.rect(headerX, headerY, headerWidth, cornerRadius, 'F');
      pdf.setDrawColor(colors.border);
      const logoX = headerX + headerPadding;
      const logoY = headerY + headerPadding;
      pdf.addImage(logoImage, 'PNG', logoX, logoY, logoWidth, logoHeight);
      yPosition = headerY + headerHeight + 15;
    } catch (logoError) {
      console.warn('No se pudo cargar el logo para el PDF:', logoError);
      const fallbackWidth = 70;
      const fallbackHeight = 25;
      const headerX = (pageWidth - fallbackWidth) / 2;
      const headerY = 0;
      pdf.setFillColor('#1C284C');
      pdf.rect(headerX, headerY, fallbackWidth, fallbackHeight, 'F');
      yPosition = headerY + fallbackHeight + 15;
    }

    // Título principal (como el header del HTML)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(colors.primary);
    pdf.text('Cotización de Lote', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;

    pdf.setDrawColor(colors.border);
    pdf.setLineWidth(0.3);
    pdf.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 8;

    const lotDetails = [
      { label: 'Lote:', value: lotData.lot || '—' },
      { label: 'Etapa:', value: lotData.phase ? `Etapa ${lotData.phase}` : '—' },
      { label: 'Área:', value: lotData.area || '—' },
      { label: 'Precio:', value: formatPrice(lotData.price) },
      { label: 'Fecha de cotización:', value: new Date().toLocaleDateString() }
    ];

    const contactDetails = [
      { label: 'Cliente:', value: formatClientName(contactData.cliente) || '—' },
      { label: 'Documento:', value: formatClientDocument(contactData.cliente) || '—' },
      { label: 'Email cliente:', value: contactData.cliente?.email || '—' },
      { 
        label: 'Celular cliente:', 
        value: contactData.cliente?.telefono 
          ? formatPhone(contactData.cliente.telefono, contactData.cliente?.codigoPais || '+51') 
          : '—' 
      }
    ];

    if (userState) {
      contactDetails.push(
        { label: 'Vendedor:', value: contactData.vendedor?.full_name || '—' },
        { label: 'Email vendedor:', value: contactData.vendedor?.email || '—' }
      );
    }

    const blockX = 20;
    const blockWidth = pageWidth - 40;
    const columnGap = 12;
    const columnWidth = (blockWidth - columnGap) / 2;
    const rightColumnX = blockX + columnWidth + columnGap;
    const labelWidth = 35;
    const valueMaxWidth = columnWidth - labelWidth + 25;
    const leftValueStartX = blockX + labelWidth + 2;
    const rightValueStartX = rightColumnX + labelWidth + 2;
    const baseLineSpacing = 4.5;
    const rows = Math.max(lotDetails.length, contactDetails.length);

    type RowLayout = {
      leftRow?: { label: string; value: string };
      rightRow?: { label: string; value: string };
      leftLines: string[];
      rightLines: string[];
      rowHeight: number;
    };

    const rowLayouts: RowLayout[] = [];
    let blockHeight = 18;

    for (let i = 0; i < rows; i++) {
      const leftRow = lotDetails[i];
      const rightRow = contactDetails[i];

      const leftLines = leftRow
        ? (pdf.splitTextToSize(String(leftRow.value), valueMaxWidth) as string[])
        : [];
      const rightLines = rightRow
        ? (pdf.splitTextToSize(String(rightRow.value), valueMaxWidth) as string[])
        : [];

      const leftHeight = leftLines.length ? leftLines.length * baseLineSpacing : baseLineSpacing;
      const rightHeight = rightLines.length ? rightLines.length * baseLineSpacing : baseLineSpacing;
      const rowHeight = Math.max(leftHeight, rightHeight) + 2;
      blockHeight += rowHeight;

      rowLayouts.push({
        leftRow,
        rightRow,
        leftLines,
        rightLines,
        rowHeight,
      });
    }

    pdf.setFillColor('#f9f9f9');
    pdf.roundedRect(blockX - 2, yPosition - 6, blockWidth + 4, blockHeight, 6, 6, 'F');

    let currentY = yPosition + 4;

    // Títulos de columna
    //pdf.setFont('helvetica', 'bold');
    //pdf.setFontSize(11);
    //pdf.setTextColor(colors.secondary);
    //pdf.text('Información del Lote', blockX, currentY);
    //pdf.text('Datos de Contacto', rightColumnX, currentY);
    //currentY += 6;

    // Contenido
    rowLayouts.forEach(({ leftRow, rightRow, leftLines, rightLines, rowHeight }) => {
      const rowY = currentY;

      if (leftRow) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(colors.lightGray);
        pdf.text(leftRow.label, blockX, rowY);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(colors.text);
        leftLines.forEach((line, idx) => {
          const lineY = rowY + idx * baseLineSpacing;
          pdf.text(line, leftValueStartX, lineY, { maxWidth: valueMaxWidth });
        });
      }

      if (rightRow) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(colors.lightGray);
        pdf.text(rightRow.label, rightColumnX, rowY);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(colors.text);
        rightLines.forEach((line, idx) => {
          const lineY = rowY + idx * baseLineSpacing;
          pdf.text(line, rightValueStartX, lineY, { maxWidth: valueMaxWidth });
        });
      }

      currentY += rowHeight;
    });

    yPosition += blockHeight + 10;

    // Cronograma de pagos (como schedule-table)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(colors.secondary);
    pdf.text('Cronograma de Pago', 20, yPosition);
    yPosition += 5;

    // Línea separadora
    pdf.setDrawColor(colors.border);
    pdf.setLineWidth(0.3);
    pdf.line(20, yPosition, pageWidth - 20, yPosition);
    yPosition += 12;

    const tableX = 20;
    const tableWidth = pageWidth - 40;
    const columnWidths = {
      cuota: tableWidth * 0.15,        // ~25.5mm
      fecha: tableWidth * 0.5,         // ~85mm
      porcentaje: tableWidth * 0.175,  // ~29.75mm
      monto: tableWidth * 0.175        // ~29.75mm
    };
    const columnCenters = {
      cuota: tableX + columnWidths.cuota / 2,
      fecha: tableX + columnWidths.cuota + columnWidths.fecha / 2,
      porcentaje: tableX + columnWidths.cuota + columnWidths.fecha + columnWidths.porcentaje / 2,
      monto: tableX + columnWidths.cuota + columnWidths.fecha + columnWidths.porcentaje + columnWidths.monto - 2
    };

    // Encabezados de la tabla (como schedule-table th)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(colors.text);
    
    // Fondo blanco para encabezados
    pdf.setFillColor('#ffffff');
    pdf.rect(20, yPosition - 6, pageWidth - 40, 8, 'F');
    
    // Borde de tabla para encabezados
    pdf.setDrawColor(colors.border);
    pdf.setLineWidth(0.5);
    pdf.rect(20, yPosition - 6, pageWidth - 40, 8);
    
    pdf.text('Concepto', columnCenters.cuota, yPosition, { align: 'center' });
    pdf.text('Fecha de Vencimiento', columnCenters.fecha, yPosition, { align: 'center' });
    pdf.text('Porcentaje', columnCenters.porcentaje, yPosition, { align: 'center' });
    pdf.text('Monto', columnCenters.monto, yPosition, { align: 'right' });
    yPosition += 6;

    // Filas de datos (como schedule-table td)
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    
    let totalAmount = 0;
    schedule.forEach((item) => {
      // Verificar si necesitamos nueva página
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }

      // Bordes de celda
      pdf.setDrawColor(colors.border);
      pdf.setLineWidth(0.5);
      pdf.rect(20, yPosition - 4, pageWidth - 40, 6);

      pdf.setTextColor(colors.text);
      pdf.text(item.item, columnCenters.cuota, yPosition, { align: 'center' });
      pdf.text(item.date, columnCenters.fecha, yPosition, { align: 'center' });
      pdf.text(`${item.percentage.toFixed(2)}%`, columnCenters.porcentaje, yPosition, { align: 'center' });
      pdf.text(formatAmount(item.amount), columnCenters.monto, yPosition, { align: 'right' });
      yPosition += 6;
      totalAmount += item.amount || 0;
    });

    // Fila total (como total-row)
    yPosition += 0;
    pdf.setFillColor(colors.totalBg);
    pdf.rect(20, yPosition - 4, pageWidth - 40, 8, 'F');
    
    pdf.setDrawColor(colors.border);
    pdf.setLineWidth(0.5);
    pdf.rect(20, yPosition - 4, pageWidth - 40, 8);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(colors.text);
    pdf.text('TOTAL', columnCenters.cuota, yPosition + 2, { align: 'center' });
    pdf.text('100%', columnCenters.porcentaje, yPosition + 2, { align: 'center' });
    pdf.text(formatAmount(totalAmount), columnCenters.monto, yPosition + 2, { align: 'right' });

    // Nota de vigencia
    if (contactData?.validity?.days) {
      yPosition -= 0;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(colors.text);
      pdf.text(`El presente cronograma es válido por ${contactData.validity.days} días`, pageWidth / 2, yPosition + 12, { align: 'center' });
      yPosition += 15;
    }

    // Sección de Notas
    yPosition += 10;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(colors.secondary);
    pdf.text('Notas', 20, yPosition);
    yPosition += 8;

    // Cuadro de notas
    const notesBoxWidth = pageWidth - 40;
    const notesBoxX = 20;
    const notesBoxY = yPosition;
    
    // Calcular altura del cuadro según el contenido
    let notesBoxHeight = 20; // Altura mínima
    if (quotationNotes) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      const notesLines = pdf.splitTextToSize(quotationNotes, notesBoxWidth - 8) as string[];
      notesBoxHeight = Math.max(20, notesLines.length * 4.5 + 8);
    }

    // Dibujar el cuadro
    pdf.setDrawColor(colors.border);
    pdf.setLineWidth(0.5);
    pdf.setFillColor('#ffffff');
    pdf.roundedRect(notesBoxX, notesBoxY, notesBoxWidth, notesBoxHeight, 4, 4, 'FD');

    // Texto de las notas dentro del cuadro
    if (quotationNotes) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(colors.text);
      const notesLines = pdf.splitTextToSize(quotationNotes, notesBoxWidth - 8) as string[];
      notesLines.forEach((line, idx) => {
        pdf.text(line, notesBoxX + 4, notesBoxY + 6 + (idx * 4.5));
      });
    }

    return pdf.output('blob');
  };

  // Función unificada para generar documento (PDF o HTML) con formato estándar
  const generateDocument = async (contactData: any, format: 'pdf' | 'html' = 'pdf'): Promise<Blob> => {
    try {
      if (format === 'html') {
        // Para HTML, usar el contenido directo (como antes)
        const printContent = generatePrintContent(contactData);
        const htmlBlob = new Blob([printContent], { type: 'text/html' });
        return htmlBlob;
      }

      // Para PDF, usar jsPDF directamente con texto
      return await generatePDFWithText(contactData);

    } catch (error) {
      console.error('Error generando documento:', error);
      throw error;
    }
  };

  // Función para capturar todos los datos actuales del estado
  const captureCurrentData = (contactData: any) => {
    return {
      cliente: {
        nombre: contactData.cliente?.nombre || '',
        apellido: contactData.cliente?.apellido || '',
        tipoDocumento: contactData.cliente?.tipoDocumento || '',
        dni: contactData.cliente?.dni || '',
        email: contactData.cliente?.email || '',
        telefono: contactData.cliente?.telefono || '',
        codigoPais: contactData.cliente?.codigoPais || '',
      },
      vendedor: {
        id: contactData.vendedor?.id || '',
        full_name: contactData.vendedor?.full_name || '',
        email: contactData.vendedor?.email || '',
      },
      validity: {
        days: contactData.validity?.days || 0,
      },
      schedule: schedule.map(item => ({
        item: item.item || '',
        date: item.date || '',
        percentage: item.percentage || 0,
        amount: item.amount || 0,
      })),
      discount: {
        amount: discountAmount,
        percentage: discountPercentage,
      },
      paymentMethod,
      separation: {
        amount: separation.amount,
        percentage: separation.percentage,
        enabled: separation.enabled,
      },
      initial: {
        amount: initial.amount,
        percentage: initial.percentage,
      },
      mortgageCredit: {
        amount: mortgageCredit.amount,
        percentage: mortgageCredit.percentage,
      },
      finalBalance: {
        amount: finalBalance.amount,
        percentage: finalBalance.percentage,
        date: finalBalance.date,
      },
      numberOfInstallments,
      equivalentInstallments,
      firstPaymentDate,
    };
  };

  // Función para comparar dos objetos de datos
  const compareData = (data1: any, data2: any): boolean => {
    if (!data1 || !data2) return false;
    
    // Comparar cliente
    const cliente1 = data1.cliente || {};
    const cliente2 = data2.cliente || {};
    if (
      cliente1.nombre !== cliente2.nombre ||
      cliente1.apellido !== cliente2.apellido ||
      cliente1.tipoDocumento !== cliente2.tipoDocumento ||
      cliente1.dni !== cliente2.dni ||
      cliente1.email !== cliente2.email ||
      cliente1.telefono !== cliente2.telefono ||
      cliente1.codigoPais !== cliente2.codigoPais
    ) {
      return false;
    }

    // Comparar vendedor
    const vendedor1 = data1.vendedor || {};
    const vendedor2 = data2.vendedor || {};
    if (
      vendedor1.id !== vendedor2.id ||
      vendedor1.full_name !== vendedor2.full_name ||
      vendedor1.email !== vendedor2.email
    ) {
      return false;
    }

    // Comparar vigencia
    const validity1 = data1.validity || {};
    const validity2 = data2.validity || {};
    if (validity1.days !== validity2.days) {
      return false;
    }

    // Comparar cronograma
    const schedule1 = data1.schedule || [];
    const schedule2 = data2.schedule || [];
    if (schedule1.length !== schedule2.length) {
      return false;
    }
    for (let i = 0; i < schedule1.length; i++) {
      const item1 = schedule1[i];
      const item2 = schedule2[i];
      if (
        item1.item !== item2.item ||
        item1.date !== item2.date ||
        Math.abs((item1.percentage || 0) - (item2.percentage || 0)) > 0.01 ||
        Math.abs((item1.amount || 0) - (item2.amount || 0)) > 0.01
      ) {
        return false;
      }
    }

    // Comparar descuento
    const discount1 = data1.discount || {};
    const discount2 = data2.discount || {};
    if (
      Math.abs((discount1.amount || 0) - (discount2.amount || 0)) > 0.01 ||
      Math.abs((discount1.percentage || 0) - (discount2.percentage || 0)) > 0.01
    ) {
      return false;
    }

    // Comparar método de pago
    if (data1.paymentMethod !== data2.paymentMethod) {
      return false;
    }

    // Comparar separación
    const separation1 = data1.separation || {};
    const separation2 = data2.separation || {};
    if (
      Math.abs((separation1.amount || 0) - (separation2.amount || 0)) > 0.01 ||
      Math.abs((separation1.percentage || 0) - (separation2.percentage || 0)) > 0.01 ||
      separation1.enabled !== separation2.enabled
    ) {
      return false;
    }

    // Comparar inicial
    const initial1 = data1.initial || {};
    const initial2 = data2.initial || {};
    if (
      Math.abs((initial1.amount || 0) - (initial2.amount || 0)) > 0.01 ||
      Math.abs((initial1.percentage || 0) - (initial2.percentage || 0)) > 0.01
    ) {
      return false;
    }

    // Comparar crédito hipotecario
    const mortgageCredit1 = data1.mortgageCredit || {};
    const mortgageCredit2 = data2.mortgageCredit || {};
    if (
      Math.abs((mortgageCredit1.amount || 0) - (mortgageCredit2.amount || 0)) > 0.01 ||
      Math.abs((mortgageCredit1.percentage || 0) - (mortgageCredit2.percentage || 0)) > 0.01
    ) {
      return false;
    }

    // Comparar saldo final
    const finalBalance1 = data1.finalBalance || {};
    const finalBalance2 = data2.finalBalance || {};
    if (
      Math.abs((finalBalance1.amount || 0) - (finalBalance2.amount || 0)) > 0.01 ||
      Math.abs((finalBalance1.percentage || 0) - (finalBalance2.percentage || 0)) > 0.01 ||
      finalBalance1.date !== finalBalance2.date
    ) {
      return false;
    }

    // Comparar número de cuotas y otras configuraciones
    if (
      data1.numberOfInstallments !== data2.numberOfInstallments ||
      data1.equivalentInstallments !== data2.equivalentInstallments ||
      data1.firstPaymentDate !== data2.firstPaymentDate
    ) {
      return false;
    }

    return true;
  };

  // Función para guardar cotización en la API
  const saveQuotationToAPI = async (contactData: any, quotationCode?: string) => {
      try {
      // Generar el PDF real usando el formato estándar
      const pdfBlob = await generateDocument(contactData, 'pdf');
      const finalFileName = getFileName(contactData, 'Cronograma', 'pdf', quotationCode);
      
      // Obtener el agente actual (vendedor logueado)
      const currentAgent = userState;
      const agentId = currentAgent?.id || '68f5db6bd9c0deedd190e4ce'; // ID por defecto
      
      // Preparar los datos del formulario
      const formData = new FormData();
      
      // Generar código único para la cotización si no se proporciona
      const code = quotationCode || generateQuotationCode();
      
      formData.append('code', code);
      formData.append('client', contactData.cliente?.nombre || '');
      formData.append('email', contactData.cliente?.email || '');
      formData.append('phone', contactData.cliente?.telefono || '');
      formData.append('identification_number', contactData.cliente?.dni || '');
      formData.append('lot_id', LOT_ID);
      // Asegurar que agreed_price sea un número válido
      const agreedPrice = loteData?.precio || 445000;
      const validAgreedPrice = typeof agreedPrice === 'number' ? agreedPrice : parseFloat(agreedPrice) || 445000;
      
      // Asegurar que discount sea un número válido
      const validDiscount = typeof discountPercentage === 'number' ? discountPercentage : parseFloat(discountPercentage) || 0;
      
      formData.append('agreed_price', validAgreedPrice.toString());
      formData.append('discount', validDiscount.toString());
      formData.append('project_id', PROJECT_ID);
      formData.append('agent_id', agentId);
      // Vigencia en días para la cotización
      if (contactData?.validity?.days) {
        formData.append('validity_days', String(contactData.validity.days));
      }
      formData.append('pdf_file', pdfBlob, finalFileName);

      // Verificar que todos los campos requeridos estén presentes
      const requiredFields = {
        code: code,
        client: contactData.cliente?.nombre || '',
        email: contactData.cliente?.email || '',
        phone: contactData.cliente?.telefono || '',
        identification_number: contactData.cliente?.dni || '',
        lot_id: LOT_ID,
        agreed_price: (loteData?.precio || 445000).toString(),
        discount: discountPercentage.toString(),
        project_id: PROJECT_ID,
        agent_id: agentId
      };

      if (Object.values(requiredFields).some(value => !value)) {
        throw new Error('Todos los campos requeridos deben estar presentes');
      }

      // Obtener token de autenticación
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('No hay token de autenticación. Por favor, inicie sesión nuevamente.');
      }
      
      // Preparar datos para console.log (FormData no es legible directamente)
      const dataToSend = {
        code: code,
        client: contactData.cliente?.nombre || '',
        email: contactData.cliente?.email || '',
        phone: contactData.cliente?.telefono || '',
        identification_number: contactData.cliente?.dni || '',
        lot_id: LOT_ID,
        agreed_price: validAgreedPrice,
        discount: validDiscount,
        project_id: PROJECT_ID,
        agent_id: agentId,
        validity_days: contactData?.validity?.days || 0,
        pdf_file: {
          name: finalFileName,
          type: pdfBlob?.type,
          size: pdfBlob?.size,
        },
      };

      // Mostrar todos los datos que se envían al dashboard
      console.log('========================================');
      console.log('DATOS ENVIADOS AL DASHBOARD (COTIZACIÓN)');
      console.log('========================================');
      console.log('Endpoint:', `${BASE_API}/quotations`);
      console.log('Método:', 'POST');
      console.log('Datos enviados:', JSON.stringify(dataToSend, null, 2));
      console.log('----------------------------------------');
      console.log('Detalles de los datos:');
      console.log('- Código de cotización:', dataToSend.code);
      console.log('- Cliente:', dataToSend.client);
      console.log('- Email:', dataToSend.email);
      console.log('- Teléfono:', dataToSend.phone);
      console.log('- Número de documento:', dataToSend.identification_number);
      console.log('- ID del lote:', dataToSend.lot_id);
      console.log('- Precio acordado:', dataToSend.agreed_price);
      console.log('- Descuento:', dataToSend.discount);
      console.log('- ID del proyecto:', dataToSend.project_id);
      console.log('- ID del agente:', dataToSend.agent_id);
      console.log('- Vigencia (días):', dataToSend.validity_days);
      console.log('- Archivo PDF:', dataToSend.pdf_file.name, `(${dataToSend.pdf_file.size} bytes)`);
      console.log('========================================');
      
      // Enviar a la API
      const response = await fetch(`${BASE_API}/quotations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        return result;
      } else {
        const errorData = await response.json();
        console.error('Error al guardar cotización:', errorData);
        console.error('Detalles del error:', errorData.detail);
        
        // Mostrar errores específicos de validación
        let errorMessage = 'Error al guardar la cotización.';
        if (errorData.detail && Array.isArray(errorData.detail)) {
          errorMessage += '\n\nErrores de validación:\n' + errorData.detail.map((err: any) => 
            `- ${err.loc ? err.loc.join('.') : 'Campo'}: ${err.msg || err.message || 'Error desconocido'}`
          ).join('\n');
        } else if (errorData.message) {
          errorMessage += `\n\n${errorData.message}`;
        }
        
        alert(errorMessage);
        throw new Error(`Error ${response.status}: ${errorData.message || response.statusText}`);
      }
    } catch (error) {
      console.error('Error al guardar cotización:', error);
      alert('Error al guardar la cotización. Por favor, intente nuevamente.');
      throw error;
    }
  };

  const handleQuotationClick = () => {
    if (isAnimating) return; // Prevent multiple clicks during animation

    setIsAnimating(true);

    // First apply the rotation (add flip class)
    const modal = document.querySelector(".lot-modal");
    if (modal) {
      modal.classList.add("flip");

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
    const modal = document.querySelector(".lot-modal");
    if (modal) {
      modal.classList.remove("flip");

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

  const handleClearSchedule = () => {
    
    // Resetear todos los estados del cronograma
    setSeparation({ amount: 0, percentage: 0, enabled: false });
    setInitial({ amount: 0, percentage: 0 });
    setMortgageCredit({ amount: 0, percentage: 0 });
    setFinalBalance({ amount: 0, percentage: 0, date: "" });
    setNumberOfInstallments(0);
    setEquivalentInstallments(true);
    setFirstPaymentDate("");
    setSchedule([]);
    setNeedsUpdate(false);
    setDateError("");
    setCalculatedFinalDate("");
    
  };

  // Funciones para los botones de funcionalidades
  const handlePrint = () => {
    // Generar o reutilizar código de cotización
    const code = (hasBeenSaved && lastSavedData?.quotationCode) 
      ? lastSavedData.quotationCode 
      : generateQuotationCode();
    setQuotationCodeForModal(code);
    setModalType("print");
    setShowContactModal(true);
  };

  const handleSave = () => {
    // Generar o reutilizar código de cotización
    const code = (hasBeenSaved && lastSavedData?.quotationCode) 
      ? lastSavedData.quotationCode 
      : generateQuotationCode();
    setQuotationCodeForModal(code);
    setModalType("save");
    setShowContactModal(true);
  };

  const handleEmail = () => {
    // Generar o reutilizar código de cotización
    const code = (hasBeenSaved && lastSavedData?.quotationCode) 
      ? lastSavedData.quotationCode 
      : generateQuotationCode();
    setQuotationCodeForModal(code);
    setModalType("email");
    setShowContactModal(true);
  };

  const generatePrintContent = (contactData: any) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cotización de Lote</title>
        <style>
          body { 
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            padding-top: 0;
            color: #333;
          }
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .logo-wrapper {
              background-color: #1C284C !important;
              border: none !important;
              box-shadow: none !important;
            }
          }
          .pdf-header {
            display: flex;
            justify-content: center;
            margin-bottom: 24px;
          }
          .logo-wrapper {
            background: #1C284C;
            padding: 16px;
            border-radius: 0 0 8px 8px;
            border: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-shadow: none;
          }
          .logo-wrapper img {
            height: 48px;
            width: auto;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px;
          }
          .header h1 { 
            color: #2d2d2d; 
            margin: 0; 
            font-size: 24px;
          }
          .info-section { 
            margin-bottom: 30px; 
          }
          .info-section h2 { 
            color: #444; 
            border-bottom: 1px solid #ccc; 
            padding-bottom: 10px;
          }
          .info-block {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 24px;
            background: #f9f9f9;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 24px;
          }
          .info-column h3 {
            margin: 0 0 12px 0;
            font-size: 16px;
            color: #2d2d2d;
          }
          .info-row {
            display: flex;
            justify-content: flex-start;
            gap: 4px;
            margin-bottom: 6px;
            font-size: 12px;
            line-height: 1.2;
            align-items: flex-start;
          }
          .info-row:last-child {
            margin-bottom: 0;
          }
          .info-label { 
            font-weight: 600; 
            color: #555; 
            min-width: 90px;
            margin-right: 2px;
          }
          .info-value {
            color: #111;
            font-weight: 500;
            text-align: left;
            flex: 1;
            word-break: break-word;
            line-height: 1.3;
          }
          .schedule-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 20px;
          }
          .schedule-table th, .schedule-table td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left;
          }
          .schedule-table th { 
            background: #f0f0f0; 
            font-weight: bold;
          }
          .schedule-table tr:nth-child(even) { 
            background: #f9f9f9;
          }
          .total-row { 
            background: #e8f5e8 !important; 
            font-weight: bold;
          }
          .notes-section {
            margin-top: 30px;
            margin-bottom: 20px;
          }
          .notes-title {
            font-size: 12px;
            font-weight: bold;
            color: #444;
            margin-bottom: 8px;
          }
          .notes-box {
            width: 100%;
            min-height: 50px;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 8px;
            background: #ffffff;
            font-size: 10px;
            color: #333;
            box-sizing: border-box;
          }
          .footer { 
            margin-top: 40px; 
            text-align: center; 
            color: #666; 
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="pdf-header">
          <div class="logo-wrapper">
            <img src="/images/logo_mikonos.png" alt="Mikonos" />
          </div>
        </div>
        <div class="header">
          <h1>Cotización de Lote</h1>
        </div>
        
        <div class="info-section">
          <div class="info-block">
            <div class="info-column">
              <div class="info-row">
                <span class="info-label">Lote:</span>
                <span class="info-value">${lotData.lot || '—'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Etapa:</span>
                <span class="info-value">${lotData.phase ? `Etapa ${lotData.phase}` : '—'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Área:</span>
                <span class="info-value">${lotData.area || '—'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Precio:</span>
                <span class="info-value">${formatPrice(lotData.price)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Fecha de cotización:</span>
                <span class="info-value">${new Date().toLocaleDateString()}</span>
              </div>
            </div>
            <div class="info-column">
              <div class="info-row">
                <span class="info-label">Cliente:</span>
                <span class="info-value">${formatClientName(contactData.cliente) || '—'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Documento:</span>
                <span class="info-value">${formatClientDocument(contactData.cliente) || '—'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Email cliente:</span>
                <span class="info-value">${contactData.cliente?.email || '—'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Celular cliente:</span>
                <span class="info-value">${contactData.cliente?.telefono ? `${formatPhone(contactData.cliente.telefono, contactData.cliente?.codigoPais || '+51')}` : '—'}</span>
              </div>
              ${userState ? `
              <div class="info-row">
                <span class="info-label">Vendedor:</span>
                <span class="info-value">${contactData.vendedor?.full_name || '—'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Email vendedor:</span>
                <span class="info-value">${contactData.vendedor?.email || '—'}</span>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
        
        <div class="info-section">
          <h2>Cronograma de Pago</h2>
          <table class="schedule-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Fecha de Vencimiento</th>
                <th>Porcentaje</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              ${schedule.map(item => `
                <tr>
                  <td>${item.item}</td>
                  <td>${item.date}</td>
                  <td>${item.percentage.toFixed(2)}%</td>
                  <td>${formatAmount(item.amount)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td><strong>TOTAL</strong></td>
                <td></td>
                <td><strong>100%</strong></td>
                <td><strong>${formatAmount(schedule.reduce((sum, item) => sum + (item.amount || 0), 0))}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        
        ${contactData?.validity?.days ? `
        <div class="info-section" style="text-align: center;">
          <p>El presente cronograma es válido por ${contactData.validity.days} días.</p>
        </div>
        ` : ''}
        
        <div class="notes-section">
          <div class="notes-title">Notas</div>
          <div class="notes-box">${quotationNotes || ''}</div>
        </div>
      
      </body>
      </html>
    `;
  };

  // Función generatePDF eliminada - ahora todos usan generatePrintContent

  const openPrintDialog = (contactData: any) => {
    // Crear una ventana nueva con los datos de la cotización
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (printWindow) {
      const printContent = generatePrintContent(contactData);
      
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // Esperar a que se cargue el contenido y luego imprimir
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      };
    }
  };

  // Función auxiliar para generar código de cotización
  const generateQuotationCode = () => {
    return `COT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
  };

  // Función auxiliar para obtener el nombre del archivo
  const getFileName = (contactData: any, defaultPrefix: string, extension: string, quotationCode?: string) => {
    // Si hay nombre personalizado, usarlo
    if (contactData.fileName && contactData.fileName.trim()) {
      // Limpiar el nombre del archivo para remover caracteres no válidos y añadir extensión
      const cleanedName = contactData.fileName.trim().replace(/[<>:"/\\|?*]/g, '_');
      return `${cleanedName}.${extension}`;
    }
    // Si hay código de cotización, usarlo como nombre
    if (quotationCode) {
      return `${quotationCode}.${extension}`;
    }
    // Si no hay nombre personalizado ni código, usar el nombre por defecto
    return `${defaultPrefix}_${lotData.lot}_${new Date().toISOString().split('T')[0]}.${extension}`;
  };

  const handleContactSubmit = async (contactData: any) => {
    // Determinar si el usuario está logueado (agente comercial)
    const isLoggedIn = !!userState;
    
    // Capturar datos actuales
    const currentData = captureCurrentData(contactData);
    
    // Verificar si los datos han cambiado
    const dataHasChanged = !hasBeenSaved || !compareData(currentData, lastSavedData);
    
    // Generar código de cotización (se usará como nombre de archivo siempre)
    // Prioridad: 1) código del modal, 2) código guardado si no hay cambios, 3) generar nuevo
    let quotationCode: string | undefined = undefined;
    if (quotationCodeForModal) {
      quotationCode = quotationCodeForModal;
    } else if (hasBeenSaved && !dataHasChanged && lastSavedData?.quotationCode) {
      quotationCode = lastSavedData.quotationCode;
    } else {
      quotationCode = generateQuotationCode();
    }
    
    // Si está logueado, verificar si debe guardar
    let shouldSave = false;
    if (isLoggedIn) {
      if (dataHasChanged) {
        // Hay cambios, debe guardar
        shouldSave = true;
      } else if (hasBeenSaved) {
        // No hay cambios y ya se guardó antes, mostrar aviso
        alert(`Este documento ya fue guardado anteriormente. No se guardará nuevamente en el dashboard.`);
        shouldSave = false;
      } else {
        // Primera vez, debe guardar
        shouldSave = true;
      }
    }
    
    switch (modalType) {
      case "print": {
        // Si debe guardar, guardar en BD antes de imprimir
        if (shouldSave) {
          try {
            await saveQuotationToAPI(contactData, quotationCode);
            // Marcar como guardado y guardar los datos (incluyendo el código)
            setHasBeenSaved(true);
            setLastSavedData({ ...currentData, quotationCode });
          } catch (error) {
            console.error('Error al guardar cotización en BD:', error);
            // Continuar con la impresión aunque falle el guardado
          }
        }
        
        // Abrir diálogo de impresión con datos de la cotización
        openPrintDialog(contactData);
        break;
      }
        
      case "save": {
        try {
          // Si debe guardar, guardar en BD
          if (shouldSave) {
            await saveQuotationToAPI(contactData, quotationCode);
            // Marcar como guardado y guardar los datos (incluyendo el código)
            setHasBeenSaved(true);
            setLastSavedData({ ...currentData, quotationCode });
          }
          
          // Generar y descargar el PDF
          const pdfBlob = await generateDocument(contactData, 'pdf');
          const url = URL.createObjectURL(pdfBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = getFileName(contactData, 'Cronograma', 'pdf', quotationCode);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Error al procesar cotización:', error);
          // Aún así, permitir descarga local del PDF
          try {
            const pdfBlob = await generateDocument(contactData, 'pdf');
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = getFileName(contactData, 'Cronograma', 'pdf', quotationCode);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          } catch (pdfError) {
            console.error('Error generando PDF local:', pdfError);
            // Fallback a HTML si falla la generación de PDF
            const printContent = generatePrintContent(contactData);
            const blob = new Blob([printContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = getFileName(contactData, 'Cronograma', 'html', quotationCode);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        }
        break;
      }
        
      case "email": {
        if (shouldSave) {
          try {
            await saveQuotationToAPI(contactData, quotationCode);
            // Marcar como guardado y guardar los datos (incluyendo el código)
            setHasBeenSaved(true);
            setLastSavedData({ ...currentData, quotationCode });
          } catch (error) {
            console.error('Error al guardar cotización en BD:', error);
            // Continuar con el flujo aunque falle el guardado
          }
        }

        alert('Enviado con éxito');
        break;
      }
    }
  };

  useEffect(() => {
    // Resetear estados de guardado cuando cambia el lote o se cierra el modal
    setHasBeenSaved(false);
    setLastSavedData(null);
    setQuotationCodeForModal(undefined);
  }, [isVisible, loteData]);

  // Asegurar que el modal tenga display: none cuando no es visible (especialmente para Firefox)
  useEffect(() => {
    const modalElement = document.getElementById("modalOverlay");
    if (modalElement) {
      if (!isVisible) {
        // Esperar a que termine la animación antes de establecer display: none
        const timer = setTimeout(() => {
          if (modalElement.classList.contains("hide")) {
            modalElement.style.display = "none";
          }
        }, 400); // Tiempo de la animación
        return () => clearTimeout(timer);
      } else {
        // Cuando es visible, asegurar que no tenga display: none inline
        modalElement.style.display = "";
      }
    }
  }, [isVisible]);

  return (
    <div
      className={`lot-modal background-container border-container ${ isVisible ? 'show' : 'hide' }`}
      id="modalOverlay"
    >
      {/* Cara frontal - Información del lote */}
      <div
        className="lot-modal-front"
        style={{ display: showQuotation ? "none" : "flex" }}
      >
        <a
          className="lot-modal-back-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            handleClose();
          }}
        >
          <i className="fas fa-arrow-left"></i>
          <span>Volver</span>
        </a>

        <div className="lot-modal-header">
          <div className="lot-modal-logo">
            <img
              src="/images/logo_mikonos.png"
              alt="Mykonos Residencial Playa"
            />
          </div>
        </div>

        <div className="lot-modal-content">
          <div className="lot-identification">
            <div className="lot-stage-badge">Etapa {lotData.phase || "1"}</div>
            <div className="lot-center">
              <div className="lot-box">
                <span id="modalLot">{getLotWithoutPhase(lotData.lot)}</span>
              </div>
            </div>
            <div
              className="lot-status-badge"
              style={{ 
                backgroundColor: statusColors.background,
                borderColor: statusColors.border,
                borderStyle: 'solid', 
                borderWidth: '1px' 
            }}
              id="modalStatus"
            >
              {statusLabel}
            </div>
          </div>

          <div className="lot-property-details">
            <div className="lot-detail-row">
              <span className="lot-detail-label">Precio</span>
              <span className="lot-detail-value" id="modalPrice">
                {lotData.price}
              </span>
            </div>
            <div className="lot-detail-row">
              <span className="lot-detail-label">Área</span>
              <span className="main-detail-value" id="modalArea">
                {lotData.area}
              </span>
            </div>
          </div>

          <div className="lot-boundaries-section">
            <h3 className="lot-boundaries-title">Colindancias</h3>
            <div className="lot-boundaries-card">
              <div className="lot-boundary-item">
                <div className="lot-boundary-icon">
                  <img
                    src="/images/lote/izquierda.svg"
                    alt="Izquierda"
                    className="lot-boundary-icon-svg"
                  />
                </div>
                <span className="lot-boundary-label">Izquierda</span>
                <span className="lot-boundary-value" id="modalLeft">
                  {lotData.boundaries?.left || "N/A"}
                </span>
              </div>
              <div className="lot-boundary-item">
                <div className="lot-boundary-icon">
                  <img
                    src="/images/lote/derecha.svg"
                    alt="Derecha"
                    className="lot-boundary-icon-svg"
                  />
                </div>
                <span className="lot-boundary-label">Derecha</span>
                <span className="lot-boundary-value" id="modalRight">
                  {lotData.boundaries?.right || "N/A"}
                </span>
              </div>
              <div className="lot-boundary-item">
                <div className="lot-boundary-icon">
                  <img
                    src="/images/lote/frente.svg"
                    alt="Frente"
                    className="lot-boundary-icon-svg"
                  />
                </div>
                <span className="lot-boundary-label">Frente</span>
                <span className="lot-boundary-value" id="modalFront">
                  {lotData.boundaries?.front || "N/A"}
                </span>
              </div>
              <div className="lot-boundary-item">
                <div className="lot-boundary-icon">
                  <img
                    src="/images/lote/fondo.svg"
                    alt="Fondo"
                    className="lot-boundary-icon-svg"
                  />
                </div>
                <span className="lot-boundary-label">Fondo</span>
                <span className="lot-boundary-value" id="modalBack">
                  {lotData.boundaries?.back || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Botones condicionales según el estado de login */}
          {userState ? (
            // Usuario logueado: Solo botón de cotizar
            <button className="lot-whatsapp-btn" style={{ 
                  background: lotData.status === 'disponible' 
                    ? '#1DB779'  
                    : 'linear-gradient(135deg, #333 0%, #444 100%)' 
                }} onClick={lotData.status === 'disponible' ? handleQuotationClick : undefined}>
              <span>{lotData.status === 'disponible' ? 'Cotizar' : 'Lote no disponible'}</span>
            </button>
          ) : (
            // Usuario no logueado: Dos botones
            <div className="lot-buttons-container">
              <button 
                className="lot-contact-btn" 
                onClick={handleWhatsAppClick}
                disabled={lotData.status !== 'disponible'}
              >
                <i className="fab fa-whatsapp"></i>
                <span>Contactar</span>
              </button>
              <button 
                className="lot-whatsapp-btn" 
                style={{ 
                  background: lotData.status === 'disponible' 
                    ? '#1DB779'  
                    : 'linear-gradient(135deg, #333 0%, #444 100%)' 
                }} 
                onClick={lotData.status === 'disponible' ? handleQuotationClick : undefined}
              >
                <span>{lotData.status === 'disponible' ? 'Cotizar' : 'Lote no disponible'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cara trasera - Cotización */}
      <div
        className="lot-modal-back"
        style={{ display: showQuotation ? "flex" : "none" }}
      >
        <a
          className="lot-modal-back-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            handleBackToLot();
          }}
        >
          <i className="fas fa-arrow-left"></i>
          <span>Volver</span>
        </a>

        <div className="quotation-header">
          <button className="quotation-close-btn" onClick={handleClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>
          <div className="quotation-title">
            <span>Cotización de Lote</span>
          <div className="quotation-divider"></div>
          </div>

          <div className="section-header">
              <h2 className="section-title">Cronograma de pago</h2>
              <button className="clear-link" onClick={handleClearSchedule}>Limpiar</button>
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
                <div className="quotation-cell item-value">{lotData.phase || "1"}</div>
                <div className="quotation-cell item-value">
                  {(() => {
                    // Parse format "Mz. E - Lote 7" to "E7"
                    if (loteData?.direccion) {
                      const match = loteData.direccion.match(
                        /Mz\.\s*([A-Z])\s*-\s*Lote\s*(\d+)/
                      );
                      if (match) {
                        return `${match[1]}${match[2]}`;
                      }
                    }
                    // Fallback to manzana + numero if available
                    if (loteData?.manzana && loteData?.numero) {
                      return `${loteData.manzana}${loteData.numero}`;
                    }
                    return "M4";
                  })()}
                </div>
                <div className="quotation-cell item-value">
                  $
                  {loteData?.precio
                    ? loteData.precio.toLocaleString()
                    : "445,000.00"}
                </div>
                <div className="quotation-cell">
                  <div className="discount-badges">
                    <input
                      type="text"
                      className="discount-input"
                      placeholder="$ 0.00"
                      value={getFormattedValue(discountAmount, 'usd', 'discount-amount')}
                      onFocus={() => handleInputFocus('discount-amount')}
                      onBlur={() => handleDecimalBlur('discount-amount', (amount) => {
                        applyDiscountFromAmount(amount);
                      })}
                      onChange={(e) => handleDiscountChange(e, "amount")}
                    />
                    <input
                      type="text"
                      className="discount-input"
                      placeholder="0.00%"
                      value={getFormattedValue(discountPercentage, 'percentage', 'discount-percentage')}
                      onFocus={() => handleInputFocus('discount-percentage')}
                      onBlur={() => handleDecimalBlur('discount-percentage', (percentage) => {
                        applyDiscountFromPercentage(percentage);
                      })}
                      onChange={(e) => handleDiscountChange(e, "percentage")}
                    />
                  </div>
                  {discountError && (
                    <div className="error-message" style={{ marginTop: '6px' }}>
                      {discountError}
                    </div>
                  )}
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

            <div className="total-row" style={{ display: 'flex' }}>
              <div className="total-label">Total:</div>
              <div className="total-value">
                ${" "}
                {(
                  (loteData?.precio || 445000) - discountAmount
                ).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Cronograma de Pago */}
          <div className="payment-schedule-section">

            <div className="payment-form">
              <div className="form-group">
                <label className="form-label">Modalidad de Pago</label>
                <select
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => handlePaymentMethodChange(e.target.value)}
                >
                  {/* <option value="credito_hipotecario">
                    Crédito Hipotecario
                  </option> */}
                  <option value="credito_directo">Crédito Directo</option>
                  <option value="contado">Contado</option>
                </select>
              </div>

              
              {paymentMethod === "credito_hipotecario" && (
                <>
                  <div className="form-group">
                    <label className="form-label">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={separation.enabled}
                        onChange={(e) => {
                          setSeparation({
                            ...separation,
                            enabled: e.target.checked,
                          });
                          setNeedsUpdate(true);
                        }}
                      />
                      Separación
                    </label>
                    {separation.enabled && (
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="0.00 USD"
                          value={getFormattedValue(separation.amount, 'usd', 'separation-amount-hipotecario')}
                          onFocus={() => handleInputFocus('separation-amount-hipotecario')}
                          onBlur={() => handleDecimalBlur('separation-amount-hipotecario', (amount) => {
                            const percentage =
                              (amount /
                                ((loteData?.precio || 445000) -
                                  discountAmount)) *
                              100;
                            setSeparation({
                              amount,
                              percentage,
                              enabled: true,
                            });
                            handleFieldChange("separation");
                          })}
                          onChange={(e) => {
                            handleDecimalInput(e.target.value, 'separation-amount-hipotecario', (amount) => {
                              const percentage =
                                (amount /
                                  ((loteData?.precio || 445000) -
                                    discountAmount)) *
                                100;
                              setSeparation({
                                amount,
                                percentage,
                                enabled: true,
                              });
                              handleFieldChange("separation");
                            });
                          }}
                        />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="0.00 %"
                          value={getFormattedValue(separation.percentage, 'percentage', 'separation-percentage-hipotecario')}
                          onFocus={() => handleInputFocus('separation-percentage-hipotecario')}
                          onBlur={() => handleDecimalBlur('separation-percentage-hipotecario', (percentage) => {
                            const validatedPercentage = validatePercentage(percentage);
                            const amount =
                              (validatedPercentage / 100) *
                              ((loteData?.precio || 445000) - discountAmount);
                            setSeparation({
                              amount,
                              percentage: validatedPercentage,
                              enabled: true,
                            });
                            handleFieldChange("separation");
                          })}
                          onChange={(e) => {
                            handleDecimalInput(e.target.value, 'separation-percentage-hipotecario', (percentage) => {
                              const validatedPercentage = validatePercentage(percentage);
                              const amount =
                                (validatedPercentage / 100) *
                                ((loteData?.precio || 445000) - discountAmount);
                              setSeparation({
                                amount,
                                percentage: validatedPercentage,
                                enabled: true,
                              });
                              handleFieldChange("separation");
                            });
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
                          value={getFormattedValue(initial.amount, 'usd', 'initial-amount-hipotecario')}
                          onFocus={() => handleInputFocus('initial-amount-hipotecario')}
                          onBlur={() => handleDecimalBlur('initial-amount-hipotecario', (amount) => {
                            const percentage =
                              (amount /
                                ((loteData?.precio || 445000) - discountAmount)) *
                              100;
                            setInitial({ amount, percentage });
                            handleFieldChange("initial");

                            // Log después de setInitial para ver si se modifica el schedule
                            setTimeout(() => {
                            }, 100);
                          })}
                        onChange={(e) => {
                          handleDecimalInput(e.target.value, 'initial-amount-hipotecario', (amount) => {
                            const percentage =
                              (amount /
                                ((loteData?.precio || 445000) - discountAmount)) *
                              100;
                            setInitial({ amount, percentage });
                            handleFieldChange("initial");

                            // Log después de setInitial para ver si se modifica el schedule
                            setTimeout(() => {
                            }, 100);
                          });
                        }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="0.00 %"
                          value={getFormattedValue(initial.percentage, 'percentage', 'initial-percentage-hipotecario')}
                          onFocus={() => handleInputFocus('initial-percentage-hipotecario')}
                          onBlur={() => handleDecimalBlur('initial-percentage-hipotecario', (percentage) => {
                            const validatedPercentage = validatePercentage(percentage);
                            const amount =
                              (validatedPercentage / 100) *
                              ((loteData?.precio || 445000) - discountAmount);
                            setInitial({ amount, percentage: validatedPercentage });
                            handleFieldChange("initial");

                          })}
                        onChange={(e) => {
                          handleDecimalInput(e.target.value, 'initial-percentage-hipotecario', (percentage) => {
                            const validatedPercentage = validatePercentage(percentage);
                            const amount =
                              (validatedPercentage / 100) *
                              ((loteData?.precio || 445000) - discountAmount);
                            setInitial({ amount, percentage: validatedPercentage });
                            handleFieldChange("initial");

                          });
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
                          value={getFormattedValue(mortgageCredit.amount, 'usd', 'mortgage-credit-amount')}
                          onFocus={() => handleInputFocus('mortgage-credit-amount')}
                          onBlur={() => handleDecimalBlur('mortgage-credit-amount', (amount) => {
                            const percentage =
                              (amount /
                                ((loteData?.precio || 445000) - discountAmount)) *
                              100;
                            setMortgageCredit({ amount, percentage });
                            handleFieldChange("mortgageCredit");
                          })}
                        onChange={(e) => {
                          handleDecimalInput(e.target.value, 'mortgage-credit-amount', (amount) => {
                            const percentage =
                              (amount /
                                ((loteData?.precio || 445000) - discountAmount)) *
                              100;
                            setMortgageCredit({ amount, percentage });
                            handleFieldChange("mortgageCredit");
                          });
                        }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="0.00 %"
                          value={getFormattedValue(mortgageCredit.percentage, 'percentage', 'mortgage-credit-percentage')}
                          onFocus={() => handleInputFocus('mortgage-credit-percentage')}
                          onBlur={() => handleDecimalBlur('mortgage-credit-percentage', (percentage) => {
                            const validatedPercentage = validatePercentage(percentage);
                            const amount =
                              (validatedPercentage / 100) *
                              ((loteData?.precio || 445000) - discountAmount);
                            setMortgageCredit({ amount, percentage: validatedPercentage });
                            handleFieldChange("mortgageCredit");
                          })}
                        onChange={(e) => {
                          handleDecimalInput(e.target.value, 'mortgage-credit-percentage', (percentage) => {
                            const validatedPercentage = validatePercentage(percentage);
                            const amount =
                              (validatedPercentage / 100) *
                              ((loteData?.precio || 445000) - discountAmount);
                            setMortgageCredit({ amount, percentage: validatedPercentage });
                            handleFieldChange("mortgageCredit");
                          });
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
                      <div className="checkbox-label">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={equivalentInstallments}
                          onChange={(e) => {
                            setEquivalentInstallments(e.target.checked);
                            setNeedsUpdate(true);
                          }}
                        />
                        <span>Cuotas Equivalentes</span>
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="2 cuotas"
                          value={getFormattedValue(numberOfInstallments, 'cuotas', 'number-of-installments')}
                          onFocus={() => handleInputFocus('number-of-installments')}
                          onBlur={() => handleInputBlur('number-of-installments')}
                        onChange={(e) => {
                          const value =
                            parseInt(e.target.value.replace(/[^0-9]/g, "")) ||
                            0;
                          setNumberOfInstallments(value);
                          setNeedsUpdate(true);
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Primer y Último Pago</label>
                    <div className="input-group">
                      <input
                        type="date"
                        className={`date-input ${dateError ? "error" : ""}`}
                        placeholder="dd/mm/aaaa"
                        value={toDateInputValue(firstPaymentDate)}
                        onChange={(e) => handleDateChange(fromDateInputValue(e.target.value))}
                        onBlur={(e) => handleDateBlur(fromDateInputValue(e.target.value))}
                      />
                      <input
                        type="date"
                        className="date-input readonly"
                        placeholder="dd/mm/aaaa"
                        value={toDateInputValue(calculatedFinalDate)}
                        readOnly
                      />
                    </div>
                    {dateError && (
                      <div className="date-error-message">{dateError}</div>
                    )}
                  </div>
                </>
              )}

              {paymentMethod === "credito_directo" && (
                <>
                  <div className="form-group">
                    <label className="form-label">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={separation.enabled}
                        onChange={(e) => {
                          setSeparation({
                            ...separation,
                            enabled: e.target.checked,
                          });
                          setNeedsUpdate(true);
                        }}
                      />
                      Separación
                    </label>
                    {separation.enabled && (
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="0.00 USD"
                          value={getFormattedValue(separation.amount, 'usd', 'separation-amount-directo')}
                          onFocus={() => handleInputFocus('separation-amount-directo')}
                          onBlur={() => handleDecimalBlur('separation-amount-directo', (amount) => {
                            const percentage =
                              (amount /
                                ((loteData?.precio || 445000) -
                                  discountAmount)) *
                              100;
                            setSeparation({
                              amount,
                              percentage,
                              enabled: true,
                            });
                            handleFieldChange("separation");
                          })}
                          onChange={(e) => {
                            handleDecimalInput(e.target.value, 'separation-amount-directo', (amount) => {
                              const percentage =
                                (amount /
                                  ((loteData?.precio || 445000) -
                                    discountAmount)) *
                                100;
                              setSeparation({
                                amount,
                                percentage,
                                enabled: true,
                              });
                              handleFieldChange("separation");
                            });
                          }}
                        />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="0.00 %"
                          value={getFormattedValue(separation.percentage, 'percentage', 'separation-percentage-directo')}
                          onFocus={() => handleInputFocus('separation-percentage-directo')}
                          onBlur={() => handleDecimalBlur('separation-percentage-directo', (percentage) => {
                            const validatedPercentage = validatePercentage(percentage);
                            const amount =
                              (validatedPercentage / 100) *
                              ((loteData?.precio || 445000) - discountAmount);
                            setSeparation({
                              amount,
                              percentage: validatedPercentage,
                              enabled: true,
                            });
                            handleFieldChange("separation");
                          })}
                          onChange={(e) => {
                            handleDecimalInput(e.target.value, 'separation-percentage-directo', (percentage) => {
                              const validatedPercentage = validatePercentage(percentage);
                              const amount =
                                (validatedPercentage / 100) *
                                ((loteData?.precio || 445000) - discountAmount);
                              setSeparation({
                                amount,
                                percentage: validatedPercentage,
                                enabled: true,
                              });
                              handleFieldChange("separation");
                            });
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
                          value={getFormattedValue(initial.amount, 'usd', 'initial-amount-directo')}
                          onFocus={() => handleInputFocus('initial-amount-directo')}
                          onBlur={() => handleDecimalBlur('initial-amount-directo', (amount) => {
                            const percentage =
                              (amount /
                                ((loteData?.precio || 445000) - discountAmount)) *
                              100;
                            setInitial({ amount, percentage });
                            handleFieldChange("initial");

                          })}
                        onChange={(e) => {
                          handleDecimalInput(e.target.value, 'initial-amount-directo', (amount) => {
                            const percentage =
                              (amount /
                                ((loteData?.precio || 445000) - discountAmount)) *
                              100;
                            setInitial({ amount, percentage });
                            handleFieldChange("initial");

                            // Log después de setInitial para ver si se modifica el schedule
                            setTimeout(() => {
                            }, 100);
                          });
                        }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="0.00 %"
                          value={getFormattedValue(initial.percentage, 'percentage', 'initial-percentage-directo')}
                          onFocus={() => handleInputFocus('initial-percentage-directo')}
                          onBlur={() => handleDecimalBlur('initial-percentage-directo', (percentage) => {
                            const validatedPercentage = validatePercentage(percentage);
                            const amount =
                              (validatedPercentage / 100) *
                              ((loteData?.precio || 445000) - discountAmount);
                            setInitial({ amount, percentage: validatedPercentage });
                            handleFieldChange("initial");

                            // Log después de setInitial para ver si se modifica el schedule
                            setTimeout(() => {
                            }, 100);
                          })}
                        onChange={(e) => {
                          handleDecimalInput(e.target.value, 'initial-percentage-directo', (percentage) => {
                            const validatedPercentage = validatePercentage(percentage);
                            const amount =
                              (validatedPercentage / 100) *
                              ((loteData?.precio || 445000) - discountAmount);
                            setInitial({ amount, percentage: validatedPercentage });
                            handleFieldChange("initial");

                            // Log después de setInitial para ver si se modifica el schedule
                            setTimeout(() => {
                            }, 100);
                          });
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Número de Cuotas</label>
                    <div className="input-group">
                      <div className="checkbox-label">
                        <input
                          type="checkbox"
                          className="checkbox"
                          checked={equivalentInstallments}
                          onChange={(e) => {
                            setEquivalentInstallments(e.target.checked);
                            setNeedsUpdate(true);
                          }}
                        />
                        <span>Cuotas Equivalentes</span>
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="2 cuotas"
                          value={getFormattedValue(numberOfInstallments, 'cuotas', 'number-of-installments')}
                          onFocus={() => handleInputFocus('number-of-installments')}
                          onBlur={() => handleInputBlur('number-of-installments')}
                        onChange={(e) => {
                          const value =
                            parseInt(e.target.value.replace(/[^0-9]/g, "")) ||
                            0;
                          setNumberOfInstallments(value);
                          setNeedsUpdate(true);
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Primer y Último Pago</label>
                    <div className="input-group">
                      <input
                        type="date"
                        className={`date-input ${dateError ? "error" : ""}`}
                        placeholder="dd/mm/aaaa"
                        value={toDateInputValue(firstPaymentDate)}
                        onChange={(e) => handleDateChange(fromDateInputValue(e.target.value))}
                        onBlur={(e) => handleDateBlur(fromDateInputValue(e.target.value))}
                      />
                      <input
                        type="date"
                        className="date-input readonly"
                        placeholder="dd/mm/aaaa"
                        value={toDateInputValue(calculatedFinalDate)}
                        readOnly
                      />
                    </div>
                    {dateError && (
                      <div className="date-error-message">{dateError}</div>
                    )}
                  </div>
                </>
              )}

              {paymentMethod === "contado" && (
                <>
                  <div className="form-group">
                    <label className="form-label">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={separation.enabled}
                        onChange={(e) => {
                          setSeparation({
                            ...separation,
                            enabled: e.target.checked,
                          });
                          setNeedsUpdate(true);
                        }}
                      />
                      Separación
                    </label>
                    {separation.enabled && (
                      <div className="input-group">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="0.00 USD"
                          value={getFormattedValue(separation.amount, 'usd', 'separation-amount-contado')}
                          onFocus={() => handleInputFocus('separation-amount-contado')}
                          onBlur={() => handleInputBlur('separation-amount-contado')}
                          onChange={(e) => {
                            const amount =
                              parseFloat(
                                e.target.value.replace(/[^0-9.-]/g, "")
                              ) || 0;
                            const percentage =
                              (amount /
                                ((loteData?.precio || 445000) -
                                  discountAmount)) *
                              100;
                            setSeparation({
                              amount,
                              percentage,
                              enabled: true,
                            });
                            handleFieldChange("separation");
                          }}
                        />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="0.00 %"
                          value={getFormattedValue(separation.percentage, 'percentage', 'separation-percentage-contado')}
                          onFocus={() => handleInputFocus('separation-percentage-contado')}
                          onBlur={() => handleInputBlur('separation-percentage-contado')}
                          onChange={(e) => {
                            const percentage = validatePercentage(
                              parseFloat(
                                e.target.value.replace(/[^0-9.-]/g, "")
                              ) || 0
                            );
                            const amount =
                              (percentage / 100) *
                              ((loteData?.precio || 445000) - discountAmount);
                            setSeparation({
                              amount,
                              percentage,
                              enabled: true,
                            });
                            handleFieldChange("separation");
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
                          value={getFormattedValue(initial.amount, 'usd', 'initial-amount-contado')}
                          onFocus={() => handleInputFocus('initial-amount-contado')}
                          onBlur={() => handleInputBlur('initial-amount-contado')}
                        onChange={(e) => {
                          const amount =
                            parseFloat(
                              e.target.value.replace(/[^0-9.-]/g, "")
                            ) || 0;
                          const percentage =
                            (amount /
                              ((loteData?.precio || 445000) - discountAmount)) *
                            100;
                          setInitial({ amount, percentage });
                          handleFieldChange("initial");

                          // Log después de setInitial para ver si se modifica el schedule
                          setTimeout(() => {
                          }, 100);
                        }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="0.00 %"
                          value={getFormattedValue(initial.percentage, 'percentage', 'initial-percentage-contado')}
                          onFocus={() => handleInputFocus('initial-percentage-contado')}
                          onBlur={() => handleInputBlur('initial-percentage-contado')}
                        onChange={(e) => {
                          const percentage = validatePercentage(
                            parseFloat(
                              e.target.value.replace(/[^0-9.-]/g, "")
                            ) || 0
                          );
                          const amount =
                            (percentage / 100) *
                            ((loteData?.precio || 445000) - discountAmount);
                          setInitial({ amount, percentage });
                          handleFieldChange("initial");

                          // Log después de setInitial para ver si se modifica el schedule
                          setTimeout(() => {
                          }, 100);
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Pago Saldo Final</label>
                    <div className="input-group">
                      <input
                        type="date"
                        className="date-input"
                        placeholder="dd/mm/aaaa"
                        value={toDateInputValue(finalBalance.date)}
                        onChange={(e) => {
                          setFinalBalance({
                            ...finalBalance,
                            date: fromDateInputValue(e.target.value)
                          });
                        }}
                        onBlur={(e) => {
                          const formattedDate = formatDateInput(fromDateInputValue(e.target.value));
                          setFinalBalance({
                            ...finalBalance,
                            date: formattedDate
                          });
                        }}
                      />
                      <div className="info-text">
                        <small>El monto se calcula automáticamente</small>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <button
                className={`generate-schedule-btn ${
                  needsUpdate ? "update-btn" : ""
                }`}
                onClick={() => {
                  if (needsUpdate) {
                    updateSchedule();
                  } else {
                    generateSchedule();
                  }
                }}
                disabled={
                  (paymentMethod !== "contado" && !firstPaymentDate) || 
                  (paymentMethod !== "contado" && numberOfInstallments === 0) || 
                  (paymentMethod !== "contado" && !!dateError)
                }
              >
                {needsUpdate ? "Actualizar Cronograma" : "Generar Cronograma"}
              </button>
            </div>

            {/* Tabla de Cronograma Generado */}
            <div className="schedule-table">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th style={{ textAlign: "center" }}>Fecha</th>
                    <th style={{ textAlign: "center" }}>Porcentaje</th>
                    <th style={{ textAlign: "center" }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((item, index) => (
                    <tr key={index}>
                      <td style={{ textAlign: "center" }}>{item.item}</td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="date"
                          className="input-date"
                          placeholder="dd/mm/aaaa"
                          {...getDateInputMinMax(item.item)}
                          value={toDateInputValue(item.date)}
                          onChange={(e) => {
                            const newSchedule = [...schedule];
                            newSchedule[index].date = fromDateInputValue(e.target.value);
                            // No marcar aún, solo actualizar el input y no aceptar inválidos en blur
                            setSchedule(newSchedule);
                          }}
                          onBlur={(e) => {
                            const inputValue = fromDateInputValue(e.target.value);
                            const formattedDate = formatDateInput(inputValue);
                            const newSchedule = [...schedule];
                            if (formattedDate) {
                              // Validar fecha según el tipo de item (Separación/Inicial vs Cuotas)
                              const validation = validateScheduleDate(formattedDate, item.item);
                              if (validation.isValid) {
                                // Fecha válida
                                newSchedule[index].date = formattedDate;
                                newSchedule[index].isEditedDate = true;
                                newSchedule[index].lastValidDate = formattedDate;
                                
                                // Si es la primera cuota (Cuota 1), actualizar firstPaymentDate
                                if (item.item === "Cuota 1") {
                                  const newFirstPaymentDate = formattedDate;
                                  setFirstPaymentDate(newFirstPaymentDate);
                                  
                                  // Validar y limpiar fechas de Separación e Inicial si son inválidas
                                  const firstPaymentParsed = parse(newFirstPaymentDate, "dd/MM/yyyy", new Date());
                                  if (isValid(firstPaymentParsed)) {
                                    newSchedule.forEach((scheduleItem, scheduleIndex) => {
                                      if (scheduleItem.item === "Separación" || scheduleItem.item === "Inicial") {
                                        if (scheduleItem.date) {
                                          const itemDateParsed = parse(scheduleItem.date, "dd/MM/yyyy", new Date());
                                          if (isValid(itemDateParsed)) {
                                            // Si la fecha de Separación/Inicial es posterior o igual a la nueva fecha de primera cuota, limpiarla
                                            if (!isBefore(itemDateParsed, firstPaymentParsed)) {
                                              newSchedule[scheduleIndex].date = '';
                                              newSchedule[scheduleIndex].lastValidDate = '';
                                              newSchedule[scheduleIndex].isEditedDate = false;
                                            }
                                          }
                                        }
                                      }
                                    });
                                  }
                                  
                                  // Recalcular fecha final si aplica
                                  if (paymentMethod === "credito_directo" && numberOfInstallments > 0) {
                                    const finalDate = calculateFinalPaymentDate(
                                      newFirstPaymentDate,
                                      numberOfInstallments
                                    );
                                    setCalculatedFinalDate(finalDate);
                                  }
                                }
                              } else {
                                // Fecha inválida: restaurar último válido (si existe) o vacío
                                const fallback = newSchedule[index].lastValidDate || '';
                                newSchedule[index].date = fallback;
                                // Opcional: mostrar error (puedes agregar un estado de error si lo necesitas)
                                if (validation.error) {
                                  console.warn(`Error en fecha de ${item.item}: ${validation.error}`);
                                }
                              }
                            } else {
                              // Fecha inválida: restaurar último válido (si existe) o vacío
                              const fallback = newSchedule[index].lastValidDate || '';
                              newSchedule[index].date = fallback;
                            }
                            setSchedule(newSchedule);
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="text"
                          className={`input-percent ${
                            item.isEquivalent && /^Cuota\s/.test(item.item) ? "readonly" : ""
                          }`}
                          value={getFormattedValue(
                            item.percentage,
                            'percentage',
                            `schedule-percentage-${index}`
                          )}
                          readOnly={item.isEquivalent && /^Cuota\s/.test(item.item)}
                          onChange={(e) => {
                            if (!item.isEquivalent) {
                              handleDecimalInput(e.target.value, `schedule-percentage-${index}`, (percentage) => {
                                const validatedPercentage = validatePercentage(percentage);
                                handleInstallmentChange(
                                  index,
                                  "percentage",
                                  validatedPercentage
                                );
                              });
                            }
                          }}
                          onFocus={() => handleInputFocus(`schedule-percentage-${index}`)}
                          onBlur={() => {
                            if (!item.isEquivalent) {
                              handleDecimalBlur(`schedule-percentage-${index}`, (percentage) => {
                                const validatedPercentage = validatePercentage(percentage);
                                handleInstallmentChange(
                                  index,
                                  "percentage",
                                  validatedPercentage
                                );
                              });
                            } else {
                              handleInputBlur(`schedule-percentage-${index}`);
                            }
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          type="text"
                          className={`input-amount ${
                            item.isEquivalent && /^Cuota\s/.test(item.item) ? "readonly" : ""
                          }`}
                          value={getFormattedValue(
                            item.amount,
                            'usd',
                            `schedule-amount-${index}`
                          )}
                          readOnly={item.isEquivalent && /^Cuota\s/.test(item.item)}
                          onChange={(e) => {
                            if (!item.isEquivalent) {
                              handleDecimalInput(e.target.value, `schedule-amount-${index}`, (amount) => {
                                handleInstallmentChange(index, "amount", amount);
                              });
                            }
                          }}
                          onFocus={() => handleInputFocus(`schedule-amount-${index}`)}
                          onBlur={() => {
                            if (!item.isEquivalent) {
                              handleDecimalBlur(`schedule-amount-${index}`, (amount) => {
                                handleInstallmentChange(index, "amount", amount);
                              });
                            } else {
                              handleInputBlur(`schedule-amount-${index}`);
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ))}

                  {mortgageCredit.amount > 0 && (
                    <tr>
                      <td className="muted">Desembolso CH</td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="date"
                          className="input-date muted"
                          placeholder="dd/mm/aaaa"
                          readOnly
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="text"
                          className="input-percent muted"
                          value={`${mortgageCredit.percentage.toFixed(2)}%`}
                          readOnly
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          type="text"
                          className="input-amount muted"
                          value={`${mortgageCredit.amount.toLocaleString()} USD`}
                          readOnly
                        />
                      </td>
                    </tr>
                  )}

                  <tr className="total-row" style={{ borderTop: "1px solid #333" }}>
                    <td colSpan={2}>
                      <strong>TOTAL</strong>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <strong>100%</strong>
                    </td>
                    <td style={{ textAlign: "right", color: "#10b981"}}>
                      <strong>
                        $
                        {(
                          (loteData?.precio || 445000) - discountAmount
                        ).toLocaleString()}{" "}
                        USD
                      </strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Funcionalidades */}
            <div className="functionalities">
              <div className="function-buttons">
                <button className="function-btn print" onClick={handlePrint} disabled={!functionalitiesEnabled}> <i className="fas fa-print"></i> Imprimir</button>
                <button className="function-btn save" onClick={handleSave} disabled={!functionalitiesEnabled}> <i className="fas fa-save"></i> Guardar</button>
                <button className="function-btn email" onClick={handleEmail} disabled={!functionalitiesEnabled}> <i className="fas fa-envelope"></i> Enviar</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Modal */}
      <ContactModal
        isVisible={showContactModal}
        type={modalType}
        onClose={() => setShowContactModal(false)}
        onSubmit={handleContactSubmit}
        currentUser={userState}
        quotationCode={quotationCodeForModal}
      />
    </div>
  );
};

export default LotInfoModal;
