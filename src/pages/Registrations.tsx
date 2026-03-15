import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  FileText,
  User,
  Phone,
  CreditCard,
  Loader2,
  Image,
  Download,
  MessageCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { maskCpf, maskPhone } from "@/lib/masks";

interface Registration {
  id: string;
  user_id: string;
  full_name: string;
  cpf: string;
  phone: string;
  verification_code: string | null;
  verified: boolean;
  application_status: string;
  rejection_reason: string | null;
  doc_cnh_path: string | null;
  doc_rg_path: string | null;
  doc_cpf_path: string | null;
  doc_address_proof_path: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

const Registrations = () => {
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "documents_submitted" | "pending_verification" | "approved" | "rejected">("all");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadRegistrations();
  }, []);

  const loadRegistrations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tenant_registrations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar cadastros: " + error.message);
    } else {
      setRegistrations((data || []) as Registration[]);
    }
    setLoading(false);
  };

  const getDocumentUrl = async (path: string): Promise<string | null> => {
    const { data } = await supabase.storage
      .from("tenant-documents")
      .createSignedUrl(path, 3600); // 1 hour
    return data?.signedUrl || null;
  };

  const handleViewDocument = async (path: string | null) => {
    if (!path) {
      toast.error("Documento não disponível.");
      return;
    }
    const url = await getDocumentUrl(path);
    if (url) {
      setPreviewUrl(url);
    } else {
      toast.error("Erro ao carregar documento.");
    }
  };

  const handleApprove = async () => {
    if (!selectedReg) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("tenant_registrations")
        .update({
          application_status: "approved",
          rejection_reason: adminNotes || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedReg.id);

      if (error) throw error;

      toast.success(`Cadastro de ${selectedReg.full_name} aprovado!`);
      setViewOpen(false);
      loadRegistrations();
    } catch (err: any) {
      toast.error("Erro ao aprovar: " + err.message);
    }
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!selectedReg) return;
    if (!adminNotes.trim()) {
      toast.error("Informe o motivo da recusa nas observações.");
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("tenant_registrations")
        .update({
          application_status: "rejected",
          rejection_reason: adminNotes,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedReg.id);

      if (error) throw error;

      toast.success(`Cadastro de ${selectedReg.full_name} recusado.`);
      setViewOpen(false);
      loadRegistrations();
    } catch (err: any) {
      toast.error("Erro ao recusar: " + err.message);
    }
    setActionLoading(false);
  };

  const copyVerificationCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending_verification: { label: "Verificação Pendente", className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
      verified: { label: "Documentos Pendentes", className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
      documents_submitted: { label: "Em Análise", className: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
      approved: { label: "Aprovado", className: "bg-green-500/10 text-green-700 border-green-500/20" },
      rejected: { label: "Recusado", className: "bg-red-500/10 text-red-700 border-red-500/20" },
    };
    const cfg = map[status] || { label: status, className: "" };
    return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
  };

  const filtered = filter === "all" ? registrations : registrations.filter((r) => r.application_status === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cadastros de Inquilinos</h1>
          <p className="text-muted-foreground">Gerencie as solicitações de cadastro e locação</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/20">
            {registrations.filter((r) => r.application_status === "documents_submitted").length} pendentes
          </Badge>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "Todos" },
          { key: "documents_submitted", label: "Em Análise" },
          { key: "pending_verification", label: "Verificação" },
          { key: "approved", label: "Aprovados" },
          { key: "rejected", label: "Recusados" },
        ].map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.key as typeof filter)}
          >
            {f.label}
            {f.key !== "all" && (
              <span className="ml-1.5 text-xs">
                ({registrations.filter((r) => r.application_status === f.key).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Nenhum cadastro encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">{reg.full_name}</TableCell>
                    <TableCell>{maskCpf(reg.cpf)}</TableCell>
                    <TableCell>{maskPhone(reg.phone)}</TableCell>
                    <TableCell>{statusBadge(reg.application_status)}</TableCell>
                    <TableCell>
                      {format(new Date(reg.created_at), "dd/MM/yy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {reg.application_status === "pending_verification" && reg.verification_code && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Copiar código"
                            onClick={() => copyVerificationCode(reg.verification_code!)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Visualizar"
                          onClick={() => {
                            setSelectedReg(reg);
                            setAdminNotes(reg.rejection_reason || "");
                            setViewOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ─── Detail / Approval Dialog ─── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedReg?.full_name}
            </DialogTitle>
            <DialogDescription>Detalhes do cadastro</DialogDescription>
          </DialogHeader>

          {selectedReg && (
            <div className="space-y-5">
              {/* Info grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> CPF
                  </p>
                  <p className="font-semibold">{maskCpf(selectedReg.cpf)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Telefone
                  </p>
                  <p className="font-semibold">{maskPhone(selectedReg.phone)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  {statusBadge(selectedReg.application_status)}
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Cadastro em</p>
                  <p className="font-semibold text-sm">
                    {format(new Date(selectedReg.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* Verification code (for pending_verification) */}
              {selectedReg.application_status === "pending_verification" && selectedReg.verification_code && (
                <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-semibold">Código de Verificação</p>
                        <p className="text-xs text-muted-foreground">
                          Envie este código via WhatsApp para o inquilino
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold tracking-widest">
                        {selectedReg.verification_code}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyVerificationCode(selectedReg.verification_code!)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Documents */}
              {(selectedReg.doc_cnh_path || selectedReg.doc_cpf_path || selectedReg.doc_rg_path) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documentos Enviados
                    <Badge variant="outline" className="text-xs">
                      {selectedReg.doc_cnh_path ? "CNH" : "CPF + RG"}
                    </Badge>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedReg.doc_cnh_path ? (
                      <button
                        type="button"
                        onClick={() => handleViewDocument(selectedReg.doc_cnh_path)}
                        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                      >
                        <Image className="h-5 w-5 text-muted-foreground" />
                        <div className="text-left">
                          <p className="text-sm font-medium">CNH</p>
                          <p className="text-xs text-muted-foreground">Clique para visualizar</p>
                        </div>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleViewDocument(selectedReg.doc_cpf_path)}
                          className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                        >
                          <Image className="h-5 w-5 text-muted-foreground" />
                          <div className="text-left">
                            <p className="text-sm font-medium">CPF</p>
                            <p className="text-xs text-muted-foreground">Clique para visualizar</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleViewDocument(selectedReg.doc_rg_path)}
                          className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                        >
                          <Image className="h-5 w-5 text-muted-foreground" />
                          <div className="text-left">
                            <p className="text-sm font-medium">RG</p>
                            <p className="text-xs text-muted-foreground">Clique para visualizar</p>
                          </div>
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => handleViewDocument(selectedReg.doc_address_proof_path)}
                      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <Image className="h-5 w-5 text-muted-foreground" />
                      <div className="text-left">
                        <p className="text-sm font-medium">Comprovante de Endereço</p>
                        <p className="text-xs text-muted-foreground">Clique para visualizar</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Admin notes */}
              {(selectedReg.application_status === "documents_submitted" ||
                selectedReg.application_status === "approved" ||
                selectedReg.application_status === "rejected") && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Observações do Administrador</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Motivo da aprovação/recusa, observações sobre documentos..."
                    rows={3}
                    disabled={selectedReg.application_status === "approved" || selectedReg.application_status === "rejected"}
                  />
                </div>
              )}
            </div>
          )}

          {/* Action buttons for pending_approval */}
          {selectedReg?.application_status === "documents_submitted" && (
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={actionLoading}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Recusar
              </Button>
              <Button
                onClick={handleApprove}
                disabled={actionLoading}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Aprovar Cadastro
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Document Preview Dialog ─── */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90dvh]">
          <DialogHeader>
            <DialogTitle>Visualização do Documento</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <div className="flex flex-col items-center gap-4">
              <img
                src={previewUrl}
                alt="Documento"
                className="max-h-[65vh] w-auto rounded-lg border object-contain"
                onError={(e) => {
                  // If it's a PDF, show link instead
                  (e.target as HTMLImageElement).style.display = "none";
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    const link = document.createElement("a");
                    link.href = previewUrl;
                    link.target = "_blank";
                    link.className = "text-primary underline";
                    link.textContent = "Abrir documento em nova aba";
                    parent.appendChild(link);
                  }
                }}
              />
              <Button variant="outline" asChild className="gap-2">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                  Abrir em nova aba
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Registrations;
