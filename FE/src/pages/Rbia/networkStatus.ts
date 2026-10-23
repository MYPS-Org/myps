// tOptionInfraNetworkStatus: 1 = RBIA (migrated), 2 = MYPS (created here). Rows added before the
// Add endpoints set it were saved with 0; they were created in MYPS too. Mirrors the BE's
// FutureInfraController.IsCreatedInMyps, which refuses Edit and Delete on RBIA rows.
export const isCreatedInMyps = (row: { NetworkStatusId: number }) =>
  row.NetworkStatusId === 2 || row.NetworkStatusId === 0;

export const RBIA_READ_ONLY_TITLE = 'Maintained in RBIA: it cannot be edited or deleted in MYPS';
