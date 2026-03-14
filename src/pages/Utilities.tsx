import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Zap, Droplets, Plus, Pencil, Trash2,
  Users, Printer, CheckCircle2,
  Clock, DollarSign, Landmark,
  Building2, ShieldAlert, Paperclip,
  Camera, FileUp, Eye, X, FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import IptuBillingDialog from "@/components/iptu/IptuBillingDialog";

/* ── Constants ────────────────────────────────────────── */
const CONNECTIONS = [
  { id: "422A", label: "422A (4 Salas)", description: "Salas 1-4 (Andar Superior)" },
  { id: "422", label: "422 (Salão)", description: "Salão comercial (Térreo)" },
  { id: "422B", label: "422B (Fundo)", description: "Sala Fundo (Térreo)" },
];

const BILLABLE_CONNECTIONS = CONNECTIONS.filter((c) => c.id !== "422");

/* ── Bill types (localStorage) ─────────────────────────── */
interface BillShare {
  unitId: string;
  unitName: string;
  amount: number;
  isPaid: boolean;
  paidDate: string | null;
}

interface UtilityBill {
  id: string;
  connectionId: string;
  billType: "electricity" | "water" | "iptu";
  referenceMonth: string;
  totalAmount: number;
  dueDate: string;
  billDate: string;
  notes: string;
  shares: BillShare[];
  createdAt: string;
  iptuRecordId?: string;
  iptuInstallmentNumber?: number;
  attachmentPath?: string;
}

const BILLS_KEY = "locagest-utility-bills";

const loadBills = (): UtilityBill[] => {
  try {
    return JSON.parse(localStorage.getItem(BILLS_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveBillsToStorage = (bills: UtilityBill[]) => {
  localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
};

const formatCurrency = (v: number) =>
  "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

const parseBRNumber = (str: string): number => {
  if (!str) return NaN;
  const trimmed = str.trim();
  if (trimmed.includes(",")) {
    return parseFloat(trimmed.replace(/\./g, "").replace(",", "."));
  }
  return parseFloat(trimmed);
};

/* ── Component ─────────────────────────────────────────── */
const Utilities = () => {
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission("admin");

  const [bills, setBills] = useState<UtilityBill[]>(loadBills);
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [editBillId, setEditBillId] = useState<string | null>(null);
  const [billForm, setBillForm] = useState({
    connectionId: "422A",
    billType: "electricity" as "electricity" | "water" | "iptu",
    referenceMonth: format(new Date(), "yyyy-MM"),
    totalAmount: "",
    dueDate: "",
    billDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });
  const [cobrancaMonth, setCobrancaMonth] = useState(format(new Date(), "yyyy-MM"));
  const [iptuBillingOpen, setIptuBillingOpen] = useState(false);

  // Attachment states
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [viewAttachmentUrl, setViewAttachmentUrl] = useState<string | null>(null);
  const [viewAttachmentOpen, setViewAttachmentOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Payment confirmation dialog states
  const [confirmPaymentOpen, setConfirmPaymentOpen] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{ billId: string; unitId: string; unitName: string; amount: number; isReversal: boolean } | null>(null);

  useEffect(() => {
    saveBillsToStorage(bills);
  }, [bills]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === BILLS_KEY) setBills(loadBills());
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const { data: units } = useQuery({
    queryKey: ["units-connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id, name, electricity_connection, water_connection")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Buscar contratos ativos para saber quais salas estão ocupadas
  const { data: activeContracts } = useQuery({
    queryKey: ["active-contracts-for-utilities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("unit_id")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const occupiedUnitIds = useMemo(() => {
    if (!activeContracts) return new Set<string>();
    return new Set(activeContracts.map((c) => c.unit_id));
  }, [activeContracts]);

  /** Retorna TODAS as salas vinculadas a uma ligação */
  const getShareUnits = (connId: string, type: "electricity" | "water" | "iptu") => {
    if (!units) return [];
    return units.filter((u) =>
      type === "electricity"
        ? u.electricity_connection === connId
        : u.water_connection === connId
    );
  };

  /** Retorna apenas as salas OCUPADAS (com contrato ativo) vinculadas a uma ligação */
  const getOccupiedShareUnits = (connId: string, type: "electricity" | "water" | "iptu") => {
    return getShareUnits(connId, type).filter((u) => occupiedUnitIds.has(u.id));
  };

  /* ── Attachment helpers ───────────────────────────── */
  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast.error("Tipo de arquivo não permitido. Use JPG, PNG, WebP ou PDF.");
      return;
    }
    setAttachmentFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setAttachmentPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  const clearAttachment = () => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const uploadAttachment = async (billId: string): Promise<string | null> => {
    if (!attachmentFile) return null;
    const ext = attachmentFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `bills/${billId}.${ext}`;
    setUploading(true);
    try {
      const { error } = await supabaseAdmin.storage
        .from("bill-attachments")
        .upload(path, attachmentFile, { upsert: true, contentType: attachmentFile.type });
      if (error) throw error;
      return path;
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Erro ao enviar arquivo: " + (err.message || "erro desconhecido"));
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (path: string) => {
    try {
      await supabaseAdmin.storage.from("bill-attachments").remove([path]);
    } catch (err) {
      console.error("Error deleting attachment:", err);
    }
  };

  const openAttachment = async (path: string) => {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from("bill-attachments")
        .createSignedUrl(path, 3600); // 1 hour
      if (error) throw error;
      setViewAttachmentUrl(data.signedUrl);
      setViewAttachmentOpen(true);
    } catch (err: any) {
      toast.error("Erro ao abrir arquivo: " + (err.message || "erro desconhecido"));
    }
  };

  const handleNewBill = () => {
    setEditBillId(null);
    clearAttachment();
    setBillForm({
      connectionId: "422A",
      billType: "electricity",
      referenceMonth: cobrancaMonth,
      totalAmount: "",
      dueDate: "",
      billDate: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    });
    setBillDialogOpen(true);
  };

  const handleEditBill = (bill: UtilityBill) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem editar contas.");
      return;
    }
    clearAttachment();
    // If editing bill has attachment, show as existing
    if (bill.attachmentPath) {
      setAttachmentPreview(bill.attachmentPath); // store path as indicator
    }
    setEditBillId(bill.id);
    setBillForm({
      connectionId: bill.connectionId,
      billType: bill.billType,
      referenceMonth: bill.referenceMonth,
      totalAmount: String(bill.totalAmount),
      dueDate: bill.dueDate,
      billDate: bill.billDate,
      notes: bill.notes,
    });
    setBillDialogOpen(true);
  };

  const saveBill = async () => {
    if (editBillId && !isAdmin) {
      toast.error("Apenas administradores podem editar contas.");
      return;
    }
    const allShareUnits = getShareUnits(billForm.connectionId, billForm.billType);
    const shareUnits = getOccupiedShareUnits(billForm.connectionId, billForm.billType);
    if (allShareUnits.length === 0) {
      toast.error("Nenhuma sala encontrada para essa ligação/tipo.");
      return;
    }
    if (shareUnits.length === 0) {
      toast.error("Nenhuma sala ocupada encontrada para essa ligação. Somente salas com contrato ativo entram no rateio.");
      return;
    }
    const totalAmount = parseBRNumber(billForm.totalAmount);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!billForm.dueDate) {
      toast.error("Informe o vencimento");
      return;
    }

    const perUnit = Math.round((totalAmount / shareUnits.length) * 100) / 100;
    const shares: BillShare[] = shareUnits.map((u, i) => ({
      unitId: u.id,
      unitName: u.name,
      amount:
        i === shareUnits.length - 1
          ? Math.round((totalAmount - perUnit * (shareUnits.length - 1)) * 100) / 100
          : perUnit,
      isPaid: false,
      paidDate: null,
    }));

    const billId = editBillId || crypto.randomUUID();

    // Upload attachment if a new file was selected
    let attachmentPath: string | undefined;
    if (attachmentFile) {
      const path = await uploadAttachment(billId);
      if (path) {
        attachmentPath = path;
      }
    } else if (editBillId) {
      // Keep existing attachment
      const existing = bills.find((b) => b.id === editBillId);
      attachmentPath = existing?.attachmentPath;
    }

    if (editBillId) {
      const existing = bills.find((b) => b.id === editBillId);
      if (existing) {
        shares.forEach((s) => {
          const prev = existing.shares.find((ps) => ps.unitId === s.unitId);
          if (prev) {
            s.isPaid = prev.isPaid;
            s.paidDate = prev.paidDate;
          }
        });
      }
      setBills((prev) =>
        prev.map((b) =>
          b.id === editBillId
            ? {
                ...b,
                connectionId: billForm.connectionId,
                billType: billForm.billType,
                referenceMonth: billForm.referenceMonth,
                totalAmount,
                dueDate: billForm.dueDate,
                billDate: billForm.billDate,
                notes: billForm.notes,
                shares,
                attachmentPath,
              }
            : b
        )
      );
      toast.success("Conta atualizada!");
    } else {
      setBills((prev) => [
        {
          id: billId,
          connectionId: billForm.connectionId,
          billType: billForm.billType,
          referenceMonth: billForm.referenceMonth,
          totalAmount,
          dueDate: billForm.dueDate,
          billDate: billForm.billDate,
          notes: billForm.notes,
          shares,
          createdAt: new Date().toISOString(),
          attachmentPath,
        },
        ...prev,
      ]);
      toast.success("Conta lançada!");
    }
    clearAttachment();
    setBillDialogOpen(false);
  };

  const deleteBill = (id: string) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem excluir contas.");
      return;
    }
    const bill = bills.find((b) => b.id === id);
    if (bill?.attachmentPath) {
      deleteAttachment(bill.attachmentPath);
    }
    setBills((prev) => prev.filter((b) => b.id !== id));
    toast.success("Conta removida!");
  };

  const toggleSharePaid = (billId: string, unitId: string) => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;
    const share = bill.shares.find((s) => s.unitId === unitId);
    if (!share) return;

    // If already paid, only admin can revert
    if (share.isPaid) {
      if (!isAdmin) {
        toast.error("Apenas administradores podem cancelar a confirmação de pagamento.");
        return;
      }
      // Admin reverting: show confirmation
      setPendingPayment({ billId, unitId, unitName: share.unitName, amount: share.amount, isReversal: true });
      setConfirmPaymentOpen(true);
      return;
    }

    // Marking as paid: show confirmation dialog
    setPendingPayment({ billId, unitId, unitName: share.unitName, amount: share.amount, isReversal: false });
    setConfirmPaymentOpen(true);
  };

  const executeTogglePayment = () => {
    if (!pendingPayment) return;
    const { billId, unitId } = pendingPayment;
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return;

    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== billId) return b;
        return {
          ...b,
          shares: b.shares.map((s) => {
            if (s.unitId !== unitId) return s;
            return {
              ...s,
              isPaid: !s.isPaid,
              paidDate: !s.isPaid ? format(new Date(), "yyyy-MM-dd") : null,
            };
          }),
        };
      })
    );

    if (bill.iptuRecordId && bill.iptuInstallmentNumber) {
      try {
        const iptuRecords: any[] = JSON.parse(
          localStorage.getItem("locagest-iptu") || "[]"
        );
        const recIdx = iptuRecords.findIndex(
          (r: any) => r.id === bill.iptuRecordId
        );
        if (recIdx !== -1) {
          const rec = iptuRecords[recIdx];
          const share = bill.shares.find((s) => s.unitId === unitId);
          const nowPaid = share ? !share.isPaid : false;
          rec.shares = rec.shares.map((sh: any) => {
            if (sh.unitId !== unitId) return sh;
            return {
              ...sh,
              installments: sh.installments.map((inst: any) => {
                if (inst.number !== bill.iptuInstallmentNumber) return inst;
                return {
                  ...inst,
                  isPaid: nowPaid,
                  paidDate: nowPaid ? format(new Date(), "yyyy-MM-dd") : null,
                };
              }),
            };
          });
          iptuRecords[recIdx] = rec;
          localStorage.setItem("locagest-iptu", JSON.stringify(iptuRecords));
        }
      } catch {
        /* ignore sync errors */
      }
    }

    toast.success(pendingPayment.isReversal ? "Pagamento revertido para pendente." : "Pagamento confirmado!");
    setPendingPayment(null);
    setConfirmPaymentOpen(false);
  };

  const printBillInvoice = (bill: UtilityBill, share: BillShare) => {
    const conn = CONNECTIONS.find((c) => c.id === bill.connectionId);
    const typeLabel =
      bill.billType === "electricity"
        ? "Energia Elétrica"
        : bill.billType === "iptu"
          ? "IPTU" + (bill.iptuInstallmentNumber ? " - Parcela " + bill.iptuInstallmentNumber : "")
          : "Água";
    const parts = bill.referenceMonth.split("-");
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];
    const refLabel = monthNames[parseInt(parts[1]) - 1] + "/" + parts[0];
    const w = window.open("", "_blank");
    if (!w) return;
    const dueFormatted = format(new Date(bill.dueDate + "T12:00:00"), "dd/MM/yyyy");
    const genDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
    let splitHtml = "";
    if (bill.shares.length > 1 && !bill.iptuRecordId) {
      splitHtml = '<div class="split-info"><strong>Rateio:</strong> Valor total: ' + formatCurrency(bill.totalAmount) + ' ÷ ' + bill.shares.length + ' salas = ' + formatCurrency(share.amount) + ' por sala</div>';
    } else if (bill.iptuRecordId) {
      splitHtml = '<div class="split-info"><strong>Rateio IPTU por m²</strong> · Valor da parcela para esta sala: ' + formatCurrency(share.amount) + '</div>';
    }
    const notesHtml = bill.notes ? '<p><strong>Obs:</strong> ' + bill.notes + '</p>' : '';
    w.document.write('<!DOCTYPE html><html><head><title>Conta ' + typeLabel + ' - ' + share.unitName + '</title><style>@page{margin:2cm;size:A4}body{font-family:"Segoe UI",Arial,sans-serif;font-size:12pt;line-height:1.6;color:#1a1a1a;max-width:700px;margin:0 auto}.header{text-align:center;border-bottom:3px solid #2563eb;padding-bottom:12px;margin-bottom:20px}.header h1{margin:0;font-size:18pt;color:#1e40af}.header p{margin:4px 0;color:#6b7280;font-size:10pt}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}.info-item{padding:8px 12px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb}.info-item .label{font-size:9pt;color:#6b7280;text-transform:uppercase;letter-spacing:.5px}.info-item .value{font-size:12pt;font-weight:600}.total-box{background:#eff6ff;border:2px solid #2563eb;border-radius:8px;padding:16px;text-align:center;margin:20px 0}.total-box .label{font-size:10pt;color:#3b82f6;text-transform:uppercase}.total-box .amount{font-size:24pt;font-weight:700;color:#1e40af}.split-info{background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;margin:16px 0;font-size:10pt;text-align:center;color:#92400e}.footer{margin-top:40px;text-align:center;font-size:9pt;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px}.sig{margin-top:50px;display:flex;justify-content:space-around;text-align:center}.sig div{border-top:1px solid #333;padding-top:4px;min-width:180px;font-size:10pt}</style></head><body><div class="header"><h1>' + (bill.billType === "iptu" ? "IPTU" : "CONTA DE " + typeLabel.toUpperCase()) + '</h1><p>LocaGest · Gestão de Locações</p></div><div class="info-grid"><div class="info-item"><div class="label">Unidade</div><div class="value">' + share.unitName + '</div></div><div class="info-item"><div class="label">' + (bill.billType === "iptu" ? "Parcela" : "Ligação") + '</div><div class="value">' + (bill.billType === "iptu" ? (bill.iptuInstallmentNumber || "—") : (conn?.label || bill.connectionId)) + '</div></div><div class="info-item"><div class="label">Referência</div><div class="value">' + refLabel + '</div></div><div class="info-item"><div class="label">Vencimento</div><div class="value">' + dueFormatted + '</div></div></div>' + splitHtml + '<div class="total-box"><div class="label">Valor a Pagar</div><div class="amount">' + formatCurrency(share.amount) + '</div></div>' + notesHtml + '<div class="sig"><div>Administração</div><div>Inquilino</div></div><div class="footer">Gerado em ' + genDate + '</div><script>window.print()<\/script></body></html>');
    w.document.close();
  };

  const formatMonth = (ym: string) => {
    const parts = ym.split("-");
    return format(new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1), "MMMM/yyyy", {
      locale: ptBR,
    });
  };

  interface UnitCharge {
    unitId: string;
    unitName: string;
    electricity: number;
    electricityBillId: string | null;
    electricityPaid: boolean;
    water: number;
    waterBillId: string | null;
    waterPaid: boolean;
    iptu: number;
    iptuBillId: string | null;
    iptuPaid: boolean;
    iptuInstallment: number | null;
    total: number;
    allPaid: boolean;
  }

  const cobrancaData = useMemo((): UnitCharge[] => {
    if (!units) return [];
    const monthBills = bills.filter((b) => b.referenceMonth === cobrancaMonth);
    const chargeMap = new Map<string, UnitCharge>();
    units.forEach((u) => {
      chargeMap.set(u.id, {
        unitId: u.id,
        unitName: u.name,
        electricity: 0,
        electricityBillId: null,
        electricityPaid: false,
        water: 0,
        waterBillId: null,
        waterPaid: false,
        iptu: 0,
        iptuBillId: null,
        iptuPaid: false,
        iptuInstallment: null,
        total: 0,
        allPaid: false,
      });
    });
    monthBills.forEach((bill) => {
      bill.shares.forEach((share) => {
        const entry = chargeMap.get(share.unitId);
        if (!entry) return;
        if (bill.billType === "electricity") {
          entry.electricity += share.amount;
          entry.electricityBillId = bill.id;
          entry.electricityPaid = share.isPaid;
        } else if (bill.billType === "water") {
          entry.water += share.amount;
          entry.waterBillId = bill.id;
          entry.waterPaid = share.isPaid;
        } else if (bill.billType === "iptu") {
          entry.iptu += share.amount;
          entry.iptuBillId = bill.id;
          entry.iptuPaid = share.isPaid;
          entry.iptuInstallment = bill.iptuInstallmentNumber ?? null;
        }
      });
    });
    chargeMap.forEach((entry) => {
      entry.total = entry.electricity + entry.water + entry.iptu;
      entry.allPaid =
        (entry.electricity === 0 || entry.electricityPaid) &&
        (entry.water === 0 || entry.waterPaid) &&
        (entry.iptu === 0 || entry.iptuPaid);
    });
    return Array.from(chargeMap.values())
      .filter((c) => c.total > 0)
      .sort((a, b) => a.unitName.localeCompare(b.unitName));
  }, [bills, units, cobrancaMonth]);

  const cobrancaTotals = useMemo(() => {
    let electricity = 0, water = 0, iptu = 0, total = 0, paid = 0, pending = 0;
    cobrancaData.forEach((c) => {
      electricity += c.electricity;
      water += c.water;
      iptu += c.iptu;
      total += c.total;
      if (c.allPaid) paid += c.total;
      else pending += c.total;
    });
    return { electricity, water, iptu, total, paid, pending };
  }, [cobrancaData]);

  const monthBillsList = useMemo(() => {
    return bills
      .filter((b) => b.referenceMonth === cobrancaMonth)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [bills, cobrancaMonth]);

  const printConsolidatedInvoice = (charge: UnitCharge) => {
    const parts = cobrancaMonth.split("-");
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];
    const refLabel = monthNames[parseInt(parts[1]) - 1] + "/" + parts[0];
    const monthBillsLocal = bills.filter((b) => b.referenceMonth === cobrancaMonth);
    let dueDate = "";
    for (const b of monthBillsLocal) {
      if (b.shares.some((s) => s.unitId === charge.unitId)) {
        if (!dueDate || b.dueDate > dueDate) dueDate = b.dueDate;
      }
    }
    const dueDateLabel = dueDate
      ? format(new Date(dueDate + "T12:00:00"), "dd/MM/yyyy")
      : "—";
    const items: { desc: string; value: number }[] = [];
    if (charge.electricity > 0)
      items.push({ desc: "⚡ Energia Elétrica (rateio)", value: charge.electricity });
    if (charge.water > 0)
      items.push({ desc: "�� Água (rateio)", value: charge.water });
    if (charge.iptu > 0)
      items.push({
        desc: "🏛️ IPTU" + (charge.iptuInstallment ? " - Parcela " + charge.iptuInstallment : "") + " (rateio por m²)",
        value: charge.iptu,
      });
    const itemsHtml = items.map((it) =>
      '<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb">' + it.desc + '</td><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">' + formatCurrency(it.value) + '</td></tr>'
    ).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    const genDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
    w.document.write('<!DOCTYPE html><html><head><title>Cobrança ' + charge.unitName + ' — ' + refLabel + '</title><style>@page{margin:2cm;size:A4}body{font-family:"Segoe UI",Arial,sans-serif;font-size:11pt;line-height:1.6;color:#1a1a1a;max-width:700px;margin:0 auto}.header{text-align:center;border-bottom:3px solid #1e40af;padding-bottom:12px;margin-bottom:24px}.header h1{margin:0;font-size:20pt;color:#1e40af}.header p{margin:4px 0;color:#6b7280;font-size:10pt}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0}.info-item{padding:10px 14px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb}.info-item .label{font-size:9pt;color:#6b7280;text-transform:uppercase;letter-spacing:.5px}.info-item .value{font-size:13pt;font-weight:600;margin-top:2px}table{width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}thead{background:#f1f5f9}thead th{padding:10px 12px;text-align:left;font-size:10pt;color:#475569;font-weight:600;text-transform:uppercase;letter-spacing:.5px}thead th:last-child{text-align:right}.total-row td{font-weight:700;font-size:13pt;border-top:2px solid #1e40af;padding:12px}.total-box{background:#eff6ff;border:2px solid #1e40af;border-radius:10px;padding:20px;text-align:center;margin:24px 0}.total-box .label{font-size:10pt;color:#3b82f6;text-transform:uppercase;letter-spacing:1px}.total-box .amount{font-size:28pt;font-weight:700;color:#1e40af;margin-top:4px}.footer{margin-top:50px;text-align:center;font-size:9pt;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px}.sig{margin-top:60px;display:flex;justify-content:space-around;text-align:center}.sig div{border-top:1px solid #333;padding-top:6px;min-width:200px;font-size:10pt}.note{background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px;margin:16px 0;font-size:10pt;color:#92400e}</style></head><body><div class="header"><h1>BOLETO DE COBRANÇA</h1><p>LocaGest · Gestão de Locações</p></div><div class="info-grid"><div class="info-item"><div class="label">Unidade / Sala</div><div class="value">' + charge.unitName + '</div></div><div class="info-item"><div class="label">Mês de Referência</div><div class="value">' + refLabel + '</div></div><div class="info-item"><div class="label">Vencimento</div><div class="value">' + dueDateLabel + '</div></div><div class="info-item"><div class="label">Data de Emissão</div><div class="value">' + format(new Date(), "dd/MM/yyyy") + '</div></div></div><table><thead><tr><th>Descrição</th><th>Valor</th></tr></thead><tbody>' + itemsHtml + '<tr class="total-row"><td>TOTAL A PAGAR</td><td style="text-align:right">' + formatCurrency(charge.total) + '</td></tr></tbody></table><div class="total-box"><div class="label">Valor Total</div><div class="amount">' + formatCurrency(charge.total) + '</div></div><div class="note"><strong>Atenção:</strong> Este boleto reúne todas as cobranças do mês (energia, água e IPTU). O pagamento deve ser realizado até a data de vencimento.</div><div class="sig"><div>Administração</div><div>Inquilino — ' + charge.unitName + '</div></div><div class="footer">Gerado em ' + genDate + ' · LocaGest</div><script>window.print()<\/script></body></html>');
    w.document.close();
  };

  const printAllInvoices = () => {
    const pending = cobrancaData.filter((c) => !c.allPaid && c.total > 0);
    if (pending.length === 0) {
      toast.info("Todas as cobranças do mês estão pagas.");
      return;
    }
    pending.forEach((c, i) => {
      setTimeout(() => printConsolidatedInvoice(c), i * 800);
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">
            Cobranças
          </h1>
          <p className="mt-1 text-muted-foreground">
            Visão consolidada de cobranças por unidade
          </p>
        </div>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span>
            Você pode visualizar, lançar contas e confirmar pagamentos. Para editar ou excluir,
            solicite a um administrador.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={cobrancaMonth}
            onChange={(e) => setCobrancaMonth(e.target.value)}
            className="w-44 h-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={printAllInvoices}
            disabled={cobrancaData.filter((c) => !c.allPaid).length === 0}
          >
            <Printer className="mr-1.5 h-4 w-4" /> Imprimir Todos
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIptuBillingOpen(true)}
            >
              <Landmark className="mr-1.5 h-4 w-4" /> IPTU
            </Button>
          )}
          <Button size="sm" onClick={handleNewBill}>
            <Plus className="mr-1.5 h-4 w-4" /> Lançar Conta
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/30 dark:to-orange-950/20 p-4">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 mb-1">
            <Zap className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Energia</span>
          </div>
          <p className="text-xl font-bold text-yellow-900 dark:text-yellow-200">
            {formatCurrency(cobrancaTotals.electricity)}
          </p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/20 p-4">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-1">
            <Droplets className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Água</span>
          </div>
          <p className="text-xl font-bold text-blue-900 dark:text-blue-200">
            {formatCurrency(cobrancaTotals.water)}
          </p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/20 p-4">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 mb-1">
            <Landmark className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">IPTU</span>
          </div>
          <p className="text-xl font-bold text-indigo-900 dark:text-indigo-200">
            {formatCurrency(cobrancaTotals.iptu)}
          </p>
        </div>
        <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20 p-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total</span>
          </div>
          <p className="text-xl font-bold text-emerald-900 dark:text-emerald-200">
            {formatCurrency(cobrancaTotals.total)}
          </p>
          <div className="flex items-center gap-3 mt-1 text-[11px]">
            <span className="text-green-600 dark:text-green-400 font-medium">
              ✓ {formatCurrency(cobrancaTotals.paid)}
            </span>
            {cobrancaTotals.pending > 0 && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                ✗ {formatCurrency(cobrancaTotals.pending)}
              </span>
            )}
          </div>
        </div>
      </div>

      {cobrancaData.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground font-medium">
            Nenhuma cobrança para{" "}
            <span className="capitalize">{formatMonth(cobrancaMonth)}</span>
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Clique em &quot;Lançar Conta&quot; para criar a primeira cobrança.
          </p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold">Unidade</TableHead>
                  <TableHead className="text-center font-semibold">
                    <div className="flex items-center justify-center gap-1">
                      <Zap className="h-3.5 w-3.5 text-yellow-600" /> Energia
                    </div>
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    <div className="flex items-center justify-center gap-1">
                      <Droplets className="h-3.5 w-3.5 text-blue-600" /> Água
                    </div>
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    <div className="flex items-center justify-center gap-1">
                      <Landmark className="h-3.5 w-3.5 text-indigo-600" /> IPTU
                    </div>
                  </TableHead>
                  <TableHead className="text-right font-semibold">Total</TableHead>
                  <TableHead className="text-center font-semibold">Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobrancaData.map((charge) => (
                  <TableRow
                    key={charge.unitId}
                    className={`group ${charge.allPaid ? "bg-green-50/50 dark:bg-green-950/10" : "hover:bg-muted/30"}`}
                  >
                    <TableCell>
                      <span className="font-semibold text-sm">{charge.unitName}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {charge.electricity > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-sm font-semibold tabular-nums ${charge.electricityPaid ? "text-green-600 dark:text-green-400" : ""}`}>
                            {formatCurrency(charge.electricity)}
                          </span>
                          {charge.electricityBillId ? (
                            charge.electricityPaid && !isAdmin ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] rounded-full">
                                ✓ Pago
                              </Badge>
                            ) : (
                              <Button
                                variant={charge.electricityPaid ? "outline" : "default"}
                                size="sm"
                                className="h-5 text-[10px] px-2 rounded-full"
                                onClick={() => toggleSharePaid(charge.electricityBillId!, charge.unitId)}
                              >
                                {charge.electricityPaid ? "✓ Pago" : "Confirmar"}
                              </Button>
                            )
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {charge.water > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-sm font-semibold tabular-nums ${charge.waterPaid ? "text-green-600 dark:text-green-400" : ""}`}>
                            {formatCurrency(charge.water)}
                          </span>
                          {charge.waterBillId ? (
                            charge.waterPaid && !isAdmin ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] rounded-full">
                                ✓ Pago
                              </Badge>
                            ) : (
                              <Button
                                variant={charge.waterPaid ? "outline" : "default"}
                                size="sm"
                                className="h-5 text-[10px] px-2 rounded-full"
                                onClick={() => toggleSharePaid(charge.waterBillId!, charge.unitId)}
                              >
                                {charge.waterPaid ? "✓ Pago" : "Confirmar"}
                              </Button>
                            )
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {charge.iptu > 0 ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-sm font-semibold tabular-nums ${charge.iptuPaid ? "text-green-600 dark:text-green-400" : ""}`}>
                            {formatCurrency(charge.iptu)}
                          </span>
                          {charge.iptuBillId ? (
                            charge.iptuPaid && !isAdmin ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] rounded-full">
                                ✓ Pago
                              </Badge>
                            ) : (
                              <Button
                                variant={charge.iptuPaid ? "outline" : "default"}
                                size="sm"
                                className="h-5 text-[10px] px-2 rounded-full"
                                onClick={() => toggleSharePaid(charge.iptuBillId!, charge.unitId)}
                              >
                                {charge.iptuPaid ? "✓ Pago" : "Confirmar"}
                              </Button>
                            )
                          ) : null}
                          {charge.iptuInstallment && (
                            <span className="text-[10px] text-muted-foreground">
                              Parc. {charge.iptuInstallment}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-sm">{formatCurrency(charge.total)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {charge.allPaid ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 text-[10px] rounded-full">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Quitado
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-[10px] rounded-full"
                        >
                          <Clock className="h-3 w-3 mr-1" /> Pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-60 hover:opacity-100 transition-opacity"
                        onClick={() => printConsolidatedInvoice(charge)}
                        title="Imprimir boleto"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/60 font-semibold border-t-2">
                  <TableCell className="text-sm">Total</TableCell>
                  <TableCell className="text-center text-sm">
                    {cobrancaTotals.electricity > 0 ? formatCurrency(cobrancaTotals.electricity) : "—"}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {cobrancaTotals.water > 0 ? formatCurrency(cobrancaTotals.water) : "—"}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {cobrancaTotals.iptu > 0 ? formatCurrency(cobrancaTotals.iptu) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-bold">
                    {formatCurrency(cobrancaTotals.total)}
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {monthBillsList.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Lançamentos —{" "}
            <span className="capitalize">{formatMonth(cobrancaMonth)}</span>
          </h2>
          <div className="space-y-2">
            {monthBillsList.map((bill) => {
              const allPaid = bill.shares.every((s) => s.isPaid);
              const paidCount = bill.shares.filter((s) => s.isPaid).length;
              const conn = CONNECTIONS.find((c) => c.id === bill.connectionId);
              const isIptuBill = !!bill.iptuRecordId;
              const Icon =
                bill.billType === "electricity"
                  ? Zap
                  : bill.billType === "iptu"
                    ? Landmark
                    : Droplets;
              const iconColor =
                bill.billType === "electricity"
                  ? "text-yellow-600"
                  : bill.billType === "iptu"
                    ? "text-indigo-600"
                    : "text-blue-600";
              const iconBg =
                bill.billType === "electricity"
                  ? "bg-yellow-100 dark:bg-yellow-900/30"
                  : bill.billType === "iptu"
                    ? "bg-indigo-100 dark:bg-indigo-900/30"
                    : "bg-blue-100 dark:bg-blue-900/30";
              const typeLabel =
                bill.billType === "electricity"
                  ? "Energia"
                  : bill.billType === "iptu"
                    ? "IPTU" + (bill.iptuInstallmentNumber ? " — Parcela " + bill.iptuInstallmentNumber : "")
                    : "Água";

              return (
                <Card
                  key={bill.id}
                  className={`overflow-hidden transition-all ${allPaid ? "opacity-60" : ""}`}
                >
                  <CardContent className="p-0">
                    <div className="flex items-center gap-4 p-4">
                      <div className={`rounded-xl p-2.5 ${iconBg}`}>
                        <Icon className={`h-5 w-5 ${iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{typeLabel}</span>
                          {bill.billType !== "iptu" && (
                            <span className="text-xs text-muted-foreground">
                              · {conn?.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>
                            Venc. {format(new Date(bill.dueDate + "T12:00:00"), "dd/MM/yyyy")}
                          </span>
                          {bill.attachmentPath && (
                            <button
                              className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline"
                              onClick={() => openAttachment(bill.attachmentPath!)}
                              title="Ver conta anexada"
                            >
                              <Paperclip className="h-3 w-3" /> Anexo
                            </button>
                          )}
                          {bill.notes && (
                            <span className="truncate max-w-[200px]">· {bill.notes}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="text-lg font-bold tabular-nums">
                            {formatCurrency(bill.totalAmount)}
                          </p>
                          {allPaid ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 text-[10px] rounded-full">
                              <CheckCircle2 className="h-3 w-3 mr-0.5" /> Quitado
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-[10px] rounded-full"
                            >
                              {paidCount}/{bill.shares.length} pago(s)
                            </Badge>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex flex-col gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEditBill(bill)}
                              disabled={isIptuBill}
                              title={isIptuBill ? "Gerenciado pelo IPTU" : "Editar"}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("Excluir esta conta?")) deleteBill(bill.id);
                              }}
                              disabled={isIptuBill}
                              title={isIptuBill ? "Gerenciado pelo IPTU" : "Excluir"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t bg-muted/20 divide-y">
                      {bill.shares.map((share) => (
                        <div
                          key={share.unitId}
                          className={`flex items-center gap-3 px-4 py-2.5 ${share.isPaid ? "bg-green-50/50 dark:bg-green-950/10" : ""}`}
                        >
                          <div
                            className={`h-2 w-2 rounded-full flex-shrink-0 ${share.isPaid ? "bg-green-500" : "bg-amber-400"}`}
                          />
                          <span className="text-sm flex-1">{share.unitName}</span>
                          <span className="text-sm font-semibold tabular-nums">
                            {formatCurrency(share.amount)}
                          </span>
                          {share.isPaid && !isAdmin ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleSharePaid(bill.id, share.unitId)}
                              title={share.isPaid ? "Cancelar confirmação (admin)" : "Confirmar pagamento"}
                            >
                              {share.isPaid ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => printBillInvoice(bill, share)}
                            title="Imprimir recibo"
                          >
                            <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Dialog
        open={billDialogOpen}
        onOpenChange={(open) => {
          if (!open) setEditBillId(null);
          setBillDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editBillId ? "Editar Conta" : "Lançar Conta"}</DialogTitle>
            <DialogDescription>
              O valor será rateado automaticamente entre as salas ocupadas (com contrato ativo) da ligação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={billForm.billType}
                  onValueChange={(v: "electricity" | "water" | "iptu") =>
                    setBillForm({ ...billForm, billType: v })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electricity">⚡ Energia</SelectItem>
                    <SelectItem value="water">💧 Água</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ligação</Label>
                <Select
                  value={billForm.connectionId}
                  onValueChange={(v) => setBillForm({ ...billForm, connectionId: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLABLE_CONNECTIONS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mês de Referência *</Label>
              <Input
                type="month"
                value={billForm.referenceMonth}
                onChange={(e) => setBillForm({ ...billForm, referenceMonth: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Total (R$) *</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={billForm.totalAmount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9.,]/g, "");
                    setBillForm({ ...billForm, totalAmount: raw });
                  }}
                  required
                  placeholder="400,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={billForm.dueDate}
                  onChange={(e) => setBillForm({ ...billForm, dueDate: e.target.value })}
                  required
                />
              </div>
            </div>

            {billForm.totalAmount &&
              (() => {
                const total = parseBRNumber(billForm.totalAmount);
                if (isNaN(total) || total <= 0) return null;
                const allShareUnits = getShareUnits(billForm.connectionId, billForm.billType);
                const shareUnits = getOccupiedShareUnits(billForm.connectionId, billForm.billType);
                const vacantUnits = allShareUnits.filter((u) => !occupiedUnitIds.has(u.id));
                if (allShareUnits.length === 0)
                  return <p className="text-xs text-muted-foreground">Nenhuma sala encontrada.</p>;
                if (shareUnits.length === 0)
                  return (
                    <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                        Nenhuma sala ocupada nesta ligação. Somente salas com contrato ativo entram no rateio.
                      </p>
                    </div>
                  );
                const perUnit = total / shareUnits.length;
                return (
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> Prévia do Rateio (somente salas ocupadas)
                    </p>
                    {shareUnits.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(total)} ÷ {shareUnits.length} ={" "}
                        <span className="font-semibold">{formatCurrency(perUnit)}</span>/sala
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {shareUnits.map((u) => (
                        <Badge key={u.id} variant="secondary" className="text-[10px]">
                          {u.name}: {formatCurrency(perUnit)}
                        </Badge>
                      ))}
                    </div>
                    {vacantUnits.length > 0 && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                        ⚠ Sala(s) vaga(s) excluída(s) do rateio:{" "}
                        {vacantUnits.map((u) => u.name).join(", ")}
                      </p>
                    )}
                  </div>
                );
              })()}

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={billForm.notes}
                onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })}
                rows={2}
                placeholder="Ex: Conta ref. fev/2026"
              />
            </div>

            {/* ── Anexar Conta ── */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" /> Anexar Conta
              </Label>

              {/* Show existing attachment (all users can view) */}
              {editBillId && !attachmentFile && bills.find((b) => b.id === editBillId)?.attachmentPath && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-2.5">
                  <FileText className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-xs text-green-700 dark:text-green-400 flex-1">Conta anexada</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => openAttachment(bills.find((b) => b.id === editBillId)!.attachmentPath!)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                  </Button>
                </div>
              )}

              {/* Admin-only: upload, replace, remove attachments */}
              {isAdmin && (
                <>
                  <p className="text-[11px] text-muted-foreground">
                    Envie uma foto ou PDF da conta. Máx 10MB. Formatos: JPG, PNG, WebP, PDF.
                  </p>

                  {/* Hidden inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  />

                  {/* File selected preview */}
                  {attachmentFile && (
                    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-2.5">
                      {attachmentPreview && attachmentFile.type.startsWith("image/") ? (
                        <img
                          src={attachmentPreview}
                          alt="Preview"
                          className="h-12 w-12 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{attachmentFile.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(attachmentFile.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={clearAttachment}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Upload buttons */}
                  {!attachmentFile && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileUp className="h-4 w-4 mr-1.5" /> Enviar Arquivo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera className="h-4 w-4 mr-1.5" /> Câmera
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* Non-admin: no attachment yet */}
              {!isAdmin && !(editBillId && bills.find((b) => b.id === editBillId)?.attachmentPath) && (
                <p className="text-[11px] text-muted-foreground italic">
                  Apenas administradores podem anexar ou remover documentos.
                </p>
              )}
            </div>

            <Button className="w-full" onClick={saveBill} disabled={uploading}>
              {uploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
              ) : (
                editBillId ? "Salvar" : "Lançar Conta"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <IptuBillingDialog
        open={iptuBillingOpen}
        onOpenChange={setIptuBillingOpen}
        onBillsGenerated={() => setBills(loadBills())}
      />

      {/* Attachment Viewer Dialog */}
      <Dialog open={viewAttachmentOpen} onOpenChange={setViewAttachmentOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="p-4 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Paperclip className="h-5 w-5" /> Conta Anexada
              </DialogTitle>
              <div className="flex gap-2">
                {viewAttachmentUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(viewAttachmentUrl, "_blank")}
                  >
                    <Eye className="mr-2 h-4 w-4" /> Abrir em Nova Aba
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="p-4 pt-2 flex items-center justify-center overflow-auto" style={{ maxHeight: "calc(90vh - 80px)" }}>
            {viewAttachmentUrl && (
              viewAttachmentUrl.match(/\.pdf(\?|$)/i) ? (
                <iframe
                  src={viewAttachmentUrl}
                  className="w-full rounded-lg border"
                  style={{ height: "75vh" }}
                  title="Visualização da conta"
                />
              ) : (
                <img
                  src={viewAttachmentUrl}
                  alt="Conta anexada"
                  className="max-w-full max-h-[75vh] rounded-lg shadow-lg object-contain"
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation Dialog */}
      <AlertDialog open={confirmPaymentOpen} onOpenChange={(open) => { if (!open) { setConfirmPaymentOpen(false); setPendingPayment(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingPayment?.isReversal ? "Cancelar Confirmação de Pagamento?" : "Confirmar Pagamento?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPayment?.isReversal ? (
                <>
                  Deseja reverter o pagamento de <strong>{pendingPayment.unitName}</strong> no valor de{" "}
                  <strong>{formatCurrency(pendingPayment.amount)}</strong> para <strong>pendente</strong>?
                </>
              ) : (
                <>
                  Confirmar o recebimento do pagamento de <strong>{pendingPayment?.unitName}</strong> no valor de{" "}
                  <strong>{formatCurrency(pendingPayment?.amount ?? 0)}</strong>?
                  <br />
                  <span className="text-xs text-muted-foreground mt-1 block">
                    Após confirmado, apenas um administrador poderá cancelar esta confirmação.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeTogglePayment}>
              {pendingPayment?.isReversal ? "Sim, Reverter" : "Sim, Confirmar Pagamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Utilities;
