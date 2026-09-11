export const LABEL_CHOICES = {
  source: '来源名称', ccf: 'CCF 国际 A/B/C', 'ccf-chinese': 'CCF 中文 T1/T2/T3',
  cas: '中科院分区', 'cas-upgraded': '中科院升级版', 'cas-discipline': '中科院学科分区',
  'jcr-quartile': 'JCR 分区', 'new-rising': '新锐分区', indexing: 'SCI / EI 等检索',
  'pku-core': '北大中文核心', cssci: 'CSSCI 来源', 'cssci-extended': 'CSSCI 扩展',
  cstpcd: '中国科技核心', 'cscd-core': 'CSCD 核心', 'cscd-extended': 'CSCD 扩展',
  'cast-tier': '中国科协（含管理学科）', 'impact-factor': '影响因子', school: '学校等级',
  sjr: 'SJR', 'publication-type': '期刊类型', warning: '预警', note: '其他标签',
} as const;

export interface LabelDisplaySettings {
  hiddenKinds: string[];
  showEdition: boolean;
  hiddenSchools?: string[];
}

export function normalizeLabelDisplay(value: unknown): LabelDisplaySettings {
  const input = value && typeof value === 'object' ? value as Partial<LabelDisplaySettings> : {};
  return {
    hiddenKinds: Array.isArray(input.hiddenKinds)
      ? [...new Set(input.hiddenKinds.filter((key): key is string => typeof key === 'string' && Object.hasOwn(LABEL_CHOICES, key)))] : [],
    showEdition: input.showEdition !== false,
    ...(Array.isArray(input.hiddenSchools) ? { hiddenSchools: [...new Set(input.hiddenSchools.filter((name): name is string => typeof name === 'string'))] } : {}),
  };
}

let active = normalizeLabelDisplay(undefined);
export function setLabelDisplay(value: unknown): void { active = normalizeLabelDisplay(value); }
export function getLabelDisplay(): LabelDisplaySettings { return active; }
