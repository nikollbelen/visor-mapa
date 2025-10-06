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
}

const LotInfoModal = ({
  isVisible = false,
  onClose,
  loteData,
}: LotInfoModalProps) => {
  // Debug: Log lotData to see what data is being passed
  console.log("LotInfoModal - loteData recibido:", loteData);
  const [showQuotation, setShowQuotation] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);

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

  const handleDiscountChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "amount" | "percentage"
  ) => {
    const value = e.target.value;
    const price = loteData?.precio || 445000;

    if (type === "amount") {
      const amount = parseFloat(value.replace(/[^0-9.-]/g, "")) || 0;
      setDiscountAmount(amount);
      setDiscountPercentage((amount / price) * 100);
    } else {
      const percentage = validatePercentage(parseFloat(value.replace(/[^0-9.-]/g, "")) || 0);
      setDiscountPercentage(percentage);
      setDiscountAmount((percentage / 100) * price);
    }

    // No recalcular automáticamente para evitar bucles
    // El usuario debe presionar "Generar Cronograma" manualmente
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

  const calculatePreciseAmounts = (items: any[], finalPrice: number) => {
    if (items.length === 0) return items;
    
    // Calcular montos para todos los items excepto el último
    let totalCalculatedAmount = 0;
    const result = [...items];
    
    for (let i = 0; i < result.length - 1; i++) {
      result[i].amount = (result[i].percentage / 100) * finalPrice;
      totalCalculatedAmount += result[i].amount;
    }
    
    // Para el último item, calcular el monto restante
    if (result.length > 0) {
      const lastIndex = result.length - 1;
      result[lastIndex].amount = finalPrice - totalCalculatedAmount;
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
        newSchedule.push({
          item: "Separación",
          date: firstPaymentDate,
          percentage: separation.percentage,
          amount: separation.amount,
          isEdited: false,
        });
      }

      // Buscar o agregar inicial
      if (initial.percentage > 0) {
        console.log("Agregando Inicial:", initial);
        newSchedule.push({
          item: "Inicial",
          date: firstPaymentDate,
          percentage: initial.percentage,
          amount: initial.amount,
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
        newSchedule.push({
          item: "Separación",
          date: firstPaymentDate,
          percentage: separation.percentage,
          amount: separation.amount,
          isEdited: false,
        });
      }

      // Buscar o agregar inicial
      if (initial.percentage > 0) {
        console.log("Agregando Inicial:", initial);
        newSchedule.push({
          item: "Inicial",
          date: firstPaymentDate,
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
        newSchedule.push({
          item: "Separación",
          date: firstPaymentDate,
          percentage: separation.percentage,
          amount: separation.amount,
          isEdited: false,
        });
      }

      // Buscar o agregar inicial
      if (initial.percentage > 0) {
        console.log("Agregando Inicial:", initial);
        newSchedule.push({
          item: "Inicial",
          date: firstPaymentDate,
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
      // Parsear fecha de inicio (formato dd/mm/aa)
      const parsedDate = parse(startDate, "dd/MM/yy", new Date());

      if (!isValid(parsedDate)) {
        console.error("Invalid start date format");
        return "";
      }

      // Agregar meses usando date-fns para manejar casos especiales
      const installmentDate = addMonths(parsedDate, installmentIndex);

      // Formatear de vuelta a dd/mm/aa
      return format(installmentDate, "dd/MM/yy");
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
      const parsedDate = parse(dateString, "dd/MM/yy", new Date());

      if (!isValid(parsedDate)) {
        return {
          isValid: false,
          error: "Formato de fecha inválido (dd/mm/aa)",
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

      // No puede ser hoy o en el pasado
      if (
        isBefore(parsedDate, today) ||
        parsedDate.getTime() === today.getTime()
      ) {
        return { isValid: false, error: "La fecha debe ser en el futuro" };
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
      const parsedDate = parse(startDate, "dd/MM/yy", new Date());
      if (!isValid(parsedDate)) return "";

      // La fecha final es la última cuota (número de cuotas - 1 meses después)
      const finalDate = addMonths(parsedDate, numberOfInstallments - 1);
      return format(finalDate, "dd/MM/yy");
    } catch (error) {
      console.error("Error calculating final payment date:", error);
      return "";
    }
  };

  const generateSchedule = () => {
    console.log("=== EJECUTANDO generateSchedule ===");
    
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
          date: calculateInstallmentDate(firstPaymentDate, index),
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
    if (equivalentInstallments) {
      // Si son equivalentes, recalcular todo
      calculateSchedule();
    } else {
      // Si no son equivalentes, mantener los valores editados y solo recalcular fechas
      const newSchedule = schedule.map((item, index) => ({
        ...item,
        date: calculateInstallmentDate(firstPaymentDate, index),
        isEquivalent: equivalentInstallments, // Actualizar propiedad isEquivalent
      }));
      setSchedule(newSchedule);
      // Los valores editados se mantienen sin recalcular
    }
    setNeedsUpdate(false);
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
    if (equivalentInstallments) return; // No permitir cambios si son equivalentes

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
        schedule[index].amount = (distributionPerInstallment / 100) * finalPrice;
        totalCalculatedAmount += schedule[index].amount;
      }

      // Para la última cuota, calcular el monto restante para que la suma sea exacta
      if (uneditedIndices.length > 0) {
        const lastIndex = uneditedIndices[uneditedIndices.length - 1];
        schedule[lastIndex].percentage = roundPercentage(distributionPerInstallment);
        
        // Calcular el monto restante para que la suma total sea exacta
        const remainingAmount = finalPrice - totalCalculatedAmount;
        schedule[lastIndex].amount = remainingAmount;
      }
    }
  };

  // Función removida - no se necesita recálculo automático para cuotas no equivalentes

  const handleDateChange = (value: string) => {
    setFirstPaymentDate(value);

    // Solo validar si la fecha está completa (formato dd/mm/aa)
    if (value.length === 8 && value.includes("/")) {
      const validation = validateStartDate(value);
      setDateError(validation.isValid ? "" : validation.error || "");

      // Calcular fecha final automáticamente solo si es válida
      if (validation.isValid) {
        const finalDate = calculateFinalPaymentDate(
          value,
          numberOfInstallments
        );
        setCalculatedFinalDate(finalDate);

        // Recalcular fechas de cuotas si ya hay un cronograma
        if (schedule.length > 0) {
          const newSchedule = schedule.map((item, index) => ({
            ...item,
            date: calculateInstallmentDate(value, index),
          }));
          setSchedule(newSchedule);
        }
      } else {
        setCalculatedFinalDate("");
      }
    } else {
      // Limpiar errores mientras se escribe
      setDateError("");
      setCalculatedFinalDate("");
    }

    setNeedsUpdate(true);
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
            <div class="info-item">
              <div class="info-label">Vendedor:</div>
              <div>${contactData.vendedor.nombre}</div>
              <div style="color: #666; font-size: 14px;">${contactData.vendedor.email}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Cliente:</div>
              <div>${contactData.cliente.nombre}</div>
              <div style="color: #666; font-size: 14px;">${contactData.cliente.email}</div>
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
    
    // Información de contacto
    doc.text('DATOS DE CONTACTO', 20, 80);
    doc.setFontSize(12);
    doc.text(`Vendedor: ${contactData.vendedor.nombre}`, 20, 95);
    doc.text(`Email: ${contactData.vendedor.email}`, 20, 105);
    doc.text(`Cliente: ${contactData.cliente.nombre}`, 20, 115);
    doc.text(`Email: ${contactData.cliente.email}`, 20, 125);
    
    // Cronograma de pagos
    if (schedule.length > 0) {
      doc.text('CRONOGRAMA DE PAGOS', 20, 145);
      
      let yPosition = 160;
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
          body: `Estimado/a ${contactData.cliente.nombre},\n\nAdjunto la cotización del lote ${lotData.lot}.\n\nSaludos,\n${contactData.vendedor.nombre}`
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
      className="lot-modal background-container border-container"
      id="modalOverlay"
      style={{ display: isVisible ? "flex" : "none" }}
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
            <div className="lot-box">
              <span id="modalLot">{lotData.lot}</span>
            </div>
            <div
              className="lot-status-badge"
              style={{ 
                backgroundColor: lotData.status === 'disponible' 
                  ? '#03b343'  
                  : lotData.status === 'reservado' 
                  ? '#f59e0b' 
                  : '#dc2626' 
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

          <button className="lot-whatsapp-btn" onClick={handleQuotationClick}>
            <i className="fa-brands fa-whatsapp"></i>
            <span>Cotización de lote</span>
          </button>
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
                      value={
                        discountAmount > 0
                          ? `$ ${discountAmount.toLocaleString()}`
                          : ""
                      }
                      onChange={(e) => handleDiscountChange(e, "amount")}
                    />
                    <input
                      type="text"
                      className="discount-input"
                      placeholder="0.00%"
                      value={
                        discountPercentage > 0
                          ? `${discountPercentage.toFixed(2)}%`
                          : ""
                      }
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
                          value={
                            separation.amount > 0
                              ? `${separation.amount.toLocaleString()} USD`
                              : ""
                          }
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
                          value={
                            separation.percentage > 0
                              ? `${separation.percentage.toFixed(2)} %`
                              : ""
                          }
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
                        value={
                          initial.amount > 0
                            ? `${initial.amount.toLocaleString()} USD`
                            : ""
                        }
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
                        value={
                          initial.percentage > 0
                            ? `${initial.percentage.toFixed(2)} %`
                            : ""
                        }
                        onChange={(e) => {
                          const percentage =
                            parseFloat(
                              e.target.value.replace(/[^0-9.-]/g, "")
                            ) || 0;
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
                    <label className="form-label">Crédito Hipotecario</label>
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="0.00 USD"
                        value={
                          mortgageCredit.amount > 0
                            ? `${mortgageCredit.amount.toLocaleString()} USD`
                            : ""
                        }
                        onChange={(e) => {
                          const amount =
                            parseFloat(
                              e.target.value.replace(/[^0-9.-]/g, "")
                            ) || 0;
                          const percentage =
                            (amount /
                              ((loteData?.precio || 445000) - discountAmount)) *
                            100;
                          setMortgageCredit({ amount, percentage });
                          handleFieldChange("mortgageCredit");
                        }}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="0.00 %"
                        value={
                          mortgageCredit.percentage > 0
                            ? `${mortgageCredit.percentage.toFixed(2)} %`
                            : ""
                        }
                        onChange={(e) => {
                          const percentage =
                            parseFloat(
                              e.target.value.replace(/[^0-9.-]/g, "")
                            ) || 0;
                          const amount =
                            (percentage / 100) *
                            ((loteData?.precio || 445000) - discountAmount);
                          setMortgageCredit({ amount, percentage });
                          handleFieldChange("mortgageCredit");
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
                        value={
                          numberOfInstallments > 0
                            ? `${numberOfInstallments} cuotas`
                            : ""
                        }
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
                        placeholder="dd/mm/aa"
                        value={firstPaymentDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                      />
                      <input
                        type="text"
                        className="date-input readonly"
                        placeholder="dd/mm/aa"
                        value={calculatedFinalDate}
                        readOnly
                      />
                    </div>
                    {dateError && (
                      <div className="date-error-message">{dateError}</div>
                    )}
                    {calculatedFinalDate && !dateError && (
                      <div className="calculated-date-display">
                        Fecha final calculada: {calculatedFinalDate}
                      </div>
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
                          value={
                            separation.amount > 0
                              ? `${separation.amount.toLocaleString()} USD`
                              : ""
                          }
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
                          value={
                            separation.percentage > 0
                              ? `${separation.percentage.toFixed(2)} %`
                              : ""
                          }
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
                        value={
                          initial.amount > 0
                            ? `${initial.amount.toLocaleString()} USD`
                            : ""
                        }
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
                        value={
                          initial.percentage > 0
                            ? `${initial.percentage.toFixed(2)} %`
                            : ""
                        }
                        onChange={(e) => {
                          const percentage =
                            parseFloat(
                              e.target.value.replace(/[^0-9.-]/g, "")
                            ) || 0;
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
                    <label className="form-label">Número de Cuotas</label>
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="2 cuotas"
                        value={
                          numberOfInstallments > 0
                            ? `${numberOfInstallments} cuotas`
                            : ""
                        }
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
                        placeholder="dd/mm/aa"
                        value={firstPaymentDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                      />
                      <input
                        type="text"
                        className="date-input readonly"
                        placeholder="dd/mm/aa"
                        value={calculatedFinalDate}
                        readOnly
                      />
                    </div>
                    {dateError && (
                      <div className="date-error-message">{dateError}</div>
                    )}
                    {calculatedFinalDate && !dateError && (
                      <div className="calculated-date-display">
                        Fecha final calculada: {calculatedFinalDate}
                      </div>
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
                          value={
                            separation.amount > 0
                              ? `${separation.amount.toLocaleString()} USD`
                              : ""
                          }
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
                          value={
                            separation.percentage > 0
                              ? `${separation.percentage.toFixed(2)} %`
                              : ""
                          }
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
                        value={
                          initial.amount > 0
                            ? `${initial.amount.toLocaleString()} USD`
                            : ""
                        }
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
                        value={
                          initial.percentage > 0
                            ? `${initial.percentage.toFixed(2)} %`
                            : ""
                        }
                        onChange={(e) => {
                          const percentage =
                            parseFloat(
                              e.target.value.replace(/[^0-9.-]/g, "")
                            ) || 0;
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
                        placeholder="dd/mm/aa"
                        value={finalBalance.date || ""}
                        onChange={(e) => {
                          setFinalBalance({
                            ...finalBalance,
                            date: e.target.value
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
                          placeholder="dd/mm/aa"
                          value={item.date}
                          onChange={(e) => {
                            const newSchedule = [...schedule];
                            newSchedule[index].date = e.target.value;
                            setSchedule(newSchedule);
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="text"
                          className={`input-percent ${
                            item.isEquivalent ? "readonly" : ""
                          }`}
                          value={`${item.percentage.toFixed(2)}%`}
                          readOnly={item.isEquivalent}
                          onChange={(e) => {
                            if (!item.isEquivalent) {
                              const percentage =
                                parseFloat(
                                  e.target.value.replace(/[^0-9.-]/g, "")
                                ) || 0;
                              handleInstallmentChange(
                                index,
                                "percentage",
                                percentage
                              );
                            }
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <input
                          type="text"
                          className={`input-amount ${
                            item.isEquivalent ? "readonly" : ""
                          }`}
                          value={`${item.amount.toLocaleString()} USD`}
                          readOnly={item.isEquivalent}
                          onChange={(e) => {
                            if (!item.isEquivalent) {
                              const amount =
                                parseFloat(
                                  e.target.value.replace(/[^0-9.-]/g, "")
                                ) || 0;
                              handleInstallmentChange(index, "amount", amount);
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
                          placeholder="dd/mm/aa"
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
                <button className="function-btn" onClick={handlePrint}>Imprimir</button>
                <button className="function-btn" onClick={handleSave}>Guardar</button>
                <button className="function-btn" onClick={handleEmail}>Enviar por correo</button>
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
      />
    </div>
  );
};

export default LotInfoModal;
