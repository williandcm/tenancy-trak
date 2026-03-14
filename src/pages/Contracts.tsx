import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, MoreHorizontal, Eye, Pencil, Printer, Trash2, CheckCircle, XCircle, TrendingUp, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Tables as DbTables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import ContractFormDialog from "@/components/contracts/ContractFormDialog";
import ContractViewDialog from "@/components/contracts/ContractViewDialog";
import ContractPrintView from "@/components/contracts/ContractPrintView";
import RentAdjustmentDialog from "@/components/contracts/RentAdjustmentDialog";

const statusMap = {
  active: { label: "Ativo", variant: "default" as const, className: "bg-green-500 text-white" },
  pending: { label: "Pendente", variant: "secondary" as const, className: "" },
  awaiting_approval: { label: "Aguardando Aprovação", variant: "secondary" as const, className: "bg-yellow-500 text-white" },
  expired: { label: "Expirado", variant: "outline" as const, className: "" },
  terminated: { label: "Rescindido", variant: "destructive" as const, className: "" },
};

const Contracts = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const isAdmin = hasPermission("admin");

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [contractToApprove, setContractToApprove] = useState<any>(null);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);

  // Queries
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["contracts-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          units(name, address_number, area_sqm, floor, description),
          tenants(full_name, nationality, rg, rg_issuer, cpf, address, address_number, neighborhood, complement, city, state, cep, phone, email),
          landlords!contracts_landlord_id_fkey(full_name, nationality, marital_status, rg, rg_issuer, cpf, address, address_number, neighborhood, complement, city, state, cep),
          second_landlord:landlords!contracts_second_landlord_id_fkey(full_name, nationality, marital_status, rg, rg_issuer, cpf, address, address_number, neighborhood, complement, city, state, cep)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: units } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: landlords } = useQuery({
    queryKey: ["landlords"],
    queryFn: async () => {
      const { data, error } = await supabase.from("landlords").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const saveContract = useMutation({
    mutationFn: async ({ payload, isEdit }: { payload: any; isEdit: boolean }) => {
      if (isEdit && selectedContract) {
        const { error } = await supabase.from("contracts").update(payload).eq("id", selectedContract.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contracts").insert(payload);
        if (error) throw error;
      }

      // Update unit status
      if (payload.status === "active") {
        await supabase
          .from("units")
          .update({ status: "occupied" as const, monthly_rent: payload.monthly_rent })
          .eq("id", payload.unit_id);
      } else if (payload.status === "terminated" || payload.status === "expired") {
        await supabase
          .from("units")
          .update({ status: "available" as const })
          .eq("id", payload.unit_id);
      }
    },
    onSuccess: (_, { isEdit }) => {
      queryClient.invalidateQueries({ queryKey: ["contracts-full"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setFormOpen(false);
      setSelectedContract(null);
      toast.success(isEdit ? "Contrato atualizado!" : "Contrato criado!");
    },
    onError: () => toast.error("Erro ao salvar contrato."),
  });

  const deleteContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts-full"] });
      toast.success("Contrato excluído!");
    },
    onError: () => toast.error("Erro ao excluir contrato."),
  });

  const approveContract = useMutation({
    mutationFn: async (contract: any) => {
      const { error } = await supabase
        .from("contracts")
        .update({ status: "active" as const })
        .eq("id", contract.id);
      if (error) throw error;

      // Update unit status to occupied
      await supabase
        .from("units")
        .update({ status: "occupied" as const, monthly_rent: contract.monthly_rent })
        .eq("id", contract.unit_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts-full"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["contracts-for-tenants"] });
      setViewOpen(false);
      setSelectedContract(null);
      toast.success("Contrato aprovado com sucesso!");
    },
    onError: () => toast.error("Erro ao aprovar contrato."),
  });

  const rejectContract = useMutation({
    mutationFn: async (contract: any) => {
      const { error } = await supabase
        .from("contracts")
        .delete()
        .eq("id", contract.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts-full"] });
      queryClient.invalidateQueries({ queryKey: ["contracts-for-tenants"] });
      setViewOpen(false);
      setSelectedContract(null);
      setRejectDialogOpen(false);
      setContractToApprove(null);
      toast.success("Solicitação de contrato recusada e removida.");
    },
    onError: () => toast.error("Erro ao recusar contrato."),
  });

  const applyAdjustment = useMutation({
    mutationFn: async ({ contractId, newRent, adjustmentDate }: { contractId: string; newRent: number; adjustmentDate: string }) => {
      const { error } = await supabase
        .from("contracts")
        .update({ monthly_rent: newRent })
        .eq("id", contractId);
      if (error) throw error;

      // Also update the unit's monthly_rent
      const contract = contracts?.find((c: any) => c.id === contractId);
      if (contract) {
        await supabase
          .from("units")
          .update({ monthly_rent: newRent })
          .eq("id", contract.unit_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts-full"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
    },
    onError: () => toast.error("Erro ao aplicar reajuste."),
  });

  const handleApplyAdjustment = (contractId: string, newRent: number, adjustmentDate: string) => {
    applyAdjustment.mutate({ contractId, newRent, adjustmentDate });
  };

  // Actions
  const openNew = () => {
    setSelectedContract(null);
    setFormOpen(true);
  };

  const openEdit = (contract: any) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem editar contratos.");
      return;
    }
    setViewOpen(false);
    // Use timeout to prevent ViewDialog's onOpenChange from clearing selectedContract
    setTimeout(() => {
      setSelectedContract(contract);
      setFormOpen(true);
    }, 0);
  };

  const openView = (contract: any) => {
    setSelectedContract(contract);
    setViewOpen(true);
  };

  const openPrint = (contract: any) => {
    setViewOpen(false);
    setTimeout(() => {
      setSelectedContract(contract);
      setPrintOpen(true);
    }, 0);
  };

  const handleSave = (payload: any, isEdit: boolean) => {
    saveContract.mutate({ payload, isEdit });
  };

  const handleApproveRequest = (contract: any) => {
    setContractToApprove(contract);
    setApproveDialogOpen(true);
  };

  const handleRejectRequest = (contract: any) => {
    setContractToApprove(contract);
    setRejectDialogOpen(true);
  };

  const confirmApprove = () => {
    if (contractToApprove) {
      approveContract.mutate(contractToApprove);
      setApproveDialogOpen(false);
      setContractToApprove(null);
    }
  };

  const confirmReject = () => {
    if (contractToApprove) {
      rejectContract.mutate(contractToApprove);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Contratos</h1>
          <p className="mt-1 text-muted-foreground">Gerencie contratos de locação</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
          <Button variant="outline" onClick={() => setAdjustmentOpen(true)}>
            <TrendingUp className="mr-2 h-4 w-4" /> Reajuste
          </Button>
          )}
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo Contrato
          </Button>
        </div>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Modo visualização — Você pode visualizar e criar contratos. Para editar, excluir ou aplicar reajustes, solicite a um administrador.</span>
        </div>
      )}

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Inquilino</TableHead>
                <TableHead>Locador</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Término</TableHead>
                <TableHead>Aluguel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : contracts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum contrato cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                contracts?.map((c: any) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openView(c)}
                  >
                    <TableCell className="font-medium">
                      {c.units?.name} ({c.units?.address_number})
                    </TableCell>
                    <TableCell>{c.tenants?.full_name}</TableCell>
                    <TableCell>{c.landlords?.full_name}</TableCell>
                    <TableCell>{format(new Date(c.start_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{format(new Date(c.end_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      R$ {Number(c.monthly_rent).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusMap[c.status as keyof typeof statusMap]?.variant}
                        className={statusMap[c.status as keyof typeof statusMap]?.className}
                      >
                        {statusMap[c.status as keyof typeof statusMap]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openView(c); }}>
                            <Eye className="mr-2 h-4 w-4" /> Visualizar
                          </DropdownMenuItem>
                          {isAdmin && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openPrint(c); }}>
                            <Printer className="mr-2 h-4 w-4" /> Imprimir
                          </DropdownMenuItem>
                          {c.status === "awaiting_approval" && hasPermission("admin") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-green-600 focus:text-green-600"
                                onClick={(e) => { e.stopPropagation(); handleApproveRequest(c); }}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" /> Aprovar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => { e.stopPropagation(); handleRejectRequest(c); }}
                              >
                                <XCircle className="mr-2 h-4 w-4" /> Recusar
                              </DropdownMenuItem>
                            </>
                          )}
                          {isAdmin && (
                          <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Tem certeza que deseja excluir este contrato?")) {
                                deleteContract.mutate(c.id);
                              }
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                          </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Form Dialog (Create / Edit) */}
      <ContractFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setSelectedContract(null);
        }}
        contract={selectedContract}
        units={units ?? []}
        tenants={tenants ?? []}
        landlords={landlords ?? []}
        onSave={handleSave}
        saving={saveContract.isPending}
      />

      {/* View Dialog */}
      <ContractViewDialog
        open={viewOpen}
        onOpenChange={(open) => {
          setViewOpen(open);
          if (!open) setSelectedContract(null);
        }}
        contract={selectedContract}
        onEdit={() => openEdit(selectedContract)}
        onPrint={() => openPrint(selectedContract)}
        onApprove={(c) => handleApproveRequest(c)}
        onReject={(c) => handleRejectRequest(c)}
        approving={approveContract.isPending}
      />

      {/* Print View */}
      <ContractPrintView
        open={printOpen}
        onOpenChange={(open) => {
          setPrintOpen(open);
          if (!open) setSelectedContract(null);
        }}
        contract={selectedContract}
      />

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Aprovar Contrato
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja <strong>aprovar</strong> este contrato?
              {contractToApprove && (
                <span className="block mt-2 text-sm">
                  <strong>Inquilino:</strong> {contractToApprove.tenants?.full_name}<br />
                  <strong>Unidade:</strong> {contractToApprove.units?.name} ({contractToApprove.units?.address_number})<br />
                  <strong>Aluguel:</strong> R$ {Number(contractToApprove.monthly_rent).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              )}
              <span className="block mt-2">
                O contrato será ativado e a unidade ficará como <strong>ocupada</strong>.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={confirmApprove}
              disabled={approveContract.isPending}
            >
              {approveContract.isPending ? "Aprovando..." : "Confirmar Aprovação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Recusar Solicitação
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja <strong>recusar</strong> esta solicitação de contrato?
              {contractToApprove && (
                <span className="block mt-2 text-sm">
                  <strong>Inquilino:</strong> {contractToApprove.tenants?.full_name}<br />
                  <strong>Unidade:</strong> {contractToApprove.units?.name} ({contractToApprove.units?.address_number})
                </span>
              )}
              <span className="block mt-2 text-destructive font-medium">
                A solicitação será removida permanentemente.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={confirmReject}
              disabled={rejectContract.isPending}
            >
              {rejectContract.isPending ? "Recusando..." : "Confirmar Recusa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Rent Adjustment Dialog */}
      <RentAdjustmentDialog
        open={adjustmentOpen}
        onOpenChange={setAdjustmentOpen}
        contracts={contracts ?? []}
        onApplyAdjustment={handleApplyAdjustment}
        applying={applyAdjustment.isPending}
      />
    </div>
  );
};

export default Contracts;
