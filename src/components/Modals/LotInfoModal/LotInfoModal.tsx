import { useEffect, useState } from "react";
import {
  addMonths,
  format,
  parse,
  isValid,
  isBefore,
  startOfDay,
} from "date-fns";
import jsPDF from "jspdf";
import "./LotInfoModal.css";
import ContactModal from "../ContactModal/ContactModal";

interface LotInfoModalProps {
  isVisible?: boolean;
  onClose?: () => void;
  loteData?: any;
  currentUser?: {id: string; nombre: string; email: string} | null;
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
  const [sellers, setSellers] = useState<Array<{id: string; nombre: string; email: string; password: string; whatsapp: string}>>([]);

  // Cargar vendedores desde la API
  useEffect(() => {
    fetch('https://api.apico.dev/v1/gE2H1N/1vL47XFQKS6ajoKccemle7MYYDStFVawgnopVpfzz-UA/values/sellers')
      .then(res => res.json())
      .then((apiData) => {
        // Transformar los datos de la API al formato esperado
        const sellersData = apiData.values.map((row: any) => ({
          id: row[0],
          nombre: row[1],
          email: row[2],
          password: row[3],
          whatsapp: row[4]
        }));
        setSellers(sellersData);
      })
      .catch((error) => {
        console.error('Error cargando sellers:', error);
        setSellers([]);
      });
  }, []);

  // Sincronizar el estado del usuario cuando cambie la prop
  useEffect(() => {
    setUserState(currentUser);
  }, [currentUser]);

  // Debug: Log user state changes
  useEffect(() => {
    console.log("LotInfoModal - userState changed:", userState);
  }, [userState]);

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
  
  // Estados para manejar el focus de inputs formateados
  const [focusedInputs, setFocusedInputs] = useState<{[key: string]: boolean}>({});
  // Datos por defecto si no hay datos del lote
  const defaultLotData = {
    lot: "Lote sin identificar",
    status: "Disponible",
    price: "$ 0",
    area: "0.00 m²",
    boundaries: {
      left: "0.00ML",
      right: "0.00ML",
      front: "0.00ML",
      back: "0.00ML",
    },
  };

  // Usar datos del lote si están disponibles, sino usar datos por defecto
  const lotData = loteData
    ? {
        lot: loteData.direccion || "Lote sin identificar",
        status: loteData.estado || "Disponible",
        price: loteData.precio
          ? `$ ${loteData.precio.toLocaleString()}`
          : "$ 0",
        area: loteData.area || "0.00 m²",
        boundaries: {
          left: loteData.boundaries?.left || "0.00ML",
          right: loteData.boundaries?.right || "0.00ML",
          front: loteData.boundaries?.front || "0.00ML",
          back: loteData.boundaries?.back || "0.00ML",
        },
      }
    : defaultLotData;

  const handleClose = () => {
    setShowQuotation(false); // Reset to lot info when closing
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
        // Validación adicional: no permitir fechas anteriores a hoy
        const candidate = new Date(yearNum, monthNum - 1, dayNum);
        if (isNaN(candidate.getTime())) {
          return '';
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        candidate.setHours(0, 0, 0, 0);
        if (candidate < today) {
          return '';
        }
        return `${day}/${month}/${year}`;
      }
    }
    
    // Si no se puede formatear correctamente, retornar vacío para invalidar la fecha
    return '';
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

  const handleDiscountChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "amount" | "percentage"
  ) => {
    if (type === "amount") {
      handleDecimalInput(e.target.value, 'discount-amount', (amount) => {
        const percentage = (amount / (loteData?.precio || 445000)) * 100;
        setDiscountAmount(amount);
        setDiscountPercentage(percentage);
        handleFieldChange("discount");
      });
    } else {
      handleDecimalInput(e.target.value, 'discount-percentage', (percentage) => {
        const amount = (percentage / 100) * (loteData?.precio || 445000);
        setDiscountAmount(amount);
        setDiscountPercentage(percentage);
        handleFieldChange("discount");
      });
    }
  };

  const handlePaymentMethodChange = (method: string) => {
    console.log("Cambiando modalidad a:", method);
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
    console.log("paymentMethod cambió a:", paymentMethod);
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
    console.log("=== INICIANDO calculateSchedule ===");
    console.log("Schedule ANTES de calculateSchedule:", schedule);
    console.log("Schedule ANTES tiene", schedule.length, "elementos");
    console.log(
      "Schedule ANTES elementos:",
      schedule.map((item) => item.item)
    );
    const finalPrice = (loteData?.precio || 445000) - discountAmount;

    const newSchedule: any[] = [];

    if (paymentMethod === "credito_hipotecario") {
      // Modalidad: Crédito Hipotecario
      console.log("Calculando cronograma para credito_hipotecario");
      console.log("paymentMethod actual:", paymentMethod);

      // Agregar separación si está habilitada
      if (separation.enabled && separation.percentage > 0) {
        console.log("Agregando Separación:", separation);
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
        console.log("Agregando Inicial:", initial);
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
        console.log("Agregando Inicial:", initial);
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
        console.log("Agregando Inicial:", initial);
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

    console.log(
      "Schedule final:",
      newSchedule.map((item) => ({
        item: item.item,
        percentage: item.percentage,
      }))
    );
    // Aplicar cálculo preciso de montos
    const preciseSchedule = calculatePreciseAmounts(newSchedule, finalPrice);
    setSchedule(preciseSchedule);
    setNeedsUpdate(false);

    // Log después de setSchedule para ver si se modifica
    setTimeout(() => {
      console.log("Schedule DESPUÉS de setSchedule:", schedule);
      console.log("Schedule DESPUÉS tiene", schedule.length, "elementos");
      console.log(
        "Schedule DESPUÉS elementos:",
        schedule.map((item) => item.item)
      );
    }, 100);

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
    console.log("=== EJECUTANDO generateSchedule ===");
    // Sincronizar estados superiores desde la tabla para Separación e Inicial
    syncSeparationAndInitialFromSchedule();
    
    // Si ya hay un cronograma y hay cuotas editadas, preservar los datos editados
    if (schedule.length > 0 && !equivalentInstallments) {
      const hasEditedCuotas = schedule.some(item => 
        item.item.startsWith("Cuota") && item.isEdited
      );
      
      if (hasEditedCuotas) {
        console.log("Preservando cuotas editadas al regenerar cronograma");
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
    setFunctionalitiesEnabled(true);
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
    setFunctionalitiesEnabled(true);
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

  const handleFieldChange = (_field: string) => {
    console.log("=== EJECUTANDO handleFieldChange ===", _field);
    setNeedsUpdate(true);
    // No llamar calculateSchedule automáticamente para evitar bucles
    // El usuario debe presionar "Generar Cronograma" manualmente
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
    console.log("=== EJECUTANDO recalculateRemainingInstallments ===");
    
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

    console.log("Recalculando cuotas:", {
      usedPercentage,
      remainingPercentage,
      schedule: schedule.map((item) => ({
        item: item.item,
        percentage: item.percentage,
        isEdited: item.isEdited,
      })),
    });

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
      // Si no está completa, limpiar todo
      setDateError("");
      setCalculatedFinalDate("");
    }
  };

  const handleWhatsAppClick = () => {
    // Seleccionar un vendedor aleatorio
    if (sellers.length === 0) {
      alert('No hay vendedores disponibles en este momento. Por favor, intente más tarde.');
      return;
    }

    const randomIndex = Math.floor(Math.random() * sellers.length);
    const selectedSeller = sellers[randomIndex];
    
    // Crear mensaje para WhatsApp
    const loteInfo = lotData?.lot || 'N/A';
    const message = `Hola ${selectedSeller.nombre}, me interesa obtener más información sobre el lote ${loteInfo}. Por favor, contácteme.`;
    const encodedMessage = encodeURIComponent(message);
    
    // Usar el número de WhatsApp del vendedor seleccionado
    const whatsappUrl = `https://wa.me/${selectedSeller.whatsapp}?text=${encodedMessage}`;
    
    console.log(`Enviando WhatsApp a ${selectedSeller.nombre} (${selectedSeller.whatsapp})`);
    
    // Abrir WhatsApp en una nueva ventana
    window.open(whatsappUrl, '_blank');
  };

  // Función para guardar información del cliente en la API
  const saveClientToAPI = async (contactData: any) => {
    try {
      
      // Preparar datos del cliente
      const clientData = {
        values: [
          [
            contactData.cliente.nombre || '',
            contactData.cliente.apellido || '',
            contactData.cliente.dni || '',
            contactData.cliente.email || '',
            contactData.cliente.telefono || '',
            lotData?.lot || 'N/A',
          ]
        ]
      };

      console.log('Guardando cliente en API:', clientData);

      // Enviar datos a la API con parámetros requeridos
      const apiUrl = new URL('https://api.apico.dev/v1/gE2H1N/1vL47XFQKS6ajoKccemle7MYYDStFVawgnopVpfzz-UA/values/clientes:append');
      apiUrl.searchParams.append('valueInputOption', 'USER_ENTERED');
      apiUrl.searchParams.append('insertDataOption', 'INSERT_ROWS');
      apiUrl.searchParams.append('includeValuesInResponse', 'true');

      console.log('URL de la API:', apiUrl.toString());

      const response = await fetch(apiUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData)
      });

      if (response.ok) {
        console.log('Cliente guardado exitosamente en la API');
      } else {
        console.error('Error al guardar cliente en la API:', response.statusText);
      }
    } catch (error) {
      console.error('Error al guardar cliente:', error);
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
    console.log("=== LIMPIANDO CRONOGRAMA ===");
    
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
    
    console.log("Cronograma limpiado completamente");
  };

  // Funciones para los botones de funcionalidades
  const handlePrint = () => {
    setModalType("print");
    setShowContactModal(true);
  };

  const handleSave = () => {
    setModalType("save");
    setShowContactModal(true);
  };

  const handleEmail = () => {
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
            font-family: Arial, sans-serif; 
            margin: 20px; 
            color: #333;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #333; 
            padding-bottom: 20px; 
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
          .info-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 20px; 
            margin-bottom: 20px;
          }
          .info-item { 
            padding: 10px; 
            background: #f5f5f5; 
            border-radius: 5px;
          }
          .info-label { 
            font-weight: bold; 
            color: #666; 
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
          .footer { 
            margin-top: 40px; 
            text-align: center; 
            color: #666; 
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>COTIZACIÓN DE LOTE</h1>
        </div>
        
        <div class="info-section">
          <h2>Información del Lote</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Lote:</div>
              <div>${lotData.lot}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Estado:</div>
              <div>${lotData.status}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Precio:</div>
              <div>${lotData.price}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Fecha de Generación:</div>
              <div>${new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        
        <div class="info-section">
          <h2>Datos de Contacto</h2>
          <div class="info-grid">
            ${userState ? `
            <div class="info-item">
              <div class="info-label">Vendedor:</div>
              <div>${contactData.vendedor?.nombre || ''}</div>
              <div style="color: #666; font-size: 14px;">${contactData.vendedor?.email || ''}</div>
            </div>
            ` : ''}
            <div class="info-item">
              <div class="info-label">Cliente:</div>
              <div>${contactData.cliente?.nombre || ''}</div>
              <div style="color: #666; font-size: 14px;">${contactData.cliente?.email || ''}</div>
              ${contactData.cliente?.telefono ? `<div style="color: #666; font-size: 14px;">${contactData.cliente.telefono}</div>` : ''}
            </div>
          </div>
        </div>
        
        <div class="info-section">
          <h2>Cronograma de Pagos</h2>
          <table class="schedule-table">
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Fecha</th>
                <th>Porcentaje</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              ${schedule.map(item => `
                <tr>
                  <td>${item.item}</td>
                  <td>${item.date}</td>
                  <td>${item.percentage}%</td>
                  <td>$${item.amount.toLocaleString()}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td><strong>TOTAL</strong></td>
                <td></td>
                <td><strong>100%</strong></td>
                <td><strong>$${schedule.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString()}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="footer">
          <p>Documento generado el ${new Date().toLocaleString()}</p>
          <p>Sistema de Cotizaciones - Mikonos</p>
        </div>
      </body>
      </html>
    `;
  };

  const generatePDF = (contactData: any) => {
    const doc = new jsPDF();
    
    // Configuración del documento
    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text('COTIZACIÓN DE LOTE', 105, 20, { align: 'center' });
    
    // Información del lote
    doc.setFontSize(14);
    doc.text(`Lote: ${lotData.lot}`, 20, 40);
    doc.text(`Estado: ${lotData.status}`, 20, 50);
    doc.text(`Precio: ${lotData.price}`, 20, 60);
    doc.text(`Acción: Guardar PDF`, 20, 70);
    
    // Información de contacto
    doc.text('DATOS DE CONTACTO', 20, 80);
    doc.setFontSize(12);
    
    let yPosition = 95;
    
    // Solo mostrar información del vendedor si está logueado
    if (userState) {
      const vendedorNombre = contactData.vendedor?.nombre || '';
      const vendedorEmail = contactData.vendedor?.email || '';
      doc.text(`Vendedor: ${vendedorNombre}`, 20, yPosition);
      doc.text(`Email vendedor: ${vendedorEmail}`, 20, yPosition + 10);
      yPosition += 20;
    }
    
    // Información del cliente
    const clienteNombre = contactData.cliente?.nombre || '';
    const clienteEmail = contactData.cliente?.email || '';
    const clienteTelefono = contactData.cliente?.telefono || '';
    doc.text(`Cliente: ${clienteNombre}`, 20, yPosition);
    doc.text(`Email cliente: ${clienteEmail}`, 20, yPosition + 10);
    if (clienteTelefono) {
      doc.text(`Teléfono cliente: ${clienteTelefono}`, 20, yPosition + 20);
    }
    
    // Cronograma de pagos
    if (schedule.length > 0) {
      const cronogramaY = userState ? 155 : 135; // Ajustar según si hay vendedor o no
      doc.text('CRONOGRAMA DE PAGOS', 20, cronogramaY);
      
      let yPosition = cronogramaY + 15;
      schedule.forEach((item) => {
        if (yPosition > 280) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFontSize(10);
        doc.text(`${item.item}`, 20, yPosition);
        doc.text(`${item.date}`, 80, yPosition);
        doc.text(`${item.percentage}%`, 120, yPosition);
        doc.text(`$${item.amount.toLocaleString()}`, 150, yPosition);
        
        yPosition += 10;
      });
    }
    
    // Pie de página
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
      doc.text(`Generado el: ${new Date().toLocaleDateString()}`, 105, 295, { align: 'center' });
    }
    
    return doc;
  };

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

  const handleContactSubmit = (contactData: any) => {
    // Guardar información del cliente en la API siempre que complete el formulario
    saveClientToAPI(contactData);

    switch (modalType) {
      case "print": {
        // Abrir diálogo de impresión con datos de la cotización
        openPrintDialog(contactData);
        break;
      }
        
      case "save": {
        // Generar PDF y descargarlo
        const doc = generatePDF(contactData);
        const fileName = contactData.fileName || `Cronograma_${lotData.lot}_${new Date().toISOString().split('T')[0]}`;
        doc.save(`${fileName}.pdf`);
        //alert(`Cronograma guardado como PDF: ${fileName}.pdf`);
        break;
      }
        
      case "email": {
        // Generar datos del email
        const emailData = {
          to: contactData.cliente.email,
          subject: `Cotización - ${lotData.lot}`,
          body: `Estimado/a ${contactData.cliente.nombre},\n\nAdjunto la cotización del lote ${lotData.lot}.${userState ? `\n\nSaludos,\n${contactData.vendedor.nombre}` : '\n\nSaludos'}`
        };
        
        // Copiar al portapapeles
        navigator.clipboard.writeText(JSON.stringify(emailData, null, 2));
        alert("Datos del email copiados al portapapeles");
        break;
      }
    }
  };

  useEffect(() => {}, [isVisible, loteData]);

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
            <div className="lot-id-left">
              <div className="lot-box">
                <span id="modalLot">{lotData.lot}</span>
              </div>
              <div className="lot-stage-badge">Etapa 1</div>
            </div>
            <div
              className="lot-status-badge"
              style={{ 
                backgroundColor: lotData.status === 'disponible' 
                    ? 'rgba(29, 183, 121, 0.2)' 
                    : lotData.status === 'reservado' 
                        ? 'rgba(251, 224, 73, 0.2)' 
                        : 'rgba(251, 73, 73, 0.2)',
                borderColor: lotData.status === 'disponible' 
                    ? '#1DB779' 
                    : lotData.status === 'reservado' 
                        ? '#FBE049' 
                        : '#FB4949', 
                borderStyle: 'solid', 
                borderWidth: '1px' 
            }}
              id="modalStatus"
            >
              {lotData.status}
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
              <span>{lotData.status === 'disponible' ? 'Cotizar' : 'Este lote ya no esta disponible'}</span>
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
                <span>{lotData.status === 'disponible' ? 'Cotizar' : 'Este lote ya no esta disponible'}</span>
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
                        const percentage = (amount / (loteData?.precio || 445000)) * 100;
                        setDiscountAmount(amount);
                        setDiscountPercentage(percentage);
                        handleFieldChange("discount");
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
                        const amount = (percentage / 100) * (loteData?.precio || 445000);
                        setDiscountAmount(amount);
                        setDiscountPercentage(percentage);
                        handleFieldChange("discount");
                      })}
                      onChange={(e) => handleDiscountChange(e, "percentage")}
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
                ${" "}
                {(
                  (loteData?.precio || 445000) - discountAmount
                ).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Cronograma de Pago */}
          <div className="payment-schedule-section">
            <div className="section-header">
              <h2 className="section-title">Cronograma de Pago</h2>
              <button className="clear-link" onClick={handleClearSchedule}>Limpiar</button>
            </div>

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
                      Separación
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
                            console.log("=== CAMBIANDO INPUT INICIAL ===");
                            console.log(
                              "Schedule ANTES de setInitial:",
                              schedule
                            );
                            const percentage =
                              (amount /
                                ((loteData?.precio || 445000) - discountAmount)) *
                              100;
                            console.log("Nuevo initial:", { amount, percentage });
                            setInitial({ amount, percentage });
                            handleFieldChange("initial");

                            // Log después de setInitial para ver si se modifica el schedule
                            setTimeout(() => {
                              console.log(
                                "Schedule DESPUÉS de setInitial:",
                                schedule
                              );
                            }, 100);
                          })}
                        onChange={(e) => {
                          handleDecimalInput(e.target.value, 'initial-amount-hipotecario', (amount) => {
                            console.log("=== CAMBIANDO INPUT INICIAL ===");
                            console.log(
                              "Schedule ANTES de setInitial:",
                              schedule
                            );
                            const percentage =
                              (amount /
                                ((loteData?.precio || 445000) - discountAmount)) *
                              100;
                            console.log("Nuevo initial:", { amount, percentage });
                            setInitial({ amount, percentage });
                            handleFieldChange("initial");

                            // Log después de setInitial para ver si se modifica el schedule
                            setTimeout(() => {
                              console.log(
                                "Schedule DESPUÉS de setInitial:",
                                schedule
                              );
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

                            // Log después de setInitial para ver si se modifica el schedule
                            setTimeout(() => {
                              console.log(
                                "Schedule DESPUÉS de setInitial:",
                                schedule
                              );
                            }, 100);
                          })}
                        onChange={(e) => {
                          handleDecimalInput(e.target.value, 'initial-percentage-hipotecario', (percentage) => {
                            const validatedPercentage = validatePercentage(percentage);
                            const amount =
                              (validatedPercentage / 100) *
                              ((loteData?.precio || 445000) - discountAmount);
                            setInitial({ amount, percentage: validatedPercentage });
                            handleFieldChange("initial");

                            // Log después de setInitial para ver si se modifica el schedule
                            setTimeout(() => {
                              console.log(
                                "Schedule DESPUÉS de setInitial:",
                                schedule
                              );
                            }, 100);
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
                        className={`date-input ${dateError ? "error" : ""}`}
                        placeholder="dd/mm/aaaa"
                        value={firstPaymentDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        onBlur={(e) => handleDateBlur(e.target.value)}
                      />
                      <input
                        type="text"
                        className="date-input readonly"
                        placeholder="dd/mm/aaaa"
                        value={calculatedFinalDate}
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
                      Separación
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
                            console.log("=== CAMBIANDO INPUT INICIAL ===");
                            console.log(
                              "Schedule ANTES de setInitial:",
                              schedule
                            );
                            const percentage =
                              (amount /
                                ((loteData?.precio || 445000) - discountAmount)) *
                              100;
                            console.log("Nuevo initial:", { amount, percentage });
                            setInitial({ amount, percentage });
                            handleFieldChange("initial");

                            // Log después de setInitial para ver si se modifica el schedule
                            setTimeout(() => {
                              console.log(
                                "Schedule DESPUÉS de setInitial:",
                                schedule
                              );
                            }, 100);
                          })}
                        onChange={(e) => {
                          handleDecimalInput(e.target.value, 'initial-amount-directo', (amount) => {
                            console.log("=== CAMBIANDO INPUT INICIAL ===");
                            console.log(
                              "Schedule ANTES de setInitial:",
                              schedule
                            );
                            const percentage =
                              (amount /
                                ((loteData?.precio || 445000) - discountAmount)) *
                              100;
                            console.log("Nuevo initial:", { amount, percentage });
                            setInitial({ amount, percentage });
                            handleFieldChange("initial");

                            // Log después de setInitial para ver si se modifica el schedule
                            setTimeout(() => {
                              console.log(
                                "Schedule DESPUÉS de setInitial:",
                                schedule
                              );
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
                              console.log(
                                "Schedule DESPUÉS de setInitial:",
                                schedule
                              );
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
                              console.log(
                                "Schedule DESPUÉS de setInitial:",
                                schedule
                              );
                            }, 100);
                          });
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
                        className={`date-input ${dateError ? "error" : ""}`}
                        placeholder="dd/mm/aaaa"
                        value={firstPaymentDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        onBlur={(e) => handleDateBlur(e.target.value)}
                      />
                      <input
                        type="text"
                        className="date-input readonly"
                        placeholder="dd/mm/aaaa"
                        value={calculatedFinalDate}
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
                      Separación
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
                          console.log("=== CAMBIANDO INPUT INICIAL ===");
                          console.log(
                            "Schedule ANTES de setInitial:",
                            schedule
                          );
                          const amount =
                            parseFloat(
                              e.target.value.replace(/[^0-9.-]/g, "")
                            ) || 0;
                          const percentage =
                            (amount /
                              ((loteData?.precio || 445000) - discountAmount)) *
                            100;
                          console.log("Nuevo initial:", { amount, percentage });
                          setInitial({ amount, percentage });
                          handleFieldChange("initial");

                          // Log después de setInitial para ver si se modifica el schedule
                          setTimeout(() => {
                            console.log(
                              "Schedule DESPUÉS de setInitial:",
                              schedule
                            );
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
                            console.log(
                              "Schedule DESPUÉS de setInitial:",
                              schedule
                            );
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
                        className="date-input"
                        placeholder="dd/mm/aaaa"
                        value={finalBalance.date || ""}
                        onChange={(e) => {
                          setFinalBalance({
                            ...finalBalance,
                            date: e.target.value
                          });
                        }}
                        onBlur={(e) => {
                          const formattedDate = formatDateInput(e.target.value);
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
                  console.log("=== BOTÓN CLICKEADO ===", {
                    needsUpdate,
                    firstPaymentDate,
                    numberOfInstallments,
                    dateError,
                  });
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
                    <th style={{ textAlign: "right" }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((item, index) => (
                    <tr key={index}>
                      <td>{item.item}</td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="text"
                          className="input-date"
                          placeholder="dd/mm/aaaa"
                          value={item.date}
                          onChange={(e) => {
                            const newSchedule = [...schedule];
                            newSchedule[index].date = e.target.value;
                            // No marcar aún, solo actualizar el input y no aceptar inválidos en blur
                            setSchedule(newSchedule);
                          }}
                          onBlur={(e) => {
                            const formattedDate = formatDateInput(e.target.value);
                            const newSchedule = [...schedule];
                            if (formattedDate) {
                              // Fecha válida
                              newSchedule[index].date = formattedDate;
                              newSchedule[index].isEditedDate = true;
                              newSchedule[index].lastValidDate = formattedDate;
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
                          type="text"
                          className="input-date muted"
                          placeholder="dd/mm/aaaa"
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

                  <tr className="total-row">
                    <td colSpan={2}>
                      <strong>TOTAL</strong>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <strong>100%</strong>
                    </td>
                    <td style={{ textAlign: "right" }}>
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
              <h3>Funcionalidades</h3>
              <div className="function-buttons">
                <button className="function-btn" onClick={handlePrint} disabled={!functionalitiesEnabled}>Imprimir</button>
                <button className="function-btn" onClick={handleSave} disabled={!functionalitiesEnabled}>Guardar</button>
                <button className="function-btn" onClick={handleEmail} disabled={!functionalitiesEnabled}>Enviar por correo</button>
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
      />
    </div>
  );
};

export default LotInfoModal;
