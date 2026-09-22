
import React, { useState, useMemo, useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
const { useParams, useNavigate, Link, useSearchParams } = ReactRouterDOM as any;
import { db } from '../services/db';
import { AnimalCondicao, Especie, KennelType, Adotante, AnimalJoined, ClinicalRecord, Prescription, Referral, Porte, CirurgiaStatus, CirurgiaPrioridade, AgendamentoCirurgia } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, Dog, User, Clipboard, FileText, Heart, 
  Stethoscope, Clock, MapPin, Scale, Calendar, Info, Plus, History, Phone, ShieldCheck, Pill, Skull, AlertTriangle, Leaf, Home, ArrowRightLeft, CheckCircle2, Activity, ArrowRight, UserCheck, Share2, Thermometer, Droplets, HeartPulse, Wind, Microscope, Syringe, Palette, IdCard, Eye, Camera, FlaskConical, ExternalLink, FileSearch, X, FileBadge2, MessageSquare, BriefcaseMedical, Zap, FileType, HeartHandshake, Save, Printer, Ambulance, UserCircle, ClipboardCheck, LogOut, Cpu, QrCode, HelpCircle, Scissors, XCircle, Check
} from 'lucide-react';
import { formatCPF, formatTelefone, validateCPF } from '../utils/validation';
import { printAnimalSheet } from '../utils/printAnimalSheet';

const safeFormatDate = (dateStr?: string | null, formatPattern: string = 'dd/MM/yyyy', fallback: string = '-') => {
  if (!dateStr) return fallback;
  try {
    const trimmed = String(dateStr).trim();
    if (!trimmed) return fallback;
    const parsed = trimmed.includes('T') ? new Date(trimmed) : new Date(`${trimmed}T12:00:00`);
    if (isNaN(parsed.getTime())) return fallback;
    return format(parsed, formatPattern, { locale: ptBR });
  } catch {
    return fallback;
  }
};

const AnimalDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'ficha';
  
  const user = db.getCurrentUser();
  const isVetOrAdmin = user?.role === 'VETERINARIO' || user?.role === 'ADMIN';

  const [animal, setAnimal] = useState<AnimalJoined | undefined>(undefined);
  const [modalType, setModalType] = useState<'ADOCAO' | 'SOLTURA' | 'OBITO' | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states for modals
  const [formAdocao, setFormAdocao] = useState({ nome: '', cpf: '', telefone: '', data: new Date().toISOString().split('T')[0] });
  const [formSoltura, setFormSoltura] = useState({ local: '', data: new Date().toISOString().split('T')[0] });
  const [formObito, setFormObito] = useState({ tipo: 'Óbito Natural', causa: '', data: new Date().toISOString().split('T')[0] });

  // Accommodations state
  const [occupations, setOccupations] = useState(() => db.getOccupations());
  const [isTransferring, setIsTransferring] = useState(false);
  const [selectedKennelId, setSelectedKennelId] = useState('');
  const [justification, setJustification] = useState('');

  // Internação para Animal Externo (Com Tutor)
  const [showInternacaoModal, setShowInternacaoModal] = useState(false);
  const [internacaoTipoAcomodacao, setInternacaoTipoAcomodacao] = useState<KennelType | ''>('');
  const [internacaoJustificativa, setInternacaoJustificativa] = useState('');
  const [isSubmittingInternacao, setIsSubmittingInternacao] = useState(false);

  const handleConfirmarInternacao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !user) return;
    if (!internacaoTipoAcomodacao) {
      alert("Por favor, selecione o tipo de acomodação recomendada para a internação.");
      return;
    }
    if (!internacaoJustificativa.trim()) {
      alert("Por favor, preencha a justificativa técnica para a internação.");
      return;
    }
    setIsSubmittingInternacao(true);
    try {
      db.internarAnimalExterno(animal.id, internacaoTipoAcomodacao as KennelType, internacaoJustificativa.trim(), user.id);
      setShowInternacaoModal(false);
      setInternacaoTipoAcomodacao('');
      setInternacaoJustificativa('');
      reloadAnimal();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar internação.');
    } finally {
      setIsSubmittingInternacao(false);
    }
  };

  const handleDarAltaHospitalar = () => {
    if (!animal || !user) return;
    if (!window.confirm(`Confirma a alta médica/hospitalar para o paciente ${animal.nome}? O paciente será liberado para o tutor e desalocado de qualquer baia ativa.`)) return;
    try {
      db.darAltaAnimalExterno(animal.id, user.id);
      reloadAnimal();
    } catch (err: any) {
      alert(err.message || 'Erro ao dar alta.');
    }
  };

  const loadAnimalData = () => {
    const data = db.getAnimalsJoined().find(a => a.id === id);
    setAnimal(data);
    if (data) {
      if (data.adotante) setFormAdocao({ ...formAdocao, nome: data.adotante.nome, cpf: data.adotante.cpf, telefone: data.adotante.telefone });
      if (data.localSoltura) setFormSoltura({ ...formSoltura, local: data.localSoltura });
      if (data.causaObito) {
        if (data.causaObito.toLowerCase().startsWith('eutanásia') || data.causaObito.toLowerCase().startsWith('eutanasia')) {
          const causaClean = data.causaObito.replace(/^eutana[sś]ia\s*[-–:]?\s*/i, '');
          setFormObito({ tipo: 'Eutanásia', causa: causaClean, data: data.dataObito || new Date().toISOString().split('T')[0] });
        } else if (data.causaObito.toLowerCase().startsWith('óbito natural') || data.causaObito.toLowerCase().startsWith('obito natural')) {
          const causaClean = data.causaObito.replace(/^óbito natural\s*[-–:]?\s*/i, '');
          setFormObito({ tipo: 'Óbito Natural', causa: causaClean, data: data.dataObito || new Date().toISOString().split('T')[0] });
        } else {
          setFormObito({ tipo: 'Óbito Natural', causa: data.causaObito, data: data.dataObito || new Date().toISOString().split('T')[0] });
        }
      }
    }
  };

  useEffect(() => {
    loadAnimalData();

    const handleUpdate = () => {
      reloadAnimal();
    };

    window.addEventListener('sisbem-occupations-changed', handleUpdate);
    window.addEventListener('sisbem-animals-changed', handleUpdate);
    window.addEventListener('sisbem-kennels-changed', handleUpdate);
    window.addEventListener('sisbem-settings-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('sisbem-occupations-changed', handleUpdate);
      window.removeEventListener('sisbem-animals-changed', handleUpdate);
      window.removeEventListener('sisbem-kennels-changed', handleUpdate);
      window.removeEventListener('sisbem-settings-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [id]);

  const reloadAnimal = () => {
    loadAnimalData();
    setOccupations(db.getOccupations());
  };

  const animalOccupations = useMemo(() => {
    return occupations
      .filter(o => o.animalId === id)
      .sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());
  }, [occupations, id]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!animal || !selectedKennelId) return;

    try {
      await db.allocateAnimalAsync({
        kennelId: selectedKennelId,
        animalId: animal.id,
        vetId: user!.id,
        justification: justification || 'Movimentação realizada na ficha'
      });
      setIsTransferring(false);
      setSelectedKennelId('');
      setJustification('');
      reloadAnimal();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const historicoOrdenado = useMemo(() => {
    if (!animal?.historico) return [];
    return [...animal.historico].sort((a, b) => 
      new Date(b.dataAtendimento).getTime() - new Date(a.dataAtendimento).getTime()
    );
  }, [animal]);

  const todasReceitas = useMemo(() => {
    if (!animal?.historico) return [];
    return animal.historico
      .filter(record => record.receitas && record.receitas.length > 0)
      .map(record => ({
        data: record.dataAtendimento,
        receitas: record.receitas,
        atendimentoId: record.id,
        veterinarioId: record.veterinarioId
      }))
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [animal]);

  const handleOpenAttachment = (base64Data: string, fileName: string) => {
    const win = window.open();
    if (win) {
      win.document.write(
        `<html><head><title>${fileName}</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;background:#1e293b;}</style></head><body>` +
        (base64Data.startsWith('data:application/pdf') 
          ? `<embed width="100%" height="100%" src="${base64Data}" type="application/pdf">`
          : `<img src="${base64Data}" style="max-width:100%; max-height:100%; object-fit:contain;">`) +
        `</body></html>`
      );
      win.document.close();
    }
  };

  const handlePrintPrescription = (prescriptions: Prescription[]) => {
    if (!animal || prescriptions.length === 0) return;
    const vet = db.getUsers().find(u => u.id === prescriptions[0].veterinarioId);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = generatePrintHTML('Receituário Clínico', animal, vet, prescriptions, 'PRESCRIPTION');
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintReferral = (referrals: Referral[]) => {
    if (!animal || referrals.length === 0) return;
    const vet = db.getUsers().find(u => u.id === referrals[0].veterinarioId);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = generatePrintHTML('Guia de Encaminhamento Veterinário', animal, vet, referrals, 'REFERRAL');
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const atendimentosCirurgicos = useMemo(() => {
    if (!animal?.historico) return [];
    return animal.historico.filter(h => 
      (h.diagnosticoClinico && (h.diagnosticoClinico.toLowerCase().includes('cirurg') || h.diagnosticoClinico.toLowerCase().includes('castra'))) ||
      (h.tratamentoAmbulatorial && (h.tratamentoAmbulatorial.toLowerCase().includes('cirurg') || h.tratamentoAmbulatorial.toLowerCase().includes('castra')))
    );
  }, [animal]);

  const handlePrintReceitasCirurgia = (c: AgendamentoCirurgia) => {
    if (!animal || !c.receitasPosOperatorias || c.receitasPosOperatorias.length === 0) return;
    const vet = db.getUsers().find(u => u.id === (c.realizadaPorId || c.veterinarioResponsavelId)) || {
      name: c.realizadaPorNome || c.veterinarioResponsavelNome || 'Médico(a) Veterinário(a)',
      crmv: 'CRMV'
    };
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Permita pop-ups para imprimir o receituário.');
      return;
    }
    const html = generatePrintHTML(
      `Receituário Pós-Cirúrgico - ${c.tipoCirurgia}`,
      animal,
      vet,
      c.receitasPosOperatorias,
      'PRESCRIPTION'
    );
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintTermoCirurgico = (c: AgendamentoCirurgia) => {
    if (!animal) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Permita pop-ups para imprimir o termo.');
      return;
    }

    const dataFormatted = safeFormatDate(c.dataAgendada, "dd 'de' MMMM 'de' yyyy", c.dataAgendada);

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Termo de Consentimento Cirúrgico - ${animal.nome}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.55; font-size: 14px; }
          .header { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 19px; font-weight: bold; text-transform: uppercase; color: #0f766e; }
          .subtitle { font-size: 13.5px; color: #64748b; }
          .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
          .label { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #64748b; }
          .value { font-size: 14.5px; font-weight: bold; color: #0f172a; margin-top: 2px; }
          .text-block { text-align: justify; font-size: 13px; color: #334155; margin: 16px 0; line-height: 1.5; }
          .signatures { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
          .sig-line { border-top: 1px solid #0f172a; text-align: center; padding-top: 8px; font-weight: bold; font-size: 13.5px; }
          @media print { body { padding: 20px; font-size: 14px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">SISBEM - Centro Municipal de Bem-Estar Animal</div>
          <div class="subtitle">TERMO DE AUTORIZAÇÃO E CONSENTIMENTO PARA PROCEDIMENTO CIRÚRGICO / CASTRAÇÃO</div>
        </div>

        <div class="box">
          <div class="label" style="margin-bottom: 8px; color: #0f766e;">1. DADOS DO PACIENTE</div>
          <div class="grid-3">
            <div><div class="label">Nome do Animal</div><div class="value">${animal.nome.toUpperCase()}</div></div>
            <div><div class="label">Espécie / Sexo</div><div class="value">${animal.especie} - ${animal.sexo}</div></div>
            <div><div class="label">Porte / Raça</div><div class="value">${animal.porte} | ${animal.raca}</div></div>
            <div><div class="label">Peso Estimado</div><div class="value">${animal.peso ? animal.peso + ' kg' : 'A aferir'}</div></div>
            <div><div class="label">Microchip</div><div class="value">${animal.numeroMicrochip || 'Não microchipado'}</div></div>
            <div><div class="label">Data Agendada</div><div class="value">${dataFormatted} (${c.horario || '08:30'})</div></div>
          </div>
        </div>

        <div class="box">
          <div class="label" style="margin-bottom: 8px; color: #0f766e;">2. RESPONSÁVEL / ORIGEM</div>
          <div class="grid-2">
            <div><div class="label">${animal.temTutor ? 'Tutor Legal' : 'Solicitante / Órgão'}</div><div class="value">${animal.temTutor ? (animal.tutor?.nomeCompleto || 'Tutor Externo') : (animal.solicitante?.nomeCompleto || 'Recolhimento Municipal')}</div></div>
            <div><div class="label">CPF / Registro</div><div class="value">${animal.temTutor ? (animal.tutor?.cpf || '-') : (animal.solicitante?.cpf || '-')}</div></div>
            <div><div class="label">Telefone de Contato</div><div class="value">${animal.temTutor ? (animal.tutor?.telefone || '-') : (animal.solicitante?.telefone || '-')}</div></div>
            <div><div class="label">Endereço</div><div class="value">${animal.temTutor ? (animal.tutor?.endereco || '-') : (animal.solicitante?.endereco || animal.localResgate || '-')}</div></div>
          </div>
        </div>

        <div class="box">
          <div class="label" style="margin-bottom: 8px; color: #0f766e;">3. PROCEDIMENTO E ORIENTAÇÕES PRÉ-OPERATÓRIAS</div>
          <div><div class="label">Procedimento Proposto</div><div class="value">${c.tipoCirurgia}</div></div>
          <div style="margin-top: 8px;"><div class="label">Preparo Pré-Operatório</div><div class="value">${c.observacoesPreOperatorias || 'Jejum alimentar de 8h e hídrico de 2h.'}</div></div>
        </div>

        <div class="text-block">
          <p>Declaro estar ciente de que qualquer ato cirúrgico e anestésico envolve riscos imprevisíveis à vida do animal. Autorizo expressamente o corpo médico-veterinário do Centro de Bem-Estar Animal a realizar o procedimento cirúrgico/esterilização e os procedimentos complementares ou de emergência que se fizerem necessários durante o ato cirúrgico.</p>
          <p style="margin-top: 8px;">Comprometo-me a seguir todas as orientações pós-operatórias para a devida recuperação do paciente, incluindo a administração dos medicamentos prescritos e o uso de colar elizabetano / roupa cirúrgica.</p>
        </div>

        <div class="signatures">
          <div>
            <div class="sig-line">
              ${animal.temTutor && animal.tutor ? animal.tutor.nomeCompleto : 'Responsável / Solicitante'}<br>
              <span style="font-size: 11.5px; font-weight: normal; color: #64748b;">Assinatura do Responsável</span>
            </div>
          </div>
          <div>
            <div class="sig-line">
              ${c.realizadaPorNome || c.veterinarioResponsavelNome || 'Médico Veterinário Responsável'}<br>
              <span style="font-size: 11.5px; font-weight: normal; color: #64748b;">CRMV / SISBEM</span>
            </div>
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const generatePrintHTML = (title: string, animal: AnimalJoined, vet: any, items: any[], type: 'PRESCRIPTION' | 'REFERRAL') => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SISBEM - ${title}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap');
          body { font-family: 'Montserrat', sans-serif; padding: 40px; color: #000; line-height: 1.45; background: #fff; font-size: 14px; }
          .header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 30px; border-bottom: 3px solid #000; padding-bottom: 15px; }
          .title-container { flex-grow: 1; }
          .pref-de { font-size: 20px; font-weight: 400; letter-spacing: 12px; margin: 0; color: #000; }
          .pref-nome { font-size: 50px; font-weight: 900; margin: -5px 0 0 0; line-height: 1; letter-spacing: -2px; color: #000; }
          .sub-title { font-size: 18px; font-weight: 700; margin: 10px 0 0 0; color: #000; border-top: 2px solid #000; padding-top: 5px; }
          .meta-info { text-align: right; min-width: 140px; }
          .doc-tag { font-size: 13px; font-weight: 900; text-transform: uppercase; color: #444; margin-bottom: 4px; }
          .doc-date { font-size: 18px; font-weight: 700; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 13px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 12px; color: #444; letter-spacing: 1px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .box { background: #fcfcfc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px; }
          .label { font-size: 11.5px; font-weight: 900; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
          .val { font-size: 16px; font-weight: 700; color: #000; }
          .item-box { border: 2px solid #000; padding: 20px; border-radius: 8px; margin-top: 15px; page-break-inside: avoid; }
          .item-top { border-bottom: 1px solid #000; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
          .item-name { font-size: 22px; font-weight: 900; text-transform: uppercase; }
          .item-tag { font-size: 13px; font-weight: 900; background: #000; color: #fff; padding: 4px 12px; border-radius: 4px; }
          .item-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
          .obs-box { margin-top: 15px; padding: 14px; background: #f5f5f5; border-left: 5px solid #000; font-style: italic; font-size: 14.5px; line-height: 1.5; }
          .footer { margin-top: 80px; text-align: center; }
          .line { width: 300px; border-top: 1px solid #000; margin: 0 auto 10px; }
          .vet { font-size: 16px; font-weight: 900; text-transform: uppercase; }
          .crmv { font-size: 13.5px; font-weight: 700; color: #444; }
          @media print { body { padding: 0; font-size: 14px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title-container">
            <div class="pref-de">PREFEITURA DE</div>
            <div class="pref-nome">POUSO ALEGRE</div>
            <div class="sub-title">Superintendência de Proteção e Cuidado Animal</div>
          </div>
          <div class="meta-info">
            <div class="doc-tag">${title}</div>
            <div class="doc-date">${format(new Date(), 'dd/MM/yyyy')}</div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Paciente</div>
          <div class="grid">
            <div class="box"><div class="label">Animal / Espécie</div><div class="val">${animal.nome} (${animal.especie})</div></div>
            <div class="box"><div class="label">Raça / Sexo / Peso</div><div class="val">${animal.raca} • ${animal.sexo} • ${animal.peso}kg</div></div>
            <div class="box" style="grid-column: span 2"><div class="label">${animal.temTutor ? 'Responsável Legal' : 'Acomodação Interna'}</div><div class="val">${animal.temTutor ? (animal.tutor?.nomeCompleto || 'Não informado') : (animal.currentOccupation?.kennel?.name || 'Centro de Bem-Estar Animal')}</div></div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">${type === 'PRESCRIPTION' ? 'Prescrições' : 'Detalhes do Encaminhamento'}</div>
          ${items.map(i => `
            <div class="item-box">
              <div class="item-top">
                <div class="item-name">${type === 'PRESCRIPTION' ? i.medicamento : i.especialidade}</div>
                <div class="item-tag">${type === 'PRESCRIPTION' ? i.via : 'URGÊNCIA: ' + i.urgencia}</div>
              </div>
              <div class="item-grid">
                ${type === 'PRESCRIPTION' ? `
                  <div><div class="label">Dosagem</div><div class="val">${i.dosagem}</div></div>
                  <div><div class="label">Frequência</div><div class="val">${i.frequencia}</div></div>
                  <div><div class="label">Duração</div><div class="val">${i.duracao}</div></div>
                ` : `
                  <div style="grid-column: span 3"><div class="label">Local Sugerido</div><div class="val">${i.localSugerido || 'À critério do tutor'}</div></div>
                `}
              </div>
              <div class="obs-box">
                <strong>${type === 'PRESCRIPTION' ? 'Orientações' : 'Justificativa Técnica'}:</strong> ${type === 'PRESCRIPTION' ? (i.observacoes || 'N/A') : i.motivo}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="footer">
          <div class="line"></div>
          <div class="vet">${vet?.name || 'Médico Veterinário'}</div>
          <div class="crmv">${vet?.crmv ? `CRMV: ${vet.crmv}` : 'Responsável Técnico'}</div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;
  };

  const handleSaveModal = async () => {
    if (!animal) return;
    setLoading(true);

    try {
      const updateData: any = { id: animal.id };

      if (modalType === 'ADOCAO') {
        if (!validateCPF(formAdocao.cpf)) {
          alert('CPF do adotante inválido.');
          setLoading(false);
          return;
        }
        updateData.condicao = AnimalCondicao.ADOTADO;
        updateData.dataAdocao = formAdocao.data;
        updateData.adotante = { nome: formAdocao.nome, cpf: formAdocao.cpf, telefone: formAdocao.telefone };
      } else if (modalType === 'SOLTURA') {
        updateData.condicao = AnimalCondicao.SOLTURA;
        updateData.dataSoltura = formSoltura.data;
        updateData.localSoltura = formSoltura.local;
      } else if (modalType === 'OBITO') {
        updateData.condicao = AnimalCondicao.OBITO;
        updateData.dataObito = formObito.data;
        const tipoObito = formObito.tipo || 'Óbito Natural';
        const causaObitoText = formObito.causa ? formObito.causa.trim() : '';
        updateData.causaObito = causaObitoText ? `${tipoObito} - ${causaObitoText}` : tipoObito;
      }

      db.saveAnimal(updateData, null, user!.id);
      loadAnimalData();
      setModalType(null);
    } catch (err) {
      alert('Erro ao salvar informações.');
    } finally {
      setLoading(false);
    }
  };

  if (!animal) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="bg-slate-100 p-6 rounded-full text-slate-400">
          <Dog size={48} />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900">Animal não encontrado</h2>
          <p className="text-slate-500">O registro que você está procurando não existe ou foi removido.</p>
        </div>
        <button onClick={() => navigate('/animais')} className="px-6 py-2 bg-teal-600 text-white font-bold rounded-lg shadow-md">Voltar para a Lista</button>
      </div>
    );
  }

  const renderCondicaoBadge = (condicao: AnimalCondicao) => {
    switch (condicao) {
      case AnimalCondicao.DISPONIVEL_ADOCAO:
        return <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm"><Heart size={12} className="fill-emerald-600 text-emerald-600" /> {condicao}</span>;
      case AnimalCondicao.EM_TRATAMENTO:
        return <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border bg-blue-50 text-blue-700 border-blue-200 shadow-sm"><Stethoscope size={12} /> {condicao}</span>;
      case AnimalCondicao.SOLTURA:
        return <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border bg-teal-50 text-teal-700 border-teal-200 shadow-sm"><Leaf size={12} /> {condicao}</span>;
      case AnimalCondicao.ADOTADO:
        return <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm"><UserCheck size={12} /> {condicao}</span>;
      case AnimalCondicao.OBITO:
        return <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border bg-slate-900 text-white border-slate-900 shadow-sm"><Skull size={12} /> {condicao}</span>;
      case AnimalCondicao.ATENDIDO:
        return <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm"><CheckCircle2 size={12} /> {condicao}</span>;
      case AnimalCondicao.AGUARDANDO_ATENDIMENTO:
        return <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm"><Clock size={12} /> {condicao}</span>;
      default:
        return <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase border bg-amber-50 text-amber-700 border-amber-300 shadow-sm"><Clock size={12} /> {condicao || 'Acolhido'}</span>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Modais de Encerramento */}
      {modalType && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
            <div className={`p-6 text-white flex justify-between items-center ${
              modalType === 'ADOCAO' ? 'bg-emerald-600' :
              modalType === 'SOLTURA' ? 'bg-teal-600' : 'bg-slate-900'
            }`}>
              <div className="flex items-center gap-3">
                {modalType === 'ADOCAO' ? <HeartHandshake size={24} /> : modalType === 'SOLTURA' ? <Leaf size={24} /> : <Skull size={24} />}
                <div>
                  <h3 className="text-lg font-black uppercase tracking-widest">
                    {modalType === 'ADOCAO' ? 'Registrar Adoção' : modalType === 'SOLTURA' ? 'Registrar Soltura' : 'Registrar Óbito'}
                  </h3>
                  <p className="text-[10px] font-bold opacity-80 uppercase tracking-tighter">Encerramento de ciclo para: {animal.nome}</p>
                </div>
              </div>
              <button onClick={() => setModalType(null)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><X size={20} /></button>
            </div>

            <div className="p-8 space-y-6">
              {modalType === 'ADOCAO' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome do Adotante *</label>
                    <input type="text" value={formAdocao.nome} onChange={e => setFormAdocao({...formAdocao, nome: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Nome completo" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CPF *</label>
                      <input type="text" value={formAdocao.cpf} onChange={e => setFormAdocao({...formAdocao, cpf: formatCPF(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono" placeholder="000.000.000-00" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Telefone *</label>
                      <input type="text" value={formAdocao.telefone} onChange={e => setFormAdocao({...formAdocao, telefone: formatTelefone(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="(00) 00000-0000" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data da Adoção *</label>
                    <input type="date" value={formAdocao.data} onChange={e => setFormAdocao({...formAdocao, data: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
              )}

              {modalType === 'SOLTURA' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Local da Soltura *</label>
                    <input type="text" value={formSoltura.local} onChange={e => setFormSoltura({...formSoltura, local: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500" placeholder="Ex: Área de Preservação Ambiental X" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data da Soltura *</label>
                    <input type="date" value={formSoltura.data} onChange={e => setFormSoltura({...formSoltura, data: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500" />
                  </div>
                </div>
              )}

              {modalType === 'OBITO' && (
                <div className="space-y-4">
                  <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                      <Skull size={14} className="text-slate-900" />
                      Classificação / Tipo de Óbito *
                    </label>
                    <select
                      value={formObito.tipo}
                      onChange={e => setFormObito({ ...formObito, tipo: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 font-bold text-slate-900 text-sm shadow-sm"
                    >
                      <option value="Óbito Natural">Óbito Natural</option>
                      <option value="Eutanásia">Eutanásia</option>
                    </select>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setFormObito({ ...formObito, tipo: 'Óbito Natural' })}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                          formObito.tipo === 'Óbito Natural'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm font-extrabold'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${formObito.tipo === 'Óbito Natural' ? 'bg-emerald-400' : 'bg-slate-300'}`}></span>
                        Óbito Natural
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormObito({ ...formObito, tipo: 'Eutanásia' })}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                          formObito.tipo === 'Eutanásia'
                            ? 'bg-red-700 text-white border-red-700 shadow-sm font-extrabold'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${formObito.tipo === 'Eutanásia' ? 'bg-red-300' : 'bg-slate-300'}`}></span>
                        Eutanásia
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Causa Provável do Óbito *</label>
                    <textarea value={formObito.causa} onChange={e => setFormObito({...formObito, causa: e.target.value})} rows={3} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 resize-none font-medium text-slate-800" placeholder="Descrição técnica do diagnóstico final..." />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data do Falecimento *</label>
                    <input type="date" value={formObito.data} onChange={e => setFormObito({...formObito, data: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 font-bold" />
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button onClick={() => setModalType(null)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-all">Cancelar</button>
                <button onClick={handleSaveModal} disabled={loading} className={`flex-1 py-3 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${modalType === 'ADOCAO' ? 'bg-emerald-600 hover:bg-emerald-700' : modalType === 'SOLTURA' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-slate-900 hover:bg-slate-800'}`}>{loading ? 'Processando...' : <><Save size={18} /> Salvar Registro</>}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Profile Section */}
      <div className="flex flex-col md:flex-row items-start gap-8">
        <div className="w-full md:w-64 shrink-0 space-y-4">
          <div className="aspect-square bg-slate-200 rounded-3xl border-4 border-white shadow-xl overflow-hidden group relative">
            {animal.foto ? (
              <img src={animal.foto} alt={animal.nome} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-700" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                <Camera size={48} strokeWidth={1} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Sem Foto</span>
              </div>
            )}
            <div className="absolute top-4 left-4">
              {renderCondicaoBadge(animal.condicao)}
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-2">Identificação SISBEM</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-600">
                <IdCard size={16} className="text-slate-400" />
                <span className="text-xs font-mono font-bold">{animal.id.substring(0, 8).toUpperCase()}</span>
              </div>
              {animal.microchipado && (
                <div className="flex items-center gap-2 text-teal-800 bg-teal-50 p-2 rounded-xl border border-teal-200">
                  <Cpu size={16} className="text-teal-600 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black text-teal-600 uppercase tracking-tight">Microchipado</p>
                    <p className="text-xs font-mono font-black text-slate-900">{animal.numeroMicrochip || 'Sem código'}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar size={16} className="text-slate-400" />
                <span className="text-xs font-medium">Cadastrado em {format(new Date(animal.dataCadastro), 'dd/MM/yyyy')}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <User size={16} className="text-slate-400" />
                <span className="text-xs font-medium">Por: {animal.usuarioResponsavel?.name || 'Sistema'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6 w-full">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <button onClick={() => navigate('/animais')} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><ArrowLeft size={20} /></button>
                <div className="flex items-center gap-2">
                  <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">{animal.nome}</h1>
                  {animal.resgateSamuvet && (
                    <div className="bg-teal-600 text-white px-2 py-1 rounded-lg flex items-center gap-1.5 shadow-md">
                      <Ambulance size={16} />
                      <span className="text-[10px] font-black uppercase">SAMUVET</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-10">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${animal.especie === Especie.CAO ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{animal.especie}</span>
                <span className="text-slate-400 text-sm font-medium">• {animal.raca} • {animal.sexo} • {animal.porte}{animal.idade ? ` • ${animal.idade}` : ''}</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <button 
                onClick={() => animal && printAnimalSheet(animal)} 
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all cursor-pointer"
                title="Imprimir Ficha Completa e Prontuário Clínico"
              >
                <Printer size={18} /> Imprimir Ficha
              </button>
              {isVetOrAdmin && (
                <Link to={`/animais/atendimento/${animal.id}`} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-all">
                  <Stethoscope size={18} /> Iniciar Atendimento
                </Link>
              )}
              <Link to={`/animais/editar/${animal.id}`} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-all">
                <FileBadge2 size={18} /> Editar Cadastro
              </Link>
            </div>
          </div>

          {/* Quick Action Decision Buttons */}
          {isVetOrAdmin && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button onClick={() => setModalType('ADOCAO')} className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all group ${animal.condicao === AnimalCondicao.ADOTADO ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20' : 'bg-white border-emerald-100 text-emerald-700 hover:bg-emerald-50'}`}>
                <div className={`p-2 rounded-xl ${animal.condicao === AnimalCondicao.ADOTADO ? 'bg-emerald-50' : 'bg-emerald-100 text-emerald-600'}`}><HeartHandshake size={20} /></div>
                <div className="text-left"><p className="text-[10px] font-black uppercase opacity-70">Processo de</p><p className="text-sm font-black">{animal.condicao === AnimalCondicao.ADOTADO ? 'Animal Adotado' : 'Registrar Adoção'}</p></div>
              </button>
              <button onClick={() => setModalType('SOLTURA')} className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all group ${animal.condicao === AnimalCondicao.SOLTURA ? 'bg-teal-600 border-teal-500 text-white shadow-lg shadow-teal-600/20' : 'bg-white border-teal-100 text-teal-700 hover:bg-teal-50'}`}>
                <div className={`p-2 rounded-xl ${animal.condicao === AnimalCondicao.SOLTURA ? 'bg-teal-50' : 'bg-teal-100 text-teal-600'}`}><Leaf size={20} /></div>
                <div className="text-left"><p className="text-[10px] font-black uppercase opacity-70">Ação de</p><p className="text-sm font-black">{animal.condicao === AnimalCondicao.SOLTURA ? 'Animal Solto' : 'Registrar Soltura'}</p></div>
              </button>
              <button onClick={() => setModalType('OBITO')} className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all group ${animal.condicao === AnimalCondicao.OBITO ? 'bg-slate-900 border-slate-800 text-white shadow-lg shadow-slate-900/20' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                <div className={`p-2 rounded-xl ${animal.condicao === AnimalCondicao.OBITO ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}><Skull size={20} /></div>
                <div className="text-left"><p className="text-[10px] font-black uppercase opacity-70">Encerramento</p><p className="text-sm font-black">{animal.condicao === AnimalCondicao.OBITO ? 'Animal em Óbito' : 'Registrar Óbito'}</p></div>
              </button>
            </div>
          )}

          {/* Castration Status & Surgical Banner */}
          {animal.agendamentoCastracaoAtivo ? (
            <div className="p-6 rounded-2xl border-2 bg-teal-50 border-teal-200 text-teal-900 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start md:items-center gap-4">
                <div className="p-3.5 rounded-2xl shrink-0 bg-teal-600 text-white shadow-md shadow-teal-600/20">
                  <Scissors size={24} />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/80 border border-slate-200">
                      Cirurgia Agendada na Fila
                    </span>
                    <span className="text-xs font-bold">
                      {animal.especie} • {animal.sexo} • {animal.porte}{animal.idade ? ` • ${animal.idade}` : ''}
                    </span>
                  </div>
                  <h4 className="text-base font-black uppercase tracking-tight">
                    {animal.agendamentoCastracaoAtivo.tipoCirurgia} agendada para {safeFormatDate(animal.agendamentoCastracaoAtivo.dataAgendada)} às {animal.agendamentoCastracaoAtivo.horario || '08:30'}
                  </h4>
                  <p className="text-xs opacity-85 font-medium">
                    Cirurgião: {animal.agendamentoCastracaoAtivo.veterinarioResponsavelNome || 'Corpo Clínico'} • Preparo: {animal.agendamentoCastracaoAtivo.observacoesPreOperatorias || 'Jejum 8h'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-end md:self-auto shrink-0">
                <Link
                  to="/cirurgias/fila"
                  className="px-4 py-2 bg-white text-teal-800 font-black text-xs rounded-xl border border-teal-300 shadow-sm hover:bg-teal-50 transition-all flex items-center gap-1.5"
                >
                  <Eye size={15} /> Ver na Fila Cirúrgica
                </Link>
                {isVetOrAdmin && (
                  <Link
                    to={`/cirurgias/fila?animalId=${animal.id}`}
                    className="px-4 py-2 bg-teal-700 text-white font-black text-xs rounded-xl shadow-md hover:bg-teal-800 transition-all flex items-center gap-1.5"
                  >
                    <Plus size={15} /> + Novo Agendamento
                  </Link>
                )}
              </div>
            </div>
          ) : !animal.castrado ? (
            <div className="p-6 rounded-2xl border-2 bg-amber-50 border-amber-200 text-amber-900 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start md:items-center gap-4">
                <div className="p-3.5 rounded-2xl shrink-0 bg-amber-500 text-white shadow-md shadow-amber-500/20">
                  <Scissors size={24} />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/80 border border-slate-200 text-amber-800">
                      Castração Pendente
                    </span>
                    <span className="text-xs font-bold">
                      {animal.especie} • {animal.sexo} • {animal.porte}{animal.idade ? ` • ${animal.idade}` : ''}
                    </span>
                  </div>
                  <h4 className="text-base font-black uppercase tracking-tight">
                    Animal Não Castrado - Aguardando Agendamento
                  </h4>
                  <p className="text-xs opacity-85 font-medium">
                    Este paciente está apto para entrar na Fila Cirúrgica para Castração ou outro procedimento cirúrgico.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-end md:self-auto shrink-0">
                {isVetOrAdmin && (
                  <Link
                    to={`/cirurgias/fila?animalId=${animal.id}`}
                    className="px-5 py-2.5 bg-teal-600 text-white font-black text-xs rounded-xl shadow-md shadow-teal-600/20 hover:bg-teal-700 transition-all flex items-center gap-2"
                  >
                    <Plus size={16} /> Agendar Castração / Cirurgia
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 px-6 rounded-2xl border bg-slate-50 border-slate-200 text-slate-800 shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black uppercase text-slate-900">
                      Animal Castrado
                    </h4>
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Castração Realizada
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Paciente apto para agendamento de outros procedimentos cirúrgicos gerais (ex: mastectomia, suturas, nódulos, etc).
                  </p>
                </div>
              </div>

              {isVetOrAdmin && (
                <Link
                  to={`/cirurgias/fila?animalId=${animal.id}`}
                  className="px-4 py-2 bg-teal-600 text-white font-black text-xs rounded-xl shadow-sm hover:bg-teal-700 transition-all flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <Plus size={15} /> Agendar Outra Cirurgia
                </Link>
              )}
            </div>
          )}

          {/* Internação & Acomodação Card para Animal Externo */}
          {animal.temTutor ? (
            <div className={`p-6 rounded-2xl border-2 shadow-sm space-y-4 transition-all ${
              animal.currentOccupation 
                ? 'bg-teal-50 border-teal-200 text-teal-950' 
                : (animal.necessitaInternacao || animal.condicao === AnimalCondicao.EM_TRATAMENTO)
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className={`p-3.5 rounded-2xl shrink-0 shadow-md ${
                    animal.currentOccupation 
                      ? 'bg-teal-600 text-white shadow-teal-600/20' 
                      : (animal.necessitaInternacao || animal.condicao === AnimalCondicao.EM_TRATAMENTO)
                        ? 'bg-amber-500 text-white shadow-amber-500/20'
                        : 'bg-indigo-600 text-white shadow-indigo-600/20'
                  }`}>
                    <Home size={24} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/90 border border-slate-200">
                        {animal.currentOccupation 
                          ? 'Paciente Internado' 
                          : (animal.necessitaInternacao || animal.condicao === AnimalCondicao.EM_TRATAMENTO)
                            ? 'Fila de Acomodação (Internação)'
                            : 'Alta Ambulatorial (Com Tutor)'}
                      </span>
                      <span className="text-xs font-bold opacity-75">
                        Tutor: {animal.tutor?.nomeCompleto || animal.solicitante?.nomeCompleto || 'Externo'}
                      </span>
                    </div>

                    <h4 className="text-base font-black uppercase tracking-tight">
                      {animal.currentOccupation 
                        ? `Acomodado na Baia: ${animal.currentOccupation.kennel?.name} (${animal.currentOccupation.kennel?.type})`
                        : (animal.necessitaInternacao || animal.condicao === AnimalCondicao.EM_TRATAMENTO)
                          ? `Aguardando Vaga na Fila • Indicado: ${animal.tipoAcomodacaoSugerida || (animal.historico && animal.historico[0]?.recommendedKennelType) || 'Acomodação Clínica'}`
                          : 'Paciente com Tutor • Sem Internação Ativa'}
                    </h4>

                    <p className="text-xs opacity-80 font-medium">
                      {animal.currentOccupation 
                        ? `Internado desde ${safeFormatDate(animal.currentOccupation.entryDate, 'dd/MM/yyyy HH:mm')}`
                        : (animal.necessitaInternacao || animal.condicao === AnimalCondicao.EM_TRATAMENTO)
                          ? `Motivo clínico: "${animal.justificativaInternacao || (animal.historico && animal.historico[0]?.accommodationJustification) || 'Internação pós-atendimento para cuidados contínuos'}"`
                          : 'Após o atendimento veterinário, o veterinário pode indicar se o paciente requer internação no Centro de Bem-Estar.'}
                    </p>
                  </div>
                </div>

                {/* Ações de Internação */}
                <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto shrink-0">
                  {/* Se NÃO está internado nem na fila */}
                  {!animal.currentOccupation && !animal.necessitaInternacao && animal.condicao !== AnimalCondicao.EM_TRATAMENTO && isVetOrAdmin && (
                    <button 
                      onClick={() => {
                        setInternacaoTipoAcomodacao(animal.tipoAcomodacaoSugerida || (animal.historico && animal.historico[0]?.recommendedKennelType) || '');
                        setInternacaoJustificativa(animal.justificativaInternacao || (animal.historico && animal.historico[0]?.accommodationJustification) || '');
                        setShowInternacaoModal(true);
                      }}
                      className="px-4 py-2.5 bg-indigo-600 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={16} /> Indicar Necessidade de Internação
                    </button>
                  )}

                  {/* Se está na fila aguardando baia */}
                  {!animal.currentOccupation && (animal.necessitaInternacao || animal.condicao === AnimalCondicao.EM_TRATAMENTO) && (
                    <>
                      <Link 
                        to="/acomodacao" 
                        className="px-3.5 py-2 bg-white text-amber-900 font-black text-xs rounded-xl border border-amber-300 shadow-sm hover:bg-amber-100 transition-all flex items-center gap-1.5"
                      >
                        <Eye size={15} /> Ver na Fila
                      </Link>
                      {isVetOrAdmin && (
                        <>
                          <button 
                            onClick={() => {
                              setSelectedKennelId('');
                              setJustification(animal.justificativaInternacao || (animal.historico && animal.historico[0]?.accommodationJustification) || 'Internação de animal com tutor');
                              setIsTransferring(true);
                            }}
                            className="px-3.5 py-2 bg-amber-600 text-white font-black text-xs rounded-xl shadow-md shadow-amber-600/20 hover:bg-amber-700 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Home size={15} /> Alocar Baia Agora
                          </button>
                          <button 
                            onClick={handleDarAltaHospitalar}
                            className="px-3 py-2 bg-white text-slate-700 hover:text-red-700 font-black text-xs rounded-xl border border-slate-200 hover:border-red-200 transition-all flex items-center gap-1 cursor-pointer"
                            title="Liberar animal para o tutor (cancelar internação)"
                          >
                            <CheckCircle2 size={15} /> Dar Alta
                          </button>
                        </>
                      )}
                    </>
                  )}

                  {/* Se já está ocupando uma baia física */}
                  {animal.currentOccupation && isVetOrAdmin && (
                    <>
                      <button 
                        onClick={() => {
                          setSelectedKennelId('');
                          setJustification('Transferência de leito hospitalar');
                          setIsTransferring(true);
                        }}
                        className="px-3.5 py-2 bg-white text-teal-800 font-black text-xs rounded-xl border border-teal-300 shadow-sm hover:bg-teal-100 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowRightLeft size={15} /> Trocar Baia
                      </button>
                      <button 
                        onClick={handleDarAltaHospitalar}
                        className="px-4 py-2 bg-teal-700 text-white font-black text-xs rounded-xl shadow-md hover:bg-teal-800 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 size={15} /> Dar Alta Hospitalar
                      </button>
                    </>
                  )}

                  <button 
                    onClick={() => setSearchParams({ tab: 'acomodacoes' })} 
                    className="p-2.5 bg-white/70 hover:bg-white text-slate-600 rounded-xl transition-colors border border-slate-200 shadow-sm cursor-pointer"
                    title="Ver Histórico de Acomodação"
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Accommodation Card */
            <div className={`p-6 rounded-2xl border-2 shadow-sm flex items-center justify-between ${animal.currentOccupation ? 'bg-indigo-50 border-indigo-100 text-indigo-900' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${animal.currentOccupation ? 'bg-white' : 'bg-slate-200'}`}><Home size={24} className={animal.currentOccupation ? 'text-indigo-600' : 'text-slate-400'} /></div>
                <div><p className="text-[10px] font-black uppercase opacity-60">Acomodação Atual</p><p className="text-lg font-black">{animal.currentOccupation?.kennel?.name || 'Nenhuma baia alocada'}</p></div>
              </div>
              <button 
                onClick={() => setSearchParams({ tab: 'acomodacoes' })} 
                className="p-2 hover:bg-white/50 rounded-lg transition-colors text-slate-500 hover:text-teal-600"
                title="Ver Histórico de Acomodação"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          )}

          <div className="flex border-b border-slate-200 gap-8 overflow-x-auto whitespace-nowrap">
            <button onClick={() => setSearchParams({ tab: 'ficha' })} className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'ficha' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}>Ficha do Animal {activeTab === 'ficha' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 rounded-t-full" />}</button>
            <button onClick={() => setSearchParams({ tab: 'cirurgias' })} className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'cirurgias' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}>Cirurgias & Castração ({animal.cirurgias?.length || 0}) {activeTab === 'cirurgias' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 rounded-t-full" />}</button>
            <button onClick={() => setSearchParams({ tab: 'historico' })} className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'historico' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}>Prontuário Clínico ({animal.historico?.length || 0}) {activeTab === 'historico' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 rounded-t-full" />}</button>
            <button onClick={() => setSearchParams({ tab: 'receituario' })} className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'receituario' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}>Receituário / Encaminhamento {activeTab === 'receituario' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 rounded-t-full" />}</button>
            <button onClick={() => setSearchParams({ tab: 'acomodacoes' })} className={`pb-4 text-sm font-bold transition-all relative ${activeTab === 'acomodacoes' ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'}`}>Histórico de Acomodação ({animalOccupations.length}) {activeTab === 'acomodacoes' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-teal-600 rounded-t-full" />}</button>
          </div>

          <div className="animate-in fade-in duration-300">
            {activeTab === 'ficha' && (
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <FileText size={15} className="text-teal-600" /> Ficha Cadastral e Prontuário Completo
                    </h3>
                    <p className="text-[11px] text-slate-500">Documento impresso padronizado com identificação, histórico de atendimentos e baias.</p>
                  </div>
                  <button
                    onClick={() => animal && printAnimalSheet(animal)}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-slate-800 font-bold text-xs rounded-xl border border-slate-300 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer shrink-0"
                    title="Imprimir Ficha Completa do Paciente"
                  >
                    <Printer size={15} className="text-teal-600" /> Imprimir Ficha / PDF
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* DADOS DE ORIGEM E TRIAGEM */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <MapPin size={14} /> {animal.temTutor ? 'Dados da Consulta Clínica' : 'Dados de Origem / Resgate'}
                    </h3>
                    <div className="space-y-4">
                      {animal.temTutor ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Data do Agendamento</p>
                            <p className="text-sm font-bold text-slate-800">{format(new Date(animal.dataResgate), 'dd/MM/yyyy')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Tipo de Atendimento</p>
                            <p className="text-sm font-bold text-indigo-600 uppercase">Consulta Externa</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Local do Resgate</p>
                              <p className="text-sm font-bold text-slate-800 truncate" title={animal.localResgate}>{animal.localResgate}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Data da Ocorrência</p>
                              <p className="text-sm font-bold text-slate-800">{format(new Date(animal.dataResgate), 'dd/MM/yyyy')}</p>
                            </div>
                          </div>
                          {animal.resgateSamuvet && (
                            <div className="p-3 bg-teal-50 border border-teal-100 rounded-xl flex items-center gap-3">
                              <Ambulance size={18} className="text-teal-600" />
                              <div>
                                <p className="text-[9px] font-black text-teal-600 uppercase">Resgatado pelo SAMUVET</p>
                                <p className="text-xs font-bold text-teal-800 uppercase">{animal.responsavelSamuvet || 'Equipe Plantonista'}</p>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                          <MessageSquare size={10} className="inline mr-1" />
                          {animal.temTutor ? 'Queixa do Tutor / Anamnese' : 'Motivo / Relato do Resgate'}
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed italic">"{animal.motivo}"</p>
                      </div>
                    </div>
                  </div>

                  {/* RESPONSÁVEL (TUTOR OU SOLICITANTE) */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      {animal.temTutor ? <><UserCircle size={14} /> Tutor Responsável</> : <><User size={14} /> Solicitante Original</>}
                    </h3>
                    {animal.temTutor && animal.tutor ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Nome Completo</p>
                            {animal.tutor.temCadUnico && (
                              <span className="flex items-center gap-1 bg-indigo-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm"><ShieldCheck size={10} /> CadÚnico</span>
                            )}
                          </div>
                          <Link to={`/tutores/${animal.tutorId}`} className="text-base font-black text-slate-800 hover:text-indigo-600 transition-colors flex items-center gap-1.5 uppercase">
                            {animal.tutor.nomeCompleto} <ExternalLink size={14} />
                          </Link>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Documento CPF</p>
                            <p className="text-sm font-mono font-bold text-slate-700">{animal.tutor.cpf}</p>
                          </div>
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Telefone</p>
                            <p className="text-sm font-bold text-slate-700">{animal.tutor.telefone}</p>
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Endereço Residencial</p>
                          <p className="text-xs font-medium text-slate-600 leading-tight">{animal.tutor.endereco || 'Não informado'}</p>
                        </div>
                      </div>
                    ) : animal.solicitante && (animal.solicitante.tipo === 'DESCONHECIDO' || animal.solicitante.cpf === 'DESC-ANONIMO' || animal.solicitante.nomeCompleto?.toLowerCase().includes('desconhecido')) ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-100 border border-slate-200 rounded-xl">
                          <div className="flex items-center gap-2 mb-1">
                            <HelpCircle size={16} className="text-slate-500" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              Origem da Solicitação
                            </p>
                          </div>
                          <p className="text-base font-black text-slate-800 uppercase">
                            Solicitante Desconhecido / Anônimo
                          </p>
                          <p className="text-xs text-slate-500 font-medium mt-1">
                            Recolhimento municipal direto em via pública, ronda preventiva ou chamado sem identificação formal.
                          </p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-slate-500">CÓDIGO: DESC-ANONIMO</span>
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">Sem Solicitante Vinculado</span>
                        </div>
                      </div>
                    ) : animal.solicitante ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">
                              {animal.solicitante.tipo === 'ONG' || animal.solicitante.codigoOng ? 'ONG / Entidade Solicitante' : 'Solicitante Original'}
                            </p>
                            {animal.solicitante.codigoOng && (
                              <span className="bg-teal-600 text-white text-[10px] font-mono font-black px-2 py-0.5 rounded uppercase tracking-wider shadow-sm">
                                {animal.solicitante.codigoOng}
                              </span>
                            )}
                          </div>
                          <Link to={`/solicitantes/${animal.solicitanteId}`} className="text-base font-black text-slate-900 hover:text-teal-600 transition-colors flex items-center gap-1.5 uppercase">
                            {animal.solicitante.nomeCompleto} <ExternalLink size={14} />
                          </Link>
                          {animal.solicitante.responsavel && (
                            <p className="text-xs text-teal-800 font-medium mt-1">
                              Representante: <span className="font-bold">{animal.solicitante.responsavel}</span>
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{animal.solicitante.tipo === 'ONG' ? 'CNPJ / Registro' : 'Documento Ident.'}</p>
                            <p className="text-sm font-mono font-bold text-slate-700">{animal.solicitante.cpf || '-'}</p>
                          </div>
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Telefone</p>
                            <p className="text-sm font-bold text-slate-700">{animal.solicitante.telefone || '(Não informado)'}</p>
                          </div>
                        </div>
                        <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                          <p className="text-[10px] text-slate-400 italic">Entidade/Pessoa que realizou a solicitação de resgate junto ao Centro de Bem-Estar.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <User size={24} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-xs text-slate-400 font-bold uppercase">Sem Responsável Vinculado</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* CARACTERÍSTICAS FÍSICAS DETALHADAS */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Scale size={14} /> Características Físicas e Fenótipo</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Idade Estimada</p>
                      <p className="text-sm font-bold text-slate-800 uppercase truncate" title={animal.idade || 'Não informada'}>{animal.idade || '-'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Peso Triagem</p>
                      <p className="text-lg font-black text-slate-800">{animal.peso} <span className="text-xs font-bold text-slate-400">kg</span></p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Raça / Mistura</p>
                      <p className="text-sm font-bold text-slate-800 uppercase truncate" title={animal.raca}>{animal.raca}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Porte</p>
                      <p className="text-sm font-bold text-slate-800 uppercase">{animal.porte}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Sexo</p>
                      <p className="text-sm font-bold text-slate-800 uppercase">{animal.sexo}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Castrado?</p>
                      <div className="flex flex-col items-center">
                        <p className={`text-sm font-bold uppercase ${animal.castrado ? 'text-emerald-600' : 'text-red-500'}`}>{animal.castrado ? 'Sim' : 'Não'}</p>
                        <Link to={`/cirurgias/fila?animalId=${animal.id}`} className="mt-1 text-[9px] text-teal-600 font-bold underline hover:text-teal-700">
                          {animal.castrado ? '+ Outra Cirurgia' : animal.agendamentoCastracaoAtivo ? 'Ver Cirurgia' : '+ Agendar'}
                        </Link>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center col-span-2 sm:col-span-1 md:col-span-1">
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Microchip?</p>
                      {animal.microchipado ? (
                        <div>
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-teal-100 text-teal-800 inline-block mb-0.5">Sim</span>
                          <p className="text-[10px] font-mono font-bold text-slate-800 truncate" title={animal.numeroMicrochip}>{animal.numeroMicrochip || '-'}</p>
                        </div>
                      ) : (
                        <p className="text-sm font-bold text-slate-400 uppercase">Não</p>
                      )}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-6">
                    <div className="flex-1">
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Descrição da Pelagem / Cor</p>
                      <p className="text-sm font-bold text-slate-800 uppercase">{animal.corPelagem}</p>
                    </div>
                    <div className="shrink-0">
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Espécie</p>
                      <span className={`px-4 py-1 rounded-full text-xs font-black uppercase border ${animal.especie === Especie.CAO ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>{animal.especie}</span>
                    </div>
                  </div>
                </div>

                {/* HISTÓRICO DE CICLO (ÓBITO, ADOÇÃO, SOLTURA) SE HOUVER */}
                {(animal.condicao === AnimalCondicao.OBITO || animal.condicao === AnimalCondicao.ADOTADO || animal.condicao === AnimalCondicao.SOLTURA) && (
                  <div className={`p-6 rounded-2xl border-2 shadow-sm animate-in zoom-in-95 ${
                    animal.condicao === AnimalCondicao.OBITO ? 'bg-slate-900 border-slate-800 text-white' :
                    animal.condicao === AnimalCondicao.ADOTADO ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
                    'bg-teal-50 border-teal-100 text-teal-900'
                  }`}>
                    <h3 className="text-xs font-black uppercase tracking-widest opacity-60 flex items-center gap-2 mb-4">
                      {animal.condicao === AnimalCondicao.OBITO ? <Skull size={14} /> : animal.condicao === AnimalCondicao.ADOTADO ? <HeartHandshake size={14} /> : <Leaf size={14} />}
                      Registro de Encerramento de Ciclo
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div>
                         <p className="text-[10px] font-black uppercase opacity-60">Data do Evento</p>
                         <p className="text-lg font-black">{animal.condicao === AnimalCondicao.OBITO ? safeFormatDate(animal.dataObito) : animal.condicao === AnimalCondicao.ADOTADO ? safeFormatDate(animal.dataAdocao) : safeFormatDate(animal.dataSoltura)}</p>
                       </div>
                       <div>
                         <p className="text-[10px] font-black uppercase opacity-60">{animal.condicao === AnimalCondicao.OBITO ? 'Causa do Falecimento' : animal.condicao === AnimalCondicao.ADOTADO ? 'Adotante Responsável' : 'Local da Soltura'}</p>
                         <p className="text-lg font-black uppercase">
                            {animal.condicao === AnimalCondicao.OBITO ? animal.causaObito : animal.condicao === AnimalCondicao.ADOTADO ? animal.adotante?.nome : animal.localSoltura}
                         </p>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'cirurgias' && (
              <div className="space-y-6">
                {/* Header da Aba */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <Scissors size={18} className="text-teal-600" /> Procedimentos Cirúrgicos e Castração
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Histórico completo de cirurgias agendadas, realizadas e prescrições pós-operatórias deste paciente.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/cirurgias/fila"
                      className="px-4 py-2 bg-white text-slate-700 font-bold text-xs rounded-xl border border-slate-300 shadow-sm hover:bg-slate-50 transition-all flex items-center gap-1.5"
                    >
                      <Eye size={15} /> Ver Fila Geral
                    </Link>
                    {isVetOrAdmin && (
                      <Link
                        to={`/cirurgias/fila?animalId=${animal.id}`}
                        className="px-4 py-2 bg-teal-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-teal-700 transition-all flex items-center gap-1.5"
                      >
                        <Plus size={15} /> {animal.castrado ? 'Agendar Nova Cirurgia' : 'Agendar Cirurgia / Castração'}
                      </Link>
                    )}
                  </div>
                </div>

                {/* Status Reprodutivo do Paciente */}
                <div className={`p-5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  animal.castrado 
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
                    : 'bg-amber-50/70 border-amber-200 text-amber-950'
                }`}>
                  <div className="flex items-center gap-3.5">
                    <div className={`p-3 rounded-xl shrink-0 ${
                      animal.castrado ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {animal.castrado ? <ShieldCheck size={24} /> : <Scissors size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          animal.castrado ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'
                        }`}>
                          Condição Reprodutiva
                        </span>
                        <span className="text-xs font-bold opacity-75">
                          {animal.especie} • {animal.sexo} • {animal.porte}
                        </span>
                      </div>
                      <h4 className="text-base font-black uppercase mt-0.5">
                        {animal.castrado ? 'Animal Esterilizado / Castrado' : 'Animal Não Castrado'}
                      </h4>
                      <p className="text-xs opacity-80 mt-0.5">
                        {animal.castrado
                          ? 'O paciente possui registro oficial de castração no SISBEM.'
                          : animal.agendamentoCastracaoAtivo
                            ? `Possui agendamento cirúrgico ativo para ${safeFormatDate(animal.agendamentoCastracaoAtivo.dataAgendada)}.`
                            : 'Animal apto para inclusão na fila municipal de castração.'}
                      </p>
                    </div>
                  </div>

                  {!animal.castrado && isVetOrAdmin && (
                    <Link
                      to={`/cirurgias/fila?animalId=${animal.id}`}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all self-start sm:self-auto shrink-0 flex items-center gap-1.5"
                    >
                      <Plus size={15} /> Incluir na Fila Cirúrgica
                    </Link>
                  )}
                </div>

                {/* Lista de Cirurgias Cadastradas */}
                {animal.cirurgias && animal.cirurgias.length > 0 ? (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 px-1 flex items-center gap-2">
                      <Scissors size={14} className="text-teal-600" /> Procedimentos Registrados na Fila ({animal.cirurgias.length})
                    </h4>
                    
                    {animal.cirurgias.map((cirurgia) => {
                      const isRealizada = cirurgia.status === CirurgiaStatus.REALIZADA || cirurgia.status === 'Realizada' || (cirurgia.status as any) === 'CONCLUIDA';
                      const isCancelada = cirurgia.status === CirurgiaStatus.CANCELADA || cirurgia.status === 'Cancelada' || (cirurgia.status as any) === 'CANCELADA';
                      const isEmPreparo = cirurgia.status === CirurgiaStatus.EM_PREPARO || cirurgia.status === 'Em Pré-operatório' || (cirurgia.status as any) === 'EM_ANDAMENTO';
                      
                      const statusBadge = isRealizada
                        ? { label: 'Cirurgia Realizada', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: <CheckCircle2 size={13} className="text-emerald-700" /> }
                        : isCancelada
                        ? { label: 'Cirurgia Cancelada', bg: 'bg-rose-100 text-rose-800 border-rose-300', icon: <XCircle size={13} className="text-rose-700" /> }
                        : isEmPreparo
                        ? { label: 'Em Pré-Operatório', bg: 'bg-blue-100 text-blue-800 border-blue-300', icon: <Clock size={13} className="text-blue-700" /> }
                        : { label: 'Agendada na Fila', bg: 'bg-amber-100 text-amber-800 border-amber-300', icon: <Calendar size={13} className="text-amber-700" /> };

                      const isUrgente = cirurgia.prioridade === CirurgiaPrioridade.URGENTE || cirurgia.prioridade === 'Urgente' || (cirurgia.prioridade as any) === 'ALTA';
                      const isFilaEspera = cirurgia.prioridade === CirurgiaPrioridade.FILA_ESPERA || cirurgia.prioridade === 'Fila de Espera' || (cirurgia.prioridade as any) === 'BAIXA';

                      const prioridadeBadge = isUrgente
                        ? { label: 'Prioridade Urgente', bg: 'bg-rose-50 text-rose-800 border-rose-200' }
                        : isFilaEspera
                        ? { label: 'Fila de Espera', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' }
                        : { label: 'Prioridade Normal', bg: 'bg-slate-100 text-slate-700 border-slate-200' };

                      const relatoPos = cirurgia.observacoesPosOperatorias || (cirurgia as any).relatorioCirurgico;
                      const temReceitas = cirurgia.receitasPosOperatorias && cirurgia.receitasPosOperatorias.length > 0;

                      return (
                        <div key={cirurgia.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 hover:border-teal-200 transition-all">
                          {/* Topo do Card */}
                          <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3.5">
                              <div className={`p-3 rounded-xl border ${isRealizada ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-teal-50 text-teal-600 border-teal-100'}`}>
                                <Scissors size={20} />
                              </div>
                              <div>
                                <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                                  {cirurgia.tipoCirurgia}
                                </h4>
                                <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                  <span>Agendamento:</span>
                                  <span className="font-bold text-slate-800">{safeFormatDate(cirurgia.dataAgendada)}</span>
                                  <span>às</span>
                                  <span className="font-bold text-slate-800">{cirurgia.horario || '08:30'}</span>
                                  {cirurgia.turno && <span className="text-[11px] font-semibold text-slate-400">({cirurgia.turno})</span>}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${prioridadeBadge.bg}`}>
                                {prioridadeBadge.label}
                              </span>
                              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${statusBadge.bg}`}>
                                {statusBadge.icon}
                                {statusBadge.label}
                              </span>
                            </div>
                          </div>

                          {/* Grid com Informações Técnicas */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Veterinário Cirurgião</p>
                              <p className="font-bold text-slate-800 uppercase">{cirurgia.realizadaPorNome || cirurgia.veterinarioResponsavelNome || 'Corpo Clínico Municipal'}</p>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Status de Realização</p>
                              <p className={`font-bold ${isRealizada ? 'text-emerald-700' : isCancelada ? 'text-rose-700' : 'text-slate-700'}`}>
                                {isRealizada 
                                  ? `Realizada em ${safeFormatDate(cirurgia.dataRealizacao, "dd/MM/yyyy 'às' HH:mm")}`
                                  : isCancelada 
                                  ? 'Procedimento Cancelado'
                                  : 'Aguardando Atendimento'}
                              </p>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Preparo Pré-Operatório</p>
                              <p className="font-medium text-slate-700 truncate" title={cirurgia.observacoesPreOperatorias || 'Jejum hídrico e alimentar de 8 horas'}>
                                {cirurgia.observacoesPreOperatorias || 'Jejum alimentar de 8h'}
                              </p>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Inclusão na Fila</p>
                              <p className="font-medium text-slate-700">
                                {safeFormatDate(cirurgia.dataCadastro || (cirurgia as any).dataCriacao, "dd/MM/yyyy 'às' HH:mm")}
                              </p>
                            </div>
                          </div>

                          {/* Se Cancelada: Motivo */}
                          {isCancelada && cirurgia.motivoCancelamento && (
                            <div className="p-4 bg-rose-50/70 rounded-xl border border-rose-200 text-rose-900 text-xs space-y-1">
                              <p className="text-[10px] font-black uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                                <AlertTriangle size={13} /> Motivo do Cancelamento
                              </p>
                              <p className="font-medium">{cirurgia.motivoCancelamento}</p>
                            </div>
                          )}

                          {/* Relatório Cirúrgico e Pós-Operatório */}
                          {relatoPos && (
                            <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200 text-emerald-950 text-xs space-y-1.5">
                              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                                <FileText size={13} /> Relatório Cirúrgico e Evolução Pós-Operatória
                              </p>
                              <p className="font-medium whitespace-pre-wrap leading-relaxed text-slate-800">{relatoPos}</p>
                            </div>
                          )}

                          {/* Prescrição Pós-Cirúrgica Integrada */}
                          {temReceitas && (
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                                  <Pill size={14} className="text-teal-600" /> Prescrição Pós-Cirúrgica ({cirurgia.receitasPosOperatorias!.length} {cirurgia.receitasPosOperatorias!.length > 1 ? 'medicamentos' : 'medicamento'})
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handlePrintReceitasCirurgia(cirurgia)}
                                  className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1 hover:underline"
                                >
                                  <Printer size={13} /> Imprimir Receita
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {cirurgia.receitasPosOperatorias!.map((rec, rIdx) => (
                                  <div key={rec.id || rIdx} className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-xs font-black text-slate-900 uppercase">{rec.medicamento}</p>
                                      <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded">
                                        {rec.via}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                                      <div><span className="text-[9px] text-slate-400 block font-bold uppercase">Dose:</span> {rec.dosagem}</div>
                                      <div><span className="text-[9px] text-slate-400 block font-bold uppercase">Freq:</span> {rec.frequencia}</div>
                                      <div><span className="text-[9px] text-slate-400 block font-bold uppercase">Duração:</span> {rec.duracao}</div>
                                    </div>
                                    {rec.observacoes && (
                                      <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-100">
                                        Obs: {rec.observacoes}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Rodapé de Ações do Procedimento */}
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handlePrintTermoCirurgico(cirurgia)}
                                className="px-3 py-1.5 bg-white text-slate-700 font-bold rounded-lg border border-slate-300 hover:bg-slate-50 shadow-2xs flex items-center gap-1.5 transition-all"
                              >
                                <Printer size={13} /> Imprimir Termo de Autorização
                              </button>
                              {temReceitas && (
                                <button
                                  type="button"
                                  onClick={() => handlePrintReceitasCirurgia(cirurgia)}
                                  className="px-3 py-1.5 bg-teal-50 text-teal-700 font-bold rounded-lg border border-teal-200 hover:bg-teal-100 shadow-2xs flex items-center gap-1.5 transition-all"
                                >
                                  <Pill size={13} /> Imprimir Receituário
                                </button>
                              )}
                            </div>

                            <Link
                              to="/cirurgias/fila"
                              className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 hover:underline"
                            >
                              Ver na Fila Cirúrgica <ExternalLink size={13} />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Scissors size={24} />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">Nenhum procedimento cirúrgico registrado na fila</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {animal.castrado 
                        ? 'Este animal já foi registrado como castrado anteriormente no prontuário.' 
                        : 'Você pode agendar a esterilização ou outro procedimento cirúrgico na Fila Cirúrgica do SISBEM.'
                      }
                    </p>
                    {isVetOrAdmin && (
                      <Link
                        to={`/cirurgias/fila?animalId=${animal.id}`}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white font-bold text-xs rounded-xl shadow-md hover:bg-teal-700 transition-all mt-2"
                      >
                        <Plus size={16} /> {animal.castrado ? 'Agendar Outra Cirurgia Agora' : 'Agendar Castração / Cirurgia Agora'}
                      </Link>
                    )}
                  </div>
                )}

                {/* Atendimentos Clínicos Cirúrgicos do Prontuário Histórico (se houver) */}
                {atendimentosCirurgicos.length > 0 && (
                  <div className="mt-8 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 px-1 flex items-center gap-2">
                      <BriefcaseMedical size={14} className="text-teal-600" /> Registros Cirúrgicos no Histórico Clínico ({atendimentosCirurgicos.length})
                    </h4>
                    <div className="space-y-3">
                      {atendimentosCirurgicos.map((atendimento) => {
                        const vet = db.getUsers().find(u => u.id === atendimento.veterinarioId);
                        return (
                          <div key={atendimento.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 border-b border-slate-200 pb-2">
                              <span className="font-black text-slate-900 uppercase">
                                Atendimento Clínico em {safeFormatDate(atendimento.dataAtendimento, "dd/MM/yyyy 'às' HH:mm")}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500">
                                Responsável: {vet?.name || 'Veterinário(a)'}
                              </span>
                            </div>
                            {atendimento.diagnosticoClinico && (
                              <p className="text-slate-800">
                                <strong className="text-slate-900">Diagnóstico / Procedimento:</strong> {atendimento.diagnosticoClinico}
                              </p>
                            )}
                            {atendimento.tratamentoAmbulatorial && (
                              <p className="text-slate-700">
                                <strong className="text-slate-900">Tratamento / Conduta:</strong> {atendimento.tratamentoAmbulatorial}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'historico' && (
              <div className="space-y-6">
                {historicoOrdenado.length > 0 ? historicoOrdenado.map((record, index) => (
                  <div key={record.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-top-4" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-600 text-white rounded-lg"><Clipboard size={18} /></div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase">Atendimento em {format(new Date(record.dataAtendimento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1.5"><User size={10} /> Veterinário(a): {db.getUsers().find(u => u.id === record.veterinarioId)?.name || 'Responsável'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black bg-white border border-slate-200 text-slate-400 px-2 py-1 rounded uppercase">Peso: {record.peso}kg</span>
                        {record.v10Aplicada && <span className="text-[9px] font-black bg-teal-100 text-teal-700 px-2 py-1 rounded uppercase border border-teal-200 shadow-sm">V10</span>}
                        {record.antirrabicaAplicada && <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-1 rounded uppercase border border-indigo-200 shadow-sm">Antirrábica</span>}
                        {record.vermifugoAplicado && <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded uppercase border border-amber-200 shadow-sm">Vermífugo</span>}
                        {record.microchipAplicado && <span className="text-[9px] font-black bg-teal-100 text-teal-800 px-2 py-1 rounded uppercase border border-teal-200 shadow-sm flex items-center gap-1 font-mono"><Cpu size={10} /> Chip: {record.numeroMicrochipAplicado || 'Sim'}</span>}
                      </div>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                         <div className="space-y-1">
                           <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Diagnóstico Clínico</p>
                           <p className="text-sm font-bold text-slate-800 leading-relaxed">{record.diagnosticoClinico || 'Não informado'}</p>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                           <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Thermometer size={10} /> Temperatura</p>
                              <p className="text-xs font-bold text-slate-700">{record.temperatura ? `${record.temperatura} °C` : '--'}</p>
                           </div>
                           <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Droplets size={10} /> Hidratação</p>
                              <p className="text-xs font-bold text-slate-700">{record.hidratacao || '--'}</p>
                           </div>
                         </div>
                         {record.tratamentoAmbulatorial && (
                           <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                             <p className="text-[9px] font-black text-blue-600 uppercase mb-1">Procedimento / Conduta</p>
                             <p className="text-xs font-medium text-blue-800">{record.tratamentoAmbulatorial}</p>
                           </div>
                         )}
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exames e Laudos</p>
                           {record.examesLaboratoriais && record.examesLaboratoriais.length > 0 ? (
                             <div className="flex flex-wrap gap-2">
                               {record.examesLaboratoriais.map(ex => (
                                 <button key={ex.id} onClick={() => handleOpenAttachment(ex.arquivo, ex.nomeExame)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-600 hover:bg-teal-600 hover:text-white hover:border-teal-600 transition-all shadow-sm">
                                   <FlaskConical size={12} /> {ex.nomeExame}
                                 </button>
                               ))}
                             </div>
                           ) : <p className="text-xs italic text-slate-400">Nenhum exame anexado.</p>}
                        </div>
                        
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><ClipboardCheck size={12} /> Avaliação de Sistemas</p>
                           <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                              <div><span className="text-slate-400">Mucosa:</span> <span className="font-bold text-slate-700">{record.mucosa || '--'}</span></div>
                              <div><span className="text-slate-400">Abdômen:</span> <span className="font-bold text-slate-700">{record.palpacaoAbdominal || '--'}</span></div>
                              <div><span className="text-slate-400">Cardíaco:</span> <span className="font-bold text-slate-700">{record.auscultaCardiaca || '--'}</span></div>
                              <div><span className="text-slate-400">Pulmonar:</span> <span className="font-bold text-slate-700">{record.auscultaPulmonar || '--'}</span></div>
                           </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 space-y-2">
                          {record.receitas && record.receitas.length > 0 && (
                             <div className="flex justify-between items-center">
                               <div className="flex items-center gap-1.5 text-[10px] font-black text-teal-600 uppercase tracking-widest"><Pill size={14} /> Receituário</div>
                               <button onClick={() => handlePrintPrescription(record.receitas!)} className="flex items-center gap-1.5 text-[10px] font-black uppercase text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all"><Printer size={14} /> Imprimir Receita</button>
                             </div>
                          )}
                          {record.encaminhamentos && record.encaminhamentos.length > 0 && (
                             <div className="flex justify-between items-center">
                               <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-600 uppercase tracking-widest"><ArrowRightLeft size={14} /> Encaminhamentos</div>
                               <button onClick={() => handlePrintReferral(record.encaminhamentos!)} className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all"><Printer size={14} /> Imprimir Guia</button>
                             </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="py-20 text-center space-y-3 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <History size={48} className="mx-auto text-slate-200" />
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Sem registros históricos de atendimento clínico.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'receituario' && (
              <div className="space-y-8">
                {/* LISTAGEM DE RECEITAS E ENCAMINHAMENTOS POR DATA */}
                {animal.historico?.some(h => (h.receitas && h.receitas.length > 0) || (h.encaminhamentos && h.encaminhamentos.length > 0)) ? (
                  historicoOrdenado.filter(h => (h.receitas && h.receitas.length > 0) || (h.encaminhamentos && h.encaminhamentos.length > 0)).map((h, hIdx) => (
                    <div key={h.id} className="space-y-4">
                      <div className="flex items-center gap-3">
                         <div className="h-px flex-1 bg-slate-200" />
                         <span className="text-[10px] font-black uppercase text-slate-400 bg-white px-4 border border-slate-200 py-1 rounded-full">Atendimento em {format(new Date(h.dataAtendimento), 'dd/MM/yyyy')}</span>
                         <div className="h-px flex-1 bg-slate-200" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* RECEITAS DO ATENDIMENTO */}
                        {h.receitas && h.receitas.length > 0 && (
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 bg-teal-600 text-white flex justify-between items-center">
                               <div className="flex items-center gap-2"><Pill size={16} /><span className="text-xs font-black uppercase">Receituário Clínico</span></div>
                               <button onClick={() => handlePrintPrescription(h.receitas!)} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all"><Printer size={16} /></button>
                            </div>
                            <div className="p-4 space-y-3">
                               {h.receitas.map((r, rIdx) => (
                                 <div key={rIdx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                    <p className="text-xs font-black text-teal-700 uppercase">{r.medicamento}</p>
                                    <p className="text-[10px] text-slate-500 font-bold">{r.dosagem} • {r.frequencia} • {r.duracao}</p>
                                 </div>
                               ))}
                            </div>
                          </div>
                        )}

                        {/* ENCAMINHAMENTOS DO ATENDIMENTO */}
                        {h.encaminhamentos && h.encaminhamentos.length > 0 && (
                          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
                               <div className="flex items-center gap-2"><ArrowRightLeft size={16} /><span className="text-xs font-black uppercase">Guia de Encaminhamento</span></div>
                               <button onClick={() => handlePrintReferral(h.encaminhamentos!)} className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-all"><Printer size={16} /></button>
                            </div>
                            <div className="p-4 space-y-3">
                               {h.encaminhamentos.map((r, rIdx) => (
                                 <div key={rIdx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                    <div className="flex justify-between items-start mb-1">
                                      <p className="text-xs font-black text-indigo-700 uppercase">{r.especialidade}</p>
                                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${r.urgencia === 'ALTA' || r.urgencia === 'EMERGENCIA' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{r.urgencia}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold italic line-clamp-1">"{r.motivo}"</p>
                                 </div>
                               ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center space-y-3 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <FileText size={48} className="mx-auto text-slate-200" />
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Não há prescrições ou encaminhamentos neste histórico.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'acomodacoes' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-slate-50 p-4 rounded-xl border border-slate-200 gap-4 animate-in fade-in">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase">Acomodação Atual</h3>
                    <p className="text-xs text-slate-500">Localização física do animal no centro de bem-estar.</p>
                  </div>
                  {isVetOrAdmin && (
                    <div className="flex gap-2 w-full sm:w-auto">
                      {animal.currentOccupation && (
                        <button
                          onClick={async () => {
                            if (window.confirm(`Deseja retirar ${animal.nome} da baia atual?`)) {
                              await db.releaseAnimalFromKennelAsync(animal.id);
                              reloadAnimal();
                            }
                          }}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white text-red-600 font-bold rounded-lg border border-red-200 text-xs hover:bg-red-50 transition-colors"
                        >
                          <LogOut size={14} /> Retirar da Baia
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setIsTransferring(true);
                          setSelectedKennelId('');
                          setJustification(animal.currentOccupation ? 'Transferência por necessidade de manejo.' : 'Alocação de baia pós-atendimento.');
                        }}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white font-bold rounded-lg text-xs hover:bg-teal-700 transition-colors shadow-sm"
                      >
                        <ArrowRightLeft size={14} /> {animal.currentOccupation ? 'Trocar de Baia' : 'Alocar Baia'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                    <History size={16} className="text-teal-600" />
                    <span className="text-xs font-black uppercase text-slate-800">Linha do Tempo de Acomodações</span>
                  </div>

                  {animalOccupations.length > 0 ? (
                    <div className="p-6 relative">
                      {/* Vertical timeline line */}
                      <div className="absolute left-9 top-8 bottom-8 w-0.5 bg-slate-100" />

                      <div className="space-y-8 relative">
                        {animalOccupations.map((occ, idx) => {
                          const kennel = db.getKennels().find(k => k.id === occ.kennelId);
                          const responsible = db.getUsers().find(u => u.id === occ.vetId);
                          const isCurrent = !occ.exitDate;

                          return (
                            <div key={occ.id} className="flex gap-6 items-start animate-in fade-in duration-300">
                              {/* Circle node indicator */}
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                                isCurrent 
                                  ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                                  : 'bg-slate-50 border-slate-300 text-slate-400'
                              }`}>
                                <Home size={12} />
                              </div>

                              {/* Timeline Content card */}
                              <div className="flex-1 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                  <div>
                                    <h4 className="text-sm font-black text-slate-800 uppercase">
                                      {kennel ? kennel.name : 'Baia Excluída'}
                                    </h4>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase">
                                      Tipo: {kennel ? kennel.type : 'N/A'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {isCurrent ? (
                                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                        Ocupação Ativa
                                      </span>
                                    ) : (
                                      <span className="bg-slate-200 text-slate-600 border border-slate-300 text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                        Histórico
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 text-xs text-slate-600">
                                  <div>
                                    <span className="font-bold block text-[10px] uppercase text-slate-400">Entrada</span>
                                    {format(new Date(occ.entryDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                                  </div>
                                  <div>
                                    <span className="font-bold block text-[10px] uppercase text-slate-400">Saída</span>
                                    {occ.exitDate ? (
                                      format(new Date(occ.exitDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                                    ) : (
                                      <span className="text-slate-400 italic">Ocupando atualmente</span>
                                    )}
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-200/60 text-xs">
                                  <span className="font-bold block text-[10px] uppercase text-slate-400">Justificativa</span>
                                  <p className="text-slate-700 italic">"{occ.justification || 'Sem justificativa registrada'}"</p>
                                </div>

                                <div className="text-[10px] text-slate-400 font-bold uppercase pt-1 flex items-center gap-1">
                                  <User size={10} /> Registrado por: {responsible?.name || 'Sistema'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400 italic text-sm">
                      Este animal nunca foi alocado em nenhuma baia ou acomodação.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal de Transferência / Alocação na Ficha */}
            {isTransferring && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
                  <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <ArrowRightLeft size={24} className="text-teal-400" />
                      <div>
                        <h3 className="text-lg font-black uppercase tracking-widest">
                          {animal.currentOccupation ? 'Trocar de Baia' : 'Alocar em Baia'}
                        </h3>
                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-tighter">Animal: {animal.nome}</p>
                      </div>
                    </div>
                    <button onClick={() => setIsTransferring(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"><X size={20} /></button>
                  </div>

                  <form onSubmit={handleTransfer} className="p-8 space-y-6">
                    {(animal.tipoAcomodacaoSugerida || (animal.historico && animal.historico[0]?.recommendedKennelType)) && (
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-start gap-3">
                        <Info size={18} className="text-indigo-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-black text-indigo-800 uppercase tracking-tighter">
                            Recomendação do Veterinário {animal.temTutor ? '(Internação de Paciente Externo)' : ''}
                          </p>
                          <p className="text-sm font-bold text-slate-800">
                            Tipo Recomendado: <span className="uppercase text-indigo-700 font-black">{animal.tipoAcomodacaoSugerida || animal.historico[0]?.recommendedKennelType}</span>
                          </p>
                          {(animal.justificativaInternacao || animal.historico[0]?.accommodationJustification) && (
                            <p className="text-xs text-slate-600 italic mt-1">
                              "{animal.justificativaInternacao || animal.historico[0]?.accommodationJustification}"
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {animal.currentOccupation && (
                      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Acomodação Atual</p>
                        <p className="text-sm font-bold text-slate-700">{animal.currentOccupation.kennel?.name} ({animal.currentOccupation.kennel?.type})</p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Selecione a Nova Baia *</label>
                      <select 
                        required 
                        value={selectedKennelId} 
                        onChange={e => setSelectedKennelId(e.target.value)} 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 font-bold text-sm"
                      >
                        <option value="">-- Selecione uma baia --</option>
                        {db.getKennels()
                          .filter(k => {
                            const activeCount = db.getOccupations().filter(o => o.kennelId === k.id && !o.exitDate).length;
                            const isCurrentKennel = animal.currentOccupation?.kennelId === k.id;
                            return !isCurrentKennel && activeCount < k.capacity;
                          })
                          .map(k => {
                            const activeCount = db.getOccupations().filter(o => o.kennelId === k.id && !o.exitDate).length;
                            return (
                              <option key={k.id} value={k.id}>
                                {k.name} - {k.type} (Vagas: {k.capacity - activeCount})
                              </option>
                            );
                          })
                        }
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Justificativa da Movimentação *</label>
                      <input 
                        required 
                        type="text" 
                        value={justification} 
                        onChange={e => setJustification(e.target.value)} 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm" 
                        placeholder="Ex: Melhoria de manejo, melhora clínica, quarentena terminada"
                      />
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button type="button" onClick={() => setIsTransferring(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-all">Cancelar</button>
                      <button type="submit" className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-2xl shadow-lg hover:bg-teal-700 transition-all flex items-center justify-center gap-2"><Save size={18} /> Confirmar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Modal de Indicação de Internação (Animal com Tutor) */}
            {showInternacaoModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
                  <div className="bg-indigo-900 p-6 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Home size={24} className="text-indigo-300" />
                      <div>
                        <h3 className="text-lg font-black uppercase tracking-widest">
                          Indicar Internação Hospitalar
                        </h3>
                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-tighter">Paciente com Tutor: {animal.nome}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowInternacaoModal(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"><X size={20} /></button>
                  </div>

                  <form onSubmit={handleConfirmarInternacao} className="p-8 space-y-6">
                    <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2">
                      <p className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                        <Info size={14} className="text-indigo-600" /> Decisão Médica de Internação
                      </p>
                      <p className="text-xs text-indigo-950 font-medium leading-relaxed">
                        Ao confirmar, o paciente será sinalizado com necessidade de internação clínica e entrará na <strong>Fila de Acomodação</strong> com a recomendação da baia para ser alocado pela equipe.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest flex items-center justify-between">
                        <span>Tipo de Acomodação Indicada *</span>
                        <span className="text-indigo-600">Obrigatório</span>
                      </label>
                      <select 
                        required 
                        value={internacaoTipoAcomodacao} 
                        onChange={e => setInternacaoTipoAcomodacao(e.target.value as KennelType)} 
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-indigo-950 uppercase cursor-pointer"
                      >
                        <option value="">-- Selecione o Tipo de Baia --</option>
                        {Object.values(KennelType).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest flex items-center justify-between">
                        <span>Justificativa Técnica / Motivo da Internação *</span>
                        <span className="text-indigo-600">Obrigatório</span>
                      </label>
                      <textarea 
                        required 
                        rows={3}
                        value={internacaoJustificativa} 
                        onChange={e => setInternacaoJustificativa(e.target.value)} 
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-xs text-slate-800 resize-none font-medium" 
                        placeholder="Ex: Paciente debilitado necessitando fluidoterapia contínua e administração de antimicrobiano injetável..."
                      />
                    </div>

                    <div className="flex gap-4 pt-2">
                      <button 
                        type="button" 
                        onClick={() => setShowInternacaoModal(false)} 
                        className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSubmittingInternacao}
                        className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        <Save size={18} /> {isSubmittingInternacao ? 'Salvando...' : 'Confirmar e Enviar para Fila'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimalDetail;
