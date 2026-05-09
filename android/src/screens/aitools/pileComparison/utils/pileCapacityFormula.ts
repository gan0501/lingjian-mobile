export const buildSegmentThicknessBlock = (segs: any): string => {
  if (!segs || typeof segs !== 'object') {
    return `\n\n（空）\n`;
  }

  const entries = Object.entries(segs as Record<string, any>)
    .map(([k, v]) => {
      const key = String(k ?? '').trim();
      const len = Number(v);
      if (!key) return null;
      if (!Number.isFinite(len) || len <= 0) return null;
      return { key, len };
    })
    .filter(Boolean) as Array<{ key: string; len: number }>;

  entries.sort((a, b) => a.key.localeCompare(b.key, 'zh-Hans-CN'));

  const lines = entries.map((x) => `  - ${x.key}: ${x.len.toFixed(2)} m`);
  if (lines.length === 0) return `\n\n（空）\n`;
  return `\n\n${lines.join('\n')}\n`;
};

export const buildCompressionDerivationBlock = (detail: any): string => {
  const d = detail && typeof detail === 'object' ? detail : null;
  if (!d) {
    return `\n\n（空）\n`;
  }

  const u = Number((d as any)?.u);
  const Ap = Number((d as any)?.Ap);
  const qpk = Number((d as any)?.qpk);
  const betaC = Number((d as any)?.betaC);
  const qsikWeightedAvgKpa = Number((d as any)?.qsikWeightedAvgKpa);
  const Qpk = Number((d as any)?.Qpk);
  const Qsk = Number((d as any)?.Qsk);
  const Quk = Number((d as any)?.Quk);
  const contributions = Array.isArray((d as any)?.sideContributions) ? (d as any).sideContributions : [];

  const out: string[] = [];
  out.push('');
  out.push('**计算公式：**');
  out.push('');
  out.push('- Quk = Qpk + Qsk');
  out.push('- Qpk = qpk × Ap');
  if (Number.isFinite(betaC) && betaC > 0 && betaC !== 1) {
    out.push('- Qsk = βc × Σ(u × qsik × li)');
  } else {
    out.push('- Qsk = Σ(u × qsik × li)');
  }

  out.push('');
  out.push('**参数取值：**');
  out.push('');
  out.push(`- u（周长）= ${Number.isFinite(u) ? u.toFixed(4) : '（空）'} m`);
  out.push(`- Ap（桩端面积）= ${Number.isFinite(Ap) ? Ap.toFixed(4) : '（空）'} ㎡`);
  out.push(`- qpk（桩端阻力标准值）= ${Number.isFinite(qpk) ? qpk.toFixed(0) : '（空）'} kPa`);
  if (Number.isFinite(betaC) && betaC > 0 && betaC !== 1) {
    out.push(`- qsik 加权平均 = ${Number.isFinite(qsikWeightedAvgKpa) ? qsikWeightedAvgKpa.toFixed(2) : '（空）'} kPa`);
    out.push(`- βc = ${betaC.toFixed(3)}`);
  }

  out.push('');
  out.push('**侧阻力分层计算：**');
  out.push('');
  if (contributions.length > 0) {
    contributions.forEach((c: any) => {
      const layerKey = String(c?.layerKey ?? '').trim();
      const li = Number(c?.li);
      const qsik = Number(c?.qsik);
      const Qi = Number(c?.Qi);
      const QiAdj = Number.isFinite(betaC) && betaC > 0 && betaC !== 1 && Number.isFinite(Qi) ? betaC * Qi : NaN;
      out.push(
        `- ${layerKey || '（空）'}: li=${Number.isFinite(li) ? li.toFixed(2) : '（空）'} m, qsik=${Number.isFinite(qsik) ? qsik.toFixed(0) : '（空）'} kPa, u×qsik×li=${Number.isFinite(Qi) ? Qi.toFixed(0) : '（空）'} kN${
          Number.isFinite(betaC) && betaC > 0 && betaC !== 1 ? `, βc×u×qsik×li=${Number.isFinite(QiAdj) ? QiAdj.toFixed(0) : '（空）'} kN` : ''
        }`
      );
    });
  } else {
    out.push('- （空）');
  }

  out.push('');
  out.push('**汇总：**');
  out.push('');
  out.push(
    `- Qpk = qpk×Ap = ${Number.isFinite(qpk) ? qpk.toFixed(0) : '（空）'} × ${Number.isFinite(Ap) ? Ap.toFixed(4) : '（空）'} = ${Number.isFinite(Qpk) ? Qpk.toFixed(0) : '（空）'} kN`
  );
  if (Number.isFinite(betaC) && betaC > 0 && betaC !== 1) {
    out.push(`- Qsk = βc×Σ(u×qsik×li) = ${Number.isFinite(Qsk) ? Qsk.toFixed(0) : '（空）'} kN`);
  } else {
    out.push(`- Qsk = Σ(u×qsik×li) = ${Number.isFinite(Qsk) ? Qsk.toFixed(0) : '（空）'} kN`);
  }
  out.push(
    `- **Quk = Qpk + Qsk = ${Number.isFinite(Qpk) ? Qpk.toFixed(0) : '（空）'} + ${Number.isFinite(Qsk) ? Qsk.toFixed(0) : '（空）'} = ${Number.isFinite(Quk) ? Quk.toFixed(0) : '（空）'} kN**`
  );

  return `\n\n${out.join('\n')}\n`;
};

// 抗拔承载力推导块（Ta = βc×Tsk + Gp = βc×Σ(λi × qsik × u × li) + Gp）
export const buildTensionDerivationBlock = (detail: any): string => {
  const d = detail && typeof detail === 'object' ? detail : null;
  if (!d) {
    return `\n\n（空）\n`;
  }

  const u = Number((d as any)?.u);
  const Ap = Number((d as any)?.Ap);
  const totalLength = Number((d as any)?.totalLength);
  const Tsk = Number((d as any)?.Tsk);
  const Gp = Number((d as any)?.Gp);
  const Ta = Number((d as any)?.Ta);
  const lambdaValues = Array.isArray((d as any)?.lambdaValues) ? (d as any).lambdaValues : [];
  const betaC = Number((d as any)?.betaC);
  const qsikWeightedAvgKpa = Number((d as any)?.qsikWeightedAvgKpa);
  const isSpecialPile = Number.isFinite(betaC) && betaC > 0 && betaC !== 1;

  const out: string[] = [];
  out.push('');
  out.push('**计算公式：**');
  out.push('');
  out.push('- Ta = Tsk + Gp');
  if (isSpecialPile) {
    out.push('- Tsk = βc × Σ(λi × qsik × u × li)  （异型桩侧阻力乘βc）');
  } else {
    out.push('- Tsk = Σ(λi × qsik × u × li)  （侧阻力特征值）');
  }
  out.push('- Gp = γc × Ap × L = 25 × Ap × L  （桩身自重，γc=25kN/m³');
  out.push('');
  out.push('*注：参数表中的侧阻力 qsik 已为特征值，无需再除以安全系数*');

  out.push('');
  out.push('**参数取值：**');
  out.push('');
  out.push(`- u（周长）= ${Number.isFinite(u) ? u.toFixed(4) : '（空）'} m`);
  out.push(`- Ap（桩身截面积）= ${Number.isFinite(Ap) ? Ap.toFixed(4) : '（空）'} ㎡`);
  out.push(`- L（桩长）= ${Number.isFinite(totalLength) ? totalLength.toFixed(2) : '（空）'} m`);
  out.push(`- γc（混凝土重度）= 25 kN/m³`);
  if (isSpecialPile) {
    out.push(`- qsik 加权平均 = ${Number.isFinite(qsikWeightedAvgKpa) ? qsikWeightedAvgKpa.toFixed(2) : '（空）'} kPa`);
    out.push(`- βc = ${betaC.toFixed(3)}`);
  }

  out.push('');
  out.push('**分层抗拔计算（侧阻力）：**');
  out.push('');
  if (lambdaValues.length > 0) {
    out.push('| 土层 | li(m) | qsik(kPa) | λi | λi×qsik×u×li(kN) |');
    out.push('|------|-------|-----------|-----|-------------------|');
    lambdaValues.forEach((c: any) => {
      const layerKey = String(c?.layerKey ?? '').trim();
      const li = Number(c?.li);
      const qsik = Number(c?.qsik);
      const lambda = Number(c?.lambda);
      const contribution = Number(c?.contribution);
      out.push(
        `| ${layerKey || '（空）'} | ${Number.isFinite(li) ? li.toFixed(2) : '（空）'} | ${Number.isFinite(qsik) ? qsik.toFixed(0) : '（空）'} | ${Number.isFinite(lambda) ? lambda.toFixed(2) : '（空）'} | ${Number.isFinite(contribution) ? contribution.toFixed(0) : '（空）'} |`
      );
    });
  } else {
    out.push('- （空）');
  }

  out.push('');
  out.push('**汇总：**');
  out.push('');
  if (isSpecialPile) {
    const Tsk0 = Tsk / betaC;
    out.push(
      `- Σ(λi×qsik×u×li) = ${Number.isFinite(Tsk0) ? Tsk0.toFixed(0) : '（空）'} kN`
    );
    out.push(
      `- Tsk = βc × Σ(λi×qsik×u×li) = ${betaC.toFixed(3)} × ${Number.isFinite(Tsk0) ? Tsk0.toFixed(0) : '（空）'} = ${Number.isFinite(Tsk) ? Tsk.toFixed(0) : '（空）'} kN`
    );
  } else {
    out.push(
      `- Tsk = Σ(λi×qsik×u×li) = ${Number.isFinite(Tsk) ? Tsk.toFixed(0) : '（空）'} kN`
    );
  }
  out.push(
    `- Gp = 25 × ${Number.isFinite(Ap) ? Ap.toFixed(4) : '（空）'} × ${Number.isFinite(totalLength) ? totalLength.toFixed(2) : '（空）'} = ${Number.isFinite(Gp) ? Gp.toFixed(0) : '（空）'} kN`
  );
  out.push(
    `- **Ta = Tsk + Gp = ${Number.isFinite(Tsk) ? Tsk.toFixed(0) : '（空）'} + ${Number.isFinite(Gp) ? Gp.toFixed(0) : '（空）'} = ${Number.isFinite(Ta) ? Ta.toFixed(0) : '（空）'} kN**`
  );

  return `\n\n${out.join('\n')}\n`;
};
