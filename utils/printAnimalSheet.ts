import { AnimalJoined, AnimalCondicao, Especie } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db } from '../services/db';

export function generateAnimalSheetHTML(animal: AnimalJoined): string {
  const users = db.getUsers();
  const kennels = db.getKennels();
  const occupations = db.getOccupations().filter(o => o.animalId === animal.id);
  
  const formattedDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const dataCadastroFormatted = animal.dataCadastro ? format(new Date(animal.dataCadastro), 'dd/MM/yyyy') : 'N/A';
  const dataResgateFormatted = animal.dataResgate ? format(new Date(animal.dataResgate), 'dd/MM/yyyy') : 'N/A';
  
  // Status text and style
  let statusBadgeBg = '#f1f5f9';
  let statusBadgeColor = '#334155';
  let statusText = animal.condicao as string;

  if (animal.condicao === AnimalCondicao.DISPONIVEL_ADOCAO) {
    statusBadgeBg = '#ecfdf5';
    statusBadgeColor = '#047857';
    statusText = 'Disponível para Adoção';
  } else if (animal.condicao === AnimalCondicao.EM_TRATAMENTO) {
    statusBadgeBg = '#eff6ff';
    statusBadgeColor = '#1d4ed8';
    statusText = 'Em Tratamento Clínico';
  } else if (animal.condicao === AnimalCondicao.ACOLHIDO) {
    statusBadgeBg = '#fef3c7';
    statusBadgeColor = '#b45309';
    statusText = 'Acolhido no Centro';
  } else if (animal.condicao === AnimalCondicao.ADOTADO) {
    statusBadgeBg = '#d1fae5';
    statusBadgeColor = '#065f46';
    statusText = 'Adotado';
  } else if (animal.condicao === AnimalCondicao.SOLTURA) {
    statusBadgeBg = '#ccfbf1';
    statusBadgeColor = '#0f766e';
    statusText = 'Soltura Realizada';
  } else if (animal.condicao === AnimalCondicao.OBITO) {
    statusBadgeBg = '#0f172a';
    statusBadgeColor = '#ffffff';
    statusText = 'Óbito';
  }

  // Sorted medical history
  const historico = animal.historico ? [...animal.historico].sort((a, b) => 
    new Date(b.dataAtendimento).getTime() - new Date(a.dataAtendimento).getTime()
  ) : [];

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>SISBEM - Ficha do Animal - ${animal.nome.toUpperCase()}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        body { 
          font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #0f172a;
          background: #ffffff;
          padding: 24px 32px;
          line-height: 1.45;
          font-size: 13.5px;
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
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 4px;
          color: #475569;
          text-transform: uppercase;
        }

        .pref-title {
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -0.5px;
          color: #0f172a;
          line-height: 1.1;
          margin-top: 1px;
        }

        .pref-sub {
          font-size: 13.5px;
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
          font-size: 12.5px;
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
          font-size: 12px;
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
          font-size: 13.5px;
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
          padding: 8px 10px;
        }

        .card-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          color: #64748b;
          margin-bottom: 2px;
        }

        .card-value {
          font-size: 13.5px;
          font-weight: 700;
          color: #0f172a;
        }

        .card-value.highlight {
          color: #0d9488;
        }

        .card-value.mono {
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        }

        /* ANIMAL BANNER */
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
          width: 90px;
          height: 90px;
          border-radius: 6px;
          object-fit: cover;
          border: 1px solid #cbd5e1;
          flex-shrink: 0;
        }

        .patient-photo-placeholder {
          width: 90px;
          height: 90px;
          border-radius: 6px;
          background: #f1f5f9;
          border: 1px dashed #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10.5px;
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
          font-size: 22px;
          font-weight: 900;
          text-transform: uppercase;
          color: #0f172a;
          letter-spacing: -0.3px;
        }

        .status-pill {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 4px;
          border: 1px solid rgba(0,0,0,0.08);
          background: ${statusBadgeBg};
          color: ${statusBadgeColor};
        }

        /* CLINICAL RECORDS TABLE */
        .record-box {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          margin-bottom: 12px;
          page-break-inside: avoid;
          overflow: hidden;
        }

        .record-header {
          background: #f1f5f9;
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #cbd5e1;
        }

        .record-title {
          font-size: 13.5px;
          font-weight: 900;
          text-transform: uppercase;
          color: #0f172a;
        }

        .record-badges {
          display: flex;
          gap: 4px;
        }

        .tag-pill {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 3px;
          background: #e2e8f0;
          color: #334155;
        }

        .tag-pill.chip {
          background: #ccfbf1;
          color: #0f766e;
          font-family: monospace;
        }

        .record-content {
          padding: 12px;
        }

        .vitals-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin-bottom: 8px;
          background: #f8fafc;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }

        .vital-item {
          font-size: 12px;
        }
        .vital-item strong {
          color: #64748b;
          font-weight: 800;
          text-transform: uppercase;
          display: block;
          font-size: 10px;
        }
        .vital-item span {
          color: #0f172a;
          font-weight: 700;
        }

        .diag-box {
          background: #f8fafc;
          border-left: 3px solid #0d9488;
          padding: 8px 10px;
          margin-bottom: 6px;
          border-radius: 0 4px 4px 0;
        }

        .table-custom {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
          font-size: 12.5px;
        }

        .table-custom th {
          background: #e2e8f0;
          text-align: left;
          padding: 6px 8px;
          font-size: 11.5px;
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

        /* FOOTER & SIGNATURE */
        .footer-signatures {
          margin-top: 24px;
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
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          color: #0f172a;
        }

        .sig-role {
          font-size: 11.5px;
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
        <button class="btn-print" onclick="window.print()">🖨️ Imprimir Ficha / Salvar PDF</button>
      </div>

      <!-- HEADER -->
      <div class="header">
        <div class="header-left">
          <div class="pref-label">Prefeitura Municipal de</div>
          <div class="pref-title">POUSO ALEGRE</div>
          <div class="pref-sub">Superintendência de Proteção e Cuidado Animal • SISBEM</div>
        </div>
        <div class="header-right">
          <div class="doc-badge">Ficha do Animal & Prontuário</div>
          <div class="meta-text"><strong>ID:</strong> ${animal.id.substring(0, 8).toUpperCase()}</div>
          <div class="meta-text"><strong>Emissão:</strong> ${formattedDate}</div>
        </div>
      </div>

      <!-- PATIENT BANNER -->
      <div class="patient-banner">
        ${animal.foto ? `
          <img src="${animal.foto}" alt="${animal.nome}" class="patient-photo" />
        ` : `
          <div class="patient-photo-placeholder">Sem Foto Cadastrada</div>
        `}
        <div class="patient-main">
          <div class="patient-name-row">
            <div class="patient-name">${animal.nome}</div>
            <div class="status-pill">${statusText}</div>
          </div>
          <div class="grid-4">
            <div class="card">
              <div class="card-label">Espécie / Raça</div>
              <div class="card-value">${animal.especie} • ${animal.raca}</div>
            </div>
            <div class="card">
              <div class="card-label">Sexo / Idade / Porte</div>
              <div class="card-value">${animal.sexo} • ${animal.idade || 'Idade N/I'} • ${animal.porte}</div>
            </div>
            <div class="card">
              <div class="card-label">Castrado?</div>
              <div class="card-value ${animal.castrado ? 'highlight' : ''}">${animal.castrado ? 'SIM' : 'NÃO'}</div>
            </div>
            <div class="card">
              <div class="card-label">Microchip</div>
              <div class="card-value mono ${animal.microchipado ? 'highlight' : ''}">${animal.microchipado ? (animal.numeroMicrochip || 'SIM') : 'NÃO POSSUI'}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- CARACTERÍSTICAS FÍSICAS E CADASTRAIS -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">1. Dados Cadastrais e Físicos</span>
        </div>
        <div class="grid-5">
          <div class="card">
            <div class="card-label">Idade Estimada</div>
            <div class="card-value">${animal.idade || 'Não informada'}</div>
          </div>
          <div class="card">
            <div class="card-label">Peso na Triagem</div>
            <div class="card-value">${animal.peso} kg</div>
          </div>
          <div class="card">
            <div class="card-label">Pelagem / Cor</div>
            <div class="card-value">${animal.corPelagem || 'Não informada'}</div>
          </div>
          <div class="card">
            <div class="card-label">Data de Cadastro</div>
            <div class="card-value">${dataCadastroFormatted}</div>
          </div>
          <div class="card">
            <div class="card-label">Cadastrador</div>
            <div class="card-value">${animal.usuarioResponsavel?.name || 'Sistema'}</div>
          </div>
        </div>
      </div>

      <!-- ORIGEM, ENTRADA E RESPONSÁVEL -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">2. Dados de Origem, Entrada e Responsável</span>
        </div>
        <div class="grid-2">
          <!-- Coluna Entrada -->
          <div class="card">
            <div class="card-label">Tipo de Ingresso / Ocorrência</div>
            <div class="card-value highlight">${animal.temTutor ? 'CONSULTA EXTERNA (COM TUTOR)' : 'RESGATE / ACOLHIMENTO MUNICIPAL'}</div>
            
            <div style="margin-top: 6px;" class="grid-2">
              <div>
                <div class="card-label">Data da Ocorrência</div>
                <div class="card-value">${dataResgateFormatted}</div>
              </div>
              <div>
                <div class="card-label">Resgate SAMUVET</div>
                <div class="card-value">${animal.resgateSamuvet ? `SIM (${animal.responsavelSamuvet || 'Plantonista'})` : 'NÃO'}</div>
              </div>
            </div>

            <div style="margin-top: 6px;">
              <div class="card-label">${animal.temTutor ? 'Local do Atendimento' : 'Local do Resgate'}</div>
              <div class="card-value">${animal.localResgate || 'Não informado'}</div>
            </div>

            <div style="margin-top: 6px;">
              <div class="card-label">${animal.temTutor ? 'Queixa do Tutor / Anamnese Inicial' : 'Motivo / Relato do Resgate'}</div>
              <div style="font-size: 13px; color: #334155; font-style: italic; margin-top: 2px;">"${animal.motivo || 'Sem relato registrado'}"</div>
            </div>
          </div>

          <!-- Coluna Responsável -->
          <div class="card">
            ${animal.temTutor && animal.tutor ? `
              <div class="card-label">Tutor Legal do Animal</div>
              <div class="card-value" style="font-size: 14.5px;">${animal.tutor.nomeCompleto}</div>
              
              <div style="margin-top: 6px;" class="grid-2">
                <div>
                  <div class="card-label">CPF</div>
                  <div class="card-value mono">${animal.tutor.cpf}</div>
                </div>
                <div>
                  <div class="card-label">Telefone</div>
                  <div class="card-value">${animal.tutor.telefone || 'N/A'}</div>
                </div>
              </div>

              <div style="margin-top: 6px;">
                <div class="card-label">CadÚnico</div>
                <div class="card-value">${animal.tutor.temCadUnico ? 'SIM (Beneficiário CadÚnico)' : 'NÃO'}</div>
              </div>

              <div style="margin-top: 6px;">
                <div class="card-label">Endereço Residencial</div>
                <div class="card-value" style="font-size: 12.5px;">${animal.tutor.endereco || 'Não informado'}</div>
              </div>
            ` : animal.solicitante && (animal.solicitante.tipo === 'DESCONHECIDO' || animal.solicitante.cpf === 'DESC-ANONIMO' || animal.solicitante.nomeCompleto?.toLowerCase().includes('desconhecido')) ? `
              <div class="card-label">Origem da Solicitação</div>
              <div class="card-value" style="font-size: 14.5px; display: flex; align-items: center; justify-content: space-between;">
                <span>SOLICITANTE DESCONHECIDO / ANÔNIMO</span>
                <span style="font-family: monospace; font-size: 11.5px; font-weight: 800; background: #e2e8f0; color: #334155; padding: 2px 6px; border-radius: 4px;">DESC-ANONIMO</span>
              </div>
              
              <div style="margin-top: 6px;">
                <div class="card-label">Descrição da Origem</div>
                <div class="card-value" style="font-size: 12.5px; color: #475569;">Recolhimento municipal direto em via pública / captura preventiva ou denúncia anônima sem solicitante formal.</div>
              </div>

              <div style="margin-top: 6px;">
                <div class="card-label">Acomodação Atual no Centro</div>
                <div class="card-value highlight">${animal.currentOccupation?.kennel?.name ? `${animal.currentOccupation.kennel.name} (${animal.currentOccupation.kennel.type})` : 'Sem baia vinculada'}</div>
              </div>
            ` : animal.solicitante ? `
              <div class="card-label">${animal.solicitante.tipo === 'ONG' || animal.solicitante.codigoOng ? 'ONG / Entidade Solicitante' : 'Solicitante do Resgate / Órgão'}</div>
              <div class="card-value" style="font-size: 14.5px; display: flex; align-items: center; justify-content: space-between;">
                <span>${animal.solicitante.nomeCompleto}</span>
                ${animal.solicitante.codigoOng ? `<span style="font-family: monospace; font-size: 12px; font-weight: 900; background: #0f766e; color: #ffffff; padding: 2px 6px; border-radius: 4px;">${animal.solicitante.codigoOng}</span>` : ''}
              </div>
              
              <div style="margin-top: 6px;" class="grid-2">
                <div>
                  <div class="card-label">${animal.solicitante.tipo === 'ONG' ? 'CNPJ / Registro' : 'CPF / Documento'}</div>
                  <div class="card-value mono">${animal.solicitante.cpf || 'N/A'}</div>
                </div>
                <div>
                  <div class="card-label">Telefone</div>
                  <div class="card-value">${animal.solicitante.telefone || 'N/A'}</div>
                </div>
              </div>

              ${animal.solicitante.responsavel ? `
                <div style="margin-top: 6px;">
                  <div class="card-label">Representante / Responsável da ONG</div>
                  <div class="card-value" style="font-size: 12.5px;">${animal.solicitante.responsavel}</div>
                </div>
              ` : ''}

              <div style="margin-top: 6px;">
                <div class="card-label">Acomodação Atual no Centro</div>
                <div class="card-value highlight">${animal.currentOccupation?.kennel?.name ? `${animal.currentOccupation.kennel.name} (${animal.currentOccupation.kennel.type})` : 'Sem baia vinculada'}</div>
              </div>
            ` : `
              <div class="card-label">Responsável</div>
              <div class="card-value" style="color: #94a3b8; font-style: italic;">Sem tutor ou solicitante vinculado.</div>
            `}
          </div>
        </div>
      </div>

      <!-- DESFECHO SE APLICÁVEL -->
      ${(animal.condicao === AnimalCondicao.OBITO || animal.condicao === AnimalCondicao.ADOTADO || animal.condicao === AnimalCondicao.SOLTURA) ? `
        <div class="section">
          <div class="section-header">
            <span class="section-title">3. Registro de Desfecho / Ciclo Final</span>
          </div>
          <div class="card" style="border-left: 4px solid #0f172a;">
            <div class="grid-3">
              <div>
                <div class="card-label">Tipo de Desfecho</div>
                <div class="card-value highlight">${animal.condicao === AnimalCondicao.OBITO ? 'ÓBITO REGISTRADO' : animal.condicao === AnimalCondicao.ADOTADO ? 'ADOÇÃO CONCLUÍDA' : 'SOLTURA REALIZADA'}</div>
              </div>
              <div>
                <div class="card-label">Data do Desfecho</div>
                <div class="card-value">${animal.condicao === AnimalCondicao.OBITO && animal.dataObito ? format(new Date(animal.dataObito), 'dd/MM/yyyy') : animal.condicao === AnimalCondicao.ADOTADO && animal.dataAdocao ? format(new Date(animal.dataAdocao), 'dd/MM/yyyy') : animal.dataSoltura ? format(new Date(animal.dataSoltura), 'dd/MM/yyyy') : 'N/A'}</div>
              </div>
              <div>
                <div class="card-label">${animal.condicao === AnimalCondicao.OBITO ? 'Causa / Laudo' : animal.condicao === AnimalCondicao.ADOTADO ? 'Adotante' : 'Local da Soltura'}</div>
                <div class="card-value">${animal.condicao === AnimalCondicao.OBITO ? animal.causaObito : animal.condicao === AnimalCondicao.ADOTADO ? `${animal.adotante?.nome} (CPF: ${animal.adotante?.cpf})` : animal.localSoltura}</div>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- HISTÓRICO CLÍNICO E PRONTUÁRIOS -->
      <div class="section">
        <div class="section-header">
          <span class="section-title">4. Prontuário e Histórico Clínico Veterinário (${historico.length} ${historico.length === 1 ? 'atendimento' : 'atendimentos'})</span>
        </div>

        ${historico.length === 0 ? `
          <div class="card" style="text-align: center; padding: 16px; color: #94a3b8; font-style: italic;">
            Nenhum atendimento clínico registrado até o momento.
          </div>
        ` : historico.map((rec, index) => {
          const vet = users.find(u => u.id === rec.veterinarioId);
          const dataAtendimentoFormatted = rec.dataAtendimento ? format(new Date(rec.dataAtendimento), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A';

          return `
            <div class="record-box">
              <div class="record-header">
                <div class="record-title">
                  Atendimento #${historico.length - index} • ${dataAtendimentoFormatted} • Dr(a). ${vet?.name || 'Veterinário Responsável'} ${vet?.crmv ? `(CRMV: ${vet.crmv})` : ''}
                </div>
                <div class="record-badges">
                  ${rec.v10Aplicada ? '<span class="tag-pill">Vacina V10</span>' : ''}
                  ${rec.antirrabicaAplicada ? '<span class="tag-pill">Antirrábica</span>' : ''}
                  ${rec.vermifugoAplicado ? '<span class="tag-pill">Vermífugo</span>' : ''}
                  ${rec.microchipAplicado ? `<span class="tag-pill chip">Chip: ${rec.numeroMicrochipAplicado || 'Implantado'}</span>` : ''}
                  <span class="tag-pill" style="background: #0f172a; color: #fff;">${rec.statusResultante || 'Atendido'}</span>
                </div>
              </div>

              <div class="record-content">
                <!-- Vitals -->
                <div class="vitals-grid">
                  <div class="vital-item"><strong>Temperatura</strong><span>${rec.temperatura ? `${rec.temperatura} °C` : '-'}</span></div>
                  <div class="vital-item"><strong>Peso no Atend.</strong><span>${rec.peso ? `${rec.peso} kg` : '-'}</span></div>
                  <div class="vital-item"><strong>Freq. Cardíaca</strong><span>${rec.frequenciaCardiaca ? `${rec.frequenciaCardiaca} bpm` : '-'}</span></div>
                  <div class="vital-item"><strong>Freq. Respiratória</strong><span>${rec.frequenciaRespiratoria ? `${rec.frequenciaRespiratoria} mpm` : '-'}</span></div>
                  <div class="vital-item"><strong>Mucosa</strong><span>${rec.mucosa || '-'}</span></div>
                  <div class="vital-item"><strong>Hidratação</strong><span>${rec.hidratacao || '-'}</span></div>
                  <div class="vital-item"><strong>Ausculta Card.</strong><span>${rec.auscultaCardiaca || '-'}</span></div>
                  <div class="vital-item"><strong>Parasitas</strong><span>${rec.parasitas || '-'}</span></div>
                </div>

                <!-- Diagnóstico -->
                ${rec.diagnosticoClinico ? `
                  <div class="diag-box">
                    <div class="card-label">Diagnóstico / Suspeita Clínica</div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${rec.diagnosticoClinico}</div>
                  </div>
                ` : ''}

                <!-- Tratamento -->
                ${rec.tratamentoAmbulatorial ? `
                  <div style="margin-bottom: 6px;">
                    <div class="card-label">Conduta / Tratamento Ambulatorial</div>
                    <div style="font-size: 12.5px; color: #334155;">${rec.tratamentoAmbulatorial}</div>
                  </div>
                ` : ''}

                <!-- Observações -->
                ${rec.observacoesGerais ? `
                  <div style="margin-bottom: 6px;">
                    <div class="card-label">Observações Clínicas Gerais</div>
                    <div style="font-size: 12.5px; color: #334155; font-style: italic;">"${rec.observacoesGerais}"</div>
                  </div>
                ` : ''}

                <!-- Receitas -->
                ${rec.receitas && rec.receitas.length > 0 ? `
                  <div style="margin-top: 8px;">
                    <div class="card-label" style="color: #0d9488;">Prescrição / Medicamentos (${rec.receitas.length})</div>
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
                        ${rec.receitas.map(rx => `
                          <tr>
                            <td style="font-weight: 700;">${rx.medicamento}</td>
                            <td>${rx.dosagem}</td>
                            <td>${rx.frequencia}</td>
                            <td>${rx.duracao}</td>
                            <td>${rx.via}</td>
                            <td style="font-style: italic;">${rx.observacoes || '-'}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                ` : ''}

                <!-- Encaminhamentos -->
                ${rec.encaminhamentos && rec.encaminhamentos.length > 0 ? `
                  <div style="margin-top: 8px;">
                    <div class="card-label" style="color: #0284c7;">Encaminhamentos Especializados (${rec.encaminhamentos.length})</div>
                    <table class="table-custom">
                      <thead>
                        <tr>
                          <th>Especialidade</th>
                          <th>Urgência</th>
                          <th>Motivo</th>
                          <th>Local Sugerido</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${rec.encaminhamentos.map(enc => `
                          <tr>
                            <td style="font-weight: 700;">${enc.especialidade}</td>
                            <td>${enc.urgencia}</td>
                            <td>${enc.motivo}</td>
                            <td>${enc.localSugerido || 'À critério'}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- HISTÓRICO DE ACOMODAÇÕES (SE HOUVER) -->
      ${occupations.length > 0 ? `
        <div class="section">
          <div class="section-header">
            <span class="section-title">5. Histórico de Baias e Acomodações</span>
          </div>
          <table class="table-custom">
            <thead>
              <tr>
                <th>Baia / Local</th>
                <th>Tipo</th>
                <th>Entrada</th>
                <th>Saída</th>
                <th>Justificativa</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              ${occupations.map(occ => {
                const k = kennels.find(item => item.id === occ.kennelId);
                const resp = users.find(u => u.id === occ.vetId);
                return `
                  <tr>
                    <td style="font-weight: 700;">${k ? k.name : 'Baia'}</td>
                    <td>${k ? k.type : '-'}</td>
                    <td>${format(new Date(occ.entryDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</td>
                    <td>${occ.exitDate ? format(new Date(occ.exitDate), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '<strong style="color: #047857;">ATIVO ATUALMENTE</strong>'}</td>
                    <td style="font-style: italic;">${occ.justification || '-'}</td>
                    <td>${resp?.name || 'Sistema'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <!-- SIGNATURES -->
      <div class="footer-signatures">
        <div class="signatures-grid">
          <div>
            <div class="sig-line">
              <div class="sig-name">Responsável pelo Cadastro / Atendimento</div>
              <div class="sig-role">Centro de Bem-Estar Animal • Pouso Alegre / MG</div>
            </div>
          </div>
          <div>
            <div class="sig-line">
              <div class="sig-name">Médico(a) Veterinário(a) / Resp. Técnico</div>
              <div class="sig-role">CRMV-MG • SISBEM</div>
            </div>
          </div>
        </div>
      </div>

      <script>
        window.onload = function() {
          // Pequeno delay para garantir que imagens e fontes foram renderizadas antes do diálogo de impressão
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;
}

export function printAnimalSheet(animal: AnimalJoined): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita pop-ups para imprimir a ficha do animal.');
    return;
  }

  const html = generateAnimalSheetHTML(animal);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
