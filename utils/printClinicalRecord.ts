import { AnimalJoined, ClinicalRecord, AnimalCondicao, Especie } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db } from '../services/db';

export function generateClinicalRecordHTML(record: ClinicalRecord, animal: AnimalJoined): string {
  const users = db.getUsers();
  const vet = users.find(u => u.id === record.veterinarioId);
  const formattedDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  
  const dataAtendimentoFormatted = record.dataAtendimento 
    ? format(new Date(record.dataAtendimento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) 
    : 'N/A';

  // Status resultant badge style
  let statusBadgeBg = '#f1f5f9';
  let statusBadgeColor = '#334155';
  let statusText = record.statusResultante || animal.condicao || 'Atendido';

  if (record.statusResultante === AnimalCondicao.EM_TRATAMENTO) {
    statusBadgeBg = '#eff6ff';
    statusBadgeColor = '#1d4ed8';
  } else if (record.statusResultante === AnimalCondicao.ALTA || record.statusResultante === AnimalCondicao.ATENDIDO) {
    statusBadgeBg = '#ecfdf5';
    statusBadgeColor = '#047857';
  } else if (record.statusResultante === AnimalCondicao.OBITO) {
    statusBadgeBg = '#0f172a';
    statusBadgeColor = '#ffffff';
  }

  const prescCount = record.receitas?.length || 0;
  const refCount = record.encaminhamentos?.length || 0;
  const adendos = record.adendos || [];

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>SISBEM - Prontuário Clínico - ${animal.nome.toUpperCase()}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body { 
          font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #0f172a;
          background: #ffffff;
          padding: 24px 32px;
          line-height: 1.45;
          font-size: 13px;
        }

        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 2.5px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }

        .header-left {
          flex: 1;
        }

        .pref-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 4px;
          color: #475569;
          text-transform: uppercase;
        }

        .pref-title {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: -0.5px;
          color: #0f172a;
          line-height: 1.1;
          margin-top: 1px;
        }

        .pref-sub {
          font-size: 13px;
          font-weight: 700;
          color: #0d9488;
          text-transform: uppercase;
          margin-top: 3px;
        }

        .header-right {
          text-align: right;
          min-width: 220px;
        }

        .doc-badge {
          display: inline-block;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          background: #0f172a;
          color: #ffffff;
          padding: 5px 12px;
          border-radius: 4px;
          margin-bottom: 6px;
          letter-spacing: 0.5px;
        }

        .meta-text {
          font-size: 11.5px;
          color: #64748b;
          font-weight: 500;
        }

        .meta-text strong {
          color: #1e293b;
        }

        /* SECTION STYLING */
        .section {
          margin-bottom: 14px;
          page-break-inside: avoid;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
          border-left: 4px solid #0d9488;
          border-bottom: 1px solid #e2e8f0;
          border-top: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
          padding: 8px 12px;
          margin-bottom: 8px;
        }

        .section-title {
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #1e293b;
        }

        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
        .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
        .grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
        .grid-6 { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }

        .card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 5px;
          padding: 7px 10px;
        }

        .card-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          color: #64748b;
          margin-bottom: 2px;
        }

        .card-value {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
        }

        .card-value.highlight {
          color: #0d9488;
        }

        .card-value.alert {
          color: #b45309;
        }

        .card-value.mono {
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        }

        /* PATIENT BANNER */
        .patient-banner {
          display: flex;
          gap: 14px;
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          border-radius: 6px;
          padding: 10px;
          margin-bottom: 12px;
          align-items: center;
        }

        .patient-photo {
          width: 85px;
          height: 85px;
          border-radius: 6px;
          object-fit: cover;
          border: 1px solid #cbd5e1;
          flex-shrink: 0;
        }

        .patient-photo-placeholder {
          width: 85px;
          height: 85px;
          border-radius: 6px;
          background: #f1f5f9;
          border: 1px dashed #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          text-align: center;
          flex-shrink: 0;
        }

        .patient-main {
          flex: 1;
        }

        .patient-name-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }

        .patient-name {
          font-size: 20px;
          font-weight: 900;
          text-transform: uppercase;
          color: #0f172a;
          letter-spacing: -0.3px;
        }

        .status-pill {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 4px;
          border: 1px solid rgba(0,0,0,0.08);
          background: ${statusBadgeBg};
          color: ${statusBadgeColor};
        }

        .badge-pill {
          display: inline-block;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 4px;
          margin-right: 4px;
        }

        .badge-emerald {
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        .badge-amber {
          background: #fffbeb;
          color: #b45309;
          border: 1px solid #fde68a;
        }

        .badge-teal {
          background: #f0fdfa;
          color: #0f766e;
          border: 1px solid #99f6e4;
        }

        .badge-slate {
          background: #f8fafc;
          color: #475569;
          border: 1px solid #cbd5e1;
        }

        /* CLINICAL CONSULTATION BOX */
        .consultation-box {
          border: 1.5px solid #0d9488;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 14px;
          page-break-inside: avoid;
        }

        .consultation-header {
          background: #0d9488;
          color: #ffffff;
          padding: 9px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .consultation-header-title {
          font-size: 13.5px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .consultation-body {
          padding: 12px 14px;
          background: #ffffff;
        }

        .vitals-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin-bottom: 10px;
          background: #f8fafc;
          padding: 8px 10px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }

        .vital-item {
          font-size: 11.5px;
        }

        .vital-item strong {
          color: #64748b;
          font-weight: 800;
          text-transform: uppercase;
          display: block;
          font-size: 9.5px;
          margin-bottom: 1px;
        }

        .vital-item span {
          color: #0f172a;
          font-weight: 700;
        }

        .diag-box {
          background: #f0fdfa;
          border-left: 4px solid #0d9488;
          border: 1px solid #ccfbf1;
          border-left-width: 4px;
          padding: 10px 12px;
          margin-bottom: 10px;
          border-radius: 4px;
        }

        .conduct-box {
          background: #eff6ff;
          border-left: 4px solid #3b82f6;
          border: 1px solid #dbeafe;
          border-left-width: 4px;
          padding: 10px 12px;
          margin-bottom: 10px;
          border-radius: 4px;
        }

        .narrative-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          padding: 9px 12px;
          margin-bottom: 10px;
          border-radius: 4px;
        }

        .table-custom {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
          font-size: 12px;
        }

        .table-custom th {
          background: #f1f5f9;
          text-align: left;
          padding: 6px 8px;
          font-size: 10.5px;
          font-weight: 800;
          text-transform: uppercase;
          color: #334155;
          border: 1px solid #cbd5e1;
        }

        .table-custom td {
          padding: 6px 8px;
          border: 1px solid #e2e8f0;
          color: #1e293b;
        }

        /* ADDENDA / COMPLEMENTOS */
        .addenda-section {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1.5px dashed #cbd5e1;
        }

        .addendum-item {
          background: #f8fafc;
          border-left: 3.5px solid #0d9488;
          border: 1px solid #e2e8f0;
          border-left-width: 3.5px;
          border-radius: 4px;
          padding: 9px 12px;
          margin-bottom: 8px;
        }

        /* FOOTER & SIGNATURE */
        .footer-signatures {
          margin-top: 28px;
          padding-top: 16px;
          page-break-inside: avoid;
        }

        .signatures-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          text-align: center;
        }

        .sig-line {
          border-top: 1px solid #0f172a;
          margin-top: 36px;
          padding-top: 6px;
        }

        .sig-name {
          font-size: 12.5px;
          font-weight: 800;
          text-transform: uppercase;
          color: #0f172a;
        }

        .sig-role {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
        }

        .print-btn-bar {
          margin-bottom: 16px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .btn-print {
          background: #0f172a;
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 800;
          cursor: pointer;
        }

        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="no-print print-btn-bar">
        <button class="btn-print" onclick="window.print()">🖨️ Imprimir Prontuário / Salvar PDF</button>
      </div>

      <!-- HEADER -->
      <div class="header">
        <div class="header-left">
          <div class="pref-label">Prefeitura Municipal de</div>
          <div class="pref-title">POUSO ALEGRE</div>
          <div class="pref-sub">Superintendência de Proteção e Cuidado Animal • SISBEM</div>
        </div>
        <div class="header-right">
          <div class="doc-badge">Prontuário Clínico Veterinário</div>
          <div class="meta-text"><strong>Prontuário Nº:</strong> ${record.id.substring(0, 8).toUpperCase()}</div>
          <div class="meta-text"><strong>Emissão:</strong> ${formattedDate}</div>
        </div>
      </div>

      <!-- BANNER DO PACIENTE (ANIMAL) -->
      <div class="patient-banner">
        ${animal.foto ? `
          <img src="${animal.foto}" alt="${animal.nome}" class="patient-photo" />
        ` : `
          <div class="patient-photo-placeholder">Sem Foto</div>
        `}
        <div class="patient-main">
          <div class="patient-name-row">
            <div class="patient-name">${animal.nome}</div>
            <div class="status-pill">${statusText}</div>
          </div>
          <div style="margin-bottom: 6px;">
            <span class="badge-pill ${animal.castrado ? 'badge-emerald' : 'badge-amber'}">
              ${animal.castrado ? '✓ Castrado: SIM' : '⚠ Castrado: NÃO (Intacto)'}
            </span>
            ${animal.temTutor ? `
              <span class="badge-pill ${animal.tutor?.temCadUnico ? 'badge-teal' : 'badge-slate'}">
                ${animal.tutor?.temCadUnico ? '✓ CadÚnico: SIM (Beneficiário)' : '✕ CadÚnico: NÃO'}
              </span>
            ` : `
              <span class="badge-pill badge-slate">Resgate Público / Sem Tutor</span>
            `}
            <span class="badge-pill badge-slate">
              ${animal.microchipado ? (animal.numeroMicrochip ? `Microchip: ${animal.numeroMicrochip}` : 'Microchip: Sim') : 'Sem Microchip'}
            </span>
          </div>
          <div class="grid-4">
            <div>
              <div class="card-label">Espécie / Sexo</div>
              <div class="card-value">${animal.especie} • ${animal.sexo}</div>
            </div>
            <div>
              <div class="card-label">Raça / Pelagem</div>
              <div class="card-value">${animal.raca || 'SRD'} (${animal.corPelagem || '-'})</div>
            </div>
            <div>
              <div class="card-label">Porte / Idade</div>
              <div class="card-value">${animal.porte || '-'}${animal.idade ? ` • ${animal.idade}` : ''}</div>
            </div>
            <div>
              <div class="card-label">ID Animal</div>
              <div class="card-value mono">${animal.id.substring(0, 8).toUpperCase()}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- DADOS DO TUTOR OU SOLICITANTE -->
      <div class="section">
        <div class="section-header">
          <div class="section-title">${animal.temTutor ? 'Identificação do Tutor Responsável' : 'Identificação da Ocorrência e Solicitante'}</div>
          ${animal.temTutor && animal.tutor?.temCadUnico ? `
            <span class="badge-pill badge-teal" style="margin: 0;">Beneficiário do CadÚnico</span>
          ` : ''}
        </div>
        ${animal.temTutor ? `
          <div class="grid-4">
            <div class="card">
              <div class="card-label">Tutor Responsável</div>
              <div class="card-value">${animal.tutor?.nomeCompleto || animal.solicitante?.nomeCompleto || 'Não Informado'}</div>
            </div>
            <div class="card">
              <div class="card-label">CPF</div>
              <div class="card-value mono">${animal.tutor?.cpf || '-'}</div>
            </div>
            <div class="card">
              <div class="card-label">Contato / Telefone</div>
              <div class="card-value">${animal.tutor?.telefone || animal.solicitante?.telefone || '-'}</div>
            </div>
            <div class="card">
              <div class="card-label">Situação CadÚnico</div>
              <div class="card-value ${animal.tutor?.temCadUnico ? 'highlight' : ''}">
                ${animal.tutor?.temCadUnico ? `Sim (Possui Benefício)${animal.tutor?.documentoCadUnico ? ` - NIS: ${animal.tutor.documentoCadUnico}` : ''}` : 'Não Possui'}
              </div>
            </div>
          </div>
          <div class="card" style="margin-top: 6px;">
            <div class="card-label">Endereço Residencial do Tutor</div>
            <div class="card-value">${animal.tutor?.endereco || animal.localResgate || 'Não informado'}</div>
          </div>
        ` : `
          <div class="grid-3">
            <div class="card">
              <div class="card-label">Solicitante</div>
              <div class="card-value">${animal.solicitante?.nomeCompleto || 'Desconhecido'}</div>
            </div>
            <div class="card">
              <div class="card-label">Vínculo / Tipo</div>
              <div class="card-value">${animal.solicitante?.tipo || 'Cidadão'}</div>
            </div>
            <div class="card">
              <div class="card-label">Contato Solicitante</div>
              <div class="card-value">${animal.solicitante?.telefone || '-'}</div>
            </div>
          </div>
          <div class="card" style="margin-top: 6px;">
            <div class="card-label">Local da Ocorrência / Resgate</div>
            <div class="card-value">${animal.localResgate || 'Não informado'}</div>
          </div>
        `}
      </div>

      <!-- CORPO PRINCIPAL DO ATENDIMENTO CLÍNICO -->
      <div class="consultation-box">
        <div class="consultation-header">
          <div class="consultation-header-title">
            Atendimento Clínico • Data: ${dataAtendimentoFormatted}
          </div>
          <div style="font-size: 12px; font-weight: 700;">
            Dr(a). ${vet?.name || 'Veterinário(a) Responsável'} ${vet?.crmv ? `• CRMV: ${vet.crmv}` : ''}
          </div>
        </div>

        <div class="consultation-body">
          <!-- Queixa Inicial / Relato -->
          ${animal.motivo ? `
            <div class="narrative-box">
              <div class="card-label">${animal.temTutor ? 'Queixa Principal / Relato do Tutor' : 'Motivo / Relato de Resgate'}</div>
              <div style="font-size: 12.5px; color: #1e293b; font-style: italic;">"${animal.motivo}"</div>
            </div>
          ` : ''}

          <!-- Sinais Vitais na Triagem -->
          <div class="vitals-grid">
            <div class="vital-item">
              <strong>Peso no Atend.</strong>
              <span>${record.peso ? `${record.peso} kg` : (animal.peso ? `${animal.peso} kg` : '-')}</span>
            </div>
            <div class="vital-item">
              <strong>Temperatura</strong>
              <span>${record.temperatura ? `${record.temperatura} °C` : '-'}</span>
            </div>
            <div class="vital-item">
              <strong>Freq. Cardíaca</strong>
              <span>${record.frequenciaCardiaca ? `${record.frequenciaCardiaca} bpm` : '-'}</span>
            </div>
            <div class="vital-item">
              <strong>Freq. Respiratória</strong>
              <span>${record.frequenciaRespiratoria ? `${record.frequenciaRespiratoria} mpm` : '-'}</span>
            </div>
            <div class="vital-item">
              <strong>Mucosa</strong>
              <span>${record.mucosa || '-'}</span>
            </div>
            <div class="vital-item">
              <strong>Hidratação</strong>
              <span>${record.hidratacao || '-'}</span>
            </div>
            <div class="vital-item">
              <strong>Palpação Abd.</strong>
              <span>${record.palpacaoAbdominal || '-'}</span>
            </div>
            <div class="vital-item">
              <strong>Ausculta Card.</strong>
              <span>${record.auscultaCardiaca || '-'}</span>
            </div>
          </div>

          <!-- Aplicações Realizadas no Atendimento -->
          ${(record.v10Aplicada || record.antirrabicaAplicada || record.vermifugoAplicado || record.microchipAplicado) ? `
            <div class="card" style="margin-bottom: 10px; background: #f8fafc;">
              <div class="card-label">Procedimentos Preventivos / Aplicações Realizadas</div>
              <div style="margin-top: 4px;">
                ${record.v10Aplicada ? `<span class="badge-pill badge-teal">Vacina V10 ${record.v10Data ? `(${record.v10Data})` : ''}</span>` : ''}
                ${record.antirrabicaAplicada ? `<span class="badge-pill badge-teal">Antirrábica ${record.antirrabicaData ? `(${record.antirrabicaData})` : ''}</span>` : ''}
                ${record.vermifugoAplicado ? `<span class="badge-pill badge-amber">Vermífugo ${record.vermifugoData ? `(${record.vermifugoData})` : ''}</span>` : ''}
                ${record.microchipAplicado ? `<span class="badge-pill badge-slate">Microchip Aplicado: ${record.numeroMicrochipAplicado || 'Implantado'}</span>` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Diagnóstico Clínico -->
          <div class="diag-box">
            <div class="card-label" style="color: #0f766e;">Diagnóstico / Suspeita Clínica</div>
            <div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-top: 2px;">
              ${record.diagnosticoClinico || 'Não informado'}
            </div>
          </div>

          <!-- Conduta / Tratamento Ambulatorial -->
          <div class="conduct-box">
            <div class="card-label" style="color: #1d4ed8;">Conduta Técnica / Procedimentos Ambulatoriais Realizados</div>
            <div style="font-size: 12.5px; font-weight: 600; color: #1e3a8a; margin-top: 2px; white-space: pre-wrap;">${record.tratamentoAmbulatorial || 'Sem procedimentos registrados'}</div>
          </div>

          <!-- Observações Clínicas Gerais -->
          ${record.observacoesGerais ? `
            <div class="narrative-box">
              <div class="card-label">Observações Clínicas Gerais / Evolução</div>
              <div style="font-size: 12px; color: #334155; white-space: pre-wrap;">${record.observacoesGerais}</div>
            </div>
          ` : ''}

          <!-- Prescrições e Medicamentos -->
          ${prescCount > 0 ? `
            <div style="margin-top: 10px;">
              <div class="card-label" style="color: #0d9488; font-size: 11px;">Prescrição Médica Veterinária (${prescCount})</div>
              <table class="table-custom">
                <thead>
                  <tr>
                    <th>Medicamento</th>
                    <th>Dosagem</th>
                    <th>Frequência</th>
                    <th>Duração</th>
                    <th>Via</th>
                    <th>Orientações</th>
                  </tr>
                </thead>
                <tbody>
                  ${record.receitas!.map(rx => `
                    <tr>
                      <td style="font-weight: 800; color: #0f172a;">${rx.medicamento}</td>
                      <td>${rx.dosagem}</td>
                      <td>${rx.frequencia}</td>
                      <td>${rx.duracao}</td>
                      <td>${rx.via || 'Oral'}</td>
                      <td style="font-style: italic;">${rx.observacoes || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- Encaminhamentos -->
          ${refCount > 0 ? `
            <div style="margin-top: 10px;">
              <div class="card-label" style="color: #0284c7; font-size: 11px;">Guias de Encaminhamento Especializado (${refCount})</div>
              <table class="table-custom">
                <thead>
                  <tr>
                    <th>Especialidade</th>
                    <th>Urgência</th>
                    <th>Motivo Clínico</th>
                    <th>Local Recomendado</th>
                  </tr>
                </thead>
                <tbody>
                  ${record.encaminhamentos!.map(enc => `
                    <tr>
                      <td style="font-weight: 800;">${enc.especialidade}</td>
                      <td><span class="badge-pill ${enc.urgencia === 'ALTA' || enc.urgencia === 'EMERGENCIA' ? 'badge-amber' : 'badge-slate'}">${enc.urgencia}</span></td>
                      <td>${enc.motivo}</td>
                      <td>${enc.localSugerido || 'A critério'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <!-- Exames Solicitados -->
          ${record.examesSolicitados ? `
            <div class="card" style="margin-top: 10px; background: #fefce8; border-color: #fef08a;">
              <div class="card-label" style="color: #854d0e;">Exames Complementares Solicitados</div>
              <div style="font-size: 12px; color: #713f12; font-weight: 600; white-space: pre-wrap;">${record.examesSolicitados}</div>
            </div>
          ` : ''}

          <!-- Indicação de Acomodação / Internação -->
          ${record.necessitaInternacao ? `
            <div class="card" style="margin-top: 10px; background: #fff7ed; border-color: #ffedd5;">
              <div class="card-label" style="color: #9a3412;">Internação no Centro de Bem-Estar</div>
              <div style="font-size: 12px; color: #7c2d12;">
                <strong>Baia Recomendada:</strong> ${record.recommendedKennelType || 'Geral'} • 
                <strong>Justificativa:</strong> ${record.accommodationJustification || 'Necessidade de observação clínica'}
              </div>
            </div>
          ` : ''}

          <!-- Adendos / Complementos Clínicos (Append-Only) -->
          ${adendos.length > 0 ? `
            <div class="addenda-section">
              <div class="card-label" style="color: #0d9488; font-size: 11px; margin-bottom: 6px;">
                Notas Complementares Posteriores ao Atendimento (${adendos.length})
              </div>
              ${adendos.map((ad, adIdx) => `
                <div class="addendum-item">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong style="font-size: 11.5px; color: #0f766e; text-transform: uppercase;">
                      Nota Complementar #${adIdx + 1} • ${format(new Date(ad.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </strong>
                    <span style="font-size: 10.5px; color: #64748b; font-weight: 700;">
                      Dr(a). ${ad.veterinarioNome || 'Veterinário(a)'} ${ad.crmv ? `(CRMV: ${ad.crmv})` : ''}
                    </span>
                  </div>
                  <div style="font-size: 10px; color: #475569; font-weight: 700; text-transform: uppercase; margin-bottom: 2px;">
                    Motivo: ${ad.motivo || 'Evolução clínica'}
                  </div>
                  <div style="font-size: 12px; color: #0f172a; white-space: pre-wrap; font-style: italic;">
                    "${ad.texto}"
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- ASSINATURAS OFICIAIS -->
      <div class="footer-signatures">
        <div class="signatures-grid">
          <div>
            <div class="sig-line">
              <div class="sig-name">Dr(a). ${vet?.name || 'Médico(a) Veterinário(a)'}</div>
              <div class="sig-role">${vet?.crmv ? `CRMV: ${vet.crmv}` : 'Responsável Técnico(a)'} • SISBEM Pouso Alegre</div>
            </div>
          </div>
          <div>
            <div class="sig-line">
              <div class="sig-name">${animal.temTutor ? (animal.tutor?.nomeCompleto || 'Tutor Responsável') : 'Responsável pelo Centro de Bem-Estar'}</div>
              <div class="sig-role">${animal.temTutor ? (animal.tutor?.cpf ? `CPF: ${animal.tutor.cpf}` : 'Tutor / Representante Legal') : 'Superintendência de Proteção Animal'}</div>
            </div>
          </div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;
}

export function printClinicalRecord(record: ClinicalRecord, animal: AnimalJoined): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita pop-ups para imprimir o prontuário clínico.');
    return;
  }

  const html = generateClinicalRecordHTML(record, animal);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
