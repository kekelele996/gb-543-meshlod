export const LOD_STRATEGIES = ['ratio_chain', 'target_error', 'adaptive'] as const;
export type LodStrategy = (typeof LOD_STRATEGIES)[number];

export const LOD_STRATEGY_LABELS: Record<LodStrategy, string> = {
  ratio_chain: '比例链',
  target_error: '误差预算',
  adaptive: '自适应面数',
};

export const LOD_STRATEGY_HINTS: Record<LodStrategy, string> = {
  ratio_chain: '按给定比例链逐级减面（100/50/25/10）',
  target_error: '按屏幕空间误差预算推导级数与比例',
  adaptive: '按面数上下限自动分配各级目标',
};
