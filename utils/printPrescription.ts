import { format } from 'date-fns';
import { AnimalJoined } from '../types';

export interface PrintPrescriptionOptions {
  kennelName?: string;
  orientacoesGerais?: string;
}

export function generatePrintHTML(
  title: string = 'Receituário Clínico',
  animal: Partial<AnimalJoined> & { nome: string; especie: string },
  vet: any,
  items: any[],
  type: 'PRESCRIPTION' | 'REFERRAL' = 'PRESCRIPTION',
  kennelNameOrOptions?: string | PrintPrescriptionOptions,
  orientacoesGeraisParam?: string
): string {
  let kennelName = '';
  let orientacoesGerais = orientacoesGeraisParam || '';

  if (typeof kennelNameOrOptions === 'string') {
    kennelName = kennelNameOrOptions;
  } else if (kennelNameOrOptions && typeof kennelNameOrOptions === 'object') {
    kennelName = kennelNameOrOptions.kennelName || '';
    if (!orientacoesGerais && kennelNameOrOptions.orientacoesGerais) {
      orientacoesGerais = kennelNameOrOptions.orientacoesGerais;
    }
  }

  if (!kennelName && (animal as any).currentOccupation?.kennel?.name) {
    kennelName = (animal as any).currentOccupation.kennel.name;
  }

  const responsavelVal = animal.temTutor
    ? (animal.tutor?.nomeCompleto || 'Não informado')
    : (kennelName || 'Centro de Bem-Estar Animal');

  const vetName = vet?.name || vet?.nome || 'Médico Veterinário';
  const vetCrmv = vet?.crmv ? `CRMV: ${vet.crmv}` : 'Responsável Técnico';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>SISBEM - ${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap');
        body { font-family: 'Montserrat', sans-serif; padding: 40px; color: #000; line-height: 1.45; background: #fff; font-size: 13px; }
        .header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 20px; border-bottom: 3px solid #000; padding-bottom: 12px; }
        .title-container { flex-grow: 1; }
        .pref-de { font-size: 18px; font-weight: 400; letter-spacing: 10px; margin: 0; color: #000; }
        .pref-nome { font-size: 46px; font-weight: 900; margin: -5px 0 0 0; line-height: 1; letter-spacing: -2px; color: #000; }
        .sub-title { font-size: 16px; font-weight: 700; margin: 8px 0 0 0; color: #000; border-top: 2px solid #000; padding-top: 4px; }
        .meta-info { text-align: right; min-width: 130px; }
        .doc-date { font-size: 16px; font-weight: 700; color: #000; }
        .doc-main-title { font-size: 24px; font-weight: 900; text-transform: uppercase; text-align: center; letter-spacing: 1.5px; color: #000; margin: 20px 0; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 10px; color: #444; letter-spacing: 1px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .box { background: #fcfcfc; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 4px; }
        .label { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
        .val { font-size: 13.5px; font-weight: 700; color: #000; }
        .presc-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12.5px; }
        .presc-table thead th { background: #f8fafc; color: #334155; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 6px; border-bottom: 2px solid #000; border-top: 1px solid #e2e8f0; text-align: left; }
        .presc-table thead th.th-num { text-align: center; width: 36px; }
        .presc-table tbody td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #000; }
        .presc-table tbody tr { page-break-inside: avoid; }
        .td-num { text-align: center; font-weight: 900; font-size: 13px; color: #000; width: 36px; }
        .td-med { font-weight: 700; min-width: 140px; }
        .med-name { font-size: 13px; font-weight: 900; text-transform: uppercase; color: #000; }
        .med-via { font-size: 10.5px; font-weight: 600; color: #64748b; margin-top: 1px; }
        .td-dos, .td-freq, .td-dur { font-size: 12.5px; font-weight: 600; white-space: nowrap; }
        .td-obs { font-size: 12px; color: #334155; line-height: 1.4; word-break: break-word; }
        .general-obs-box { margin-top: 14px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; border-left: 4px solid #0f766e; }
        .general-obs-title { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #0f766e; margin-bottom: 3px; letter-spacing: 0.5px; }
        .general-obs-text { font-size: 12.5px; color: #1e293b; line-height: 1.45; }
        .item-box { border: 2px solid #000; padding: 20px; border-radius: 8px; margin-top: 15px; page-break-inside: avoid; }
        .item-top { border-bottom: 1px solid #000; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
        .item-name { font-size: 22px; font-weight: 900; text-transform: uppercase; }
        .item-tag { font-size: 13px; font-weight: 900; background: #000; color: #fff; padding: 4px 12px; border-radius: 4px; }
        .item-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
        .obs-box { margin-top: 15px; padding: 14px; background: #f5f5f5; border-left: 5px solid #000; font-style: italic; font-size: 14.5px; line-height: 1.5; }
        .footer { margin-top: 70px; text-align: center; }
        .line { width: 300px; border-top: 1px solid #000; margin: 0 auto 10px; }
        .vet { font-size: 16px; font-weight: 900; text-transform: uppercase; }
        .crmv { font-size: 13.5px; font-weight: 700; color: #444; }
        @media print { body { padding: 0; font-size: 13px; } .no-print { display: none; } }
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
          <div class="doc-date">${format(new Date(), 'dd/MM/yyyy')}</div>
        </div>
      </div>
      <div class="doc-main-title">${title}</div>
      <div class="section">
        <div class="section-title">Paciente</div>
        <div class="grid">
          <div class="box"><div class="label">Animal / Espécie</div><div class="val">${animal.nome} (${animal.especie})</div></div>
          <div class="box"><div class="label">Raça / Sexo / Peso</div><div class="val">${animal.raca || 'SRD'} • ${animal.sexo || 'Indefinido'} • ${animal.peso ? animal.peso + 'kg' : (animal.porte || 'Médio')}</div></div>
          <div class="box" style="grid-column: span 2"><div class="label">${animal.temTutor ? 'Responsável Legal' : 'Acomodação Interna'}</div><div class="val">${responsavelVal}</div></div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">${type === 'PRESCRIPTION' ? 'Prescrições' : 'Detalhes do Encaminhamento'}</div>
        ${type === 'PRESCRIPTION' ? `
          <table class="presc-table">
            <thead>
              <tr>
                <th class="th-num">Nº</th>
                <th>Medicamento</th>
                <th>Dosagem</th>
                <th>Frequência</th>
                <th>Duração</th>
                <th>Observações</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((i, idx) => `
                <tr>
                  <td class="td-num">${idx + 1}</td>
                  <td class="td-med">
                    <div class="med-name">${i.medicamento}</div>
                    ${i.via ? `<div class="med-via">Via: ${i.via}</div>` : ''}
                  </td>
                  <td class="td-dos">${i.dosagem || '—'}</td>
                  <td class="td-freq">${i.frequencia || '—'}</td>
                  <td class="td-dur">${i.duracao || '—'}</td>
                  <td class="td-obs">${i.observacoes && i.observacoes !== 'N/A' ? i.observacoes : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${orientacoesGerais && orientacoesGerais.trim() !== '' ? `
            <div class="general-obs-box">
              <div class="general-obs-title">Orientações Gerais:</div>
              <div class="general-obs-text">${orientacoesGerais}</div>
            </div>
          ` : ''}
        ` : `
          ${items.map(i => `
            <div class="item-box">
              <div class="item-top">
                <div class="item-name">${i.especialidade}</div>
                <div class="item-tag">${'URGÊNCIA: ' + i.urgencia}</div>
              </div>
              <div class="item-grid">
                <div style="grid-column: span 3"><div class="label">Local Sugerido</div><div class="val">${i.localSugerido || 'À critério do tutor'}</div></div>
              </div>
              <div class="obs-box">
                <strong>Justificativa Técnica:</strong> ${i.motivo}
              </div>
            </div>
          `).join('')}
        `}
      </div>
      <div class="footer">
        <div class="line"></div>
        <div class="vet">${vetName}</div>
        <div class="crmv">${vetCrmv}</div>
      </div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `;
}
